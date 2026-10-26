# Formats findings and summaries for terminals and editors.
# Keeps presentation separate from validation logic.

from __future__ import annotations

from pathlib import Path
from typing import Sequence

from .models import ERROR, WARNING, Finding


# Mark findings that sit in edited legacy code.
SCOPE_SUFFIXES = {"touched": " (touched legacy code)"}



def display_path(path: Path) -> str:
    """Render a path relative to the working directory.

    Purpose:
        Keep diagnostics short and clickable in editors.

    Inputs:
        path: Finding path to render.

    Output:
        Relative path when possible, otherwise absolute.
    """

    # Prefer relative paths inside the working directory.
    absolute = path.resolve()
    try:
        return str(absolute.relative_to(Path.cwd()))
    except ValueError:
        return str(absolute)



def finding_sort_key(finding: Finding) -> tuple[str, int, int, str]:
    """Build a stable finding sort key.

    Purpose:
        Keep diagnostics deterministic across runs.

    Inputs:
        finding: Structured validation result.

    Output:
        Path, line, column, and rule key.
    """

    # Order diagnostics for predictable review.
    return display_path(finding.path), finding.line, finding.column, finding.rule



def format_finding(finding: Finding) -> str:
    """Format one finding as an editor-friendly line.

    Purpose:
        Produce stable location, rule, and message output.

    Inputs:
        finding: Structured validation result.

    Output:
        Printable diagnostic line.
    """

    # Include line and column only when meaningful.
    location = display_path(finding.path)
    if finding.line:
        location = f"{location}:{finding.line}:{finding.column}"
    suffix = SCOPE_SUFFIXES.get(finding.scope, "")
    return f"{location}: {finding.level}: [{finding.rule}] {finding.message}{suffix}"



def print_report(findings: Sequence[Finding], file_count: int, mode: str, hidden: int) -> int:
    """Print findings and a summary, returning exit status.

    Purpose:
        Give humans and automation one consistent outcome.

    Inputs:
        findings: Findings to print.
        file_count: Number of inspected files.
        mode: Description of the inspected scope.
        hidden: Pre-existing findings hidden by change scoping.

    Output:
        Zero without errors, otherwise one.

    Side effects:
        Prints diagnostics and the summary line.
    """

    # Print stable diagnostics before the summary.
    for finding in sorted(findings, key=finding_sort_key):
        print(format_finding(finding))

    # Summarize severities and change classifications.
    errors = sum(finding.level == ERROR for finding in findings)
    warnings = sum(finding.level == WARNING for finding in findings)
    touched = sum(finding.scope == "touched" for finding in findings)
    summary = f"Checked {file_count} files ({mode}): {errors} errors, {warnings} warnings."
    if touched:
        summary += f" {touched} sit in touched legacy code."
    if hidden:
        summary += f" Hid {hidden} pre-existing findings outside the change."
    print(summary)
    return 1 if errors else 0
