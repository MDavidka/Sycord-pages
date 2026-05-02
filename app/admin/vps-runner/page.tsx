"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export default function VpsRunnerAdmin() {
  const { data: session } = useSession()
  const [status, setStatus] = useState<any>(null)
  const [websites, setWebsites] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLogs, setSelectedLogs] = useState<{ projectId: string, type: string, data: string[] } | null>(null)
  const [destroyConfirm, setDestroyConfirm] = useState("")

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/admin/vps-runner/status')
      if (res.ok) {
        const data = await res.json()
        setStatus(data)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const fetchWebsites = async () => {
    try {
      const res = await fetch('/api/admin/vps-runner/websites')
      if (res.ok) {
        const data = await res.json()
        setWebsites(Object.values(data.websites || {}))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    fetchWebsites()
    const int = setInterval(() => {
      fetchStatus()
      fetchWebsites()
    }, 10000)
    return () => clearInterval(int)
  }, [])

  const handleAction = async (action: string) => {
    try {
      if (action === 'start' || action === 'setup') {
         // Use the SSH setup endpoint to reliably start the runner or run setup
         await fetch('/api/vps/setup', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ action: action === 'start' ? 'start_server' : 'init' })
         });
      } else {
         await fetch(`/api/admin/vps-runner/runner/${action}`, { method: 'POST' })
      }
      fetchStatus()
    } catch (e) {
      console.error(e)
    }


  const handleSiteAction = async (projectId: string, action: string) => {
    try {
      await fetch(`/api/admin/vps-runner/websites/${projectId}/${action}`, { method: 'POST' })
      fetchWebsites()
    } catch (e) {
      console.error(e)
    }
  }

  const handleSiteDestroy = async (projectId: string) => {
    if (destroyConfirm !== projectId) {
      alert("Please type the project ID to confirm destruction.")
      return
    }
    try {
      await fetch(`/api/admin/vps-runner/websites/${projectId}`, { method: 'DELETE' })
      setDestroyConfirm("")
      fetchWebsites()
    } catch (e) {
      console.error(e)
    }
  }

  const viewLogs = async (projectId: string, type: string) => {
    try {
      const res = await fetch(`/api/admin/vps-runner/websites/${projectId}/logs?type=${type}`)
      if (res.ok) {
         const data = await res.json()
         setSelectedLogs({ projectId, type, data: data.logs })
      }
    } catch (e) {
      console.error(e)
    }
  }

  if (loading) return <div>Loading...</div>

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">VPS Runner Admin</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          <CardContent>
            {status ? (
              <div className="space-y-2">
                <div>Status: <span className="font-bold text-green-500">{status.status}</span></div>
                <div>Uptime: {Math.floor(status.uptime || 0)}s</div>
                <div>Active Websites: {status.websites}</div>
              </div>
            ) : (
              <div className="text-red-500">Offline or Unreachable</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Runner Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-x-2">
            <Button onClick={() => handleAction('start')}>Start</Button>
            <Button onClick={() => handleAction('stop')} variant="secondary">Stop</Button>
            <Button onClick={() => handleAction('setup')} variant="outline">Setup</Button>
            <Button onClick={() => handleAction('destroy')} variant="destructive">Destroy</Button>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-xl font-bold mb-4">Websites</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b">Project ID</th>
              <th className="py-2 px-4 border-b">Domain</th>
              <th className="py-2 px-4 border-b">Status</th>
              <th className="py-2 px-4 border-b">Health</th>
              <th className="py-2 px-4 border-b">Port</th>
              <th className="py-2 px-4 border-b">Actions</th>
            </tr>
          </thead>
          <tbody>
            {websites.map((site) => (
              <tr key={site.projectId} className="text-center">
                <td className="py-2 px-4 border-b">{site.projectId}</td>
                <td className="py-2 px-4 border-b">{site.domain}</td>
                <td className="py-2 px-4 border-b">{site.status}</td>
                <td className="py-2 px-4 border-b">{site.health}</td>
                <td className="py-2 px-4 border-b">{site.port}</td>
                <td className="py-2 px-4 border-b space-x-2">
                  <Button size="sm" onClick={() => handleSiteAction(site.projectId, 'start')}>Start</Button>
                  <Button size="sm" onClick={() => handleSiteAction(site.projectId, 'stop')} variant="secondary">Stop</Button>
                  <Button size="sm" onClick={() => handleSiteAction(site.projectId, 'restart')} variant="outline">Restart</Button>
                  <Button size="sm" onClick={() => handleSiteAction(site.projectId, 'health')} variant="outline">Check Health</Button>
                  <Button size="sm" onClick={() => viewLogs(site.projectId, 'deploy')}>Logs</Button>
                  <div className="inline-flex items-center space-x-2 ml-2">
                     <Input
                        placeholder="Type ID to destroy"
                        value={destroyConfirm}
                        onChange={(e) => setDestroyConfirm(e.target.value)}
                        className="w-32 h-8"
                     />
                     <Button size="sm" variant="destructive" onClick={() => handleSiteDestroy(site.projectId)}>Destroy</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedLogs && (
        <Card className="mt-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Logs: {selectedLogs.projectId} ({selectedLogs.type})</CardTitle>
            <div className="space-x-2">
              <Button size="sm" onClick={() => viewLogs(selectedLogs.projectId, 'deploy')}>Deploy</Button>
              <Button size="sm" onClick={() => viewLogs(selectedLogs.projectId, 'build')}>Build</Button>
              <Button size="sm" onClick={() => viewLogs(selectedLogs.projectId, 'runtime')}>Runtime</Button>
              <Button size="sm" onClick={() => viewLogs(selectedLogs.projectId, 'error')}>Error</Button>
              <Button size="sm" onClick={() => viewLogs(selectedLogs.projectId, 'health')}>Health</Button>
              <Button size="sm" variant="outline" onClick={() => setSelectedLogs(null)}>Close</Button>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="bg-black text-green-400 p-4 rounded overflow-auto h-96 whitespace-pre-wrap">
              {selectedLogs.data.join('\n')}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
}
