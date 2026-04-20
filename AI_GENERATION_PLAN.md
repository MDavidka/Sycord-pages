# AI Builder Pipeline (Reworked)

## Stage Overview

1. **Stage 0 — Validation Gate (No AI)**
   - Sanitize user prompt
   - Build cheatsheet from `componentManifest` keys
   - Enforce input bounds

2. **Stage 1 — Architect AI (Style JSON)**
   - Input: `{ prompt, cheatsheet }`
   - Output: validated component tree (Style JSON)
   - Validation: Zod schema + retry (max 3)

3. **Stage 2 — Manifest Resolver (No AI)**
   - Extract used components from Style JSON
   - Attach real shadcn/ui component source for each used component

4. **Stage 3 — Developer AI (Function JSON)**
   - Input: `styleJson + componentSources`
   - Output: state declarations, handlers, render injections
   - Validation: Zod schema + retry (max 3)

5. **Stage 4 — Orchestrator (No AI)**
   - Build imports/state/handler blocks
   - Render JSX recursively from Style JSON
   - Apply `render_injections`
   - Assemble final TSX

6. **Stage 5 — Build Gate**
   - Syntax/type diagnostics + build command checklist
   - Commands: `tsc --noEmit`, `npm run lint`, `npm run build`

## Implemented Endpoints

- `POST /api/ai/generate-style` → Stage 0 + Stage 1
- `POST /api/ai/generate-functions` → Stage 2 + Stage 3
- `POST /api/ai/orchestrate` → Stage 4
- `POST /api/ai/generate-build` → Stage 5

## Core Modules

- `lib/ai-builder/validation-gate.ts`
- `lib/ai-builder/manifest/index.ts`
- `lib/ai-builder/schemas.ts`
- `lib/ai-builder/manifest-resolver.ts`
- `lib/ai-builder/buildImports.ts`
- `lib/ai-builder/renderNode.ts`
- `lib/ai-builder/assemble.ts`
- `lib/ai-builder/llm.ts`
