#!/usr/bin/env python3
"""
Verify local visual asset references in standalone HTML and CSS projects.

Exit codes:
    0: every local reference resolves
    1: one or more local references are missing
    2: invalid arguments or unreadable source files
"""

from __future__ import annotations

import argparse
import html
import re
import sys
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


SOURCE_SUFFIXES = {".html", ".htm", ".css"}
IGNORED_DIRECTORIES = {
    ".git",
    ".hg",
    ".svn",
    "__pycache__",
    "node_modules",
    "dist",
    "build",
    "coverage",
}
CSS_URL_PATTERN = re.compile(
    r"url\(\s*(?:\"([^\"]+)\"|'([^']+)'|([^)'\"\s][^)]*))\s*\)",
    re.IGNORECASE,
)
SOCIAL_IMAGE_KEYS = {
    "og:image",
    "og:image:url",
    "twitter:image",
    "twitter:image:src",
}
SKIPPED_SCHEMES = {
    "data",
    "blob",
    "http",
    "https",
    "mailto",
    "tel",
    "javascript",
}


@dataclass(frozen=True)
class Reference:
    source: Path
    value: str
    kind: str
    line: int


def split_srcset(value: str) -> list[str]:
    """Return the URL portion of each srcset candidate."""
    value = html.unescape(value.strip())
    if not value or value.lower().startswith("data:"):
        return [value] if value else []

    urls: list[str] = []
    for candidate in value.split(","):
        candidate = candidate.strip()
        if candidate:
            urls.append(candidate.split()[0])
    return urls


def extract_css_references(content: str, source: Path) -> list[Reference]:
    references: list[Reference] = []
    for match in CSS_URL_PATTERN.finditer(content):
        value = next((group for group in match.groups() if group is not None), "")
        line = content.count("\n", 0, match.start()) + 1
        references.append(Reference(source, html.unescape(value.strip()), "css-url", line))
    return references


class HTMLReferenceParser(HTMLParser):
    """Collect visual asset URLs from HTML attributes."""

    def __init__(self, source: Path):
        super().__init__(convert_charrefs=True)
        self.source = source
        self.references: list[Reference] = []

    def add(self, value: str | None, kind: str) -> None:
        if value is None:
            return
        value = value.strip()
        if value:
            self.references.append(Reference(self.source, value, kind, self.getpos()[0]))

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        values = {name.lower(): value for name, value in attrs}

        if tag in {"img", "source"}:
            self.add(values.get("src"), f"{tag}-src")
            for value in split_srcset(values.get("srcset") or ""):
                self.add(value, f"{tag}-srcset")

        if tag == "video":
            self.add(values.get("poster"), "video-poster")

        if tag == "input" and (values.get("type") or "").lower() == "image":
            self.add(values.get("src"), "input-image")

        if tag == "image":
            self.add(values.get("href") or values.get("xlink:href"), "svg-image")

        if tag == "link":
            rel_tokens = set((values.get("rel") or "").lower().split())
            if rel_tokens.intersection({"icon", "apple-touch-icon", "mask-icon"}):
                self.add(values.get("href"), "document-icon")

        if tag == "meta":
            key = (values.get("property") or values.get("name") or "").lower()
            if key in SOCIAL_IMAGE_KEYS:
                self.add(values.get("content"), key)

def is_ignored_reference(value: str) -> bool:
    value = html.unescape(value.strip())
    if not value or value.startswith(("#", "//")):
        return True
    if value.startswith(("{{", "{%", "<%", "${")) or "var(" in value:
        return True
    return urlsplit(value).scheme.lower() in SKIPPED_SCHEMES


def normalized_path(value: str) -> str:
    parsed = urlsplit(html.unescape(value.strip()))
    return unquote(parsed.path)


def candidate_paths(
    reference: Reference,
    project_root: Path,
    images_dir: Path,
) -> list[Path]:
    path_value = normalized_path(reference.value)
    if not path_value:
        return []

    if path_value.startswith("/"):
        return [(project_root / path_value.lstrip("/")).resolve()]

    relative = Path(path_value)
    candidates = [(reference.source.parent / relative).resolve()]
    if len(relative.parts) == 1:
        candidates.append((images_dir / relative.name).resolve())
    return list(dict.fromkeys(candidates))


def find_source_files(html_dir: Path) -> list[Path]:
    if html_dir.is_file():
        return [html_dir] if html_dir.suffix.lower() in SOURCE_SUFFIXES else []

    files: list[Path] = []
    for path in html_dir.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in SOURCE_SUFFIXES:
            continue
        relative_parts = path.relative_to(html_dir).parts[:-1]
        if any(part in IGNORED_DIRECTORIES for part in relative_parts):
            continue
        files.append(path)
    return sorted(files)


def read_references(source: Path) -> list[Reference]:
    content = source.read_text(encoding="utf-8")
    if source.suffix.lower() == ".css":
        return extract_css_references(content, source)

    parser = HTMLReferenceParser(source)
    parser.feed(content)
    parser.close()
    parser.references.extend(extract_css_references(content, source))
    return list(dict.fromkeys(parser.references))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Verify local visual asset references in HTML and CSS files."
    )
    parser.add_argument(
        "--html-dir",
        default=".",
        help="HTML/CSS file or directory to scan recursively (default: current directory)",
    )
    parser.add_argument(
        "--images-dir",
        default="images",
        help="Fallback directory for bare image filenames (default: images)",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    html_dir = Path(args.html_dir).resolve()
    project_root = html_dir if html_dir.is_dir() else html_dir.parent
    images_dir = Path(args.images_dir)
    if not images_dir.is_absolute():
        images_dir = (project_root / images_dir).resolve()

    if not html_dir.exists():
        print(f"Error: scan target does not exist: {html_dir}", file=sys.stderr)
        return 2

    source_files = find_source_files(html_dir)
    if not source_files:
        print(f"Warning: no HTML or CSS files found under {html_dir}")
        return 0

    all_references: list[Reference] = []
    read_errors: list[tuple[Path, str]] = []
    for source in source_files:
        try:
            all_references.extend(read_references(source))
        except (OSError, UnicodeError, ValueError) as exc:
            read_errors.append((source, str(exc)))

    if read_errors:
        for source, error in read_errors:
            print(f"Error reading {source}: {error}", file=sys.stderr)
        return 2

    unique_references = list(dict.fromkeys(all_references))
    local_references = [
        reference
        for reference in unique_references
        if not is_ignored_reference(reference.value)
    ]
    external_count = len(unique_references) - len(local_references)

    missing: list[tuple[Reference, list[Path]]] = []
    resolved_count = 0
    for reference in local_references:
        candidates = candidate_paths(reference, project_root, images_dir)
        if any(path.is_file() for path in candidates):
            resolved_count += 1
        else:
            missing.append((reference, candidates))

    print(f"Scanned source files: {len(source_files)}")
    print(f"Local visual references: {len(local_references)}")
    print(f"Resolved local references: {resolved_count}")
    print(f"Skipped external or inline references: {external_count}")

    if missing:
        print(f"Missing local references: {len(missing)}", file=sys.stderr)
        for reference, candidates in missing:
            print(
                f"- {reference.source}:{reference.line} "
                f"[{reference.kind}] {reference.value}",
                file=sys.stderr,
            )
            if candidates:
                print(
                    "  Checked: " + ", ".join(str(path) for path in candidates),
                    file=sys.stderr,
                )
        return 1

    print("All local visual references resolved successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
