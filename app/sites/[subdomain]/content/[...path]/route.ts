import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ subdomain: string; path: string[] }> }
) {
  const { subdomain, path } = await params
  const filename = path.join("/")

  try {
    const client = await clientPromise
    const db = client.db()

    // Try to find deployment first
    let deployment = await db.collection("deployments").findOne({
      subdomain: subdomain.toLowerCase(),
    })

    let projectId

    if (deployment) {
      projectId = deployment.projectId
    } else {
      // Fallback to project lookup
      const project = await db.collection("projects").findOne({
        subdomain: subdomain.toLowerCase(),
      })
      if (project) {
        projectId = project._id
      }
    }

    if (!projectId) {
      return new Response("Site Not Found", { status: 404 })
    }

    const project = await db.collection("projects").findOne({
      _id: projectId,
    })

    if (!project || !project.pages) {
      // Fallback to aiGeneratedCode if pages array doesn't exist (legacy)
      if (project?.aiGeneratedCode && (filename === "index.html" || filename === "index")) {
         return new Response(project.aiGeneratedCode, {
            headers: { "Content-Type": "text/html" },
         })
      }
      return new Response("Content Not Found", { status: 404 })
    }

    // Find file in pages array
    // Handle cases where filename might be "about" but stored as "about.html"
    let file = project.pages.find((p: any) => p.name === filename)

    if (!file && !filename.includes('.')) {
        file = project.pages.find((p: any) => p.name === `${filename}.html`)
    }

    // Default to index.html if root request (should ideally be handled by page.tsx but good fallback)
    if (!file && (filename === "" || filename === "index")) {
        file = project.pages.find((p: any) => p.name === "index.html")
    }

    if (!file) {
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
