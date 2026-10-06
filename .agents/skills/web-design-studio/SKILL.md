---
name: web-design-studio
description: Create or redesign production-grade standalone websites in semantic HTML, CSS, and JavaScript with distinctive art direction and Codex-generated raster imagery. Use for landing pages, marketing sites, portfolios, product pages, editorial sites, and static dashboards that do not require React, Vue, Next.js, or another application framework. Do not use for framework-based applications, deployment-only work, or isolated components that belong in an existing framework project.
---

# Web Design Studio

Build complete static websites with a strong visual concept, finished content, original raster imagery, and a verified browser experience. Use `frontend-design` for art direction and interface quality. Use `imagegen` for every newly created raster asset.

## Operating boundaries

- Produce standalone HTML, CSS, and JavaScript only.
- Preserve the structure and conventions of an existing static site.
- For an empty project, default to `index.html`, `styles.css`, `script.js`, and `images/`.
- Do not migrate, initialize, or rewrite a React, Vue, Next.js, Svelte, or other framework project. Route those requests to the appropriate frontend skill.
- If `.openai/hosting.json` exists, follow the Sites skills instead of this standalone workflow.
- Do not deploy, publish, or add hosting configuration unless the user separately requests it.
- Do not generate a design handoff document unless the user explicitly requests one.

## Workflow

### 1. Audit the project

Before editing, inspect:

- existing entry pages, stylesheets, scripts, and asset directories
- project instructions and user-authored changes
- supplied brand assets, copy, references, and required content
- current navigation, interactions, metadata, and responsive behavior

Treat existing content and assets as intentional unless the request says otherwise. Never replace a working structure merely to apply the default file layout.

### 2. Define the product and content

Lock the following before visual implementation:

- page purpose and primary user action
- target audience and decision context
- information hierarchy and section order
- required interactions and conversion points
- content constraints, factual claims, and legal or brand requirements

Write concrete, product-specific copy. Do not use Lorem Ipsum, placeholder labels, invented testimonials, fabricated metrics, unsupported claims, or empty “feature card” filler. When facts are missing, use neutral non-factual language or clearly marked user-editable copy.

### 3. Commit to one art direction

Choose a clear concept appropriate to the subject: editorial, refined luxury, industrial, playful, organic, brutalist, retro-futurist, minimal, maximal, or another deliberate direction. Define the memorable visual idea before coding.

Create a compact design system:

- display and body typography with reliable fallbacks
- dominant, supporting, accent, surface, and text colors as CSS variables
- spacing rhythm, grid, container widths, radii, borders, and shadows
- responsive composition and image-crop behavior
- a restrained motion language for entry, hover, focus, and scroll states

Avoid generic AI aesthetics unless the brand genuinely calls for them: default system typography, purple gradients on white, repetitive rounded cards, predictable centered heroes, excessive glow, arbitrary glassmorphism, and decorative motion without purpose. Match implementation complexity to the concept.

### 4. Plan every visual asset

Create an explicit asset brief after the content structure and art direction are stable. All newly created raster visuals must be generated with Codex, including hero art, product imagery, editorial photography, illustrations, and textures.

Preserve user-provided logos, brand marks, photographs, and reference assets. Use HTML, CSS, or SVG for precise interface icons, logos that must remain vector, simple geometry, diagrams, and structural decoration.

For each raster asset, define:

- purpose, placement, and final filename
- aspect ratio, crop, subject placement, and responsive behavior
- safe areas and negative space required by nearby content
- subject, environment, medium, lighting, palette, and materials
- exact text only when text must appear inside the image
- invariants, prohibited elements, and artifact risks

### 5. Generate with Codex

Use the built-in `image_gen` tool through the `imagegen` skill.

- Do not use stock-image search, external generation services, or project-local generation scripts.
- Issue one generation call per distinct asset or variant.
- Use references only when they materially constrain identity, style, composition, or product details.
- Inspect every output for subject accuracy, crop, safe areas, text fidelity, anatomy, duplicated objects, watermarks, and visual artifacts.
- Iterate with a single targeted correction when an output is not usable.
- Follow `imagegen` for edits, transparent backgrounds, and fallback policy.

Use a placement-aware prompt when useful:

```text
Use case: <product-mockup | ads-marketing | photorealistic-natural | illustration-story | stylized-concept>
Asset type: <hero | product image | editorial image | illustration | texture>
Primary request: <essential visual>
Scene/backdrop: <environment>
Subject: <main subject>
Style/medium: <photography | illustration | 3D | collage>
Composition/framing: <aspect ratio, crop, subject placement, safe areas, negative space>
Lighting/mood: <lighting and emotional tone>
Color palette: <interface-aligned palette>
Text (verbatim): "<exact text only when required>"
Constraints: <must preserve or include>
Avoid: watermarks, unintended text, logos, clutter, malformed details, generic stock styling
```

Codex saves built-in outputs under `$CODEX_HOME/generated_images/` by default. For project-bound assets:

1. Create `images/` when the project has no established asset directory.
2. Copy or move the selected output into the project.
3. Use a descriptive kebab-case filename such as `ceramic-mug-hero.png`.
4. Do not overwrite an existing asset unless explicitly requested; otherwise create a sibling such as `ceramic-mug-hero-v2.png`.
5. Never leave a referenced site asset only under `$CODEX_HOME`.

### 6. Implement the complete site

- Use semantic landmarks and a logical heading hierarchy.
- Set an accurate document language, title, meta description, viewport, and relevant social metadata.
- Build responsive layouts that work without horizontal overflow.
- Use real links and controls with keyboard support, visible focus, meaningful labels, and correct states.
- Add useful `alt` text; use empty alt text for purely decorative images.
- Declare image dimensions or aspect ratios to prevent layout shift.
- Prioritize the primary hero image and lazy-load below-the-fold images.
- Use progressive enhancement so essential content and navigation remain available without JavaScript.
- Support `prefers-reduced-motion` and avoid interaction that depends only on hover.
- Keep JavaScript focused on real behavior; avoid speculative state or unnecessary libraries.
- Do not leave placeholders, broken links, commented-out mock sections, or accidental external image dependencies.

### 7. Preview and verify

Resolve `SKILL_DIR` to the directory containing this `SKILL.md`. Verify local visual assets:

```bash
python3 "$SKILL_DIR/scripts/verify_images.py" \
  --html-dir . \
  --images-dir images
```

Fix every missing reference before delivery. When browser control is available, serve the site locally and inspect representative widths around 390 px, 768 px, and 1440 px. Check:

- first viewport composition and content hierarchy
- navigation, buttons, forms, and keyboard order
- focus states, reduced motion, and touch behavior
- text wrapping, overflow, image crops, and loading
- console errors and broken local requests

If browser control is unavailable, perform the static checks and report that visual browser QA was not available.

### 8. Generate a Chinese handoff only on request

When the user explicitly requests a design specification or client handoff, generate it after site and asset verification:

```bash
python3 "$SKILL_DIR/scripts/generate_design_doc.py" \
  --project-name "Project Name" \
  --output "design-doc-project.html" \
  --html-file "index.html"
```

The document uses Simplified Chinese for fixed headings, labels, default guidance, and explanatory copy. Preserve project names and source content as supplied. Write manual explanatory values such as `--design-concept`, `--target-audience`, `--design-goals`, and `--features` in Simplified Chinese unless the user requests another language.

### 9. Deliver

Confirm:

- the static site is complete and functional
- every newly created raster visual came from Codex and is stored in the project
- all local visual references resolve
- accessibility, responsive behavior, metadata, and reduced motion are present
- browser QA was completed when available
- no design document was generated unless requested

Report the entry page, generated asset paths, verification performed, and any explicitly requested Chinese handoff document.
