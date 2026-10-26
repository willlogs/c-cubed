# Checks file size, blank runs, and responsibility headers.
# Keeps physical layout rules separate from prose rules.

from __future__ import annotations

from pathlib import Path
from typing import Sequence

from ..models import ERROR, WARNING, Finding
from .comments import count_header_comment_lines, starts_standalone_comment
from .settings import MAX_BLANK_RUN, MAX_FILE_LINES, SPLIT_REVIEW_LINES


# Skip syntax-required prologues before the responsibility header.
PROLOGUE_PREFIXES = ("#!", "<?php", "<?xml", "<!doctype", "<!DOCTYPE", "'use ", '"use ')



def check_line_count(path: Path, lines: Sequence[str]) -> list[Finding]:
    """Check one file's physical line count.

    Purpose:
        Enforce the ceiling and split-review threshold.

    Inputs:
        path: Inspected source path.
        lines: Physical source lines.

    Output:
        Size-related findings.
    """

    # Report the strongest applicable size boundary.
    count = len(lines)
    if count > MAX_FILE_LINES:
        message = f"File has {count} lines; split responsibilities below {MAX_FILE_LINES}."
        return [Finding(path, MAX_FILE_LINES + 1, ERROR, "size/file-lines", message)]
    if count > SPLIT_REVIEW_LINES:
        message = f"File has {count} lines; review splitting by responsibility."
        return [Finding(path, SPLIT_REVIEW_LINES + 1, WARNING, "size/split-review", message)]
    return []



def check_blank_runs(path: Path, lines: Sequence[str]) -> list[Finding]:
    """Check consecutive blank-line separation.

    Purpose:
        Prevent whitespace beyond major-subject separation.

    Inputs:
        path: Inspected source path.
        lines: Physical source lines.

    Output:
        Excessive-whitespace findings.
    """

    # Track blank runs and report each overflow once.
    findings: list[Finding] = []
    blank_count = 0
    for line_number, line in enumerate(lines, start=1):
        blank_count = blank_count + 1 if not line.strip() else 0
        if blank_count == MAX_BLANK_RUN + 1:
            message = f"More than {MAX_BLANK_RUN} consecutive blank lines."
            findings.append(Finding(path, line_number, ERROR, "layout/blank-run", message))
    return findings



def check_file_header(path: Path, lines: Sequence[str]) -> list[Finding]:
    """Check for a top-of-file responsibility comment.

    Purpose:
        Require immediate file ownership context.

    Inputs:
        path: Inspected source path.
        lines: Physical source lines.

    Output:
        Missing or malformed header findings.
    """

    # Skip blank lines and syntax-required file prologues.
    for line_number, line in enumerate(lines[:12], start=1):
        stripped = line.strip()
        if not stripped or stripped.startswith(PROLOGUE_PREFIXES):
            continue
        if "coding:" in stripped or "coding=" in stripped:
            continue

        # Require two or three explanatory header lines.
        if starts_standalone_comment(path, stripped):
            header_lines = count_header_comment_lines(path, lines, line_number - 1)
            if 2 <= header_lines <= 3:
                return []
            message = f"File header has {header_lines} lines; write two or three."
            return [Finding(path, line_number, ERROR, "comment/file-header", message)]
        message = "Start with a two-line responsibility and justification header."
        return [Finding(path, line_number, ERROR, "comment/file-header", message)]
    return [Finding(path, 1, ERROR, "comment/file-header", "Add a responsibility header.")]
