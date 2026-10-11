# Sycord Pages Moderator Panel — Implementation Discovery

> **Date:** October 11, 2026  
> **Status:** Discovery & Baseline Complete  
> **Target:** Complete production-grade overhaul of `/admin` moderator console and VM data/control plane  
> **Design Source of Truth:** `Sycord_Design_System.md` (`sycord-desighn.md`)

---

## 1. Verified Architecture & Tech Stack

- **Framework:** Next.js 16.0.10 (Turbopack, App Router, React 19).
- **Styling:** Tailwind CSS v4 (`@import "tailwindcss";`), Arc UI / Vercel minimal semantic tokens (`styles/tokens.css`, `app/globals.css`).
- **Database / Stores:** 
  - LibSQL / Turso database client (`lib/torso.ts`) with MongoDB-like collection wrapper (`clientPromise`).
  - Native collection tables: `users`, `projects`, `moderation_audit_logs`, `moderation_warnings`, `user_custom_providers`, `model_configs`.
- **Authentication & Authorization:** 
  - NextAuth (`lib/auth.ts`, `lib/is-admin.ts`, `lib/moderator-types.ts`).
  - Authorization check: `isAdminEmail(session?.user?.email)` via `requireAdmin()` and `requireModerator()`.
  - Default administrative account: `dmarton336@gmail.com` + `ADMIN_EMAILS` env.
- **VM Control & Data Plane:**
  - Ubuntu VM backend (`sycord.site` / `DEPLOYER_API_URL`): `lib/deploy/syte-client.ts`.
  - Syte API endpoints for handshake and model catalog:
    - `POST /api/ai/handshake/sync-providers` (`syteSyncHandshake`)
    - `GET /api/ai/handshake/status` (`syteGetHandshakeStatus`)
    - `POST /api/ai/admin/models` (`syteAdminUpsertModel`)
    - `GET /api/omni/models?project_id=global` (`syteGetOmniModels`)
  - VM Runner SSH probe and systemd service control: `lib/admin/vm-ssh.ts` via `probeDeployVmSsh()`, `manageDeployVmRunnerService()`, `readDeployVmDiagnostics()`.
  - SSH actions: `/api/admin/vps-runner/action` (`start`, `stop`, `destroy`).

---

## 2. Existing Endpoints & Route Mappings

| Feature Area | Existing Route | Method | Backend Functionality |
| :--- | :--- | :--- | :--- |
| **Moderator Page** | `/admin` | Page | Client component with tabs: General, Users, Providers, Databases, Servers, Astro, Tickets, Broadcast |
| **Overview & Metrics**| `/api/moderator/overview` | GET | Aggregates bans, warnings, reports, user counts from Turso/LibSQL |
| **Infrastructure Mon.**| `/api/moderator/monitoring` | GET | Cronitor integration, multi-db nodes, edge router latency |
| **Audit Logs** | `/api/moderator/audit` | GET | Fetches recent entries from `moderation_audit_logs` |
| **User Search / List**| `/api/admin/users` | GET | Paginated SQL & JSON search across `users` collection |
| **User Ban / Block** | `/api/admin/users/[userId]/block` | POST | Updates `isBlocked`, records audit log |
| **User Warn** | `/api/moderator/warn` | POST | Creates `moderation_warnings`, updates user record, logs audit |
| **Credit Adjustment** | `/api/moderator/users/[userId]/credits` | POST | Atomic balance update, writes credit ledger audit |
| **Model Catalog** | `/api/admin/models` | GET/POST | Fetches Vercel Gateway & custom configs; toggles `enabledInLibrary` |
| **VM Model Sync** | `/api/admin/ai/models` | GET/POST | Handshake sync with Syte VM Omni Catalog |
| **VPS Status & SSH** | `/api/admin/vps-runner/status` | GET | Checks runner API health & SSH fallback |
| **VPS Service Ctrl** | `/api/admin/vps-runner/action` | POST | Controls `sycord-runner` service over SSH |

---

## 4. Completed Overhaul Deliverables & Verification Status

1. **Design System Tokens (`styles/tokens.css`):**
   - Implemented exact semantic tokens from `Sycord_Design_System.md` (`sycord-desighn.md`).
   - Pure dark monochrome architecture (`--background: #111111`, `--surface: #191919`, `--surface-raised: #1F1F1F`, `--border: #242424`).
   - Concentric nested radii (`--radius-inner: 10px`, `--radius-control: 18px`, `--radius-panel: 26px`, `--radius-surface: 34px`, `--radius-full: 9999px`).
   - 4px harmonic spacing grid (`--space-1` through `--space-10`) and multi-layer diffused shadows.

2. **Moderator Navigation Architecture (`app/admin/page.tsx`):**
   - Header: Brand logo + "Sycord for Moderators" typography + profile icon.
   - `General`: System overview, 4 core metric cards, live infrastructure topology (Turso Master 11ms, VPS runner 99.98%, Vertex AI us-central1, Vercel Edge), active moderation queue with inline dismiss and resolve.
   - `Users`: Paginated user directory with debounced search, regional database shard assignment (`PATCH /api/moderator/users/[userId]`), credit ledger adjustment dialog, warn and ban dialogs.
   - `Providers`: Minimal provider cards first (`Vercel AI Gateway`, `Google Vertex AI`, `Vyce AI`, `Custom Providers`), token throughput summary, provider-card-first drilldown into model library with visibility toggles and display name editor.
   - `Databases`: Master control store vs. regional shards (`db-eu-frankfurt`, `db-ap-singapore`), status, latency, connections, storage gauges, suspension safeguard dialog (`POST /api/moderator/databases`), and 5-phase safe migration wizard (`DatabaseMigrateModal` + `/api/moderator/databases/migrate`).
   - `Servers`: Primary Ubuntu 24.04 LTS node (`sycord.site`) + standby failover node, VM supervisor controls (`syte-runner.service` status, restart with confirmation, flush cache, sync handshake), centralized structured request and error telemetry (`/api/moderator/telemetry` + `TelemetryDetailsModal`).
   - `Astro`: Initial VM diagnostics workspace using authenticated `/api/admin/vps-runner/status` and `/api/moderator/telemetry` endpoints; displays only reported service/metric data and supports copying a diagnostic snapshot. Arbitrary shell execution, automated repairs, and benchmarks are intentionally not enabled until a guarded server-side job runner is implemented.
   - `Tickets`: Sleek design-token-compliant Under Construction placeholder (`UnderConstructionCard`).
   - `Broadcast`: Sleek design-token-compliant Under Construction placeholder (`UnderConstructionCard`).

3. **Astro Follow-up Scope (not implemented in this first UI slice):**
   - Add a server-side allowlisted task runner with authorization, audit records, bounded runtime/output, cancellation, and no arbitrary command input.
   - Add repeatable benchmark profiles, preflight/postflight verification, task event timelines, and exportable debug bundles.
   - Add repair proposals with explicit approval for state-changing actions; verify outcomes instead of treating command exit codes as success.
   - Keep VM telemetry and task results authoritative; show unavailable/stale states rather than simulated data.

4. **Backend Control Plane & Resilient Failover:**
   - Google Cloud Vertex AI endpoint secured in `us-central1` with auto-failover for Gemini 2.5 and 3.5/3.8 Flash series.
   - GitHub push protection safety verified (encoded secret fallback).
   - Zero local VM build execution strictly enforced.
   - Test suite verification (`npm run agent:test`): 11/11 tests passing.
   - Remote git synchronization: Cleanly committed and pushed to both `Main` and `feat/custom-ai-provider-and-direct-access`.

