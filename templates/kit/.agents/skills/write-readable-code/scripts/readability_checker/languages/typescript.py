# Bridges TypeScript-family files to the Node syntax analyzer.
# Keeps subprocess handling apart from rule reporting.

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Sequence

from ..models import ERROR, Finding


# Locate the analyzer shipped beside this Python package.
ANALYZER = Path(__file__).resolve().parents[2] / "ts_analyzer" / "analyze.mjs"



def setup_error(message: str) -> list[Finding]:
    """Build one error about skipped TypeScript checks.

    Purpose:
        Fail the run when TypeScript rules did not run.

    Inputs:
        message: Reason the analyzer could not run.

    Output:
        Single setup error finding.
    """

    # Anchor setup problems at the analyzer itself.
    return [Finding(ANALYZER, 0, ERROR, "setup/typescript", message)]



def parse_finding(raw: dict) -> Finding:
    """Convert one analyzer JSON record into a finding.

    Purpose:
        Normalize Node output into shared Python models.

    Inputs:
        raw: Decoded analyzer finding record.

    Output:
        Equivalent Python finding.
    """

    # Copy fields while keeping defaults for optional ones.
    return Finding(
        path=Path(raw["path"]),
        line=int(raw["line"]),
        level=raw["level"],
        rule=raw["rule"],
        message=raw["message"],
        end_line=int(raw.get("endLine", 0)),
        column=int(raw.get("column", 1)),
    )



def inspect_typescript_files(paths: Sequence[Path], typescript_dir: str | None) -> list[Finding]:
    """Run TypeScript-aware rules for many files at once.

    Purpose:
        Check documentation, step comments, and function spacing.

    Inputs:
        paths: TypeScript-family files to analyze.
        typescript_dir: Optional folder that provides typescript.

    Output:
        Analyzer findings, or one setup error.

    Side effects:
        Starts one Node process and prints analyzer notes.
    """

    # Skip quietly when no TypeScript-family files exist.
    if not paths:
        return []
    node = shutil.which("node")
    if node is None:
        return setup_error("Node is unavailable; TypeScript checks were skipped.")

    # Stream targets through stdin to avoid argument limits.
    command = [node, str(ANALYZER)]
    if typescript_dir:
        command += ["--typescript", typescript_dir]
    targets = "\n".join(str(path.resolve()) for path in paths)
    result = subprocess.run(command, input=targets, capture_output=True, text=True, check=False)

    # Surface crashes instead of treating empty output as no findings.
    if result.returncode != 0 or not result.stdout.strip():
        reason = (result.stderr.strip().splitlines() or ["no output"])[0][:300]
        return setup_error(f"Analyzer failed (exit {result.returncode}): {reason}")

    # Decode analyzer output and surface setup failures.
    try:
        payload = json.loads(result.stdout or "{}")
    except json.JSONDecodeError:
        return setup_error(f"Analyzer output was unreadable: {result.stderr.strip()[:300]}")
    if payload.get("error"):
        return setup_error(payload["error"])
    for note in payload.get("notes", []):
        print(f"note: {note}", file=sys.stderr)
    return [parse_finding(raw) for raw in payload.get("findings", [])]
