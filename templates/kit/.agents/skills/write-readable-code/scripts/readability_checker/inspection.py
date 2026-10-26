# Composes per-file and batched checks into one finding list.
# Keeps orchestration separate from command-line handling.

from __future__ import annotations

from pathlib import Path
from typing import Sequence

from .languages.python_docs import check_python_documentation
from .languages.python_spacing import check_python_spacing
from .languages.typescript import inspect_typescript_files
from .models import Finding
from .scope.discovery import is_generated_source, read_source_lines
from .text.prose import check_comment_words
from .text.layout import check_blank_runs, check_file_header, check_line_count
from .text.settings import TYPESCRIPT_SUFFIXES



def inspect_source_file(path: Path) -> tuple[list[Finding], bool]:
    """Run every line-based and Python check on one file.

    Purpose:
        Compose language-agnostic and Python-specific validation.

    Inputs:
        path: Source file to inspect.

    Output:
        Findings, and whether the file is handwritten.
    """

    # Load source content and skip machine-owned files.
    lines, read_error = read_source_lines(path)
    if read_error is not None:
        return [read_error], False
    if is_generated_source(lines):
        return [], False

    # Combine independent structural and prose checks.
    findings = [
        *check_line_count(path, lines),
        *check_blank_runs(path, lines),
        *check_comment_words(path, lines),
        *check_file_header(path, lines),
        *check_python_documentation(path, lines),
        *check_python_spacing(path, lines),
    ]
    return findings, True



def inspect_files(
    paths: Sequence[Path],
    typescript_dir: str | None,
    use_typescript: bool,
) -> list[Finding]:
    """Inspect many files, batching TypeScript analysis.

    Purpose:
        Run each checker family once over its targets.

    Inputs:
        paths: Source files to inspect.
        typescript_dir: Optional folder that provides typescript.
        use_typescript: Whether syntax-aware TypeScript rules run.

    Output:
        Findings from every applicable check.
    """

    # Run per-file checks and collect handwritten TypeScript.
    findings: list[Finding] = []
    typescript_files: list[Path] = []
    for path in paths:
        file_findings, handwritten = inspect_source_file(path)
        findings.extend(file_findings)
        if handwritten and path.suffix.lower() in TYPESCRIPT_SUFFIXES:
            typescript_files.append(path)

    # Analyze TypeScript-family files in one Node process.
    if use_typescript:
        findings.extend(inspect_typescript_files(typescript_files, typescript_dir))
    return findings
