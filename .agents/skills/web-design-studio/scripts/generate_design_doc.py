#!/usr/bin/env python3
"""Generate a Simplified Chinese HTML design handoff for a static website."""

from __future__ import annotations

import argparse
import html
import re
import struct
import sys
from dataclasses import dataclass
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


DEFAULT_COLORS = {
    "primary": "#0a2540",
    "secondary": "#1e3a5f",
    "accent": "#ff6b2c",
    "bg": "#f7fafc",
}
IMAGE_SUFFIXES = {
    ".avif",
    ".gif",
    ".ico",
    ".jpeg",
    ".jpg",
    ".png",
    ".svg",
    ".webp",
}
CSS_URL_PATTERN = re.compile(
    r"url\(\s*(?:\"([^\"]+)\"|'([^']+)'|([^)'\"\s][^)]*))\s*\)",
    re.IGNORECASE,
)
CSS_VARIABLE_PATTERN = re.compile(
    r"--([a-zA-Z0-9_-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\b"
)
HEX_COLOR_PATTERN = re.compile(r"^#[0-9a-fA-F]{3,8}$")
CTA_TEXT_PATTERN = re.compile(
    r"(?:立即|马上|了解更多|联系我们|注册|登录|购买|预订|开始使用|免费试用|"
    r"get\s+started|learn\s+more|contact\s+us|sign\s+up|log\s+in|"
    r"buy\s+now|shop\s+now|book\s+now|request\s+a\s+quote|try\s+free)",
    re.IGNORECASE,
)
STYLE = """
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
    margin: 0;
    background: var(--bg);
    color: #18212b;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", sans-serif;
    line-height: 1.75;
}
a { color: inherit; }
.hero {
    position: relative;
    overflow: hidden;
    padding: 88px 24px 72px;
    color: #fff;
    background: linear-gradient(135deg, var(--primary), var(--secondary));
}
.hero::after {
    position: absolute;
    inset: auto -10% -55% 35%;
    width: 620px;
    aspect-ratio: 1;
    border: 1px solid rgba(255,255,255,.18);
    border-radius: 50%;
    content: "";
}
.hero-inner, .nav-inner, main, .footer-inner {
    width: min(1120px, calc(100% - 32px));
    margin: 0 auto;
}
.badge {
    display: inline-flex;
    padding: 7px 13px;
    border: 1px solid rgba(255,255,255,.32);
    border-radius: 999px;
    background: rgba(255,255,255,.1);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: .08em;
}
h1 {
    max-width: 850px;
    margin: 22px 0 12px;
    font-size: clamp(40px, 7vw, 72px);
    line-height: 1.08;
}
.subtitle {
    max-width: 720px;
    margin: 0;
    color: rgba(255,255,255,.82);
    font-size: 18px;
}
.meta {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 28px;
    margin-top: 34px;
    color: rgba(255,255,255,.72);
    font-size: 14px;
}
.nav {
    position: sticky;
    top: 0;
    z-index: 10;
    overflow-x: auto;
    border-bottom: 1px solid #dfe5eb;
    background: rgba(255,255,255,.94);
    backdrop-filter: blur(14px);
}
.nav-inner { display: flex; gap: 4px; }
.nav a {
    padding: 16px 15px;
    color: #55616e;
    font-size: 13px;
    font-weight: 700;
    text-decoration: none;
    white-space: nowrap;
}
.nav a:hover, .nav a:focus-visible { color: var(--accent); }
main { padding: 72px 0 96px; }
.section { margin: 0 0 88px; scroll-margin-top: 76px; }
.section-kicker {
    color: var(--accent);
    font-size: 13px;
    font-weight: 800;
    letter-spacing: .12em;
}
h2 {
    margin: 8px 0 26px;
    color: var(--primary);
    font-size: clamp(30px, 4vw, 46px);
    line-height: 1.2;
}
h3 { margin: 36px 0 16px; color: var(--secondary); font-size: 22px; }
p { color: #53606d; }
.lead { max-width: 820px; font-size: 18px; }
.callout {
    margin: 26px 0;
    padding: 24px 26px;
    border-left: 4px solid var(--accent);
    border-radius: 0 14px 14px 0;
    background: #fff;
    box-shadow: 0 12px 36px rgba(10,37,64,.06);
}
.grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
}
.card {
    padding: 24px;
    border: 1px solid #dde4ea;
    border-radius: 16px;
    background: #fff;
}
.card h4 { margin: 0 0 8px; color: var(--primary); font-size: 17px; }
.card p { margin: 0; font-size: 14px; }
.palette {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 14px;
}
.swatch {
    overflow: hidden;
    border: 1px solid #dfe5eb;
    border-radius: 14px;
    background: #fff;
}
.swatch-color { height: 96px; }
.swatch-copy { padding: 16px; }
.swatch-copy strong, .swatch-copy span { display: block; }
.swatch-copy span { color: #687582; font-size: 13px; }
.structure {
    overflow: hidden;
    border: 1px solid #dfe5eb;
    border-radius: 16px;
    background: #fff;
}
.structure-item {
    display: grid;
    grid-template-columns: 42px 1fr;
    gap: 16px;
    padding: 22px;
    border-bottom: 1px solid #e5eaef;
}
.structure-item:last-child { border-bottom: 0; }
.number {
    display: grid;
    width: 42px;
    height: 42px;
    place-items: center;
    border-radius: 12px;
    background: var(--primary);
    color: #fff;
    font-weight: 800;
}
.structure-item h4 { margin: 0 0 4px; color: var(--primary); }
.structure-item p { margin: 0; }
table {
    width: 100%;
    overflow: hidden;
    border-collapse: collapse;
    border-radius: 14px;
    background: #fff;
    box-shadow: 0 10px 32px rgba(10,37,64,.05);
}
th, td {
    padding: 14px 16px;
    border-bottom: 1px solid #e4e9ee;
    text-align: left;
    vertical-align: top;
}
th { background: var(--primary); color: #fff; font-size: 13px; }
td { color: #4e5b67; font-size: 14px; overflow-wrap: anywhere; }
tr:last-child td { border-bottom: 0; }
.checklist { display: grid; gap: 10px; padding: 0; list-style: none; }
.checklist li {
    position: relative;
    padding: 13px 16px 13px 44px;
    border: 1px solid #dfe5eb;
    border-radius: 12px;
    background: #fff;
    color: #465461;
}
.checklist li::before {
    position: absolute;
    left: 16px;
    color: var(--accent);
    content: "✓";
    font-weight: 900;
}
footer { padding: 38px 0; color: rgba(255,255,255,.72); background: var(--primary); }
.footer-inner { display: flex; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
.footer-inner strong { color: #fff; }
@media (max-width: 640px) {
    .hero { padding-top: 64px; }
    main { padding-top: 52px; }
    .section { margin-bottom: 64px; }
    .structure-item { grid-template-columns: 1fr; }
    table { display: block; overflow-x: auto; }
}
@media (prefers-reduced-motion: reduce) {
    html { scroll-behavior: auto; }
}
"""


@dataclass
class Section:
    name: str
    content: str


@dataclass
class ImageAsset:
    filename: str
    dimensions: str
    purpose: str


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(value)).strip()


def split_csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def split_srcset(value: str) -> list[str]:
    if not value or value.strip().lower().startswith("data:"):
        return []
    return [item.strip().split()[0] for item in value.split(",") if item.strip()]


def is_external_reference(value: str) -> bool:
    value = value.strip()
    if not value or value.startswith(("#", "//", "data:", "blob:")):
        return True
    return urlsplit(value).scheme.lower() in {"http", "https"}


def resolve_reference(value: str, source: Path, project_root: Path) -> Path | None:
    if is_external_reference(value):
        return None
    path_value = unquote(urlsplit(html.unescape(value.strip())).path)
    if not path_value:
        return None
    if path_value.startswith("/"):
        return (project_root / path_value.lstrip("/")).resolve()
    return (source.parent / path_value).resolve()


class SectionExtractor(HTMLParser):
    """Extract h1-h3 sections and compact text summaries."""

    SKIP_TAGS = {"script", "style", "nav", "footer", "header", "noscript"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.sections: list[Section] = []
        self.skip_depth = 0
        self.capturing_heading = False
        self.heading_parts: list[str] = []
        self.current_title = ""
        self.content_parts: list[str] = []

    def finalize(self) -> None:
        title = clean_text(self.current_title)
        if not title:
            return
        meaningful = [clean_text(item) for item in self.content_parts if len(clean_text(item)) > 2]
        summary = " ".join(meaningful)
        if len(summary) > 180:
            summary = summary[:177].rstrip() + "..."
        if not summary:
            summary = "该区块展示相关内容，并建立清晰的信息层级。"
        self.sections.append(Section(title, summary))

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        if tag in self.SKIP_TAGS:
            self.skip_depth += 1
            return
        if self.skip_depth == 0 and tag in {"h1", "h2", "h3"}:
            self.finalize()
            self.current_title = ""
            self.content_parts = []
            self.heading_parts = []
            self.capturing_heading = True

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in self.SKIP_TAGS and self.skip_depth:
            self.skip_depth -= 1
            return
        if self.skip_depth == 0 and tag in {"h1", "h2", "h3"} and self.capturing_heading:
            self.current_title = " ".join(self.heading_parts)
            self.capturing_heading = False

    def handle_data(self, data: str) -> None:
        if self.skip_depth:
            return
        text = clean_text(data)
        if not text:
            return
        if self.capturing_heading:
            self.heading_parts.append(text)
        elif self.current_title:
            self.content_parts.append(text)

    def close(self) -> None:
        super().close()
        self.finalize()


class PageAnalyzer(HTMLParser):
    """Collect images, stylesheets, and de-duplicated CTA elements."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.images: list[tuple[str, str]] = []
        self.stylesheets: list[str] = []
        self.cta_count = 0
        self.anchor: dict[str, object] | None = None

    def add_image(self, value: str | None, purpose: str) -> None:
        if value and value.strip():
            self.images.append((value.strip(), purpose))

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        values = {name.lower(): value for name, value in attrs}

        if tag == "img":
            self.add_image(values.get("src"), values.get("alt") or "页面图片")
            for value in split_srcset(values.get("srcset") or ""):
                self.add_image(value, values.get("alt") or "响应式页面图片")
        elif tag == "source":
            self.add_image(values.get("src"), "响应式页面图片")
            for value in split_srcset(values.get("srcset") or ""):
                self.add_image(value, "响应式页面图片")
        elif tag == "video":
            self.add_image(values.get("poster"), "视频封面")
        elif tag == "meta":
            key = (values.get("property") or values.get("name") or "").lower()
            if key in {"og:image", "og:image:url", "twitter:image", "twitter:image:src"}:
                self.add_image(values.get("content"), "社交分享图片")
        elif tag == "link":
            rel_tokens = set((values.get("rel") or "").lower().split())
            if "stylesheet" in rel_tokens and values.get("href"):
                self.stylesheets.append(values["href"] or "")
            elif rel_tokens.intersection({"icon", "apple-touch-icon"}):
                self.add_image(values.get("href"), "站点图标")

        if tag == "button":
            self.cta_count += 1
        elif tag == "input" and (values.get("type") or "").lower() in {
            "button",
            "image",
            "submit",
        }:
            self.cta_count += 1
        elif tag == "a":
            class_name = values.get("class") or ""
            self.anchor = {
                "class_is_cta": bool(re.search(r"(?:^|\s)(?:btn|button|cta)(?:\s|$|-)", class_name, re.I)),
                "text": [],
            }

    def handle_data(self, data: str) -> None:
        if self.anchor is not None:
            text = clean_text(data)
            if text:
                text_parts = self.anchor["text"]
                assert isinstance(text_parts, list)
                text_parts.append(text)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() != "a" or self.anchor is None:
            return
        text_parts = self.anchor["text"]
        assert isinstance(text_parts, list)
        anchor_text = " ".join(text_parts)
        if bool(self.anchor["class_is_cta"]) or CTA_TEXT_PATTERN.search(anchor_text):
            self.cta_count += 1
        self.anchor = None


def extract_css_urls(content: str) -> list[str]:
    values: list[str] = []
    for match in CSS_URL_PATTERN.finditer(content):
        value = next((group for group in match.groups() if group is not None), "")
        value = html.unescape(value.strip())
        if Path(urlsplit(value).path).suffix.lower() in IMAGE_SUFFIXES:
            values.append(value)
    return values


def discover_css(
    html_file: Path | None,
    html_content: str,
    analyzer: PageAnalyzer,
    explicit_css: str,
) -> list[tuple[Path, str]]:
    css_sources: list[tuple[Path, str]] = []
    if explicit_css:
        css_path = Path(explicit_css).resolve()
        if not css_path.is_file():
            raise FileNotFoundError(f"CSS file does not exist: {css_path}")
        css_sources.append((css_path, css_path.read_text(encoding="utf-8")))

    if html_file:
        project_root = html_file.parent
        for reference in analyzer.stylesheets:
            path = resolve_reference(reference, html_file, project_root)
            if path and path.is_file() and all(existing[0] != path for existing in css_sources):
                css_sources.append((path, path.read_text(encoding="utf-8")))

    if html_content:
        virtual_source = html_file or (Path.cwd() / "index.html")
        if explicit_css:
            css_sources.append((virtual_source, html_content))
        else:
            css_sources.insert(0, (virtual_source, html_content))
    return css_sources


def extract_colors(css_sources: list[tuple[Path, str]]) -> dict[str, str]:
    colors: dict[str, str] = {}
    all_hex: list[str] = []
    for _, content in css_sources:
        for name, value in CSS_VARIABLE_PATTERN.findall(content):
            lower_name = name.lower()
            all_hex.append(value)
            if "primary" in lower_name and "primary" not in colors:
                colors["primary"] = value
            elif "secondary" in lower_name and "secondary" not in colors:
                colors["secondary"] = value
            elif "accent" in lower_name and "accent" not in colors:
                colors["accent"] = value
            elif lower_name in {"bg", "background", "page-bg", "surface"} and "bg" not in colors:
                colors["bg"] = value

    unique_hex = list(dict.fromkeys(all_hex))
    for key in ("primary", "secondary", "accent"):
        if key in colors:
            continue
        candidate = next((value for value in unique_hex if value not in colors.values()), None)
        if candidate:
            colors[key] = candidate
    return colors


def normalize_color(value: str | None, fallback: str) -> str:
    return value if value and HEX_COLOR_PATTERN.fullmatch(value) else fallback


def read_image_dimensions(path: Path) -> tuple[int, int] | None:
    """Read common raster dimensions without third-party dependencies."""
    try:
        with path.open("rb") as stream:
            header = stream.read(32)

            if header.startswith(b"\x89PNG\r\n\x1a\n") and len(header) >= 24:
                return struct.unpack(">II", header[16:24])

            if header[:6] in {b"GIF87a", b"GIF89a"} and len(header) >= 10:
                return struct.unpack("<HH", header[6:10])

            if header.startswith(b"RIFF") and header[8:12] == b"WEBP":
                chunk = header[12:16]
                if chunk == b"VP8X" and len(header) >= 30:
                    width = 1 + int.from_bytes(header[24:27], "little")
                    height = 1 + int.from_bytes(header[27:30], "little")
                    return width, height
                if chunk == b"VP8 ":
                    stream.seek(20)
                    data = stream.read(10)
                    marker = data.find(b"\x9d\x01\x2a")
                    if marker >= 0 and len(data) >= marker + 7:
                        width, height = struct.unpack("<HH", data[marker + 3 : marker + 7])
                        return width & 0x3FFF, height & 0x3FFF
                if chunk == b"VP8L":
                    stream.seek(20)
                    data = stream.read(5)
                    if len(data) == 5 and data[0] == 0x2F:
                        bits = int.from_bytes(data[1:5], "little")
                        return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1

            if header.startswith(b"\xff\xd8"):
                stream.seek(2)
                while True:
                    byte = stream.read(1)
                    if not byte:
                        break
                    if byte != b"\xff":
                        continue
                    marker = stream.read(1)
                    while marker == b"\xff":
                        marker = stream.read(1)
                    if marker in {b"\xd8", b"\xd9"}:
                        continue
                    length_data = stream.read(2)
                    if len(length_data) != 2:
                        break
                    segment_length = struct.unpack(">H", length_data)[0]
                    marker_value = marker[0]
                    if marker_value in {
                        0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7,
                        0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF,
                    }:
                        data = stream.read(5)
                        if len(data) == 5:
                            height, width = struct.unpack(">HH", data[1:5])
                            return width, height
                        break
                    stream.seek(max(segment_length - 2, 0), 1)
    except (OSError, ValueError, struct.error):
        return None
    return None


def parse_manual_images(value: str) -> list[ImageAsset]:
    images: list[ImageAsset] = []
    for item in split_csv(value):
        parts = [part.strip() for part in item.split("|")]
        if parts and parts[0]:
            images.append(
                ImageAsset(
                    filename=parts[0],
                    dimensions=parts[1] if len(parts) > 1 and parts[1] else "未检测",
                    purpose=parts[2] if len(parts) > 2 and parts[2] else "页面图片",
                )
            )
    return images


def build_image_assets(
    analyzer: PageAnalyzer,
    css_sources: list[tuple[Path, str]],
    html_file: Path | None,
    manual_list: str,
) -> list[ImageAsset]:
    if manual_list:
        return parse_manual_images(manual_list)

    project_root = html_file.parent if html_file else Path.cwd()
    source = html_file or (project_root / "index.html")
    references = [
        (reference, purpose, source)
        for reference, purpose in analyzer.images
    ]
    for css_path, content in css_sources:
        for reference in extract_css_urls(content):
            references.append((reference, "背景或装饰图片", css_path))

    assets: list[ImageAsset] = []
    seen: set[str] = set()
    for reference, purpose, reference_source in references:
        normalized = html.unescape(reference.strip())
        if not normalized or normalized in seen or is_external_reference(normalized):
            continue
        seen.add(normalized)
        path = resolve_reference(normalized, reference_source, project_root)
        dimensions = read_image_dimensions(path) if path and path.is_file() else None
        assets.append(
            ImageAsset(
                filename=Path(urlsplit(normalized).path).name or normalized,
                dimensions=f"{dimensions[0]} × {dimensions[1]} px" if dimensions else "未检测",
                purpose=clean_text(purpose) or "页面图片",
            )
        )
    return assets


def safe(value: object) -> str:
    return html.escape(str(value), quote=True)


def render_cards(items: list[str]) -> str:
    return "\n".join(
        f'<article class="card"><h4>{safe(item)}</h4><p>围绕项目目标落实并验证该项设计要求。</p></article>'
        for item in items
    )


def render_sections(sections: list[Section]) -> str:
    if not sections:
        sections = [
            Section("顶部导航", "呈现品牌标识、主要导航与核心行动入口。"),
            Section("首屏展示", "快速传达价值主张，并建立明确的视觉焦点。"),
            Section("内容区块", "按用户决策顺序组织产品、服务或品牌信息。"),
            Section("页脚", "集中呈现辅助导航、联系信息与必要声明。"),
        ]
    return "\n".join(
        (
            '<div class="structure-item">'
            f'<div class="number">{index:02d}</div>'
            f'<div><h4>{safe(section.name)}</h4><p>{safe(section.content)}</p></div>'
            "</div>"
        )
        for index, section in enumerate(sections, 1)
    )


def render_image_table(images: list[ImageAsset]) -> str:
    if not images:
        return "<p>页面未检测到本地图片资源，或图片清单未提供。</p>"
    rows = "\n".join(
        f"<tr><td>{safe(image.filename)}</td><td>{safe(image.dimensions)}</td><td>{safe(image.purpose)}</td></tr>"
        for image in images
    )
    return (
        '<table><thead><tr><th>文件名</th><th>实际尺寸</th><th>用途</th></tr></thead>'
        f"<tbody>{rows}</tbody></table>"
    )


def validate_output_path(filename: str) -> Path:
    path = Path(filename)
    if path.is_absolute() or ".." in path.parts:
        raise ValueError("Output must be a relative path without '..'.")
    if not path.suffix:
        path = path.with_suffix(".html")
    return path


def generate_document(args: argparse.Namespace) -> str:
    html_file = Path(args.html_file).resolve() if args.html_file else None
    if html_file and not html_file.is_file():
        raise FileNotFoundError(f"HTML file does not exist: {html_file}")

    html_content = html_file.read_text(encoding="utf-8") if html_file else ""
    analyzer = PageAnalyzer()
    extractor = SectionExtractor()
    if html_content:
        analyzer.feed(html_content)
        analyzer.close()
        extractor.feed(html_content)
        extractor.close()

    css_sources = discover_css(html_file, html_content, analyzer, args.css_file or "")
    extracted_colors = extract_colors(css_sources)
    colors = {
        key: normalize_color(
            getattr(args, f"{key}_color", None),
            extracted_colors.get(key, DEFAULT_COLORS[key]),
        )
        for key in ("primary", "secondary", "accent", "bg")
    }

    if args.page_sections:
        sections = [
            Section(name, "该区块展示相关内容，并建立清晰的信息层级。")
            for name in split_csv(args.page_sections)
        ]
    else:
        sections = extractor.sections[:12]

    goals = split_csv(args.design_goals) or [
        "建立鲜明的品牌认知",
        "清晰传递核心价值",
        "引导用户完成关键行动",
        "保持跨设备体验一致",
    ]
    features = split_csv(args.features) or [
        "语义化页面结构",
        "响应式布局",
        "清晰的交互反馈",
        "图片加载与版式稳定",
        "键盘与触控支持",
        "减少动态效果支持",
    ]
    images = build_image_assets(
        analyzer,
        css_sources,
        html_file,
        args.image_list or "",
    )

    if args.cta_count:
        try:
            cta_count = int(args.cta_count)
        except ValueError as exc:
            raise ValueError("--cta-count must be a non-negative integer.") from exc
        if cta_count < 0:
            raise ValueError("--cta-count must be a non-negative integer.")
    else:
        cta_count = analyzer.cta_count

    current_date = datetime.now().strftime("%Y年%m月%d日")
    concept = args.design_concept or "以清晰的信息层级、统一的视觉语言和完整的交互路径，建立具有辨识度且便于使用的网站体验。"
    audience = args.target_audience or "面向项目定义的核心用户，围绕其浏览场景、决策需求和设备习惯进行设计。"
    typography = args.typography or "使用具有辨识度的标题字体与易读的正文字体，并配置可靠的后备字体。"
    tech_stack = args.tech_stack or "HTML5、CSS3、原生 JavaScript、响应式设计"
    project_type = args.project_type or "网站"
    author = args.author or "Web Design Studio"

    root_style = (
        f":root{{--primary:{colors['primary']};--secondary:{colors['secondary']};"
        f"--accent:{colors['accent']};--bg:{colors['bg']};}}"
    )
    goals_html = render_cards(goals)
    features_html = render_cards(features)
    sections_html = render_sections(sections)
    images_html = render_image_table(images)

    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{safe(args.project_name)} - 设计说明文档</title>
<style>{root_style}{STYLE}</style>
</head>
<body>
<header class="hero">
  <div class="hero-inner">
    <span class="badge">设计文档 V{safe(args.version or "1.0")}</span>
    <h1>{safe(args.project_name)}<br>设计说明文档</h1>
    <p class="subtitle">专业{safe(project_type)}设计 · 静态网站交付说明</p>
    <div class="meta"><span>更新日期：{safe(current_date)}</span><span>设计单位：{safe(author)}</span></div>
  </div>
</header>
<nav class="nav" aria-label="文档章节">
  <div class="nav-inner">
    <a href="#overview">设计概述</a><a href="#visual">视觉设计</a>
    <a href="#structure">页面结构</a><a href="#ux">用户体验</a>
    <a href="#tech">技术实现</a><a href="#deliverables">交付清单</a>
  </div>
</nav>
<main>
  <section class="section" id="overview">
    <div class="section-kicker">01 / OVERVIEW</div><h2>设计概述</h2>
    <div class="callout"><strong>核心理念</strong><p>{safe(concept)}</p></div>
    <h3>设计目标</h3><div class="grid">{goals_html}</div>
    <h3>目标受众</h3><p class="lead">{safe(audience)}</p>
  </section>
  <section class="section" id="visual">
    <div class="section-kicker">02 / VISUAL SYSTEM</div><h2>视觉设计策略</h2>
    <h3>色彩系统</h3>
    <div class="palette">
      <div class="swatch"><div class="swatch-color" style="background:{colors['primary']}"></div><div class="swatch-copy"><strong>主色</strong><span>{colors['primary']}</span></div></div>
      <div class="swatch"><div class="swatch-color" style="background:{colors['secondary']}"></div><div class="swatch-copy"><strong>辅助色</strong><span>{colors['secondary']}</span></div></div>
      <div class="swatch"><div class="swatch-color" style="background:{colors['accent']}"></div><div class="swatch-copy"><strong>强调色</strong><span>{colors['accent']}</span></div></div>
      <div class="swatch"><div class="swatch-color" style="background:{colors['bg']}"></div><div class="swatch-copy"><strong>背景色</strong><span>{colors['bg']}</span></div></div>
    </div>
    <h3>字体策略</h3><p class="lead">{safe(typography)}</p>
    <h3>图片资源</h3>{images_html}
  </section>
  <section class="section" id="structure">
    <div class="section-kicker">03 / STRUCTURE</div><h2>页面结构设计</h2>
    <p class="lead">页面内容按照用户理解与决策顺序组织，兼顾首屏表达、信息扫描和行动转化。</p>
    <div class="structure">{sections_html}</div>
  </section>
  <section class="section" id="ux">
    <div class="section-kicker">04 / EXPERIENCE</div><h2>用户体验设计</h2>
    <div class="grid">{features_html}</div>
    <h3>响应式策略</h3>
    <table><thead><tr><th>设备</th><th>参考宽度</th><th>布局行为</th></tr></thead>
    <tbody><tr><td>桌面端</td><td>≥ 1024 px</td><td>完整多栏构图与宽屏视觉层级</td></tr>
    <tr><td>平板端</td><td>768–1023 px</td><td>收缩网格并保持清晰触控目标</td></tr>
    <tr><td>移动端</td><td>&lt; 768 px</td><td>单栏内容流、可读文字和稳定图片裁切</td></tr></tbody></table>
  </section>
  <section class="section" id="tech">
    <div class="section-kicker">05 / IMPLEMENTATION</div><h2>技术实现</h2>
    <div class="callout"><strong>技术栈</strong><p>{safe(tech_stack)}</p></div>
    <div class="grid">
      <article class="card"><h4>轻量实现</h4><p>避免不必要依赖，保持页面加载与维护效率。</p></article>
      <article class="card"><h4>语义结构</h4><p>使用清晰的 HTML 地标、标题和可访问控件。</p></article>
      <article class="card"><h4>渐进增强</h4><p>核心内容不依赖脚本，JavaScript 聚焦真实交互。</p></article>
      <article class="card"><h4>资源稳定</h4><p>声明图片尺寸、控制加载优先级并验证本地路径。</p></article>
    </div>
  </section>
  <section class="section" id="deliverables">
    <div class="section-kicker">06 / DELIVERY</div><h2>交付清单</h2>
    <ul class="checklist">
      <li>完整静态 HTML 页面</li><li>响应式 CSS 样式</li>
      <li>必要的原生 JavaScript 交互</li><li>{len(images)} 项已登记图片资源</li>
      <li>{cta_count} 个已识别行动入口</li><li>本设计说明文档</li>
    </ul>
    <h3>建议后续工作</h3>
    <ul class="checklist">
      <li>接入真实表单、分析或业务服务</li><li>完成域名、托管与安全配置</li>
      <li>根据真实设备数据继续优化图片格式与加载策略</li><li>上线后复核转化路径与无障碍体验</li>
    </ul>
  </section>
</main>
<footer><div class="footer-inner"><strong>{safe(args.project_name)}</strong><span>文档版本：v{safe(args.version or "1.0")} · 最后更新：{safe(current_date)} · {safe(author)}</span></div></footer>
</body>
</html>
"""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate a Simplified Chinese HTML design handoff."
    )
    parser.add_argument("--project-name", "-p", required=True, help="Project name")
    parser.add_argument("--output", "-o", required=True, help="Relative output HTML path")
    parser.add_argument("--html-file", "-H", help="HTML entry file to analyze")
    parser.add_argument("--design-concept", "-d", help="Design concept")
    parser.add_argument("--target-audience", "-a", help="Target audience")
    parser.add_argument("--primary-color", help="Primary hex color")
    parser.add_argument("--secondary-color", help="Secondary hex color")
    parser.add_argument("--accent-color", help="Accent hex color")
    parser.add_argument("--bg-color", help="Background hex color")
    parser.add_argument("--typography", "-t", help="Typography description")
    parser.add_argument("--design-goals", "-g", help="Comma-separated design goals")
    parser.add_argument("--page-sections", "-s", help="Comma-separated page sections")
    parser.add_argument(
        "--image-list",
        help="Comma-separated filename|dimensions|purpose image entries",
    )
    parser.add_argument("--cta-count", help="Manual non-negative CTA count")
    parser.add_argument("--tech-stack", help="Technology stack description")
    parser.add_argument("--features", "-f", help="Comma-separated experience features")
    parser.add_argument("--css-file", help="Explicit local CSS file to analyze")
    parser.add_argument("--author", default="Web Design Studio", help="Author")
    parser.add_argument("--project-type", default="网站", help="Project type")
    parser.add_argument("--version", default="1.0", help="Document version")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        output_path = validate_output_path(args.output)
        document = generate_document(args)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(document, encoding="utf-8")
    except (OSError, UnicodeError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 2

    print(f"Design documentation generated: {output_path.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
