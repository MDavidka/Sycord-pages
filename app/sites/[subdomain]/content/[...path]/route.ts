
import clientPromise from "@/lib/mongodb";


export async function GET(
  request: Request,
  { params }: { params: Promise<{ subdomain: string; path: string[] }> }
) {
  const { subdomain, path } = await params
  const rawFilename = path.join("/")
  // Normalize filename: remove leading slash
  const filename = rawFilename.replace(/^\//, "")

  try {
    const client = await clientPromise
    const db = client.db()

    // Find user who has a project with this subdomain
    const userWithProject = await db.collection("users").findOne({
      "projects.subdomain": subdomain.toLowerCase()
    }, {
      projection: { "projects.$": 1 }
    })

    if (!userWithProject || !userWithProject.projects || userWithProject.projects.length === 0) {
      return new Response("Site Not Found", { status: 404 })
    }

    const project = userWithProject.projects[0];
    const projectId = project._id;

    if (!project || (!project.pages && !project.aiGeneratedCode)) {
      return new Response("Content Not Found", { status: 404 })
    }

    // Find file in pages array with robust matching
    const pages = project.pages || [];
    let file = pages.find((p: any) => {
        const storedName = p.name.replace(/^\//, "")
        return storedName === filename
    })

    // Try adding .html if missing
    if (!file && !filename.includes('.')) {
        file = pages.find((p: any) => {
            const storedName = p.name.replace(/^\//, "")
            return storedName === `${filename}.html`
        })
    }

    // Default to index.html if root request
    if (!file && (filename === "" || filename === "index")) {
        file = pages.find((p: any) => {
            const storedName = p.name.replace(/^\//, "")
            return storedName === "index.html"
        })
    }

    // Fallback to legacy aiGeneratedCode
    if (!file && project.aiGeneratedCode && (filename === "index.html" || filename === "index" || filename === "")) {
         return new Response(project.aiGeneratedCode, {
            headers: { "Content-Type": "text/html" },
         })
    }

    if (!file) {
      console.log(`[v0] File not found: ${filename} in project ${projectId}`)
      return new Response("File Not Found", { status: 404 })
    }

    // Determine Content Type
    let contentType = "text/html"
    if (filename.endsWith(".css")) contentType = "text/css"
    if (filename.endsWith(".js")) contentType = "application/javascript"
    if (filename.endsWith(".json")) contentType = "application/json"
    if (filename.endsWith(".png")) contentType = "image/png"
    if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) contentType = "image/jpeg"
    if (filename.endsWith(".svg")) contentType = "image/svg+xml"

    return new Response(file.content, {
      headers: { "Content-Type": contentType },
    })
  } catch (error) {
    console.error("Error serving content:", error)
    return new Response("Internal Server Error", { status: 500 })
  }
}
