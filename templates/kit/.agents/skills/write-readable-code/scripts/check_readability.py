# Runs readability validation from one stable script path.
# Keeps package internals hidden from skill users.

import sys

# Keep bytecode caches out of the skill folder.
sys.dont_write_bytecode = True

from readability_checker.cli import main  # noqa: E402




if __name__ == "__main__":
    # Return validation status to the invoking process.
    raise SystemExit(main())
