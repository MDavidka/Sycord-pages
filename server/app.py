"""
Sycord Pages – Flask VPS Runner
================================
Complete deployment handler that:
- Serves deployed websites via subdomain detection
- Auto-configures DNS CNAME records for new subdomains
- Validates required packages and environment variables at startup
- Provides detailed build/deploy logging
- Exposes a health-check and status API

API surface
-----------
POST   /api/deploy/<project_id>        – upload / update project files
GET    /api/projects/<project_id>       – project metadata
GET    /api/logs?project_id=…&limit=…   – recent server logs
DELETE /api/projects/<project_id>       – remove a project and its files
GET    /api/status                      – runner health + diagnostics
"""

from __future__ import annotations

import importlib
import json
import logging
import os
import re
import shutil
import signal
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# Dependency check – warn clearly about any missing packages
# ---------------------------------------------------------------------------
REQUIRED_PACKAGES = {
    "flask": "flask",
    "requests": "requests",
}

_missing: list[str] = []
for _display, _import in REQUIRED_PACKAGES.items():
    try:
        importlib.import_module(_import)
    except ImportError:
        _missing.append(_display)

if _missing:
    print(
        f"[WARN] Missing Python packages: {', '.join(_missing)}. "
        f"Install them with:  pip install {' '.join(_missing)}",
        file=sys.stderr,
    )

# Flask is mandatory – bail out with a clear message if absent
try:
    from flask import Flask, Response, abort, jsonify, request, send_from_directory
except ImportError:
    print(
        "[FATAL] Flask is not installed. Run: python3 -m pip install flask",
        file=sys.stderr,
    )
    sys.exit(1)

# requests is optional for basic serving but required for DNS auto-config
try:
    import requests as _requests_mod
except ImportError:
    _requests_mod = None  # type: ignore[assignment]

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

def _load_env_server() -> None:
    """Load key=value pairs from ``.env.server`` (next to this script) into
    ``os.environ`` so that Cloudflare / GitHub credentials are available even
    when the process is started via plain ``nohup``.

    Lines starting with ``#`` and empty lines are silently skipped.
    Existing env vars take precedence (won't be overwritten).
    """
    env_file = Path(__file__).resolve().parent / ".env.server"
    if not env_file.is_file():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip()
        # Don't overwrite env vars that are already set
        if key and key not in os.environ:
            os.environ[key] = value

_load_env_server()

BASE_DIR = Path(os.environ.get("SYCORD_DATA_DIR", "/var/sycord/data"))
PROJECTS_DIR = BASE_DIR / "projects"
LOG_FILE = BASE_DIR / "server.log"
NEXT_SERVER_PORT_BASE = int(os.environ.get("SYCORD_NEXT_SERVER_PORT_BASE", "6100"))

# Ensure directories exist
PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE.parent.mkdir(parents=True, exist_ok=True)

# Environment variables used for DNS auto-config
CF_API_KEY = os.environ.get("CLOUDFLARE_API_KEY", "")
CF_ZONE_ID = os.environ.get("CLOUDFLARE_ZONE_ID", "")

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
file_handler = logging.FileHandler(str(LOG_FILE))
file_handler.setFormatter(
    logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")
)

logger = logging.getLogger("sycord")
logger.setLevel(logging.INFO)
logger.addHandler(file_handler)
logger.addHandler(logging.StreamHandler())

# ---------------------------------------------------------------------------
# Startup diagnostics
# ---------------------------------------------------------------------------

def _log_startup_diagnostics() -> None:
    """Log useful runtime info and warn about anything misconfigured."""
    logger.info("Python %s", sys.version)
    logger.info("Data directory: %s", BASE_DIR)
    logger.info("Projects directory: %s", PROJECTS_DIR)

    env_server_path = Path(__file__).resolve().parent / ".env.server"
    if env_server_path.is_file():
        logger.info("Loaded .env.server from %s", env_server_path)
    else:
        logger.info("No .env.server found (server env vars from OS environment only)")

    if _missing:
        logger.warning(
            "[WARN] Missing optional packages: %s – some features may not work. "
            "Install with: pip install %s",
            ", ".join(_missing),
            " ".join(_missing),
        )

    if not CF_API_KEY or not CF_ZONE_ID:
        logger.warning(
            "[WARN] CLOUDFLARE_API_KEY or CLOUDFLARE_ZONE_ID not set. "
            "Automated DNS record creation for new subdomains is disabled."
        )
    else:
        logger.info("Cloudflare DNS auto-config is enabled (zone %s…)", CF_ZONE_ID[:8])

    # Check npm / node availability
    npm_ok = _check_tool("npm")
    node_ok = _check_tool("node")
    if not npm_ok:
        logger.error("[WARN] npm is not installed – project builds will fail")
    if not node_ok:
        logger.error("[WARN] node is not installed – project builds will fail")
    if npm_ok and node_ok:
        try:
            nv = subprocess.check_output(["node", "--version"], text=True).strip()
            logger.info("Node.js %s available for project builds", nv)
        except Exception:
            pass

    # Check for git (needed for some deploy workflows)
    if not _check_tool("git"):
        logger.warning("[WARN] git is not installed – some deploy operations may fail")

    # List existing projects
    if PROJECTS_DIR.is_dir():
        projects = [
            p.name for p in PROJECTS_DIR.iterdir()
            if p.is_dir() and not p.name.startswith(".")
        ]
        logger.info("Existing deployments: %d %s", len(projects), projects[:10])


def _check_tool(name: str) -> bool:
    """Return True if *name* is available on $PATH."""
    return shutil.which(name) is not None


def _sanitize_vite_config(project_dir: Path) -> None:
    """Remove ``minify: 'terser'`` / ``minify: "terser"`` from vite.config
    files so that Vite falls back to its default esbuild minifier.

    Terser became an optional dependency in Vite v3; AI-generated configs
    sometimes reference it even though it's not in package.json.
    """
    for name in ("vite.config.ts", "vite.config.js", "vite.config.mts", "vite.config.mjs"):
        cfg = project_dir / name
        if not cfg.is_file():
            continue
        original = cfg.read_text()
        # Remove minify: 'terser' or minify: "terser" (with optional
        # surrounding whitespace and trailing comma) so esbuild is used.
        cleaned = re.sub(
            r"""\s*minify\s*:\s*['"]terser['"]\s*,?\s*""",
            "\n",
            original,
        )
        if cleaned != original:
            cfg.write_text(cleaned)
            logger.info(
                "Sanitized %s for project in %s – removed terser minify option",
                name, project_dir,
            )


def _build_project(project_id: str, project_dir: Path) -> dict:
    """Run npm install + npm run build inside *project_dir* if package.json exists.

    Returns a dict with ``built`` (bool), ``logs`` (list[str]),
    and optional ``error`` (str).
    """
    pkg_json = project_dir / "package.json"
    if not pkg_json.is_file():
        return {"built": False, "logs": [], "reason": "no package.json"}

    if not _check_tool("npm"):
        logger.error("npm is not installed on the server")
        return {"built": False, "logs": ["npm is not installed"], "error": "npm not found"}

    # Build environment: ensure node_modules/.bin is on PATH so tools like
    # vite, tsc, next etc. can be found by npm scripts.
    build_env = os.environ.copy()
    node_bin = str(project_dir / "node_modules" / ".bin")
    build_env["PATH"] = node_bin + os.pathsep + build_env.get("PATH", "")

    build_logs: list[str] = []
    error_msg: str | None = None

    # Pre-build: ensure vite.config does not reference terser (optional dep
    # since Vite v3).  Replace with default esbuild minifier to avoid
    # "terser not found" build failures.
    _sanitize_vite_config(project_dir)

    # Step 1: npm install
    logger.info(
        "Detected buildable project %s – starting build", project_id,
    )

    install_cmd = ["npm", "install", "--no-fund", "--no-audit"]
    logger.info(
        "Build [install] project %s – running: %s",
        project_id, " ".join(install_cmd),
    )
    try:
        result = subprocess.run(
            install_cmd,
            cwd=str(project_dir),
            capture_output=True,
            text=True,
            timeout=120,
            env=build_env,
        )
        if result.stdout.strip():
            logger.info(
                "Build [install] stdout for project %s:\n%s",
                project_id, result.stdout.strip(),
            )
            build_logs.append(result.stdout.strip())
        if result.stderr.strip():
            logger.warning(
                "Build [install] stderr for project %s:\n%s",
                project_id, result.stderr.strip(),
            )
            build_logs.append(result.stderr.strip())
        if result.returncode != 0:
            error_msg = f"npm install exited with code {result.returncode}"
            logger.error("Build [install] failed for %s: %s", project_id, error_msg)
            return {
                "built": False,
                "logs": build_logs,
                "error": error_msg,
            }
    except subprocess.TimeoutExpired:
        error_msg = "npm install timed out after 120 s"
        logger.error("Build [install] %s: %s", project_id, error_msg)
        return {"built": False, "logs": build_logs, "error": error_msg}
    except Exception as exc:
        error_msg = str(exc)
        logger.error("Build [install] %s exception: %s", project_id, exc)
        return {"built": False, "logs": build_logs, "error": error_msg}

    # Step 2: npm run build (only if "build" script exists in package.json)
    try:
        pkg = json.loads(pkg_json.read_text())
    except Exception:
        pkg = {}

    if "build" not in pkg.get("scripts", {}):
        logger.info(
            "Build [build] skipped for %s – no 'build' script in package.json",
            project_id,
        )
        return {"built": True, "logs": build_logs}

    build_cmd = ["npm", "run", "build"]
    logger.info(
        "Build [build] project %s – running: %s",
        project_id, " ".join(build_cmd),
    )
    try:
        result = subprocess.run(
            build_cmd,
            cwd=str(project_dir),
            capture_output=True,
            text=True,
            timeout=180,
            env=build_env,
        )
        if result.stdout.strip():
            logger.info(
                "Build [build] stdout for project %s:\n%s",
                project_id, result.stdout.strip(),
            )
            build_logs.append(result.stdout.strip())
        if result.stderr.strip():
            logger.warning(
                "Build [build] stderr for project %s:\n%s",
                project_id, result.stderr.strip(),
            )
            build_logs.append(result.stderr.strip())
        if result.returncode != 0:
            error_msg = f"npm run build exited with code {result.returncode}"
            logger.error("Build [build] failed for %s: %s", project_id, error_msg)
            return {"built": False, "logs": build_logs, "error": error_msg}
    except subprocess.TimeoutExpired:
        error_msg = "npm run build timed out after 180 s"
        logger.error("Build [build] %s: %s", project_id, error_msg)
        return {"built": False, "logs": build_logs, "error": error_msg}
    except Exception as exc:
        error_msg = str(exc)
        logger.error("Build [build] %s exception: %s", project_id, exc)
        return {"built": False, "logs": build_logs, "error": error_msg}

    logger.info("Build completed successfully for %s", project_id)

    # If there's a dist/ or build/ directory, serve from there instead
    output_dir_name: str | None = None
    for candidate_name in ("dist", "build", "out", ".next"):
        output_dir = project_dir / candidate_name
        if output_dir.is_dir():
            output_dir_name = candidate_name
            logger.info(
                "Build [output] project %s – found %s/ directory, will serve from it",
                project_id, candidate_name,
            )
            break

    return {"built": True, "logs": build_logs, "output_dir": output_dir_name}


def _verify_static_export(project_id: str, project_dir: Path) -> dict:
    out_dir = project_dir / "out"
    index_html = out_dir / "index.html"
    if not out_dir.is_dir():
        return {"verified": False, "error": "Missing out/ directory after static export build"}
    if not index_html.is_file():
        return {"verified": False, "error": "Missing out/index.html after static export build"}
    return {"verified": True, "serve_dir": "out", "index": "out/index.html"}


def _port_for_project(project_id: str) -> int:
    return NEXT_SERVER_PORT_BASE + (abs(hash(project_id)) % 1000)


def _next_pid_path(project_dir: Path) -> Path:
    return project_dir / ".next-server.pid"


def _stop_next_server(project_dir: Path) -> None:
    pid_path = _next_pid_path(project_dir)
    if not pid_path.is_file():
        return
    try:
        pid = int(pid_path.read_text().strip())
        os.kill(pid, signal.SIGTERM)
    except Exception:
        pass
    try:
        pid_path.unlink()
    except Exception:
        pass


def _start_next_server(project_id: str, project_dir: Path, env_vars: dict) -> dict:
    if not (project_dir / ".next").is_dir():
        return {"ok": False, "error": "Missing .next directory for Next server deployment"}

    _stop_next_server(project_dir)
    port = _port_for_project(project_id)
    env = os.environ.copy()
    env.update({str(k): str(v) for k, v in env_vars.items()})
    env["PORT"] = str(port)
    env["HOSTNAME"] = "127.0.0.1"
    env["PATH"] = str(project_dir / "node_modules" / ".bin") + os.pathsep + env.get("PATH", "")

    log_file = open(project_dir / ".next-server.log", "a", encoding="utf-8")
    proc = subprocess.Popen(
        ["npm", "run", "start", "--", "-p", str(port), "-H", "127.0.0.1"],
        cwd=str(project_dir),
        stdout=log_file,
        stderr=subprocess.STDOUT,
        env=env,
        start_new_session=True,
        text=True,
    )
    _next_pid_path(project_dir).write_text(str(proc.pid))
    for _ in range(20):
        try:
            check = subprocess.run(
                ["python3", "-c", f"import urllib.request; urllib.request.urlopen('http://127.0.0.1:{port}/', timeout=1).read(1)"],
                capture_output=True,
                text=True,
                timeout=2,
            )
            if check.returncode == 0:
                return {"ok": True, "port": port, "url": f"http://127.0.0.1:{port}"}
        except Exception:
            pass
        if proc.poll() is not None:
            return {"ok": False, "error": f"next start exited with code {proc.returncode}", "port": port}
    return {"ok": False, "error": "Next server health check timed out", "port": port}


def _proxy_next_request(target_base: str):
    import urllib.error
    import urllib.request

    target = target_base.rstrip("/") + "/" + request.full_path.lstrip("/")
    if target.endswith("?"):
        target = target[:-1]
    try:
        req = urllib.request.Request(target, method=request.method)
        for key, value in request.headers.items():
            if key.lower() not in {"host", "content-length"}:
                req.add_header(key, value)
        body = request.get_data() if request.method not in {"GET", "HEAD"} else None
        with urllib.request.urlopen(req, data=body, timeout=15) as resp:
            excluded = {"transfer-encoding", "connection", "content-encoding"}
            headers = [(k, v) for k, v in resp.headers.items() if k.lower() not in excluded]
            return Response(resp.read(), status=resp.status, headers=headers)
    except urllib.error.HTTPError as exc:
        return Response(exc.read(), status=exc.code)
    except Exception as exc:
        logger.error("Next server proxy failed for %s: %s", target_base, exc)
        abort(502)


# ---------------------------------------------------------------------------
# Flask App
# ---------------------------------------------------------------------------
app = Flask(__name__)


# ── helpers ────────────────────────────────────────────────────────────────

def _project_dir(project_id: str) -> Path:
    """Return the on-disk directory for *project_id*."""
    safe_id = os.path.basename(project_id)
    return PROJECTS_DIR / safe_id


def _meta_path(project_id: str) -> Path:
    return _project_dir(project_id) / ".meta.json"


def _read_meta(project_id: str) -> dict | None:
    meta = _meta_path(project_id)
    if meta.exists():
        return json.loads(meta.read_text())
    project_dir = _project_dir(project_id)
    if project_dir.is_symlink():
        resolved_meta = project_dir.resolve() / ".meta.json"
        if resolved_meta.exists():
            return json.loads(resolved_meta.read_text())
    return None


def _write_meta(project_id: str, data: dict) -> None:
    _meta_path(project_id).write_text(json.dumps(data, default=str))


def _extract_subdomain() -> str | None:
    host = request.host.split(":")[0]
    parts = host.split(".")
    if len(parts) > 2:
        return parts[0]
    return None


def _ensure_dns_record(subdomain: str) -> dict:
    """Create or update a Cloudflare CNAME for *subdomain*.sycord.site.

    Returns a dict with ``success``, ``action`` ('created'|'updated'|'skipped'),
    and an optional ``error`` key.
    """
    if not CF_API_KEY or not CF_ZONE_ID:
        logger.info("DNS auto-config skipped for %s (no Cloudflare credentials)", subdomain)
        return {"success": True, "action": "skipped", "reason": "Cloudflare credentials not configured"}

    if _requests_mod is None:
        logger.warning("DNS auto-config skipped – 'requests' package not installed")
        return {"success": True, "action": "skipped", "reason": "requests package not installed"}

    fqdn = f"{subdomain}.sycord.site"
    headers = {
        "Authorization": f"Bearer {CF_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        check_url = f"https://api.cloudflare.com/client/v4/zones/{CF_ZONE_ID}/dns_records?name={fqdn}"
        check_resp = _requests_mod.get(check_url, headers=headers, timeout=10)
        check_data = check_resp.json()

        payload = {
            "type": "CNAME",
            "name": subdomain,
            "content": "server.sycord.site",
            "proxied": True,
            "ttl": 1,
        }

        if check_data.get("success") and check_data.get("result"):
            record_id = check_data["result"][0]["id"]
            update_url = (
                f"https://api.cloudflare.com/client/v4/zones/{CF_ZONE_ID}"
                f"/dns_records/{record_id}"
            )
            resp = _requests_mod.put(update_url, headers=headers, json=payload, timeout=10)
            resp_data = resp.json()
            if resp_data.get("success"):
                logger.info("DNS record updated for %s", fqdn)
                return {"success": True, "action": "updated"}
            err = resp_data.get("errors", [])
            logger.error("DNS update failed for %s: %s", fqdn, err)
            return {"success": False, "action": "updated", "error": str(err)}

        create_url = f"https://api.cloudflare.com/client/v4/zones/{CF_ZONE_ID}/dns_records"
        resp = _requests_mod.post(create_url, headers=headers, json=payload, timeout=10)
        resp_data = resp.json()
        if resp_data.get("success"):
            logger.info("DNS record created for %s", fqdn)
            return {"success": True, "action": "created"}
        err = resp_data.get("errors", [])
        logger.error("DNS create failed for %s: %s", fqdn, err)
        return {"success": False, "action": "created", "error": str(err)}
    except Exception as exc:
        logger.error("DNS auto-config exception for %s: %s", fqdn, exc)
        return {"success": False, "action": "skipped", "error": str(exc)}


# ── Subdomain-based content serving ───────────────────────────────────────

@app.before_request
def serve_subdomain_content():
    subdomain = _extract_subdomain()
    if subdomain is None:
        return

    if request.path.startswith("/api/"):
        return

    project_dir = PROJECTS_DIR / subdomain
    if not project_dir.is_dir():
        return

    rel_path = request.path.lstrip("/") or "index.html"
    target = project_dir / rel_path

    try:
        target.resolve().relative_to(project_dir.resolve())
    except ValueError:
        abort(403)

    if target.is_file():
        return send_from_directory(str(project_dir), rel_path)

    if (project_dir / rel_path / "index.html").is_file():
        return send_from_directory(str(project_dir / rel_path), "index.html")

    meta = _read_meta(subdomain) or _read_meta(project_dir.resolve().name)
    if meta and meta.get("deployment_mode") == "next-server" and meta.get("next_server_url"):
        return _proxy_next_request(meta["next_server_url"])

    abort(404)


# ── Health-check landing page ─────────────────────────────────────────────

@app.route("/")
def index():
    return Response(
        "flask is working on server",
        content_type="text/plain; charset=utf-8",
    )


# ── API: Status / diagnostics ────────────────────────────────────────────

@app.route("/api/status", methods=["GET"])
def status():
    """Return runner health information."""
    project_count = sum(
        1 for p in PROJECTS_DIR.iterdir()
        if p.is_dir() and not p.name.startswith(".")
    ) if PROJECTS_DIR.is_dir() else 0

    warnings = list(_missing) if _missing else []
    if not _check_tool("npm"):
        warnings.append("npm is not installed – project builds will fail")
    if not _check_tool("node"):
        warnings.append("node is not installed – project builds will fail")

    return jsonify(
        success=True,
        status="running",
        python_version=sys.version,
        flask_installed=True,
        requests_installed=_requests_mod is not None,
        npm_installed=_check_tool("npm"),
        node_installed=_check_tool("node"),
        dns_auto_config=bool(CF_API_KEY and CF_ZONE_ID),
        project_count=project_count,
        data_dir=str(BASE_DIR),
        warnings=warnings,
    )


# ── API: Deploy ───────────────────────────────────────────────────────────

@app.route("/api/deploy/<project_id>", methods=["POST"])
def deploy(project_id: str):
    data = request.get_json(silent=True)
    if not data or "files" not in data:
        logger.error("Deploy %s: missing 'files' in request body", project_id)
        return jsonify(success=False, error="Request body must include 'files'"), 400

    files: list[dict] = data["files"]
    subdomain: str | None = data.get("subdomain")
    env_vars: dict = data.get("env_vars", {})
    deployment_mode: str = data.get("deployment_mode") or data.get("deploymentMode") or "static-export"
    if deployment_mode not in {"static-export", "next-server"}:
        return jsonify(success=False, error=f"Unsupported deployment mode: {deployment_mode}"), 400

    if not files:
        logger.error("Deploy %s: empty files list", project_id)
        return jsonify(success=False, error="No files provided"), 400
    if deployment_mode == "static-export":
        api_files = [f.get("path", "") for f in files if str(f.get("path", "")).startswith("app/api/")]
        if api_files:
            return jsonify(
                success=False,
                error=f"Dynamic API route generated for static deployment: {api_files[0]}",
                artifact={"verified": False, "error": "Dynamic API route generated for static deployment"},
            ), 400

    logger.info(
        "Deploy started for %s (%d files, subdomain=%s, env_vars=%d)",
        project_id, len(files), subdomain, len(env_vars),
    )

    project_dir = _project_dir(project_id)
    _stop_next_server(project_dir)

    # Clean previous deployment
    if project_dir.exists():
        for item in project_dir.iterdir():
            if item.name == ".meta.json":
                continue
            if item.is_dir():
                shutil.rmtree(item)
            else:
                item.unlink()
        logger.info("Deploy %s: cleaned previous deployment", project_id)
    else:
        project_dir.mkdir(parents=True, exist_ok=True)

    # Write files
    written = 0
    for f in files:
        rel_path = f.get("path", "")
        content = f.get("content", "")
        if not rel_path:
            continue

        safe_path = os.path.normpath(rel_path).lstrip(os.sep)
        if safe_path.startswith(".."):
            logger.warning("Deploy %s: blocked traversal path %s", project_id, rel_path)
            continue

        dest = project_dir / safe_path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(content, encoding="utf-8")
        written += 1

    logger.info("Deploy %s: wrote %d/%d files", project_id, written, len(files))

    # Build step – run npm install + npm run build if package.json exists
    build_result = _build_project(project_id, project_dir)
    built = build_result.get("built", False)
    if not built:
        meta = _read_meta(project_id) or {}
        meta.update(
            {
                "project_id": project_id,
                "subdomain": subdomain,
                "domain": None,
                "files_count": written,
                "env_vars_count": len(env_vars),
                "deployment_mode": deployment_mode,
                "deployed_at": datetime.now(timezone.utc).isoformat(),
                "build": False,
                "build_error": build_result.get("error"),
                "artifact": {"verified": False, "error": build_result.get("error") or "Build failed"},
            },
        )
        _write_meta(project_id, meta)
        return jsonify(
            success=False,
            error=build_result.get("error") or "Build failed",
            project_id=project_id,
            files_count=written,
            build=build_result,
            artifact=meta["artifact"],
        ), 400

    # Subdomain symlink – point to build output dir if it exists
    serve_dir = project_dir
    artifact_result: dict = {"verified": True}
    health_result: dict | None = None
    if deployment_mode == "static-export":
        artifact_result = _verify_static_export(project_id, project_dir)
        if not artifact_result.get("verified"):
            meta = _read_meta(project_id) or {}
            meta.update(
                {
                    "project_id": project_id,
                    "subdomain": subdomain,
                    "domain": None,
                    "files_count": written,
                    "env_vars_count": len(env_vars),
                    "deployment_mode": deployment_mode,
                    "deployed_at": datetime.now(timezone.utc).isoformat(),
                    "build": True,
                    "build_error": artifact_result.get("error"),
                    "artifact": artifact_result,
                },
            )
            _write_meta(project_id, meta)
            return jsonify(
                success=False,
                error=artifact_result.get("error") or "Missing static export artifact",
                project_id=project_id,
                files_count=written,
                build=build_result,
                artifact=artifact_result,
            ), 400
        serve_dir = project_dir / "out"
        logger.info("Deploy %s: serving static export from out/", project_id)
    else:
        health_result = _start_next_server(project_id, project_dir, env_vars)
        if not health_result.get("ok"):
            meta = _read_meta(project_id) or {}
            meta.update(
                {
                    "project_id": project_id,
                    "subdomain": subdomain,
                    "domain": None,
                    "files_count": written,
                    "env_vars_count": len(env_vars),
                    "deployment_mode": deployment_mode,
                    "deployed_at": datetime.now(timezone.utc).isoformat(),
                    "build": True,
                    "build_error": health_result.get("error"),
                    "artifact": {"verified": True, "serve_dir": ".next"},
                    "health": health_result,
                },
            )
            _write_meta(project_id, meta)
            return jsonify(
                success=False,
                error=health_result.get("error") or "Next server health check failed",
                project_id=project_id,
                files_count=written,
                build=build_result,
                artifact=meta["artifact"],
                health=health_result,
            ), 400

    if subdomain:
        link = PROJECTS_DIR / subdomain
        if link.exists() or link.is_symlink():
            if link.is_symlink():
                link.unlink()
            elif link.resolve() != serve_dir.resolve():
                shutil.rmtree(link)
        if not link.exists():
            link.symlink_to(serve_dir)
        logger.info(
            "Deploy %s: subdomain symlink %s → %s",
            project_id, subdomain, serve_dir,
        )

    # Auto-create DNS record
    dns_result: dict = {"action": "skipped"}
    if subdomain:
        dns_result = _ensure_dns_record(subdomain)
        if dns_result.get("error"):
            logger.warning(
                "Deploy %s: DNS auto-config issue: %s",
                project_id, dns_result["error"],
            )

    # Persist metadata
    domain = f"{subdomain}.sycord.site" if subdomain else None
    meta = _read_meta(project_id) or {}
    meta.update(
        {
            "project_id": project_id,
            "subdomain": subdomain,
            "domain": domain,
            "files_count": written,
            "env_vars_count": len(env_vars),
            "deployment_mode": deployment_mode,
            "deployed_at": datetime.now(timezone.utc).isoformat(),
            "dns_status": dns_result.get("action", "skipped"),
            "build": build_result.get("built", False),
            "build_error": build_result.get("error"),
            "artifact": artifact_result,
            "health": health_result,
            "next_server_url": health_result.get("url") if health_result else None,
        },
    )
    _write_meta(project_id, meta)

    logger.info(
        "Deployed project %s (%d files, subdomain=%s, build=%s)",
        project_id, written, subdomain, build_result.get("built", False),
    )

    return jsonify(
        success=True,
        project_id=project_id,
        domain=domain,
        files_count=written,
        dns=dns_result,
        build=build_result,
        deployment_mode=deployment_mode,
        artifact=artifact_result,
        health=health_result,
    )


# ── API: Project info ─────────────────────────────────────────────────────

@app.route("/api/projects/<project_id>", methods=["GET"])
def project_info(project_id: str):
    meta = _read_meta(project_id)
    if meta is None:
        return jsonify(success=False, error="Project not found"), 404

    project_dir = _project_dir(project_id)
    file_list = []
    if project_dir.is_dir():
        for p in sorted(project_dir.rglob("*")):
            if p.is_file() and p.name != ".meta.json":
                file_list.append(str(p.relative_to(project_dir)))

    meta["files"] = file_list
    meta["success"] = True
    return jsonify(meta)


# ── API: Logs ──────────────────────────────────────────────────────────────

@app.route("/api/logs", methods=["GET"])
def logs():
    project_id = request.args.get("project_id")
    limit = min(int(request.args.get("limit", 200)), 500)

    if not project_id:
        return jsonify(success=False, error="project_id is required"), 400

    lines: list[str] = []
    if LOG_FILE.exists():
        all_lines = LOG_FILE.read_text().splitlines()
        relevant = [ln for ln in all_lines if project_id in ln]
        if relevant:
            lines = relevant[-limit:]
        else:
            lines = all_lines[-limit:]

    return jsonify(success=True, project_id=project_id, logs=lines)


# ── API: Delete project ───────────────────────────────────────────────────

@app.route("/api/projects/<project_id>", methods=["DELETE"])
def delete_project(project_id: str):
    project_dir = _project_dir(project_id)

    if not project_dir.exists():
        return jsonify(success=False, error="Project not found"), 404

    meta = _read_meta(project_id)
    if meta and meta.get("subdomain"):
        link = PROJECTS_DIR / meta["subdomain"]
        if link.is_symlink():
            link.unlink()

    shutil.rmtree(project_dir)
    logger.info("Deleted project %s", project_id)

    return jsonify(success=True, message="Project deleted successfully")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    _log_startup_diagnostics()
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    logger.info("Starting Sycord Pages server on port %d", port)
    app.run(host="0.0.0.0", port=port, debug=debug)
