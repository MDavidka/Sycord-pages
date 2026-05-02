import { NextResponse } from "next/server"
import { NodeSSH } from "node-ssh"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { readFile } from "fs/promises"
import path from "path"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    // Simple admin check
    if (session?.user?.email !== "dmarton336@gmail.com") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    const host = process.env.VPS_IP
    const username = process.env.VPS_USERNAME
    const password = process.env.VPS_PASSWORD

    if (!host || !username || !password) {
      return NextResponse.json({ error: "VPS credentials missing in environment variables" }, { status: 500 })
    }

    const ssh = new NodeSSH()
    await ssh.connect({ host, username, password })

    const homeDir = username === 'root' ? '/root' : `/home/${username}`
    const cwd = `${homeDir}/myapp`

    // Helper to log errors but not necessarily throw, useful for checking if a command worked
    const run = async (cmd: string, dir: string = cwd) => {
        const res = await ssh.execCommand(cmd, { cwd: dir })
        if (res.stderr) {
            console.log(`[VPS Setup] Warn/Err running '${cmd}':`, res.stderr)
        }
        return res
    }

    // --- STEP 1: INIT ---
    if (action === "init") {
      console.log(`[VPS Setup] Running Step 1: Init...`)

      // Ensure absolute paths
      await run(`mkdir -p ${cwd}`, homeDir)

      // Clone if empty
      const lsRes = await run(`ls -A ${cwd}`)
      if (!lsRes.stdout) {
          await run(`git clone https://github.com/MDavidka/server-sycord ${cwd} || true`, homeDir)
      }

      console.log(`[VPS Setup] Installing Cloudflared locally...`)
      // Download cloudflared binary directly to the folder so we don't need sudo dpkg
      await run(`wget -q -O cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64`, cwd)
      await run(`chmod +x cloudflared`, cwd)

      console.log(`[VPS Setup] Installing Flask & deps via pip...`)
      // Install dependencies system-wide so nohup subprocesses can find them
      // Use --break-system-packages for PEP 668 compatibility on newer Ubuntu
      await ssh.execCommand('sudo apt-get update && sudo apt-get install -y python3-pip python3-venv || true', { cwd })
      // Try multiple pip install strategies to handle different OS configurations
      await run(`python3 -m pip install flask requests --break-system-packages 2>/dev/null || python3 -m pip install flask requests 2>/dev/null || pip3 install flask requests --break-system-packages 2>/dev/null || pip3 install flask requests 2>/dev/null || true`, cwd)

      // Verify Flask was actually installed
      const flaskCheck = await run('python3 -c "import flask; print(flask.__version__)" 2>&1')
      if (!flaskCheck.stdout.trim() || flaskCheck.stdout.includes("No module")) {
        console.warn(`[VPS Setup] Flask pip install failed, trying apt fallback...`)
        await ssh.execCommand('sudo apt-get install -y python3-flask || true', { cwd })
        // Re-verify
        const flaskCheck2 = await run('python3 -c "import flask; print(flask.__version__)" 2>&1')
        if (!flaskCheck2.stdout.trim() || flaskCheck2.stdout.includes("No module")) {
          console.error(`[VPS Setup] Flask installation failed after all attempts`)
        } else {
          console.log(`[VPS Setup] Flask ${flaskCheck2.stdout.trim()} installed via apt`)
        }
      } else {
        console.log(`[VPS Setup] Flask ${flaskCheck.stdout.trim()} installed via pip`)
      }

      console.log(`[VPS Setup] Installing Node.js & npm for project builds...`)
      // Install Node.js (LTS) via NodeSource if not already installed
      const nodeCheck = await run('node --version 2>/dev/null')
      if (!nodeCheck.stdout.trim()) {
        await ssh.execCommand('curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs || true', { cwd })
      }
      const npmCheck = await run('npm --version 2>/dev/null')
      const nodeVer = await run('node --version 2>/dev/null')
      console.log(`[VPS Setup] Node: ${nodeVer.stdout.trim() || 'not found'}, npm: ${npmCheck.stdout.trim() || 'not found'}`)

      // Write .env.server with Cloudflare & GitHub credentials early during init
      console.log(`[VPS Setup] Writing .env.server...`)
      const serverEnvVars: Record<string, string | undefined> = {
        CLOUDFLARE_API_KEY: process.env.CLOUDFLARE_API_KEY,
        CLOUDFLARE_ZONE_ID: process.env.CLOUDFLARE_ZONE_ID,
        GITHUB_API_TOKEN: process.env.GITHUB_API_TOKEN || process.env.GITHUB_TOKEN,
        GITHUB_OWNER: process.env.GITHUB_OWNER || process.env.GITHUB_USERNAME,
      }

      const envLines = Object.entries(serverEnvVars)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}=${v}`)

      if (envLines.length > 0) {
        const envContent = `# Auto-generated by Sycord VPS Setup\n${envLines.join("\n")}\n`
        await ssh.execCommand(`cat > .env.server`, { cwd, stdin: envContent })
        console.log(`[VPS Setup] Wrote .env.server with ${envLines.length} variable(s)`)
      } else {
        console.warn(`[VPS Setup] No server env vars available to write to .env.server`)
      }

      ssh.dispose()
      return NextResponse.json({ success: true, message: "VPS Initialized! Repository cloned, dependencies installed, and .env.server written." })
    }

    // --- STEP 2: AUTH ---
    if (action === "auth") {
      console.log(`[VPS Setup] Running Step 2: Auth...`)

      // Request login URL
      await run('rm -f cloudflared_login.log', cwd)

      // Run the binary directly, forcing stdout/stderr to log.
      // Cloudflared might refuse to output the URL if it detects no TTY,
      // but usually redirecting to a file works. Let's use `stdbuf` just in case to avoid buffering issues.
      await run('stdbuf -oL -eL ./cloudflared tunnel login > cloudflared_login.log 2>&1 &', cwd)

      // Poll log for the URL
      let authUrl = null
      let finalLog = ""
      for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 1000))
        const log = await run('cat cloudflared_login.log', cwd)
        finalLog = log.stdout + "\n" + log.stderr

        // Match the callback URL (often spans multiple lines or has slightly different formats)
        // cloudflared outputs ANSI codes and mixed newlines, so we clean it up and use a more permissive regex
        // to catch the full encoded url
        const cleanLog = finalLog.replace(/\x1b\[[0-9;]*m/g, '').replace(/\\n/g, '\n').trim()

        // Check if the server is already authorized
        if (cleanLog.includes("You have an existing certificate") || cleanLog.includes("cert.pem which login would overwrite")) {
          ssh.dispose()
          return NextResponse.json({
            success: true,
            alreadyAuthorized: true,
            message: "Cloudflare tunnel is already authorized on this server."
          })
        }

        // Find the URL specifically. It's usually `https://dash.cloudflare.com/argotunnel?callback=...`
        // We match until a space, newline, or a specific control character to avoid chopping off parts of the URL.
        const match = cleanLog.match(/(https:\/\/dash\.cloudflare\.com\/argotunnel\?callback=[^\s"'\n\r]+)/i)
        if (match) {
          authUrl = match[1] // capture group ensures we don't grab trailing random chars
          break
        }
      }

      ssh.dispose()

      if (authUrl) {
        return NextResponse.json({ success: true, authUrl, message: "Please authorize Cloudflare using the provided link." })
      } else {
        // Return the log output so the user can debug what actually happened (e.g. command not found, permissions)
        const safeLog = finalLog.substring(0, 500) // Truncate to avoid massive payloads
        return NextResponse.json({
            error: `Failed to generate Cloudflare auth link. Log snippet: \n${safeLog}`
        }, { status: 500 })
      }
    }

    // --- STEP 3: CONFIG ---
    if (action === "config") {
      console.log(`[VPS Setup] Running Step 3: Config...`)

      // Create Tunnel (may fail if it already exists – that's fine)
      const createRes = await run('./cloudflared tunnel create sycord-runner', cwd)
      const uuidMatch = createRes.stdout.match(/id ([a-f0-9-]+)/i) || createRes.stderr.match(/id ([a-f0-9-]+)/i)

      let tunnelId = ""
      if (uuidMatch) {
         tunnelId = uuidMatch[1]
      } else {
         // Tunnel probably already exists – look it up
         console.log(`[VPS Setup] Tunnel create didn't return UUID. Checking tunnel list...`)
         const listRes = await run('./cloudflared tunnel list', cwd)
         const listMatch = listRes.stdout.match(/([a-f0-9-]{36})\s+sycord-runner/i)
         if (listMatch) {
            tunnelId = listMatch[1]
         } else {
            // Last resort: try to extract any UUID from the list output
            const anyUuid = listRes.stdout.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i)
            if (anyUuid) {
               tunnelId = anyUuid[1]
               console.log(`[VPS Setup] Using first tunnel UUID found: ${tunnelId}`)
            }
         }
      }

      // Even if we couldn't find the tunnel UUID, don't crash.
      // Write config.yml with whatever we have and let the user proceed.
      if (!tunnelId) {
         console.warn("[VPS Setup] Could not determine tunnel UUID. Writing config with placeholder – tunnel start may fail but Flask will still work.")
      }

      // Route DNS (non-blocking, uses || true)
      if (tunnelId) {
        await run(`./cloudflared tunnel route dns sycord-runner server.sycord.site || true`, cwd)
        await run(`./cloudflared tunnel route dns sycord-runner "*.sycord.site" || true`, cwd)
      }

      // Generate config.yml
      const configYml = tunnelId
        ? `tunnel: ${tunnelId}
credentials-file: ${homeDir}/.cloudflared/${tunnelId}.json

ingress:
  - hostname: server.sycord.site
    service: http://127.0.0.1:5000
  - hostname: "*.sycord.site"
    service: http://127.0.0.1:5000
  - service: http_status:404`
        : `# Tunnel UUID could not be determined automatically.
# Run: ./cloudflared tunnel list   to find your tunnel UUID,
# then replace <TUNNEL_UUID> below.
tunnel: <TUNNEL_UUID>
credentials-file: ${homeDir}/.cloudflared/<TUNNEL_UUID>.json

ingress:
  - hostname: server.sycord.site
    service: http://127.0.0.1:5000
  - hostname: "*.sycord.site"
    service: http://127.0.0.1:5000
  - service: http_status:404`

      await ssh.execCommand(`cat > config.yml`, { cwd, stdin: configYml })

      ssh.dispose()
      return NextResponse.json({
        success: true,
        tunnelId: tunnelId || null,
        message: tunnelId
          ? "Tunnel sycord-runner created! DNS routing attempted for server.sycord.site and *.sycord.site."
          : "Config written but tunnel UUID could not be determined. Flask will still start. You may need to manually check the tunnel."
      })
    }

    // --- STEP 4: START SERVER ---
    if (action === "start_server") {
      console.log(`[VPS Setup] Running Step 4: Start Server...`)

      const pythonRunnerScript = await readFile(path.join(process.cwd(), "server", "app.py"), "utf8")

      // Write optional SSL Certs if provided
      const { sslCert, sslKey } = body
      if (sslCert && sslKey) {
          console.log(`[VPS Setup] Writing custom SSL Origin Certificates...`)
          await ssh.execCommand(`cat > cert.pem`, { cwd, stdin: sslCert.trim() })
          await ssh.execCommand(`cat > privkey.pem`, { cwd, stdin: sslKey.trim() })
      } else {
          // Remove old certs if user is running without them
          await run(`rm -f cert.pem privkey.pem`, cwd)
      }

      // Write runner.py (force remove old one first)
      await run(`rm -f runner.py`, cwd)
      const writeRes = await ssh.execCommand(`cat > runner.py`, { cwd, stdin: pythonRunnerScript })
      if (writeRes.code !== null && writeRes.code !== 0) {
         ssh.dispose()
         return NextResponse.json({
           error: `Failed to write runner.py on VPS. stderr: ${writeRes.stderr || 'unknown error'}`
         }, { status: 500 })
      }

      // Verify the file was actually written and has content
      const verifyRes = await run(`test -s runner.py && echo "ok"`, cwd)
      if (!verifyRes.stdout.includes("ok")) {
         ssh.dispose()
         return NextResponse.json({
           error: "runner.py was not written correctly (file is empty or missing)."
         }, { status: 500 })
      }

      // Pre-flight: ensure Flask is installed before starting runner
      const flaskPreCheck = await run('python3 -c "import flask; print(flask.__version__)" 2>&1')
      if (!flaskPreCheck.stdout.trim() || flaskPreCheck.stdout.includes("No module") || flaskPreCheck.stdout.includes("Traceback")) {
        console.warn("[VPS Setup] Flask not found, attempting to install before start...")
        await run(`python3 -m pip install flask requests --break-system-packages 2>/dev/null || python3 -m pip install flask requests 2>/dev/null || pip3 install flask requests --break-system-packages 2>/dev/null || pip3 install flask requests 2>/dev/null || sudo apt-get install -y python3-flask 2>/dev/null || true`, cwd)
        // Re-verify
        const flaskReCheck = await run('python3 -c "import flask; print(flask.__version__)" 2>&1')
        if (!flaskReCheck.stdout.trim() || flaskReCheck.stdout.includes("No module") || flaskReCheck.stdout.includes("Traceback")) {
          ssh.dispose()
          return NextResponse.json({
            error: "Flask is not installed and could not be auto-installed. Run Step 1 (Init) first, or manually run: python3 -m pip install flask requests --break-system-packages"
          }, { status: 500 })
        }
        console.log(`[VPS Setup] Flask ${flaskReCheck.stdout.trim()} installed successfully`)
      } else {
        console.log(`[VPS Setup] Flask ${flaskPreCheck.stdout.trim()} already available`)
      }

      // Kill existing processes forcefully
      await run('pkill -9 -f "runner\\.py" || true', cwd)
      await run('pkill -9 -f "cloudflared tunnel run" || true', cwd)

      // Force free port 5000 just in case pkill missed it
      await run('fuser -k 5000/tcp || true', cwd)

      // Write .env.server with Cloudflare & GitHub credentials so the Flask
      // server can auto-configure DNS records and perform API operations.
      // Only env vars that are actually set in the Next.js environment are
      // written – empty values are omitted.
      const serverEnvVars: Record<string, string | undefined> = {
        CLOUDFLARE_API_KEY: process.env.CLOUDFLARE_API_KEY,
        CLOUDFLARE_ZONE_ID: process.env.CLOUDFLARE_ZONE_ID,
        GITHUB_API_TOKEN: process.env.GITHUB_API_TOKEN || process.env.GITHUB_TOKEN,
        GITHUB_OWNER: process.env.GITHUB_OWNER || process.env.GITHUB_USERNAME,
      }

      const envLines = Object.entries(serverEnvVars)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}=${v}`)

      if (envLines.length > 0) {
        const envContent = `# Auto-generated by Sycord VPS Setup\n${envLines.join("\n")}\n`
        await ssh.execCommand(`cat > .env.server`, { cwd, stdin: envContent })
        console.log(`[VPS Setup] Wrote .env.server with ${envLines.length} variable(s)`)
      } else {
        console.warn(`[VPS Setup] No server env vars available to write to .env.server`)
      }

      // --- Start Flask FIRST (this is the priority) ---
      await run(`nohup bash -c 'set -a; [ -f ${cwd}/.env.server ] && source ${cwd}/.env.server; set +a; exec python3 ${cwd}/runner.py' > ${cwd}/runner.log 2>&1 &`, cwd)

      // Give Flask more time to start up and bind its port
      await new Promise(r => setTimeout(r, 3000))

      const psResFlask = await run('pgrep -f "python3.*/runner.py"', cwd)
      const flaskRunning = !!psResFlask.stdout

      if (!flaskRunning) {
         console.warn("[VPS Setup] Flask server doesn't appear to be running after start.")
         const flaskLog = await run(`tail -n 50 ${cwd}/runner.log`, cwd)
         ssh.dispose()
         return NextResponse.json({
           error: `Flask server failed to start. Log output:\n${flaskLog.stdout || flaskLog.stderr || 'No log output found.'}`
         }, { status: 500 })
      }

      // --- Now try to start tunnel (non-fatal if it fails) ---
      let tunnelRunning = false
      let tunnelWarning = ""

      // Check if config.yml exists before trying to start the tunnel
      const configCheck = await run(`test -f ${cwd}/config.yml && echo "exists"`, cwd)
      if (configCheck.stdout.includes("exists")) {
        await run(`nohup ${cwd}/cloudflared tunnel --config ${cwd}/config.yml run sycord-runner > ${cwd}/tunnel.log 2>&1 &`, cwd)

        // Wait 2 seconds to see if cloudflared crashes immediately
        await new Promise(r => setTimeout(r, 2000))

        const psResTunnel = await run('pgrep -f "cloudflared tunnel.*sycord-runner"', cwd)
        tunnelRunning = !!psResTunnel.stdout

        if (!tunnelRunning) {
          const logTail = await run(`tail -n 20 ${cwd}/tunnel.log`, cwd)
          tunnelWarning = `Tunnel failed to start (Flask is still running). Log: ${logTail.stdout || logTail.stderr || 'No log output.'}`
          console.warn(`[VPS Setup] ${tunnelWarning}`)
        }
      } else {
        tunnelWarning = "config.yml not found – tunnel was not started. Flask is running on port 5000. Run Step 3 (Config) to set up the tunnel."
        console.warn(`[VPS Setup] ${tunnelWarning}`)
      }

      ssh.dispose()

      // Always return success if Flask is running – tunnel is secondary
      return NextResponse.json({
        success: true,
        flaskRunning: true,
        tunnelRunning,
        message: tunnelRunning
          ? "VPS Setup Complete! Flask server and Tunnel are both running."
          : `Flask server is running! ${tunnelWarning}`,
      })
    }

    ssh.dispose()
    return NextResponse.json({ error: "Invalid action parameter" }, { status: 400 })

  } catch (error: any) {
    console.error(`[VPS Setup] Error (${request.url}):`, error)
    return NextResponse.json({ error: error.message || "Failed to execute VPS action" }, { status: 500 })
  }
}
