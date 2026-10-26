# Defines shared validation results for checker modules.
# Prevents diagnostic shapes drifting between responsibilities.

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


# Name severities once for consistent reporting.
ERROR = "error"
WARNING = "warning"


# Carry one editor-friendly validation result.
@dataclass(frozen=True)
class Finding:
    """Describe one readability validation result.

    Purpose:
        Carry structured details between validation steps.

    Inputs:
        path: Inspected source file or folder.
        line: First related line, or zero for whole files.
        level: Severity, either error or warning.
        rule: Stable rule identifier, such as doc/sections.
        message: Human-readable explanation naming the fix.
        end_line: Last related line, used for change scoping.
        column: Related column, starting at one.
        scope: Change classification, empty outside change mode.

    Output:
        Immutable validation finding.
    """

    path: Path
    line: int
    level: str
    rule: str
    message: str
    end_line: int = 0
    column: int = 1
    scope: str = ""



    @property
    def last_line(self) -> int:
        """Return the final line covered by this finding.

        Purpose:
            Give change scoping one span for every producer.

        Inputs:
            None.

        Output:
            End line, defaulting to the first line.
        """

        # Treat single-line findings as one-line spans.
        return max(self.end_line, self.line)
