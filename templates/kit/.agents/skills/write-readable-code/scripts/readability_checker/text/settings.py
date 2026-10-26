# Owns language tables and limits for readability validation.
# Keeps recognition data separate from checking logic.

import re


# Bound file size, prose, whitespace, and folder fan-out.
MAX_FILE_LINES = 300
SPLIT_REVIEW_LINES = 200
MAX_COMMENT_WORDS = 10
MAX_BLANK_RUN = 4
DEFAULT_MAX_FOLDER_FILES = 5

# Identify handwritten source formats inspected during scans.
SOURCE_SUFFIXES = frozenset({
    ".c", ".cc", ".cjs", ".cpp", ".cs", ".css", ".cts", ".dart", ".ex",
    ".exs", ".fs", ".fsx", ".go", ".h", ".hpp", ".html", ".java", ".js",
    ".jsx", ".kt", ".kts", ".lua", ".mjs", ".mts", ".php", ".py", ".rb",
    ".rs", ".scala", ".scss", ".sh", ".sql", ".svelte", ".swift", ".ts",
    ".tsx", ".vue", ".zig",
})

# Route these formats through the TypeScript syntax analyzer.
TYPESCRIPT_SUFFIXES = frozenset({
    ".cjs", ".cts", ".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx",
})

# Exclude dependencies and machine-owned build folders.
IGNORED_DIRECTORIES = frozenset({
    "__pycache__", "build", "coverage", "dist", "generated",
    "node_modules", "target", "vendor",
})

# Exempt project roots, whose files tooling places there.
MANIFEST_FILES = frozenset({
    "Cargo.toml", "Gemfile", "Makefile", "build.gradle", "composer.json",
    "deno.json", "go.mod", "package.json", "pom.xml", "pyproject.toml",
    "requirements.txt", "setup.py", "tsconfig.json",
})

# Detect conventional machine-ownership declarations near file headers.
GENERATED_MARKERS = (
    "automatically generated", "auto-generated", "code generated",
    "do not edit", "generated file",
)

# Skip tool directives, which are not human prose.
DIRECTIVE_PATTERN = re.compile(
    r"^(?:eslint|@ts-|prettier-ignore|istanbul |c8 |biome-ignore|noqa"
    r"|type: ?ignore|pylint:|fmt: |#region|#endregion|@vite-ignore)"
)

# Match words consistently across supported comment syntaxes.
WORD_PATTERN = re.compile(r"[A-Za-z0-9_@]+(?:[-'][A-Za-z0-9_@]+)*")
URL_PATTERN = re.compile(r"\b[a-z][a-z0-9+.-]*://\S+", re.IGNORECASE)
OPENING_COMMENT_PATTERN = re.compile(r"^(?:\"\"\"|'''|//+|#+|--+|/\*+|<!--|\*+)\s*")
CLOSING_COMMENT_PATTERN = re.compile(r"\s*(?:\*/|-->|\"\"\"|''')$")

# Map language families to standalone line-comment prefixes.
HASH_COMMENT_SUFFIXES = frozenset({".ex", ".exs", ".php", ".py", ".rb", ".sh"})
DASH_COMMENT_SUFFIXES = frozenset({".lua", ".sql"})
SLASH_COMMENT_SUFFIXES = frozenset({
    ".c", ".cc", ".cjs", ".cpp", ".cs", ".cts", ".dart", ".fs", ".fsx",
    ".go", ".h", ".hpp", ".java", ".js", ".jsx", ".kt", ".kts", ".mjs",
    ".mts", ".php", ".rs", ".scala", ".scss", ".svelte", ".swift", ".ts",
    ".tsx", ".vue", ".zig",
})
