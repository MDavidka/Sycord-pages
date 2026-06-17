# DEPRECATED — single shared "vm-runner" service

This Fastify service implemented the **single shared runner** model: one
persistent Node process (systemd `sycord-vm-runner`, port 5050) on one VPS that
built and ran every generated site behind nginx + cloudflared.

It has been **replaced by the container-per-project architecture**:

- Infra scripts and the workspace image live in [`/infra`](../infra).
- Provisioning + build/deploy over SSH is in
  [`lib/admin/workspace-provision.ts`](../lib/admin/workspace-provision.ts).
- User-scoped APIs live under `app/api/workspace/*`
  (`provision`, `deploy`, `deploy/stream`, `status`, `destroy`).
- The admin "Runner" tab APIs under `app/api/admin/vps-runner/*` now manage the
  Docker host and workspace containers instead of proxying to port 5050.

Nothing in the application references this directory anymore. It is kept only
for historical reference and can be removed once no longer needed.
