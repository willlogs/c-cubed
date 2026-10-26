# Enforces shallow folders with a bounded number of files.
# Keeps navigation checks separate from per-file rules.

from __future__ import annotations

import os
from pathlib import Path
from typing import Iterable

from ..models import ERROR, Finding
from ..text.settings import MANIFEST_FILES, SOURCE_SUFFIXES
from .discovery import is_skipped_directory



def visible_files(folder: Path) -> list[Path]:
    """List regular, non-hidden files directly inside a folder.

    Purpose:
        Count only files a teammate sees while browsing.

    Inputs:
        folder: Folder to inspect.

    Output:
        Sorted visible file paths.
    """

    # Ignore dotfiles such as editor or keep markers.
    try:
        entries = sorted(folder.iterdir())
    except OSError:
        return []
    return [entry for entry in entries if entry.is_file() and not entry.name.startswith(".")]



def walk_folders(paths: Iterable[Path]) -> list[Path]:
    """Collect folders under targets, skipping machine-owned trees.

    Purpose:
        Choose folders for full-scan fan-out checks.

    Inputs:
        paths: Requested files or directories.

    Output:
        Sorted unique folders to inspect.
    """

    # Include file parents and every walked source folder.
    folders: set[Path] = set()
    for path in paths:
        if path.is_file():
            folders.add(path.parent)
            continue
        for root, names, _ in os.walk(path):
            names[:] = [name for name in names if not is_skipped_directory(name)]
            folders.add(Path(root))
    return sorted(folders)



def check_folder_sizes(
    folders: Iterable[Path],
    limit: int,
    added: set[Path] | None = None,
) -> list[Finding]:
    """Report source folders holding more files than allowed.

    Purpose:
        Force grouping into named subfolders before sprawl.

    Inputs:
        folders: Candidate folders to inspect.
        limit: Maximum visible files per folder.
        added: New absolute files, when scoping a change.

    Output:
        Folder fan-out findings.
    """

    # Evaluate source folders, skipping tool-dictated project roots.
    findings: list[Finding] = []
    for folder in sorted(set(folders)):
        files = visible_files(folder)
        has_source = any(file.suffix.lower() in SOURCE_SUFFIXES for file in files)
        is_project_root = any(file.name in MANIFEST_FILES for file in files)
        if len(files) <= limit or not has_source or is_project_root:
            continue

        # Label folders this change pushed over the limit.
        scope = ""
        if added is not None:
            existing = sum(1 for file in files if file.resolve() not in added)
            scope = "new" if existing <= limit else "touched"
        message = f"Folder holds {len(files)} files; group them into subfolders of {limit} or fewer."
        findings.append(Finding(folder, 0, ERROR, "structure/folder-files", message, scope=scope))
    return findings
