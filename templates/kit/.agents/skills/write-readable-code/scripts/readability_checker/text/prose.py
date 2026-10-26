# Limits comment prose to short, scannable lines.
# Keeps wording rules apart from comment syntax recognition.

from __future__ import annotations

from pathlib import Path
from typing import Sequence

from ..models import ERROR, Finding
from .comments import iter_comment_lines
from .settings import DIRECTIVE_PATTERN, MAX_COMMENT_WORDS, URL_PATTERN, WORD_PATTERN



def count_prose_words(comment: str) -> int:
    """Count human prose words in one comment line.

    Purpose:
        Ignore tool directives and count URLs once.

    Inputs:
        comment: Comment prose without delimiters.

    Output:
        Countable word total.
    """

    # Exempt machine directives from prose limits.
    if DIRECTIVE_PATTERN.match(comment):
        return 0

    # Collapse each URL into one countable word.
    return len(WORD_PATTERN.findall(URL_PATTERN.sub("url", comment)))



def check_comment_words(path: Path, lines: Sequence[str]) -> list[Finding]:
    """Check standalone comment line lengths.

    Purpose:
        Keep comments concise and visually scannable.

    Inputs:
        path: Inspected source path.
        lines: Physical source lines.

    Output:
        Overlong-comment findings.
    """

    # Count prose words on each recognized comment line.
    findings: list[Finding] = []
    for line_number, comment in iter_comment_lines(path, lines):
        word_count = count_prose_words(comment)
        if word_count > MAX_COMMENT_WORDS:
            message = f"Comment line has {word_count} words; keep it to {MAX_COMMENT_WORDS}."
            findings.append(Finding(path, line_number, ERROR, "comment/words", message))
    return findings
