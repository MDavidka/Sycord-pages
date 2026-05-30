# Sycord-pages Rework — PRD

## Original Problem Statement
Rework `MDavidka/Sycord-pages` (Next.js 16 / React 19 / shadcn / Zod / Recharts) from the existing
`prompt → manifest → generated TSX files` flow into a hybrid:

`prompt → validated JSON UI document → live patch-rendered canvas → optional shadcn/Next code export`

The existing `ai-website-builder` is preserved as the **export/compiler backend**. The new JSON
builder sits in front of it as the **live IR/editor layer**.

## Architecture
- **Live IR**: `BuilderDocument` (pages, routes, theme, history, state) — JSON, Zod-validated
- **Live canvas**: 4-panel React workspace at `/builder` with desktop / tablet / mobile previews
- **Mutation**: RFC 6902 JSON Patch ops only (no React state mutation of the rendered tree)
- **Streaming generation**: LLM emits JSONL patch ops; each op is validated before being applied
- **Routing**: Claude Sonnet 4.5 (`best`) for new layouts, Claude Haiku 4.5 (`fast`) for tweaks
- **Export**: `BuilderDocument` → compiled TSX page files + manifest

## User Personas
1. **Prompt-first designer** — writes natural language, picks fast vs. best, watches canvas update
2. **Visual editor** — selects nodes on the canvas, edits props in the inspector (still JSON Patch-driven)
3. **Developer** — exports the document as TSX to drop into a Next.js project

## Tech Stack
- Next.js 16 / React 19 / TypeScript / Tailwind / shadcn-ui / Zod / Recharts
- Anthropic Claude (Sonnet 4.5 / Haiku 4.5) via the Emergent LLM proxy (OpenAI-compatible)
- FastAPI HTTP proxy on `:8001` forwarding to Next.js on `:3000` so the Emergent ingress
  correctly routes `/api/*` to the Next.js route handlers

## Core Requirements (static)
- 16-component whitelist: Page, Section, Container, Grid, Stack, Card, Button, Input, Accordion,
  Tabs, Avatar, Badge, Image, Text, Heading, LineGraph
- Per-component Zod schemas (discriminated union on `component`)
- Patch engine implements add / replace / remove / move / copy / test with JSON Pointer paths
- Sandboxed iframe preview (`sandbox="allow-scripts"` only)
- Streaming patch generator with per-op validation + invalid-patch reporting
- Property inspector dispatches patches; never mutates React state directly
- Undo / redo / export to JSON

## What's Been Implemented — 2026-01-30
### Phase 1 — IR
- `BuilderDocument`, `ComponentNode`, theme, routes, history (`lib/ai-ui-builder/document/types.ts`)
- `createDefaultDocument()` for seeding (`lib/ai-ui-builder/document/default-document.ts`)

### Phase 2 — Catalog & runtime registry
- `CATALOG` with defaults / categories / capabilities (`lib/ai-ui-builder/catalog/components.ts`)
- React renderer per component (`lib/ai-ui-builder/runtime/registry.tsx`)
- Recursive `RenderNode` with selectable outlines in editor mode (`runtime/render-node.tsx`)

### Phase 3 — Zod schemas
- Strict per-component schemas + `builderDocumentSchema` (`catalog/schemas.ts`)
- Custom invariants: unique IDs, max depth, route uniqueness (`document/validate.ts`)

### Phase 4 — Workspace
- `/builder` page (`app/builder/page.tsx`)
- 4-panel resizable shell (`components/builder/builder-shell.tsx`)
- Prompt panel, component tree, spatial canvas with 3 viewports, property inspector, bottom
  code/diff drawer

### Phase 5 — Patch engine
- RFC 6902 implementation incl. JSON Pointer escaping (`document/patches.ts`)
- Central store with undo/redo, history, selection (`components/builder/store.tsx`)

### Phase 6 — Streaming patches
- `/api/builder/stream` SSE route emits `event: start/patch/invalid-patch/error/done`
  (`app/api/builder/stream/route.ts`)
- Per-op validation against the document schema before forwarding
- JSONL line parser + END marker contract

### Phase 7 — Mode routing
- Auto-pick `best` vs `fast` based on selection + prompt regex hints
- User override pill in prompt panel
- Model IDs: Sonnet 4.5 (`claude-sonnet-4-5-20250929`), Haiku 4.5 (`claude-haiku-4-5-20251001`)

### Phase 8 — Bidirectional inspector
- All edits dispatch `{op: replace|add, path, value}` ops via the store
- Duplicate / remove buttons; text + level + variant + padding + className + src/alt fields

### Phase 9 — Sandboxed preview
- Iframe with `sandbox="allow-scripts"` only (no `allow-same-origin`)
- Mini-renderer mirrors the React registry for self-contained preview
- `postMessage`-driven re-render on every document version bump

### Phase 10 — Code export
- `compileBuilderDocument()` converts each page to a TSX file that uses `RenderNode`
  (`lib/ai-ui-builder/export/compile.ts`)
- `/api/builder/export` validates then returns `{files[], manifest}`
- Export button in the prompt panel downloads the result as JSON

## Verification
- TypeScript: 0 errors in any new file (`tsc --noEmit` clean for all new paths)
- Next.js build: succeeds, registers `/builder`, `/api/builder/stream`, `/api/builder/export`
- End-to-end:
  - Prompt → SSE patch stream applied to live document → canvas updates within ~2s for tweaks
  - Inspector edit → patch visible in PATCHES panel → iframe re-renders
  - Export endpoint returns TSX + manifest for any valid document
- Testing subagent: **backend 100%, frontend 100%** (`/app/test_reports/iteration_1.json`)

## Files of Interest
```
lib/ai-ui-builder/
├── catalog/components.ts      # 16-component CATALOG
├── catalog/schemas.ts         # Per-component Zod schemas
├── catalog/actions.ts         # ActionRef schema
├── document/types.ts          # BuilderDocument, ComponentNode, BuilderPatchOp
├── document/default-document.ts
├── document/patches.ts        # RFC 6902 engine
├── document/pointer.ts        # findNodeById / listNodes
├── document/validate.ts       # validateDocument / validateNode
├── runtime/registry.tsx       # React renderer per component
├── runtime/render-node.tsx    # Recursive node walker
├── llm/stream-client.ts       # Claude via Emergent LLM proxy
├── llm/prompts.ts             # Strict JSON Patch system prompt
└── export/compile.ts          # BuilderDocument → TSX files

components/builder/
├── builder-shell.tsx          # 4-panel layout
├── prompt-panel.tsx           # Prompt + mode routing + SSE consumer
├── component-tree.tsx         # Tree of nodes
├── property-inspector.tsx     # Patch-dispatching inspector
├── spatial-canvas.tsx         # 3-viewport canvas
├── preview-iframe.tsx         # Sandboxed iframe + mini renderer
├── code-diff-panel.tsx        # Patches / Code / Document tabs
└── store.tsx                  # Context + reducer + history

app/builder/page.tsx
app/api/builder/stream/route.ts
app/api/builder/export/route.ts
```

## Backlog
- **P1** Replace the iframe's `cdn.tailwindcss.com` with an inlined utility subset for CSP-strict envs
- **P1** Wire the export adapter into the existing `lib/ai-website-builder` scaffolding so we can deploy
  the BuilderDocument as a full Next.js project (right now we only export page TSX files)
- **P1** Multi-page navigation in the canvas (add a page picker; routes already exist in the IR)
- **P2** Progressive partial-JSON fallback when the model returns a non-streaming response
- **P2** Repair-patch round trip: when an op fails, ask the model to repair with the error message
- **P2** Add Playwright tests (deferred per user)
- **P2** Reorder children via drag in the component tree
- **P2** Persist BuilderDocument to MongoDB and to the URL hash for collaboration

## Smart Enhancement Idea
Add a **“Save as Template”** button that turns the current `BuilderDocument` into a reusable
starter (with a screenshot of the desktop iframe and a name). Users can then bootstrap new
projects from their own template library — this dramatically increases shareability and creates
a viral loop where each user produces assets that bring more users into the workspace.
