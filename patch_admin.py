import re

with open("app/admin/page.tsx", "r") as f:
    content = f.read()

# State additions
content = content.replace(
    'const [vpsLogLines, setVpsLogLines] = useState<number>(200)',
    'const [vpsLogLines, setVpsLogLines] = useState<number>(200)\n  const [vpsWebsites, setVpsWebsites] = useState<any[]>([])\n  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string | null>(null)'
)

# Fetch updates
fetch_vps_status_old = """  const fetchVpsStatus = async () => {
    setVpsLoading(true)
    try {
      const res = await fetch("/api/vps/status")
      if (res.ok) {
        const data = await res.json()
        setVpsStatus(data)
      }
    } catch (err) {
      console.error("Failed to fetch VPS status:", err)
    } finally {
      setVpsLoading(false)
    }
  }"""

fetch_vps_status_new = """  const fetchVpsStatus = async () => {
    setVpsLoading(true)
    try {
      const res = await fetch("/api/admin/vps-runner/status")
      if (res.ok) {
        const data = await res.json()
        setVpsStatus(data)
      }
      const websitesRes = await fetch("/api/admin/vps-runner/websites")
      if (websitesRes.ok) {
        setVpsWebsites(await websitesRes.json())
      }
    } catch (err) {
      console.error("Failed to fetch VPS status:", err)
    } finally {
      setVpsLoading(false)
    }
  }

  const handleWebsiteAction = async (id: string, action: "start" | "stop" | "restart" | "destroy") => {
    try {
      const res = await fetch(`/api/admin/vps-runner/websites/${id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Website ${action} successful`)
        setTimeout(fetchVpsStatus, 1000)
      } else {
        toast.error(data.error || `Failed to ${action} website`)
      }
    } catch (err) {
      toast.error(`Failed to ${action} website`)
    }
  }"""

content = content.replace(fetch_vps_status_old, fetch_vps_status_new)

fetch_vps_logs_old = """  const fetchVpsLogs = async (type?: string, lines?: number) => {
    try {
      const logType = type || vpsLogType
      const logLines = lines || vpsLogLines
      const res = await fetch(`/api/vps/logs?lines=${logLines}&type=${logType}`)
      if (res.ok) {
        const data = await res.json()
        setVpsLogs(Array.isArray(data.logs) ? data.logs : [])
      }
    } catch (err) {
      console.error("Failed to fetch VPS logs:", err)
    }
  }"""

fetch_vps_logs_new = """  const fetchVpsLogs = async (id?: string) => {
    try {
      const targetId = id || selectedWebsiteId
      if (!targetId) return
      const res = await fetch(`/api/admin/vps-runner/websites/${targetId}/logs`)
      if (res.ok) {
        const data = await res.json()
        setVpsLogs(Array.isArray(data.logs) ? data.logs : [])
      }
    } catch (err) {
      console.error("Failed to fetch VPS logs:", err)
    }
  }"""

content = content.replace(fetch_vps_logs_old, fetch_vps_logs_new)

vps_ui_old = """            {/* Runner Status Indicators */}
            {vpsStatus && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-white/[0.04]">
                <div className="text-center">
                  <div className={`h-2 w-2 rounded-full mx-auto mb-1.5 ${vpsStatus.runner ? 'bg-green-500' : 'bg-red-500'}`} />
                  <p className="text-[11px] text-white/40">Flask Runner</p>
                </div>
                <div className="text-center">
                  <div className={`h-2 w-2 rounded-full mx-auto mb-1.5 ${vpsStatus.tunnel ? 'bg-green-500' : 'bg-red-500'}`} />
                  <p className="text-[11px] text-white/40">Tunnel</p>
                </div>
                <div className="text-center">
                  <div className={`h-2 w-2 rounded-full mx-auto mb-1.5 ${vpsStatus.httpOk ? 'bg-green-500' : 'bg-red-500'}`} />
                  <p className="text-[11px] text-white/40">HTTP</p>
                </div>
                <div className="text-center">
                  <div className={`h-2 w-2 rounded-full mx-auto mb-1.5 ${vpsStatus.npmInstalled ? 'bg-green-500' : 'bg-yellow-500'}`} />
                  <p className="text-[11px] text-white/40">npm</p>
                </div>
              </div>
            )}

            {/* CPU / RAM / Disk Stats */}
            {vpsStatus?.online && (vpsStatus.cpu !== null || vpsStatus.mem?.percent !== null) && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/[0.04]">"""

vps_ui_new = """            {/* CPU / RAM / Disk Stats */}
            {vpsStatus?.online && (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-4 pt-4 border-t border-white/[0.04]">
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 text-center">
                  <p className="text-[11px] text-white/40">Node.js</p>
                  <p className="text-xs font-semibold text-white mt-1">{vpsStatus.nodeVersion || "—"}</p>
                </div>
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 text-center">
                  <p className="text-[11px] text-white/40">npm</p>
                  <p className="text-xs font-semibold text-white mt-1">{vpsStatus.npmVersion || "—"}</p>
                </div>"""

content = content.replace(vps_ui_old, vps_ui_new)

vps_logs_old = """            {/* Logs Section */}
            <div className="rounded-2xl bg-black/40 border border-white/[0.06] p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] text-white/30 uppercase tracking-wider font-semibold">Server Logs</p>
                <div className="flex items-center gap-2">
                  {/* Log type selector */}
                  <div className="flex rounded-lg overflow-hidden border border-white/[0.06]">
                    {(["all", "runner", "tunnel", "server"] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => { setVpsLogType(type); fetchVpsLogs(type); }}
                        className={`px-2.5 py-1 text-[10px] font-medium transition-colors ${
                          vpsLogType === type
                            ? "bg-white/10 text-white"
                            : "text-white/30 hover:text-white/60 hover:bg-white/[0.04]"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                  {/* Line count */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-1 px-2 py-1 rounded-lg border border-white/[0.06] text-[10px] font-medium text-white/40 hover:text-white/60 transition-colors">
                        {vpsLogLines} lines
                        <ChevronDown className="h-2.5 w-2.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[80px]">
                      {[50, 100, 200, 500].map((n) => (
                        <DropdownMenuItem
                          key={n}
                          onClick={() => { setVpsLogLines(n); fetchVpsLogs(undefined, n); }}
                          className="text-xs"
                        >
                          {n} lines
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              {vpsLogs.length > 0 ? (
                <div className="max-h-[600px] overflow-y-auto font-mono text-xs text-zinc-400 space-y-0.5 custom-scrollbar">
                  {vpsLogs.map((line, i) => (
                    <p key={i} className={
                      line.toLowerCase().includes('error') || line.toLowerCase().includes('exception')
                        ? 'text-red-400'
                        : line.toLowerCase().includes('warn')
                          ? 'text-yellow-400'
                          : line.toLowerCase().includes('success') || line.toLowerCase().includes('deployed')
                            ? 'text-green-400'
                            : ''
                    }>
                      {line}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-white/20 text-center py-8">No logs available. Click Refresh to load.</p>
              )}
            </div>"""

websites_list = """            {/* Websites List */}
            <div className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-6 mt-6">
              <h3 className="text-base font-semibold text-white mb-4">Websites Running</h3>
              <div className="space-y-4">
                {vpsWebsites.length === 0 ? (
                  <p className="text-xs text-white/40">No websites deployed to VPS.</p>
                ) : (
                  vpsWebsites.map(site => (
                    <div key={site.id} className="p-4 bg-black/20 rounded-xl border border-white/[0.06] flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-white">{site.domain || site.subdomain}</p>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 rounded-full ${site.health_ok ? 'border-green-500/30 text-green-500 bg-green-500/5' : 'border-red-500/30 text-red-500 bg-red-500/5'}`}>
                            {site.health_ok ? "Healthy" : "Failing"}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 rounded-full border-blue-500/30 text-blue-500 bg-blue-500/5">
                            Port: {site.port}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 rounded-full border-white/10 text-white/50 bg-white/5">
                            Mem: {site.memory || "—"} / CPU: {site.cpu || "—"}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" className="h-8 border-white/10" onClick={() => { setSelectedWebsiteId(site.id); fetchVpsLogs(site.id); }}>
                          Logs
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 border-white/10" onClick={() => handleWebsiteAction(site.id, 'restart')}>
                          Restart
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 border-red-500/20 text-red-400 hover:bg-red-500/10" onClick={() => handleWebsiteAction(site.id, 'destroy')}>
                          Destroy
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            
            {/* Logs Section */}
            <div className="rounded-2xl bg-black/40 border border-white/[0.06] p-4 mt-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] text-white/30 uppercase tracking-wider font-semibold">
                  {selectedWebsiteId ? `Logs for ${selectedWebsiteId}` : "Select a website to view logs"}
                </p>
                <Button size="sm" variant="ghost" className="h-6" onClick={() => fetchVpsLogs()}>Refresh Logs</Button>
              </div>
              {vpsLogs.length > 0 ? (
                <div className="max-h-[600px] overflow-y-auto font-mono text-xs text-zinc-400 space-y-0.5 custom-scrollbar">
                  {vpsLogs.map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-white/20 text-center py-8">No logs available.</p>
              )}
            </div>"""

content = content.replace(vps_logs_old, websites_list)

with open("app/admin/page.tsx", "w") as f:
    f.write(content)
