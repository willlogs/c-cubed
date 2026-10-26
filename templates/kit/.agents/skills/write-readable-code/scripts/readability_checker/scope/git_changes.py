# Reads which files and lines changed since a git base.
# Keeps git plumbing apart from finding classification.

from __future__ import annotations

import re
import subprocess
from dataclasses import dataclass, field
from pathlib import Path


# Match unified diff targets, hunk ranges, and edit statuses.
TARGET_HEADER = re.compile(r"^\+\+\+ b/(.+)$")
HUNK_HEADER = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@")
MODIFIED_CODES = frozenset({"M", "R", "T"})


# Describe which files and lines one change introduced.
@dataclass
class ChangeScope:
    """Hold the files and added lines of one change.

    Purpose:
        Classify findings as new, touched, or pre-existing.

    Inputs:
        base: Git revision the change is measured against.
        root: Repository root for resolving git paths.
        new_files: Added or untracked absolute paths.
        added_lines: Added line numbers per modified file.
        base_names: Base-revision path per modified file.

    Output:
        Mutable change description.
    """

    base: str
    root: Path
    new_files: set[Path] = field(default_factory=set)
    added_lines: dict[Path, set[int]] = field(default_factory=dict)
    base_names: dict[Path, str] = field(default_factory=dict)



    @property
    def files(self) -> set[Path]:
        """Return every file the change created or modified.

        Purpose:
            Choose inspection targets in change mode.

        Inputs:
            None.

        Output:
            Absolute changed file paths.
        """

        # Combine wholly new and partially edited files.
        return self.new_files | set(self.added_lines)



def git(root: Path, *arguments: str) -> str:
    """Run one read-only git command.

    Purpose:
        Centralize git invocation and failure reporting.

    Inputs:
        root: Directory where git runs.
        arguments: Git arguments after the executable.

    Output:
        Command standard output.
    """

    # Raise readable errors for missing refs or repositories.
    command = ["git", "-c", "core.quotePath=false", *arguments]
    result = subprocess.run(command, cwd=root, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(f"git {' '.join(arguments)} failed: {result.stderr.strip()}")
    return result.stdout



def parse_added_lines(diff: str, root: Path) -> dict[Path, set[int]]:
    """Collect added line numbers per file from a diff.

    Purpose:
        Locate exactly which lines the change wrote.

    Inputs:
        diff: Unified diff text with zero context.
        root: Repository root for resolving paths.

    Output:
        Added line numbers keyed by absolute path.
    """

    # Walk target headers, then record each hunk's new lines.
    added: dict[Path, set[int]] = {}
    current: set[int] | None = None
    for line in diff.splitlines():
        target = TARGET_HEADER.match(line)
        if target:
            current = added.setdefault((root / target.group(1)).resolve(), set())
            continue
        hunk = HUNK_HEADER.match(line)
        if hunk and current is not None:
            start, count = int(hunk.group(1)), int(hunk.group(2) or "1")
            current.update(range(start, start + count))
    return added



def load_change_scope(since: str | None) -> ChangeScope:
    """Describe the current change relative to its base.

    Purpose:
        Gather new files and added lines for scoping.

    Inputs:
        since: Optional ref for branch-wide comparison.

    Output:
        Populated change scope.

    Side effects:
        Runs read-only git commands.
    """

    # Locate the repository and its comparison base.
    root = Path(git(Path.cwd(), "rev-parse", "--show-toplevel").strip()).resolve()
    base = git(root, "merge-base", since, "HEAD").strip() if since else "HEAD"
    scope = ChangeScope(base=base, root=root)

    # Sort tracked changes into new and modified files.
    for line in git(root, "diff", "--name-status", "--find-renames", base).splitlines():
        parts = line.split("\t")
        target = (root / parts[-1]).resolve()
        if parts[0].startswith("A"):
            scope.new_files.add(target)
        elif parts[0][:1] in MODIFIED_CODES:
            scope.base_names[target] = parts[1]
            scope.added_lines[target] = set()

    # Treat untracked, unignored files as wholly new.
    untracked = git(root, "ls-files", "--others", "--exclude-standard")
    scope.new_files.update((root / name).resolve() for name in untracked.splitlines() if name)

    # Record which lines each modified file gained.
    diff = git(root, "diff", "--unified=0", "--no-color", "--no-ext-diff", "--find-renames",
               "--src-prefix=a/", "--dst-prefix=b/", base)
    for path, lines in parse_added_lines(diff, root).items():
        if path in scope.added_lines:
            scope.added_lines[path] = lines
    return scope
