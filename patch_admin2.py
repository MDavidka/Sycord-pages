with open("app/admin/page.tsx", "r") as f:
    content = f.read()

# Add Setup Action button
vps_actions_old = """            {/* Controls */}
            <div className="flex items-center gap-3">
              <Button
                onClick={() => handleVpsAction("start")}
                disabled={!!vpsAction}
                className="bg-green-600 hover:bg-green-700 text-white rounded-xl"
              >
                {vpsAction === "start" ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                Start
              </Button>
              <Button
                onClick={() => handleVpsAction("restart")}
                disabled={!!vpsAction}
                variant="outline"
                className="border-white/10 text-white/60 hover:text-white rounded-xl"
              >
                {vpsAction === "restart" ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <RotateCcw className="h-4 w-4 mr-1.5" />}
                Restart
              </Button>
              <Button
                onClick={() => handleVpsAction("stop")}
                disabled={!!vpsAction}
                variant="outline"
                className="border-red-500/20 text-red-400 hover:bg-red-500/10 rounded-xl"
              >
                Stop
              </Button>
            </div>"""

vps_actions_new = """            {/* Controls */}
            <div className="flex items-center justify-between mb-4 mt-6">
              <h3 className="text-base font-semibold text-white">VPS Setup & Actions</h3>
              <div className="flex items-center gap-3">
                <Button
                  onClick={async () => {
                    const res = await fetch("/api/admin/vps-runner/setup", { method: "POST" })
                    if (res.ok) toast.success("VPS Setup complete")
                  }}
                  variant="outline"
                  className="border-blue-500/20 text-blue-400 hover:bg-blue-500/10 rounded-xl"
                >
                  Run Setup
                </Button>
                <Button
                  onClick={() => handleVpsAction("start")}
                  disabled={!!vpsAction}
                  className="bg-green-600 hover:bg-green-700 text-white rounded-xl"
                >
                  {vpsAction === "start" ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                  Start
                </Button>
                <Button
                  onClick={() => handleVpsAction("restart")}
                  disabled={!!vpsAction}
                  variant="outline"
                  className="border-white/10 text-white/60 hover:text-white rounded-xl"
                >
                  {vpsAction === "restart" ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <RotateCcw className="h-4 w-4 mr-1.5" />}
                  Restart
                </Button>
                <Button
                  onClick={() => handleVpsAction("stop")}
                  disabled={!!vpsAction}
                  variant="outline"
                  className="border-red-500/20 text-red-400 hover:bg-red-500/10 rounded-xl"
                >
                  Stop
                </Button>
              </div>
            </div>"""

content = content.replace(vps_actions_old, vps_actions_new)

with open("app/admin/page.tsx", "w") as f:
    f.write(content)
