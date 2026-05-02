import re

with open("app/dashboard/sites/[id]/page.tsx", "r") as f:
    content = f.read()

content = content.replace(
    'const [deployResult, setDeployResult] = useState<{ url?: string; message?: string; build?: boolean; running?: boolean; health_ok?: boolean; domain?: string; port?: number } | null>(null)',
    'const [deployResult, setDeployResult] = useState<{ url?: string; message?: string; build?: boolean; running?: boolean; health_ok?: boolean; domain?: string; port?: number } | null>(null)\n  const [deploymentRuntime, setDeploymentRuntime] = useState<any>(null)'
)

content = content.replace(
    'setProject(data)',
    'setProject(data)\n            if (data.deploymentRuntime) setDeploymentRuntime(data.deploymentRuntime)'
)

old_ui = """                  <Card className="border-primary/30 bg-primary/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Rocket className="h-4 w-4 text-primary" />
                        Next server runtime
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Deployments run npm install, npm run build, then PORT=&lt;allocated&gt; npm run start. Live status requires build, server process, and health check success.
                      </CardDescription>
                    </CardHeader>
                    {deployResult && (
                      <CardContent className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                        <div>Build: {deployResult.build ? "ok" : "pending"}</div>
                        <div>Server: {deployResult.running ? "running" : "pending"}</div>
                        <div>Health: {deployResult.health_ok ? "ok" : "pending"}</div>
                        <div>Port: {deployResult.port ?? "allocated by VM"}</div>
                      </CardContent>
                    )}
                  </Card>"""

new_ui = """                  <Card className="border-primary/30 bg-primary/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Rocket className="h-4 w-4 text-primary" />
                        Next server runtime
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Deployments run npm install, npm run build, then PORT=&lt;allocated&gt; npm run start. Live status requires build, server process, and health check success.
                      </CardDescription>
                    </CardHeader>
                    {(deployResult || deploymentRuntime) && (
                      <CardContent className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                        <div>Build: {deployResult?.build ?? deploymentRuntime?.build ? "ok" : "pending"}</div>
                        <div>Server: {deployResult?.running ?? deploymentRuntime?.running ? "running" : "pending"}</div>
                        <div>Health: {deployResult?.health_ok ?? deploymentRuntime?.health_ok ? "ok" : "pending"}</div>
                        <div>Port: {deployResult?.port ?? deploymentRuntime?.port ?? "allocated by VM"}</div>
                      </CardContent>
                    )}
                  </Card>"""

content = content.replace(old_ui, new_ui)

with open("app/dashboard/sites/[id]/page.tsx", "w") as f:
    f.write(content)
