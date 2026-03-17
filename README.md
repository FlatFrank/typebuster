# Typebuster

Typebuster is an experimental type lab built with Next.js, React, TypeScript and `opentype.js`.

This repo currently focuses on a precise SVG/Bézier workbench:
- loads local Google Fonts masters
- vectorizes glyphs into cubic contours
- deforms them live through a small set of expressive axes
- previews the result across a specimen grid
- exports a subset sample font once the user has pushed the design far enough

It is not trying to be a full font editor or a foundry-grade interpolation tool. The goal is fast, playful, visually strong experimentation.

## Run locally

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm run typecheck
npm run build
npm run check
```

Open [http://localhost:3000](http://localhost:3000) or the next free port if `3000` is already in use.

## Current product

The current app is a single-screen type workbench with:

- font switching between `Archivo`, `DM Sans`, `DM Serif`, `Playfair`, and `Bricolage Grotesque`
- live axes for `width`, `height`, `weight`, `contrast`, `slant`, `roundness`, `chamfer`, `facet`, `pixel snap`, `wobble`, `liquify`, and `glitch`
- compact SVG specimen cards for `A-Z`, `a-z`, `0-9`, `!?`
- a sample font export flow with in-product naming modal

## Export flow

The sample download is intentionally gated:

- the user must reach at least `25%` total non-weight modification
- `weight` does not count toward unlock
- `width` + `height` can only contribute `20%` combined

When export is unlocked:

- the user names the sample font in a centered modal
- the `.zip` and `.otf` use exactly that name
- the package includes:
  - the generated subset font
  - `OFL.txt`
  - `DISCLAIMER.txt`
  - `SETTINGS.json`

The current subset includes:

- `A-Z`
- `a-z`
- `1-9`
- `!?`
- `space`

## Technical approach

The app is built around a simple pipeline:

1. Load local font masters from `public/fonts`
2. Convert glyphs to cubic Bézier contours with `opentype.js`
3. Interpolate weight from compatible masters
4. Apply geometric and expressive transforms in a stable order
5. Render the result as SVG cards
6. Rebuild a downloadable subset font from the transformed contours

Important implementation choices:

- SVG first, not canvas, so the geometry stays inspectable
- local font assets only, no runtime dependency on external font APIs
- heavier weight and export logic are family-aware where possible
- some axes are intentionally visual heuristics rather than academically exact type design operations

## Project structure

```text
app/
  globals.css
  icon.svg
  layout.tsx
  page.tsx
components/
  bezier-controls-panel.tsx
  bezier-glyph-card.tsx
  bezier-workbench.tsx
  info-tooltip.tsx
  sample-name-modal.tsx
  slider-control.tsx
lib/
  font/
    export-sample.ts
    load-font.ts
  glyph/
    path-utils.ts
    transform-vectorized-glyph.ts
    vectorize-glyph.ts
  types.ts
public/
  fonts/
  licenses/
types/
  opentype.js.d.ts
```

## Design notes

Effects that currently work best are the ones that operate directly on robust contour geometry:

- `roundness`
- `contrast`
- `chamfer`
- `facet`
- `pixel snap`
- `wobble`
- `liquify`
- `glitch`

Axes like true serif construction or foundry-grade inktraps are intentionally out of the current build because they require much more glyph-specific logic.

## Fonts and licensing

All source fonts used by the workbench are stored locally in `public/fonts`, and their corresponding licenses are stored in `public/licenses`.

The export flow is built around renamed sample fonts plus bundled licensing/disclaimer files so the output is clearly separated from the original upstream family naming.

## What was cleaned up

This repo no longer includes the earlier generic type-lab prototype and its unused transform/store stack. The current codebase is centered on the Bézier workbench only.

## Next roadmap

- add more deformation axes that fit the contour engine well
- improve contrast with more glyph-aware region logic
- support more source families without degrading the editing experience
- add save/load for user presets
- explore poster/specimen export
- improve typing around `opentype.js` so less runtime casting is needed
