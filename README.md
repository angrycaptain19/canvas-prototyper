# canvas-prototyper

A visual UI prototyping tool built on tldraw 5. Design React + Tailwind components on an infinite canvas, save them as reusable parts with variants, and generate production-ready code.

The AI agent is design-system aware: generations compose your saved components instead of redrawing from primitives, and editing a selection rewires the existing tree rather than starting over. Themes swap in one click — every Button, Badge, Card on the canvas re-skins atomically.

## Setup

```bash
npm install
npm run dev
```

Open the app and add your Anthropic API key via the Settings cog in the Cmd+K palette. The key lives in `localStorage` (browser only — it never leaves your machine).

## Using it

- **Drag from the Library panel** to drop primitives or your saved components onto the canvas.
- **Cmd+K** opens the prompt palette.
  - With nothing selected → multi-variant generation (3 styles in parallel, side-by-side).
  - With a selection → edit mode (refines the existing shapes in place).
- **`P`** toggles preview mode (hides editor chrome — what the rendered UI actually looks like).
- **Theme panel** has 5 preset chips (Default · Stripe · Linear · Vercel · Editorial) plus per-token editing.

## Generating React code

Two paths:

**Per component (in-app)** — select a saved component instance or a PageFrame on the canvas → Inspector's `Code` button opens a modal showing the generated `.tsx`.

**Whole project (CLI)** — click `Export project` in the Library panel to download `project.json`, then:

```bash
npm run sync project.json --out ./ui
# or with shadcn/ui composition mode:
npm run sync project.json --out ./ui --shadcn
```

Emits `theme.css` (CSS variables from your current theme), `tailwind.preset.ts`, `_lib.tsx` (the `cn` helper), one `<DefName>.tsx` per saved component, one `<PageName>.tsx` per PageFrame, and an `index.ts` re-export.

## Stack

tldraw 5 · React · Vite · Tailwind · Anthropic API · TypeScript
</content>
</invoke>