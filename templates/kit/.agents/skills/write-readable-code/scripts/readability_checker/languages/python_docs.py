# Validates hover-ready documentation for Python functions.
# Keeps documentation checks independent from spacing rules.

from __future__ import annotations

import ast
import re
from pathlib import Path
from typing import Sequence

from ..models import ERROR, Finding


# Define recognized functions and documentation section labels.
FUNCTION_NODES = (ast.FunctionDef, ast.AsyncFunctionDef)
INPUT_HEADINGS = ("inputs:", "args:", "arguments:", "parameters:")
OUTPUT_HEADINGS = ("output:", "returns:", "yields:")



def function_parameters(node: ast.FunctionDef | ast.AsyncFunctionDef) -> list[str]:
    """Collect user-provided function parameter names.

    Purpose:
        Compare declared inputs with hover documentation.

    Inputs:
        node: Parsed function declaration.

    Output:
        Parameters excluding implicit instance receivers.
    """

    # Combine every supported Python parameter category.
    arguments = [*node.args.posonlyargs, *node.args.args, *node.args.kwonlyargs]
    names = [argument.arg for argument in arguments]
    if node.args.vararg is not None:
        names.append(node.args.vararg.arg)
    if node.args.kwarg is not None:
        names.append(node.args.kwarg.arg)
    return [name for name in names if name not in {"self", "cls"}]



def missing_sections(node: ast.FunctionDef | ast.AsyncFunctionDef, docstring: str) -> list[str]:
    """List documentation sections one function lacks.

    Purpose:
        Report every gap in a single finding.

    Inputs:
        node: Parsed function declaration.
        docstring: Raw function docstring.

    Output:
        Human-readable missing section names.
    """

    # Check purpose, input, and output headings.
    lowered = docstring.lower()
    missing: list[str] = []
    if "purpose:" not in lowered:
        missing.append("Purpose")
    if not any(heading in lowered for heading in INPUT_HEADINGS):
        missing.append("Inputs")
    if not any(heading in lowered for heading in OUTPUT_HEADINGS):
        missing.append("Output")

    # Confirm every parameter, or explicit absence, appears.
    parameters = function_parameters(node)
    for parameter in parameters:
        if re.search(rf"\b{re.escape(parameter)}\b", docstring) is None:
            missing.append(f"parameter {parameter}")
    if not parameters and re.search(r"\bnone\b", lowered) is None:
        missing.append("explicit None input")
    return missing



def check_function_documentation(
    path: Path,
    node: ast.FunctionDef | ast.AsyncFunctionDef,
) -> list[Finding]:
    """Check one Python function's hover documentation.

    Purpose:
        Require description, purpose, inputs, and output.

    Inputs:
        path: Inspected Python path.
        node: Parsed function declaration.

    Output:
        Documentation findings for one function.
    """

    # Require a language-server-visible function docstring.
    span_end = node.end_lineno or node.lineno
    docstring = ast.get_docstring(node, clean=False)
    if not docstring:
        message = f"Function {node.name} needs a docstring with Purpose, Inputs, Output."
        return [Finding(path, node.lineno, ERROR, "doc/missing", message, end_line=span_end)]

    # Report every missing section together.
    missing = missing_sections(node, docstring)
    if not missing:
        return []
    message = f"Function {node.name} docstring lacks {', '.join(missing)}."
    return [Finding(path, node.lineno, ERROR, "doc/sections", message, end_line=span_end)]



def check_python_documentation(path: Path, lines: Sequence[str]) -> list[Finding]:
    """Check every Python function's hover documentation.

    Purpose:
        Apply documentation requirements syntax-aware.

    Inputs:
        path: Inspected source path.
        lines: Physical source lines.

    Output:
        Python documentation findings.
    """

    # Ignore other languages and unparseable Python.
    if path.suffix.lower() != ".py":
        return []
    try:
        tree = ast.parse("\n".join(lines))
    except SyntaxError:
        return []

    # Validate every nested and top-level function.
    findings: list[Finding] = []
    for node in ast.walk(tree):
        if isinstance(node, FUNCTION_NODES):
            findings.extend(check_function_documentation(path, node))
    return findings
