"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Server, Play, Square, RotateCcw, Loader2, Check, AlertTriangle, ArrowLeft, ExternalLink, ShieldCheck, Globe, Power, Lock, Terminal, ScrollText, ChevronDown, ChevronUp, Wifi, WifiOff,  } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type RunnerStatus = {
  online: boolean
  runner: boolean
  tunnel: boolean
  httpOk?: boolean
  uptime?: string | null
  flaskVersion?: string | null
  warnings?: string[]
  error?: string
  envLoaded?: {
    cloudflareApiKey: boolean
    cloudflareZoneId: boolean
  }
  activeDeployments?: string[]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function SetupPage() {
  // Runner status
  const [status, setStatus] = useState<RunnerStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)

  // Action loading states
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Live logs
  const [logs, setLogs] = useState<string[]>([])
  const [logsOpen, setLogsOpen] = useState(false)
  const [logType, setLogType] = useState<"runner" | "tunnel" | "all">("runner")
  const logRef = useRef<HTMLDivElement>(null)

  // Setup wizard state
  const [wizardOpen, setWizardOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [loadingStep, setLoadingStep] = useState<number | null>(null)
  const [authUrl, setAuthUrl] = useState<string | null>(null)
  const [tunnelId, setTunnelId] = useState<string | null>(null)
  const [sslCert, setSslCert] = useState("")
  const [sslKey, setSslKey] = useState("")

  // ── Fetch status ────────────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/vps/status")
      const data = await res.json()
      setStatus(data)
    } catch {
      setStatus({ online: false, runner: false, tunnel: false, error: "Network error" })
    } finally {
      setStatusLoading(false)
    }
  }, [])

  // ── Fetch logs ──────────────────────────────────────────────────────────
  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`/api/vps/logs?type=${logType}&lines=100`)
      const data = await res.json()
      if (data.logs) setLogs(data.logs)
    } catch {
      // silent
    }
  }, [logType])

  // ── Auto-refresh status every 15s and logs every 5s ─────────────────────
  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 15000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  useEffect(() => {
    if (logsOpen) {
      fetchLogs()
      const interval = setInterval(fetchLogs, 5000)
      return () => clearInterval(interval)
    }
  }, [logsOpen, fetchLogs])

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [logs])

  // ── Runner actions ──────────────────────────────────────────────────────
  const runAction = async (action: "start" | "stop" | "restart") => {
    try {
      setActionLoading(action)
      const res = await fetch("/api/vps/restart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Action failed")
      toast.success(data.message)
      // Refresh status after action
      setTimeout(fetchStatus, 1500)
    } catch (err: any) {
      toast.error(err.message || "Failed to execute action")
    } finally {
      setActionLoading(null)
    }
  }

  // ── The embedded runner script that gets written to the VPS ─────────────
  const pythonRunner = `from __future__ import annotations

import importlib
import json
import logging
import os
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

REQUIRED_PACKAGES = {"flask": "flask", "requests": "requests"}
_missing = []
for _d, _i in REQUIRED_PACKAGES.items():
    try:
        importlib.import_module(_i)
    except ImportError:
        _missing.append(_d)

if _missing:
    print(f"[WARN] Missing packages: {', '.join(_missing)}. pip install {' '.join(_missing)}", file=sys.stderr)

try:
    from flask import Flask, Response, abort, jsonify, request, send_from_directory
except ImportError:
    print("[FATAL] Flask not installed. Run: python3 -m pip install flask", file=sys.stderr)
    sys.exit(1)

try:
    import requests as _req
except ImportError:
    _req = None

BASE_DIR = Path(os.environ.get("SYCORD_DATA_DIR", "/var/sycord/data"))
PROJECTS_DIR = BASE_DIR / "projects"
LOG_FILE = BASE_DIR / "server.log"
PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE.parent.mkdir(parents=True, exist_ok=True)

CF_API_KEY = os.environ.get("CLOUDFLARE_API_KEY", "")
CF_ZONE_ID = os.environ.get("CLOUDFLARE_ZONE_ID", "")

file_handler = logging.FileHandler(str(LOG_FILE))
file_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
logger = logging.getLogger("sycord")
logger.setLevel(logging.INFO)
logger.addHandler(file_handler)
logger.addHandler(logging.StreamHandler())

app = Flask(__name__)

def _check_tool(name):
    return shutil.which(name) is not None

def _project_dir(pid):
    return PROJECTS_DIR / os.path.basename(pid)

def _meta_path(pid):
    return _project_dir(pid) / ".meta.json"

def _read_meta(pid):
    m = _meta_path(pid)
    return json.loads(m.read_text()) if m.exists() else None

def _write_meta(pid, data):
    _meta_path(pid).write_text(json.dumps(data, default=str))

def _ensure_dns(subdomain):
    if not CF_API_KEY or not CF_ZONE_ID or not _req:
        return {"success": False, "action": "skipped"}
    fqdn = f"{subdomain}.sycord.site"
    hdr = {"Authorization": f"Bearer {CF_API_KEY}", "Content-Type": "application/json"}
    try:
        chk = _req.get(f"https://api.cloudflare.com/client/v4/zones/{CF_ZONE_ID}/dns_records?name={fqdn}", headers=hdr, timeout=10).json()
        payload = {"type": "CNAME", "name": subdomain, "content": "server.sycord.site", "proxied": True, "ttl": 1}
        if chk.get("success") and chk.get("result"):
            rid = chk["result"][0]["id"]
            r = _req.put(f"https://api.cloudflare.com/client/v4/zones/{CF_ZONE_ID}/dns_records/{rid}", headers=hdr, json=payload, timeout=10).json()
            if r.get("success"):
                logger.info("DNS updated: %s", fqdn)
                return {"success": True, "action": "updated"}
            return {"success": False, "action": "updated", "error": str(r.get("errors", []))}
        r = _req.post(f"https://api.cloudflare.com/client/v4/zones/{CF_ZONE_ID}/dns_records", headers=hdr, json=payload, timeout=10).json()
        if r.get("success"):
            logger.info("DNS created: %s", fqdn)
            return {"success": True, "action": "created"}
        return {"success": False, "action": "created", "error": str(r.get("errors", []))}
    except Exception as e:
        logger.error("DNS error for %s: %s", fqdn, e)
        return {"success": False, "action": "skipped", "error": str(e)}

def _build_project(project_id, project_dir):
    pkg_json = project_dir / "package.json"
    if not pkg_json.is_file():
        return {"built": False, "logs": [], "reason": "no package.json"}
    if not _check_tool("npm"):
        logger.error("npm is not installed on the server")
        return {"built": False, "logs": ["npm is not installed"], "error": "npm not found"}

    # --- AI Code Forgiveness: Strip tsc and inject terser ---
    try:
        pkg = json.loads(pkg_json.read_text(encoding="utf-8"))
        modified = False

        # 1. Strip TypeScript strict checking from build script
        if "scripts" in pkg and "build" in pkg["scripts"]:
            old_build = pkg["scripts"]["build"]
            # Remove 'tsc &&', 'tsc -b &&', 'vue-tsc &&' etc.
            new_build = old_build.replace("tsc && ", "").replace("tsc -b && ", "").replace("vue-tsc && ", "").strip()
            if new_build != old_build:
                pkg["scripts"]["build"] = new_build
                modified = True

        # 2. Inject terser into devDependencies if vite is used
        is_vite = "vite" in pkg.get("devDependencies", {}) or "vite" in pkg.get("dependencies", {})
        has_terser = "terser" in pkg.get("devDependencies", {}) or "terser" in pkg.get("dependencies", {})
        if is_vite and not has_terser:
            if "devDependencies" not in pkg:
                pkg["devDependencies"] = {}
            pkg["devDependencies"]["terser"] = "^5.31.0"
            modified = True

        if modified:
            pkg_json.write_text(json.dumps(pkg, indent=2), encoding="utf-8")
            logger.info("Applied AI code forgiveness to package.json for %s", project_id)
    except Exception as e:
        logger.warning("Failed to parse/modify package.json for %s: %s", project_id, e)
    # --------------------------------------------------------

    build_env = os.environ.copy()
    node_bin = str(project_dir / "node_modules" / ".bin")
    build_env["PATH"] = node_bin + os.pathsep + build_env.get("PATH", "")
    build_logs = []
    logger.info("Detected buildable project %s \\u2013 starting build", project_id)
    install_cmd = ["npm", "install", "--no-fund", "--no-audit", "--legacy-peer-deps"]
    logger.info("Build [install] project %s \\u2013 running: %s", project_id, " ".join(install_cmd))
    try:
        result = subprocess.run(install_cmd, cwd=str(project_dir), capture_output=True, text=True, timeout=120, env=build_env)
        if result.stdout.strip():
            logger.info("Build [install] stdout for project %s:\\n%s", project_id, result.stdout.strip())
            build_logs.append(result.stdout.strip())
        if result.stderr.strip():
            logger.warning("Build [install] stderr for project %s:\\n%s", project_id, result.stderr.strip())
            build_logs.append(result.stderr.strip())
        if result.returncode != 0:
            err = f"npm install exited with code {result.returncode}"
            logger.error("Build [install] failed for %s: %s", project_id, err)
            return {"built": False, "logs": build_logs, "error": err}
    except subprocess.TimeoutExpired:
        logger.error("Build [install] %s: timed out", project_id)
        return {"built": False, "logs": build_logs, "error": "npm install timed out"}
    except Exception as exc:
        logger.error("Build [install] %s exception: %s", project_id, exc)
        return {"built": False, "logs": build_logs, "error": str(exc)}
    try:
        pkg = json.loads(pkg_json.read_text())
    except Exception:
        pkg = {}
    if "build" not in pkg.get("scripts", {}):
        logger.info("Build [build] skipped for %s \\u2013 no build script", project_id)
        return {"built": True, "logs": build_logs}
    build_cmd = ["npm", "run", "build"]
    logger.info("Build [build] project %s \\u2013 running: %s", project_id, " ".join(build_cmd))
    try:
        result = subprocess.run(build_cmd, cwd=str(project_dir), capture_output=True, text=True, timeout=180, env=build_env)
        if result.stdout.strip():
            logger.info("Build [build] stdout for project %s:\\n%s", project_id, result.stdout.strip())
            build_logs.append(result.stdout.strip())
        if result.stderr.strip():
            logger.warning("Build [build] stderr for project %s:\\n%s", project_id, result.stderr.strip())
            build_logs.append(result.stderr.strip())
        if result.returncode != 0:
            err = f"npm run build exited with code {result.returncode}"
            logger.error("Build [build] failed for %s: %s", project_id, err)
            return {"built": False, "logs": build_logs, "error": err}
    except subprocess.TimeoutExpired:
        logger.error("Build [build] %s: timed out", project_id)
        return {"built": False, "logs": build_logs, "error": "npm run build timed out"}
    except Exception as exc:
        logger.error("Build [build] %s exception: %s", project_id, exc)
        return {"built": False, "logs": build_logs, "error": str(exc)}
    logger.info("Build completed successfully for %s", project_id)
    return {"built": True, "logs": build_logs}

@app.before_request
def serve_subdomain():
    host = request.host.split(":")[0]
    parts = host.split(".")
    if len(parts) <= 2:
        return
    sub = parts[0]
    if request.path.startswith("/api/"):
        return
    pd = PROJECTS_DIR / sub
    if not pd.is_dir():
        return
    rel = request.path.lstrip("/") or "index.html"
    tgt = pd / rel
    try:
        tgt.resolve().relative_to(pd.resolve())
    except ValueError:
        abort(403)
    if tgt.is_file():
        return send_from_directory(str(pd), rel)
    if (pd / rel / "index.html").is_file():
        return send_from_directory(str(pd / rel), "index.html")
    abort(404)

@app.route("/")
def index():
    return Response("flask is working on server", content_type="text/plain; charset=utf-8")

@app.route("/api/status")
def api_status():
    pc = sum(1 for p in PROJECTS_DIR.iterdir() if p.is_dir() and not p.name.startswith(".")) if PROJECTS_DIR.is_dir() else 0
    w = list(_missing) if _missing else []
    if not _check_tool("npm"):
        w.append("npm is not installed")
    if not _check_tool("node"):
        w.append("node is not installed")
    return jsonify(success=True, status="running", python_version=sys.version, project_count=pc, npm_installed=_check_tool("npm"), node_installed=_check_tool("node"), dns_auto_config=bool(CF_API_KEY and CF_ZONE_ID), warnings=w)

@app.route("/api/deploy/<project_id>", methods=["POST"])
def deploy(project_id):
    data = request.get_json(silent=True)
    if not data or "files" not in data: logger.error("Deploy %s: missing files", project_id)
        return jsonify(success=False, error="Request body must include 'files'"), 400
    files = data["files"]
    subdomain = data.get("subdomain")
    if not files:
        return jsonify(success=False, error="No files provided"), 400
    logger.info("Deploy start: %s (%d files, sub=%s)", project_id, len(files), subdomain)
    pd = _project_dir(project_id)
    if pd.exists():
        for it in pd.iterdir():
            if it.name == ".meta.json":
                continue
            shutil.rmtree(it) if it.is_dir() else it.unlink()
    else:
        pd.mkdir(parents=True, exist_ok=True)
    written = 0
    for f in files:
        rp = f.get("path", "")
        ct = f.get("content", "")
        if not rp:
            continue
        sp = os.path.normpath(rp).lstrip(os.sep)
        if sp.startswith(".."):
            continue
        dest = pd / sp
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(ct, encoding="utf-8")
        written += 1
    # Build step
    build_result = _build_project(project_id, pd)
    built = build_result.get("built", False)
    # Serve from build output dir if exists
    serve_dir = pd
    if built:
        for od in ("dist", "build", "out"):
            if (pd / od).is_dir():
                serve_dir = pd / od
                logger.info("Deploy %s: serving from %s/", project_id, od)
                break
    if subdomain:
        lnk = PROJECTS_DIR / subdomain
        if lnk.exists() or lnk.is_symlink():
            if lnk.is_symlink():
                lnk.unlink()
            elif lnk.resolve() != serve_dir.resolve():
                shutil.rmtree(lnk)
        if not lnk.exists():
            lnk.symlink_to(serve_dir)
    dns = _ensure_dns(subdomain) if subdomain else {"action": "skipped"}
    domain = f"{subdomain}.sycord.site" if subdomain else None
    meta = _read_meta(project_id) or {}
    meta.update({"project_id": project_id, "subdomain": subdomain, "domain": domain, "files_count": written, "deployed_at": datetime.now(timezone.utc).isoformat(), "dns_status": dns.get("action", "skipped"), "build": built, "build_error": build_result.get("error")})
    _write_meta(project_id, meta)
    logger.info("Deployed project %s (%d files, subdomain=%s, build=%s)", project_id, written, subdomain, built)
    return jsonify(success=True, project_id=project_id, domain=domain, files_count=written, dns=dns, build=build_result)

@app.route("/api/projects/<project_id>")
def project_info(project_id):
    meta = _read_meta(project_id)
    if not meta:
        return jsonify(success=False, error="Not found"), 404
    pd = _project_dir(project_id)
    meta["files"] = [str(p.relative_to(pd)) for p in sorted(pd.rglob("*")) if p.is_file() and p.name != ".meta.json"] if pd.is_dir() else []
    meta["success"] = True
    return jsonify(meta)

@app.route("/api/logs")
def api_logs():
    pid = request.args.get("project_id")
    limit = min(int(request.args.get("limit", 200)), 500)
    if not pid:
        return jsonify(success=False, error="project_id required"), 400
    lines = []
    if LOG_FILE.exists():
        al = LOG_FILE.read_text().splitlines()
        rel = [l for l in al if pid in l]
        lines = rel[-limit:] if rel else al[-limit:]
    return jsonify(success=True, project_id=pid, logs=lines)

@app.route("/api/projects/<project_id>", methods=["DELETE"])
def delete_project(project_id):
    pd = _project_dir(project_id)
    if not pd.exists():
        return jsonify(success=False, error="Not found"), 404
    meta = _read_meta(project_id)
    if meta and meta.get("subdomain"):
        lnk = PROJECTS_DIR / meta["subdomain"]
        if lnk.is_symlink():
            lnk.unlink()
    shutil.rmtree(pd)
    logger.info("Deleted %s", project_id)
    return jsonify(success=True, message="Deleted")

if __name__ == "__main__": logger.info("Python %s", sys.version)
    if _missing:
        logger.warning("Missing packages: %s", ", ".join(_missing))
    if not _check_tool("npm"):
        logger.error("npm is not installed on the server")
    if not _check_tool("node"):
        logger.error("node is not installed on the server")
    if not CF_API_KEY or not CF_ZONE_ID:
        logger.warning("CLOUDFLARE_API_KEY/ZONE_ID not set. DNS auto-config disabled.")
    port = int(os.environ.get("PORT", 5000))
    logger.info("Starting Sycord Pages server on port %d", port)
    app.run(host="0.0.0.0", port=port)`

  // ── Setup wizard step execution ─────────────────────────────────────────
  const runStep = async (stepNumber: number, action: string) => {
    try {
      setLoadingStep(stepNumber)
      toast(`Running Step ${stepNumber + 1}...`)

      const body = action === "start_server"
        ? { action, pythonRunnerScript: pythonRunner, sslCert, sslKey }
        : { action }

      const res = await fetch("/api/vps/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || `Failed step ${stepNumber + 1}.`)
      }

      if (action === "auth") {
        if (data.alreadyAuthorized) {
          toast.success(data.message)
          setCurrentStep(stepNumber + 1)
        } else if (data.authUrl) {
          setAuthUrl(data.authUrl)
          toast.success(data.message)
        }
      } else {
        if (action === "config" && data.tunnelId) {
          setTunnelId(data.tunnelId)
        }
        toast.success(data.message)
        setCurrentStep(stepNumber + 1)
      }

    } catch (error: any) {
      toast.error(error.message || "An error occurred during VPS setup.")
    } finally {
      setLoadingStep(null)
    }
  }

  const handleAuthCompleted = () => setCurrentStep(2)

  // ── Status display helpers ──────────────────────────────────────────────
  const runnerOnline = status?.runner === true
  const tunnelOnline = status?.tunnel === true

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/admin">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Server className="h-6 w-6 text-primary" />
                <div className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background ${
                  statusLoading ? "bg-yellow-500 animate-pulse" : runnerOnline ?"bg-green-500" : "bg-red-500"
                }`} />
              </div>
              <span className="text-lg font-semibold">Runner</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {runnerOnline && (
              <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/5">
                <Wifi className="h-3 w-3 mr-1" /> Online
              </Badge>
            )}
            {!runnerOnline && !statusLoading && (
              <Badge variant="outline" className="text-red-500 border-red-500/30 bg-red-500/5">
                <WifiOff className="h-3 w-3 mr-1" /> Offline
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-3xl space-y-6">

        {/* ── Status Card ──────────────────────────────────────────────── */}
        <Card className="border-border">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`h-14 w-14 rounded-xl flex items-center justify-center ${
                  runnerOnline ? "bg-green-500/10" : "bg-red-500/10"
                }`}>
                  <Server className={`h-7 w-7 ${runnerOnline ? "text-green-500" : "text-red-500"}`} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">
                    {statusLoading ? "Checking…" : runnerOnline ? "Runner is Online" : "Runner is Offline"}
                  </h2>
                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                    {status?.uptime && <span>Uptime: {status.uptime}</span>}
                    {status?.httpOk ? <span className="text-green-400">Flask Serving ✓</span> : status?.runner ? <span className="text-yellow-500">Flask Starting...</span> : <span className="text-red-500">Flask Down</span>}
                    {tunnelOnline && <span className="text-blue-400">Tunnel ✓</span>}
                    {status?.online && !tunnelOnline && <span className="text-yellow-500">No tunnel</span>}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {!runnerOnline && (
                  <Button
                    onClick={() => runAction("start")}
                    disabled={!!actionLoading}
                    className="bg-green-600 hover:bg-green-700"
                    size="sm"
                  >
                    {actionLoading === "start" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
                    Start
                  </Button>
                )}
                {runnerOnline && (
                  <>
                    <Button
                      onClick={() => runAction("restart")}
                      disabled={!!actionLoading}
                      variant="outline"
                      size="sm"
                    >
                      {actionLoading === "restart" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RotateCcw className="h-4 w-4 mr-1" />}
                      Restart
                    </Button>
                    <Button
                      onClick={() => runAction("stop")}
                      disabled={!!actionLoading}
                      variant="outline"
                      size="sm"
                      className="text-red-500 hover:text-red-400 border-red-500/30"
                    >
                      {actionLoading === "stop" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Square className="h-4 w-4 mr-1" />}
                      Stop
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Warnings ─────────────────────────────────────────────────── */}
        {status?.warnings && status.warnings.length > 0 && (
          <Card className="border-yellow-500/30 bg-yellow-500/5">
            <CardContent className="p-4 space-y-2">
              {status.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                  <span className="text-yellow-200">{w}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* ── Live Logs ────────────────────────────────────────────────── */}
        <Card className="border-border">
          <CardHeader className="pb-2 cursor-pointer" onClick={() => setLogsOpen(!logsOpen)}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ScrollText className="h-4 w-4" />
                Live Logs
              </CardTitle>
              <div className="flex items-center gap-2">
                {logsOpen && (
                  <div className="flex gap-1">
                    {(["runner", "tunnel", "all"] as const).map(t => (
                      <button
                        key={t}
                        onClick={(e) => { e.stopPropagation(); setLogType(t) }}
                        className={`px-2 py-0.5 rounded text-xs ${logType === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
                {logsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </div>
          </CardHeader>
          {logsOpen && (
            <CardContent className="pt-0">
              <div
                ref={logRef}
                className="bg-black/50 rounded-lg p-3 font-mono text-xs leading-relaxed max-h-80 overflow-auto border border-border"
              >
                {logs.length === 0 ? (
                  <span className="text-muted-foreground">No logs available</span>
                ) : (
                  logs.map((line, i) => (
                    <div key={i} className={`${
                      line.includes("[ERROR]") || line.includes("[FATAL]") ? "text-red-400" :
                      line.includes("[WARN]") ? "text-yellow-400" :
                      line.includes("[INFO]") ? "text-zinc-400" : "text-zinc-500"
                    }`}>
                      {line}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          )}
        </Card>

        {/* ── Active Deployments ───────────────────────────────────────── */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Active Deployments
            </CardTitle>
            <CardDescription className="text-xs">
              List of currently running mini-servers
            </CardDescription>
          </CardHeader>
          <CardContent>
            {status?.activeDeployments && status.activeDeployments.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {status.activeDeployments.map((domain) => (
                  <Badge key={domain} variant="outline" className="text-green-400 border-green-500/30">
                    {domain}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">No active deployments found.</span>
            )}
          </CardContent>
        </Card>

        {/* ── Setup Wizard (collapsible) ───────────────────────────────── */}
        <Card className="border-border">
          <CardHeader className="pb-2 cursor-pointer" onClick={() => setWizardOpen(!wizardOpen)}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                Setup Wizard
                {currentStep >= 4 && <Badge variant="outline" className="text-green-500 border-green-500/30 ml-2 text-xs">Completed</Badge>}
              </CardTitle>
              {wizardOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
            <CardDescription className="text-xs mt-1">
              First-time setup: install dependencies, authorize Cloudflare, configure tunnel, and start the runner.
            </CardDescription>
          </CardHeader>
          {wizardOpen && (
            <CardContent className="space-y-4 pt-2">

              {/* Step 1: Init */}
              <div className={`p-4 rounded-lg border transition-all ${currentStep === 0 ? "border-primary bg-primary/5" : currentStep > 0 ? "border-border opacity-60" : "border-border opacity-40"}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${currentStep >= 0 ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>1</span>
                    <span className="text-sm font-medium">Load .env & Initialize VPS</span>
                  </div>
                  {currentStep > 0 ? <Check className="h-4 w-4 text-green-500" /> : currentStep === 0 && (
                    <Button onClick={() => runStep(0, "init")} disabled={loadingStep === 0} size="sm" variant="outline">
                      {loadingStep === 0 ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                    </Button>
                  )}
                </div>
                {currentStep === 0 && status?.envLoaded && (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline" className={status.envLoaded.cloudflareZoneId ? "text-green-500 border-green-500/30" : "text-yellow-500 border-yellow-500/30"}>
                      Zone ID: {status.envLoaded.cloudflareZoneId ? "Loaded" : "Missing"}
                    </Badge>
                    <Badge variant="outline" className={status.envLoaded.cloudflareApiKey ? "text-green-500 border-green-500/30" : "text-yellow-500 border-yellow-500/30"}>
                      API Key: {status.envLoaded.cloudflareApiKey ? "Loaded" : "Missing"}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Step 2: Auth */}
              <div className={`p-4 rounded-lg border transition-all ${currentStep === 1 ? "border-primary bg-primary/5" : currentStep > 1 ? "border-border opacity-60" : "border-border opacity-40"}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${currentStep >= 1 ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>2</span>
                    <span className="text-sm font-medium">Authorize Cloudflare</span>
                  </div>
                  {currentStep > 1 ? <Check className="h-4 w-4 text-green-500" /> : currentStep === 1 && !authUrl && (
                    <Button onClick={() => runStep(1, "auth")} disabled={loadingStep === 1} size="sm" variant="outline">
                      {loadingStep === 1 ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                    </Button>
                  )}
                </div>
                {currentStep === 1 && authUrl && (
                  <div className="mt-3 flex gap-2">
                    <a href={authUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-xs text-primary hover:underline">
                      Open auth link <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                    <Button variant="outline" size="sm" onClick={handleAuthCompleted} className="text-xs h-7">
                      Done
                    </Button>
                  </div>
                )}
              </div>

              {/* Step 3: Config */}
              <div className={`p-4 rounded-lg border transition-all ${currentStep === 2 ? "border-primary bg-primary/5" : currentStep > 2 ? "border-border opacity-60" : "border-border opacity-40"}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${currentStep >= 2 ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>3</span>
                    <span className="text-sm font-medium">Configure Tunnel & DNS</span>
                  </div>
                  {currentStep > 2 ? <Check className="h-4 w-4 text-green-500" /> : currentStep === 2 && (
                    <Button onClick={() => runStep(2, "config")} disabled={loadingStep === 2} size="sm" variant="outline">
                      {loadingStep === 2 ? <Loader2 className="h-3 w-3 animate-spin" /> : <Globe className="h-3 w-3" />}
                    </Button>
                  )}
                </div>
              </div>

              {/* Step 4: Start */}
              <div className={`p-4 rounded-lg border transition-all ${currentStep === 3 ? "border-primary bg-primary/5" : currentStep > 3 ? "border-border opacity-60" : "border-border opacity-40"}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${currentStep >= 3 ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>4</span>
                    <span className="text-sm font-medium">Start Server</span>
                  </div>
                  {currentStep > 3 ? <Check className="h-4 w-4 text-green-500" /> : currentStep === 3 && (
                    <Button onClick={() => runStep(3, "start_server")} disabled={loadingStep === 3} size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                      {loadingStep === 3 ? <Loader2 className="h-3 w-3 animate-spin" /> : <Power className="h-3 w-3" />}
                    </Button>
                  )}
                </div>
                {currentStep === 3 && (
                  <div className="mt-3 space-y-3">
                    <details className="text-xs text-muted-foreground">
                      <summary className="cursor-pointer flex items-center gap-1">
                        <Lock className="h-3 w-3" /> Optional: SSL certificates
                      </summary>
                      <div className="grid gap-2 md:grid-cols-2 mt-2">
                        <Textarea placeholder="cert.pem" className="font-mono text-xs h-20 resize-none" value={sslCert} onChange={e => setSslCert(e.target.value)} />
                        <Textarea placeholder="privkey.pem" className="font-mono text-xs h-20 resize-none" value={sslKey} onChange={e => setSslKey(e.target.value)} />
                      </div>
                    </details>
                  </div>
                )}
              </div>

              {/* Completed */}
              {currentStep >= 4 && (
                <div className="flex items-center justify-between p-4 rounded-lg border border-green-500/30 bg-green-500/5">
                  <div className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-500" />
                    <span className="text-sm font-medium text-green-400">Setup Complete</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <a href="https://server.sycord.site" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                      Test <ExternalLink className="h-3 w-3" />
                    </a>
                    <Button variant="ghost" size="sm" onClick={() => { setCurrentStep(0); setAuthUrl(null) }} className="text-xs h-7 text-muted-foreground">
                      Reset
                    </Button>
                  </div>
                </div>
              )}

            </CardContent>
          )}
        </Card>

      </main>
    </div>
  )
}
