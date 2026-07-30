# Glovix AI Builder (vendored)

This directory contains the [GlovixTech](https://github.com/GlovixTechnologies/GlovixTech)
open-source AI web-development environment, vendored into this Next.js project to
replace the previous "Syra" builder.

- Upstream: https://github.com/GlovixTechnologies/GlovixTech
- License: Apache License 2.0 (see `./LICENSE`)

## What was changed when porting from the original Vite app

The upstream project is a standalone Vite + React SPA. It is integrated here as a
client-only island inside Next.js:

- `import.meta.env.VITE_*` was replaced with `process.env.NEXT_PUBLIC_*`, and
  `import.meta.env.DEV/MODE` with `process.env.NODE_ENV`.
- `BrowserRouter` was swapped for `MemoryRouter` so the builder does not fight the
  Next.js router (see `App.tsx`).
- `src/index.css` was renamed to `glovix.css` and its `@tailwind` directives removed
  (the host app's Tailwind v4 pipeline supplies utilities).
- The Vite dev-server AI proxy (`/api/ai/chat`) is reimplemented as a Next.js route
  handler backed by **Google Gemini on Vertex AI** (via `lib/glovix-gemini.ts`),
  the same engine the old "Syra" builder used. It translates Glovix's
  OpenAI-style requests to Gemini and streams responses back as OpenAI-compatible
  SSE, so the client parser is unchanged. The provider API key is no longer
  required on the client.
- The mermaid CDN dynamic import is annotated with bundler-ignore comments.

## How it is mounted

- `components/glovix-builder.tsx` loads `glovix/App` with `next/dynamic({ ssr: false })`.
- `app/builder/page.tsx` exposes it full-screen at `/builder`.
- It is also embedded in the dashboard AI tab at `app/dashboard/sites/[id]/page.tsx`.

WebContainers require cross-origin isolation; the necessary COOP/COEP headers are set
for `/builder` and `/dashboard/sites/:id` in `next.config.mjs`.

## Configuration

See `.env.example` for environment variables. The builder runs on Gemini Vertex AI:
`GOOGLE_VERTEX_PROJECT` (+ `GOOGLE_VERTEX_LOCATION`) for full Vertex AI with ADC, or
`GOOGLE_AIAGENT_API` for an API key, with optional `GOOGLE_AIAGENT_MODEL`
(default `gemini-3.5-flash`).
