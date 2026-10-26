# Discovers readable source targets and loads their content.
# Isolates filesystem traversal from validation rules.

from __future__ import annotations

import os
from pathlib import Path
from typing import Iterable, Sequence

from ..models import ERROR, WARNING, Finding
from ..text.settings import GENERATED_MARKERS, IGNORED_DIRECTORIES, SOURCE_SUFFIXES



def is_skipped_directory(name: str) -> bool:
    """Decide whether traversal should skip one folder.

    Purpose:
        Ignore dependencies, build output, and hidden tooling.

    Inputs:
        name: Folder name without parents.

    Output:
        True when the folder holds no handwritten source.
    """

    # Skip hidden folders and machine-owned trees.
    return name.startswith(".") or name in IGNORED_DIRECTORIES



def collect_source_files(paths: Sequence[Path]) -> tuple[list[Path], list[Finding]]:
    """Collect supported source files from target paths.

    Purpose:
        Normalize file and directory inputs deterministically.

    Inputs:
        paths: Requested files or directories.

    Output:
        Sorted files and discovery findings.
    """

    # Accept explicit files, reporting unusable targets.
    files: set[Path] = set()
    findings: list[Finding] = []
    for path in paths:
        if not path.exists():
            findings.append(Finding(path, 0, ERROR, "setup/target", "Target path does not exist."))
            continue
        if path.is_file():
            if path.suffix.lower() in SOURCE_SUFFIXES:
                files.add(path)
            else:
                findings.append(Finding(path, 0, WARNING, "setup/target", "Unsupported format skipped."))
            continue

        # Prune skipped folders before recursive traversal.
        for root, directory_names, file_names in os.walk(path):
            directory_names[:] = [name for name in directory_names if not is_skipped_directory(name)]
            for file_name in file_names:
                candidate = Path(root) / file_name
                if candidate.suffix.lower() in SOURCE_SUFFIXES:
                    files.add(candidate)

    # Stabilize validation and reporting order.
    return sorted(files), findings



def within_targets(path: Path, targets: Iterable[Path]) -> bool:
    """Check whether a path sits inside requested targets.

    Purpose:
        Narrow change-mode files to requested folders.

    Inputs:
        path: Absolute candidate path.
        targets: Absolute requested files or folders.

    Output:
        True when any target contains the path.
    """

    # Accept exact matches and descendants.
    return any(path == target or target in path.parents for target in targets)



def is_ignored_path(path: Path, root: Path) -> bool:
    """Check whether a skipped folder contains a path.

    Purpose:
        Apply traversal exclusions to change-mode files.

    Inputs:
        path: Absolute candidate file.
        root: Absolute repository root.

    Output:
        True when an ancestor folder is skipped.
    """

    # Inspect only folders between root and file.
    try:
        parts = path.relative_to(root).parts[:-1]
    except ValueError:
        return False
    return any(is_skipped_directory(part) for part in parts)



def read_source_lines(path: Path) -> tuple[list[str], Finding | None]:
    """Read one UTF-8 source file safely.

    Purpose:
        Convert source content into physical lines.

    Inputs:
        path: Source file to inspect.

    Output:
        Source lines and an optional error.
    """

    # Read source without normalizing physical lines.
    try:
        return path.read_text(encoding="utf-8").splitlines(), None
    except (OSError, UnicodeError) as error:
        return [], Finding(path, 0, ERROR, "setup/read", f"Unable to read source: {error}")



def is_generated_source(lines: Sequence[str]) -> bool:
    """Detect common generated-source ownership markers.

    Purpose:
        Avoid reporting machine-owned source files.

    Inputs:
        lines: Physical source lines.

    Output:
        True when generated ownership is declared.
    """

    # Search only the conventional header region.
    header = "\n".join(lines[:20]).lower()
    return any(marker in header for marker in GENERATED_MARKERS)
