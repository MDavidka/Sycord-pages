import os
import subprocess
import psutil
import time
from flask import Flask, request, jsonify

app = Flask(__name__)

# Basic storage for logs and websites since this is a mock representation
websites = {}

def run_cmd(cmd, cwd=None):
    try:
        res = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True)
        return res.returncode == 0, res.stdout, res.stderr
    except Exception as e:
        return False, "", str(e)

@app.route("/api/status", methods=["GET"])
def get_status():
    uptime = run_cmd("uptime -p")[1].strip()
    node_v = run_cmd("node -v")[1].strip()
    npm_v = run_cmd("npm -v")[1].strip()
    
    cpu = psutil.cpu_percent(interval=0.1)
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    
    return jsonify({
        "cpu": cpu,
        "mem": {"total": round(mem.total / 1024 / 1024), "used": round(mem.used / 1024 / 1024), "percent": mem.percent},
        "disk": {"total": f"{round(disk.total / 1024 / 1024 / 1024)}G", "used": f"{round(disk.used / 1024 / 1024 / 1024)}G", "percent": disk.percent},
        "uptime": uptime,
        "nodeVersion": node_v,
        "npmVersion": npm_v,
        "online": True
    })

@app.route("/api/setup", methods=["POST"])
def setup_vps():
    return jsonify({"success": True, "message": "Setup complete"})

@app.route("/api/websites", methods=["GET"])
def list_websites():
    return jsonify(list(websites.values()))

@app.route("/api/websites/<id>/logs", methods=["GET"])
def get_logs(id):
    website = websites.get(id)
    if not website:
        return jsonify({"error": "Not found"}), 404
    return jsonify({"logs": website.get("logs", [])})

@app.route("/api/websites/<id>/action", methods=["POST"])
def website_action(id):
    action = request.json.get("action")
    if id in websites:
        websites[id]["status"] = "running" if action in ["start", "restart"] else "stopped"
        return jsonify({"success": True})
    return jsonify({"error": "Not found"}), 404

@app.route("/api/deploy/<id>", methods=["POST"])
def deploy(id):
    data = request.json
    mode = data.get("deployment_mode")
    files = data.get("files", [])
    env_vars = data.get("env_vars", {})
    subdomain = data.get("subdomain", id)
    
    # Mocking deployment steps
    logs = [f"Starting deploy for {id} in mode {mode}"]
    
    # Write files (mocked directory)
    deploy_dir = f"/tmp/sycord/{id}"
    os.makedirs(deploy_dir, exist_ok=True)
    
    for f in files:
        path = os.path.join(deploy_dir, f["path"])
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as out:
            out.write(f["content"])
            
    # Save env vars outside
    env_dir = f"/srv/sycord/env/{id}"
    os.makedirs(env_dir, exist_ok=True)
    with open(f"{env_dir}/.env", "w") as env_out:
        for k, v in env_vars.items():
            env_out.write(f"{k}={v}\n")
            
    logs.append("Files and environment variables written successfully.")
    
    # Mock build
    logs.append("Running npm install...")
    logs.append("Running npm run build...")
    build_success = True
    
    port = 3000 + len(websites)
    logs.append(f"Assigned port {port}")
    
    # Mock PM2 / Systemd
    logs.append(f"Starting server on port {port}...")
    running = True
    
    # Health check
    health_ok = True
    logs.append(f"Health check to http://127.0.0.1:{port}/ passed.")
    
    domain = f"{subdomain}.sycord.site"
    
    websites[id] = {
        "id": id,
        "subdomain": subdomain,
        "domain": domain,
        "port": port,
        "status": "running",
        "health_ok": health_ok,
        "logs": logs,
        "memory": "120MB",
        "cpu": "1.2%"
    }
    
    return jsonify({
        "success": True,
        "build": {"built": build_success, "logs": "Build output..."},
        "running": running,
        "health_ok": health_ok,
        "health": {"ok": health_ok},
        "domain": domain,
        "port": port,
        "logs": logs
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
