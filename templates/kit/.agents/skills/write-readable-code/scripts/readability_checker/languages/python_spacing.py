# Validates generous boundaries around Python functions.
# Keeps syntax-aware spacing separate from generic checks.

from __future__ import annotations

import ast
from pathlib import Path
from typing import Sequence

from ..models import ERROR, WARNING, Finding


# Identify syntax nodes that declare Python functions.
FUNCTION_NODES = (ast.FunctionDef, ast.AsyncFunctionDef)



def function_start_line(node: ast.FunctionDef | ast.AsyncFunctionDef) -> int:
    """Find a function's earliest declaration line.

    Purpose:
        Include decorators within the function boundary.

    Inputs:
        node: Parsed function declaration.

    Output:
        One-based starting line.
    """

    # Include decorators attached to the declaration.
    decorator_lines = [decorator.lineno for decorator in node.decorator_list]
    return min([node.lineno, *decorator_lines])



def preceding_empty_lines(lines: Sequence[str], start_line: int) -> int:
    """Count empty lines immediately before a declaration.

    Purpose:
        Measure visible separation without counting comments.

    Inputs:
        lines: Physical source lines.
        start_line: One-based declaration line.

    Output:
        Consecutive preceding empty-line count.
    """

    # Walk backward until meaningful content appears.
    count = 0
    index = start_line - 2
    while index >= 0 and not lines[index].strip():
        count += 1
        index -= 1
    return count



def is_main_guard(node: ast.stmt) -> bool:
    """Recognize a conventional Python module guard.

    Purpose:
        Classify bootstrap code as a distinct subject.

    Inputs:
        node: Parsed module statement.

    Output:
        True for an executable module guard.
    """

    # Match either ordering of the name comparison.
    if not isinstance(node, ast.If) or not isinstance(node.test, ast.Compare):
        return False
    rendered = ast.unparse(node.test)
    return "__name__" in rendered and "__main__" in rendered



def check_function_pairs(
    path: Path,
    lines: Sequence[str],
    statements: Sequence[ast.stmt],
    module_scope: bool,
) -> list[Finding]:
    """Check adjacent function and bootstrap boundaries.

    Purpose:
        Enforce generous spacing between readable subjects.

    Inputs:
        path: Inspected Python path.
        lines: Physical source lines.
        statements: Statements sharing one body.
        module_scope: Whether statements belong to the module.

    Output:
        Under-spaced boundary findings.
    """

    # Compare adjacent declarations within one lexical body.
    findings: list[Finding] = []
    for previous, current in zip(statements, statements[1:]):
        if isinstance(previous, FUNCTION_NODES) and isinstance(current, FUNCTION_NODES):
            start_line = function_start_line(current)
            found = preceding_empty_lines(lines, start_line)
            if found < 3:
                message = f"Leave three blank lines before {current.name}; found {found}."
                findings.append(Finding(path, start_line, ERROR, "layout/function-spacing", message))
            continue

        # Give module execution its strongest subject boundary.
        if module_scope and isinstance(previous, FUNCTION_NODES) and is_main_guard(current):
            if preceding_empty_lines(lines, current.lineno) < 4:
                message = "Leave four blank lines before the module bootstrap."
                findings.append(Finding(path, current.lineno, ERROR, "layout/subject-spacing", message))
    return findings



def check_python_spacing(path: Path, lines: Sequence[str]) -> list[Finding]:
    """Check syntax-aware Python whitespace boundaries.

    Purpose:
        Validate function spacing without language heuristics.

    Inputs:
        path: Inspected source path.
        lines: Physical source lines.

    Output:
        Python spacing findings.
    """

    # Ignore source languages handled only by generic checks.
    if path.suffix.lower() != ".py":
        return []

    # Parse complete Python before inspecting lexical bodies.
    try:
        tree = ast.parse("\n".join(lines))
    except SyntaxError as error:
        message = f"Unable to inspect Python spacing: {error.msg}"
        return [Finding(path, error.lineno or 0, WARNING, "setup/python-syntax", message)]

    # Inspect each statement body containing adjacent functions.
    findings = check_function_pairs(path, lines, tree.body, module_scope=True)
    for node in ast.walk(tree):
        statements = getattr(node, "body", None)
        if node is not tree and isinstance(statements, list):
            findings.extend(check_function_pairs(path, lines, statements, module_scope=False))
    return findings
