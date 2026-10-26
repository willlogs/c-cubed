# Tests the TypeScript analyzer bridge on large and failing runs.
# Run with npm run test:skills from the repository root.

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.dont_write_bytecode = True

from readability_checker.languages import typescript  # noqa: E402


# Use enough long paths to pass the pipe buffer.
FILE_COUNT = 400
UNDOCUMENTED = "export function add(a: number, b: number) {\n  return a + b;\n}\n"



class TypeScriptBridgeTests(unittest.TestCase):
    """Covers big stdin target lists and analyzer crash reporting."""

    def make_targets(self, root: Path) -> list[Path]:
        """Create many undocumented TypeScript files under long paths.

        Purpose:
            Produce a target list larger than the pipe buffer.

        Inputs:
            root: Temporary folder that holds the files.

        Output:
            Paths of the created files.
        """

        # Long folder names push the list past 64 KB.
        folder = root / ("long-folder-name-" * 10)
        folder.mkdir()
        paths = []
        for index in range(FILE_COUNT):
            path = folder / f"{'file-name-' * 3}{index}.ts"
            path.write_text(UNDOCUMENTED)
            paths.append(path)
        return paths




    def test_large_target_list_yields_findings(self):
        """Pipe more than 64 KB of targets and expect findings.

        Purpose:
            Guard against the EAGAIN stdin failure.

        Inputs:
            None.

        Output:
            None; asserts on the analyzer findings.
        """

        # Skip the check when Node is missing.
        if not subprocess.run(["which", "node"], capture_output=True).stdout:
            self.skipTest("node is unavailable")
        with tempfile.TemporaryDirectory() as tmp:
            paths = self.make_targets(Path(tmp))
            self.assertGreater(len("\n".join(str(p) for p in paths)), 65536)
            findings = typescript.inspect_typescript_files(paths, None)

        # Real findings, not a setup warning, must come back.
        self.assertGreater(len(findings), FILE_COUNT)
        self.assertFalse(any(f.rule.startswith("setup/") for f in findings))




    def test_analyzer_crash_becomes_setup_error(self):
        """A non-zero analyzer exit must fail the run.

        Purpose:
            Keep a crashed analyzer from hiding every rule.

        Inputs:
            None.

        Output:
            None; asserts on the setup error.
        """

        # Fake a crashed Node process with empty stdout.
        crashed = subprocess.CompletedProcess([], 1, stdout="", stderr="boom: EAGAIN\nstack")
        with mock.patch.object(typescript.subprocess, "run", return_value=crashed):
            findings = typescript.inspect_typescript_files([Path(__file__)], None)

        # The error carries the first stderr line.
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0].rule, "setup/typescript")
        self.assertEqual(findings[0].level, typescript.ERROR)
        self.assertIn("boom: EAGAIN", findings[0].message)



if __name__ == "__main__":
    unittest.main()
