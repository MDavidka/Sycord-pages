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
| **Moderator Page** | `/admin` | Page | Client component with tabs: General, Users, Models, Providers, Servers, Tickets |
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

## 3. Discrepancies vs. Master Plan Specification

1. **Navigation Structure:**
   - Current `/admin` tabs: `General`, `Users`, `Models Library`, `Providers & Usage`, `Servers`, `Tickets & Broadcasts`.
   - Specified navigation:
     1. **General** — System overview & live indicators.
     2. **Users** — User lookup, region assignment & moderation.
     3. **Providers** — Provider cards overview first, detail view contains its models (no redundant standalone Models tab).
     4. **Databases** — Master & regional databases, shard status, migration wizard.
     5. **Servers** — VM operations, primary/backup nodes, unified request & error telemetry.
     6. **Tickets** — Under construction placeholder.
     7. **Broadcast** — Under construction placeholder.
2. **Design Tokens:**
   - Missing explicit tokens in `styles/tokens.css`: `--radius-full`, `--shadow-border`, `--shadow-card`, `--shadow-floating`, `--shadow-overlay`, `--space-*` harmonic grid.
3. **Database & Region Assignment:**
   - Currently static in `/api/moderator/monitoring`. Needs dedicated backend API `/api/moderator/databases` supporting:
     - Master vs. regional database registry.
     - Connection testing (SSRF-protected).
     - Suspension workflow.
     - Migration preflight, copy, verify, cutover, rollback.
4. **Unified Error & Telemetry Ingestion:**
   - Needs `/api/moderator/telemetry` for correlated event streams across AI chat, provider gateway, VM runner, and databases.
5. **Continuous VM Synchronization:**
   - Monotonic versioning of provider/model configs with acknowledgement status tracking.
