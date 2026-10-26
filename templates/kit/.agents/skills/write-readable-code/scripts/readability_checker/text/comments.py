# Recognizes standalone comments across common source languages.
# Keeps comment syntax apart from prose and layout rules.

from __future__ import annotations

from pathlib import Path
from typing import Iterator, Sequence

from .settings import (
    CLOSING_COMMENT_PATTERN,
    DASH_COMMENT_SUFFIXES,
    HASH_COMMENT_SUFFIXES,
    OPENING_COMMENT_PATTERN,
    SLASH_COMMENT_SUFFIXES,
)


# Pair multiline comment openers with their closers.
BLOCK_DELIMITERS = (("<!--", "-->"), ("/*", "*/"), ('"""', '"""'), ("'''", "'''"))



def line_comment_prefixes(path: Path) -> tuple[str, ...]:
    """Return recognized line comments for one language.

    Purpose:
        Prevent code syntax becoming comment prose accidentally.

    Inputs:
        path: Source path providing language context.

    Output:
        Supported standalone line-comment prefixes.
    """

    # Combine prefixes supported by the source suffix.
    suffix = path.suffix.lower()
    prefixes: list[str] = []
    if suffix in HASH_COMMENT_SUFFIXES:
        prefixes.append("#")
    if suffix in DASH_COMMENT_SUFFIXES:
        prefixes.append("--")
    if suffix in SLASH_COMMENT_SUFFIXES:
        prefixes.append("//")
    return tuple(prefixes)



def block_opening(text: str) -> tuple[str, str] | None:
    """Find the multiline comment form one line opens.

    Purpose:
        Share block recognition between header and prose checks.

    Inputs:
        text: Stripped source line.

    Output:
        Opener and closer pair, or None.
    """

    # Match the first recognized block opener.
    return next((pair for pair in BLOCK_DELIMITERS if text.startswith(pair[0])), None)



def starts_standalone_comment(path: Path, text: str) -> bool:
    """Recognize a standalone source comment opening.

    Purpose:
        Support header and prose validation consistently.

    Inputs:
        path: Source path providing language context.
        text: Stripped source line.

    Output:
        True when the line opens a comment.
    """

    # Accept block openings and language line comments.
    return block_opening(text) is not None or text.startswith(line_comment_prefixes(path))



def clean_comment_text(text: str) -> str:
    """Remove standalone comment syntax from one line.

    Purpose:
        Isolate prose for deterministic word counting.

    Inputs:
        text: Raw standalone comment line.

    Output:
        Comment prose without delimiters.
    """

    # Remove common opening and closing delimiters.
    cleaned = OPENING_COMMENT_PATTERN.sub("", text.strip())
    return CLOSING_COMMENT_PATTERN.sub("", cleaned).strip()



def count_header_comment_lines(path: Path, lines: Sequence[str], start_index: int) -> int:
    """Count explanatory lines in one file header.

    Purpose:
        Enforce concise ownership and boundary justification.

    Inputs:
        path: Source path providing language context.
        lines: Physical source lines.
        start_index: Zero-based header starting line.

    Output:
        Non-empty explanatory comment line count.
    """

    # Count multiline header content through its closer.
    opening = block_opening(lines[start_index].strip())
    if opening is not None:
        opener, closer = opening
        count = 0
        for offset, line in enumerate(lines[start_index:]):
            count += bool(clean_comment_text(line.strip()))
            if closer in line.strip()[len(opener) if offset == 0 else 0 :]:
                break
        return count

    # Count consecutive language-specific header lines.
    prefixes = line_comment_prefixes(path)
    count = 0
    for line in lines[start_index:]:
        stripped = line.strip()
        if not stripped.startswith(prefixes):
            break
        count += bool(clean_comment_text(stripped))
    return count



def iter_comment_lines(path: Path, lines: Sequence[str]) -> Iterator[tuple[int, str]]:
    """Yield standalone comment prose with source lines.

    Purpose:
        Follow line comments, blocks, and docstrings.

    Inputs:
        path: Source path providing language context.
        lines: Physical source lines.

    Output:
        Comment line numbers and prose.
    """

    # Follow standalone comments across block boundaries.
    active_closer: str | None = None
    for line_number, line in enumerate(lines, start=1):
        stripped = line.strip()
        if active_closer is not None:
            yield line_number, clean_comment_text(stripped)
            active_closer = None if active_closer in stripped else active_closer
            continue

        # Open recognized multiline comment forms.
        opening = block_opening(stripped)
        if opening is not None:
            opener, closer = opening
            yield line_number, clean_comment_text(stripped)
            active_closer = None if closer in stripped[len(opener) :] else closer
            continue

        # Yield only language-appropriate line comments.
        if not stripped.startswith("#!") and stripped.startswith(line_comment_prefixes(path)):
            yield line_number, clean_comment_text(stripped)
