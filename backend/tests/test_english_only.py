"""Fail if any project text file contains Cyrillic (all jury-visible text is English)."""

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXTENSIONS = {".py", ".json", ".geojson", ".md", ".txt", ".toml", ".yml"}
SKIP_DIRS = {"docs", ".venv", ".git", "__pycache__", ".pytest_cache", ".ruff_cache"}
SKIP_FILES = {"CLAUDE.md"}


def _is_cyrillic(ch: str) -> bool:
    return 0x0400 <= ord(ch) <= 0x04FF


def _find_cyrillic() -> list[str]:
    hits: list[str] = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            path = Path(dirpath) / name
            if path.suffix not in EXTENSIONS or name in SKIP_FILES:
                continue
            text = path.read_text(encoding="utf-8")
            for lineno, line in enumerate(text.splitlines(), start=1):
                if any(_is_cyrillic(ch) for ch in line):
                    hits.append(f"{path.relative_to(ROOT)}:{lineno}: {line.strip()}")
    return hits


def test_no_cyrillic_in_project_files():
    hits = _find_cyrillic()
    assert not hits, "Cyrillic text found:\n" + "\n".join(hits)
