# Owns command-line parsing and the two validation modes.
# Keeps argument handling apart from inspection and reporting.

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Sequence

from .inspection import inspect_files
from .reporting import print_report
from .scope.classify import scope_findings
from .scope.git_changes import load_change_scope
from .scope.discovery import collect_source_files, is_ignored_path, within_targets
from .scope.folders import check_folder_sizes, walk_folders
from .text.settings import DEFAULT_MAX_FOLDER_FILES, SOURCE_SUFFIXES



def parse_arguments(arguments: Sequence[str] | None = None) -> argparse.Namespace:
    """Parse readability checker arguments.

    Purpose:
        Define targets, change scoping, and analyzer options.

    Inputs:
        arguments: Optional command arguments.

    Output:
        Parsed command namespace.
    """

    # Configure targets and the optional change scope.
    parser = argparse.ArgumentParser(description="Check source against readable-code rules.")
    parser.add_argument("paths", nargs="*", type=Path, help="files or folders to check")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--changed", action="store_true", help="check changes since HEAD")
    mode.add_argument("--since", metavar="REF", help="check changes since merge-base with REF")

    # Configure limits and the TypeScript analyzer.
    parser.add_argument("--max-folder-files", type=int, default=DEFAULT_MAX_FOLDER_FILES)
    parser.add_argument("--typescript", metavar="DIR", help="folder resolving typescript")
    parser.add_argument("--no-typescript", action="store_true", help="skip TypeScript rules")
    options = parser.parse_args(arguments)
    if not options.paths and not (options.changed or options.since):
        parser.error("pass paths, --changed, or --since REF")
    return options



def run_full(options: argparse.Namespace) -> int:
    """Check every source file under the requested paths.

    Purpose:
        Audit whole folders, including legacy findings.

    Inputs:
        options: Parsed command namespace.

    Output:
        Process exit status.
    """

    # Inspect discovered files, then folder fan-out.
    files, findings = collect_source_files(options.paths)
    findings.extend(inspect_files(files, options.typescript, not options.no_typescript))
    findings.extend(check_folder_sizes(walk_folders(options.paths), options.max_folder_files))
    return print_report(findings, len(files), "full scan", 0)



def run_changed(options: argparse.Namespace) -> int:
    """Check only files and lines in the current change.

    Purpose:
        Report debt the change created or touched.

    Inputs:
        options: Parsed command namespace.

    Output:
        Process exit status.
    """

    # Describe the change and select its handwritten files.
    scope = load_change_scope(options.since)
    targets = [path.resolve() for path in options.paths] or [scope.root]
    changed = [path for path in scope.files
               if path.exists() and within_targets(path, targets) and not is_ignored_path(path, scope.root)]
    files = sorted(path for path in changed if path.suffix.lower() in SOURCE_SUFFIXES)

    # Inspect changed files and folders gaining new files.
    findings = inspect_files(files, options.typescript, not options.no_typescript)
    added = {path for path in changed if path in scope.new_files}
    findings.extend(check_folder_sizes({path.parent for path in added}, options.max_folder_files, added))

    # Hide findings outside the change before reporting.
    visible, hidden = scope_findings(scope, findings)
    mode = f"changed since {options.since}" if options.since else "changed since HEAD"
    return print_report(visible, len(files), mode, hidden)



def main(arguments: Sequence[str] | None = None) -> int:
    """Validate requested paths or the current change.

    Purpose:
        Dispatch to full or change-scoped validation.

    Inputs:
        arguments: Optional command arguments.

    Output:
        Zero on success, one on errors, two on setup failure.
    """

    # Run the selected mode, reporting git setup failures.
    options = parse_arguments(arguments)
    try:
        return run_changed(options) if options.changed or options.since else run_full(options)
    except RuntimeError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
