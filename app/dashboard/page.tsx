import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Globe, Settings, BarChart3, FileText, Users } from "lucide-react"

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white rounded-md flex items-center justify-center">
                <span className="text-black font-bold text-lg">S</span>
              </div>
              <span className="text-xl font-semibold text-foreground">Sycord</span>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/dashboard" className="text-sm text-foreground font-medium">
                Overview
              </Link>
              <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Projects
              </Link>
              <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Analytics
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-foreground">
              <Settings className="h-5 w-5" />
            </Button>
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              <span className="text-sm font-medium text-foreground">JD</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Welcome back, John</h1>
          <p className="text-muted-foreground">Here's what's happening with your projects today.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {[
            { label: "Total Projects", value: "12", icon: <Globe className="h-5 w-5" /> },
            { label: "Active Sites", value: "8", icon: <BarChart3 className="h-5 w-5" /> },
            { label: "Total Visitors", value: "24.5K", icon: <Users className="h-5 w-5" /> },
            { label: "Pages Created", value: "47", icon: <FileText className="h-5 w-5" /> },
          ].map((stat, i) => (
            <Card key={i} className="bg-card border-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">{stat.label}</span>
                  <div className="text-muted-foreground">{stat.icon}</div>
                </div>
                <div className="text-3xl font-bold text-foreground">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Projects Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-foreground">Your Projects</h2>
            <Button className="bg-white text-black hover:bg-white/90">
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                name: "Mobile Store Pro",
                type: "E-commerce",
                status: "Active",
                visitors: "12.3K",
                updated: "2 hours ago",
              },
              {
                name: "Hosting Services",
                type: "Service Page",
                status: "Active",
                visitors: "8.1K",
                updated: "5 hours ago",
              },
              {
                name: "Portfolio Site",
                type: "Portfolio",
                status: "Draft",
                visitors: "0",
                updated: "1 day ago",
              },
            ].map((project, i) => (
              <Card key={i} className="bg-card border-border hover:bg-accent transition-colors cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                      <Globe className="h-5 w-5 text-white" />
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        project.status === "Active" ? "bg-white/10 text-white" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {project.status}
                    </span>
                  </div>
                  <CardTitle className="text-foreground">{project.name}</CardTitle>
                  <CardDescription className="text-muted-foreground">{project.type}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Visitors</span>
                    <span className="text-foreground font-medium">{project.visitors}</span>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">Updated {project.updated}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Quick Actions</CardTitle>
            <CardDescription className="text-muted-foreground">Common tasks to help you get started</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { title: "Create Mobile Store", description: "Set up an e-commerce site" },
                { title: "Add Hosting Page", description: "Showcase your hosting services" },
                { title: "Build Service Page", description: "Display your offerings" },
              ].map((action, i) => (
                <button
                  key={i}
                  className="text-left p-4 rounded-lg border border-border hover:bg-accent transition-colors"
                >
                  <h3 className="font-semibold text-foreground mb-1">{action.title}</h3>
                  <p className="text-sm text-muted-foreground">{action.description}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
