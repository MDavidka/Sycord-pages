# AI Builder Pipeline (Prompt → Live)

The builder now follows a staged architecture:

1. **Prompt input** from `components/ai-website-builder.tsx`
2. **Style JSON** from `POST /api/ai/generate-plan`
3. **Function JSON** from `POST /api/ai/generate-functions`
4. **Deterministic orchestration** from `POST /api/ai/orchestrate` (no AI in this step)
5. **Persist generated files** to project pages
6. **Deploy** via `POST /api/deploy`

## Stage Responsibilities

### 1) Style stage (`/api/ai/generate-plan`)
- Input: user messages + component cheatsheet.
- Output: strict style tree JSON (`root`, nested `children`, component IDs/props).
- Purpose: define structure only (no state/handlers).

### 2) Function stage (`/api/ai/generate-functions`)
- Input: Style JSON + component source manifest + request context.
- Output: Function JSON (`state`, `handlers`, `render_injections`).
- Purpose: define logic only (no layout redesign).

### 3) Orchestration stage (`/api/ai/orchestrate`)
- Input: Style JSON + Function JSON.
- Output: concrete files for a buildable Vite app:
  - `package.json`
  - `tsconfig.json`
  - `vite.config.ts`
  - `index.html`
  - `src/main.tsx`
  - `src/style.css`
  - `src/components/ui.tsx`
  - `src/App.tsx`
- Purpose: pure mechanical assembly.

## Mental model

`Prompt → Style JSON → Function JSON → Files → Deploy`
