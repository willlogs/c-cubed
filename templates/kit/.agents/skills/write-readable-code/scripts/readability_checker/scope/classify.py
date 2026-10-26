# Classifies findings as new, touched, or pre-existing.
# Separates new debt from untouched legacy findings.

from __future__ import annotations

from dataclasses import replace
from pathlib import Path
from typing import Sequence

from ..models import Finding
from .git_changes import ChangeScope, git



def size_change(scope: ChangeScope, path: Path) -> tuple[int, int]:
    """Measure a modified file before and after the change.

    Purpose:
        Judge size findings by growth, not position.

    Inputs:
        scope: Change description.
        path: Absolute modified file.

    Output:
        Base and current physical line counts.
    """

    # Read both revisions and count physical lines.
    before = git(scope.root, "show", f"{scope.base}:{scope.base_names[path]}")
    after = path.read_text(encoding="utf-8", errors="replace")
    return len(before.splitlines()), len(after.splitlines())



def classify(scope: ChangeScope, finding: Finding) -> Finding | None:
    """Classify one finding against the change.

    Purpose:
        Separate new debt from untouched legacy findings.

    Inputs:
        scope: Change description.
        finding: Finding to classify.

    Output:
        Labeled finding, or None when pre-existing.
    """

    # Keep labels from specialized rules and new files.
    path = finding.path.resolve()
    if finding.scope or finding.rule.startswith("setup/"):
        return finding
    if path in scope.new_files:
        return replace(finding, scope="new")
    added = scope.added_lines.get(path)
    if added is None:
        return None

    # Judge file-size findings by growth during the change.
    if finding.rule.startswith("size/"):
        before, after = size_change(scope, path)
        message = f"{finding.message} This change grew it from {before} lines."
        return replace(finding, scope="touched", message=message) if after > before else None

    # Compare the finding span with added lines.
    span = set(range(max(finding.line, 1), finding.last_line + 1))
    overlap = span & added
    if not overlap:
        return None
    return replace(finding, scope="new" if overlap == span else "touched")



def scope_findings(scope: ChangeScope, findings: Sequence[Finding]) -> tuple[list[Finding], int]:
    """Keep findings inside the change, counting the rest.

    Purpose:
        Show only debt this change created or touched.

    Inputs:
        scope: Change description.
        findings: Every finding from changed files.

    Output:
        Visible labeled findings and the hidden count.
    """

    # Classify each finding, counting pre-existing ones.
    visible = [labeled for labeled in (classify(scope, item) for item in findings) if labeled]
    return visible, len(findings) - len(visible)
