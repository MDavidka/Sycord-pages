import { NextResponse } from "next/server"
import { Vercel } from "@vercel/sdk"
import { getServerSession } from "next-auth/next"
import { authOptions } from "../auth/[...nextauth]/route"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  if (!process.env.VERCEL_TOKEN) {
    return NextResponse.json({ message: "Missing VERCEL_TOKEN environment variable" }, { status: 500 })
  }

  if (!process.env.VERCEL_PROJECT_ID) {
    return NextResponse.json({ message: "Missing VERCEL_PROJECT_ID environment variable" }, { status: 500 })
  }

  try {
    const vercel = new Vercel({
      bearerToken: process.env.VERCEL_TOKEN,
      teamId: process.env.VERCEL_TEAM_ID, // Optional, if the project is under a team
    })

    const { subdomain, projectId } = await request.json()

    if (!subdomain || !subdomain.endsWith(".ltpd.xyz")) {
      return NextResponse.json({ message: "Invalid subdomain format. Must end with .ltpd.xyz" }, { status: 400 })
    }

    const result = await vercel.projects.addProjectDomain({
      idOrName: process.env.VERCEL_PROJECT_ID,
      requestBody: {
        name: subdomain,
      },
    })

    console.log(`[v0] Successfully added domain: ${subdomain} for project: ${projectId}`)

    return NextResponse.json({
      success: true,
      domain: subdomain,
      result,
    })
  } catch (error: any) {
    console.error("[v0] Error creating deployment:", JSON.stringify(error, null, 2))

    return NextResponse.json(
      {
        message: "Failed to create deployment",
        error: error.message || "Unknown error",
        details: error.response?.data || null,
      },
      { status: 500 },
    )
  }
}
