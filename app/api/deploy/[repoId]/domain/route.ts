import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import clientPromise from "@/lib/mongodb";

const SYCORD_DEPLOY_API_BASE = "https://micro1.sycord.com"

export async function GET(
    request: Request,
    { params }: { params: Promise<{ repoId: string }> }
) {
    const { repoId } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!repoId) {
        return NextResponse.json({ error: "Missing Repo ID" }, { status: 400 })
    }

    try {
        console.log(`[Domain Check] Checking domain for repo ${repoId}`)

        let domain = null

        // 1. Try Upstream Domain API
        try {
            const res = await fetch(`${SYCORD_DEPLOY_API_BASE}/api/deploy/${repoId}/domain`)
            if (res.ok) {
                const data = await res.json()
                if (data.success && data.domain) {
                    domain = data.domain
                    console.log(`[Domain Check] Found via API: ${domain}`)
                }
            }
        } catch (apiError) {
            console.error(`[Domain Check] API fetch error:`, apiError)
        }

        // 2. Fallback: Parse Logs if API failed or returned generic placeholder
        if (!domain || domain === "https://test.pages.dev") {
            console.log(`[Domain Check] Domain is missing or placeholder, checking logs...`)
            try {
                const logsRes = await fetch(`${SYCORD_DEPLOY_API_BASE}/api/logs?project_id=${repoId}&limit=100`)
                if (logsRes.ok) {
                    const logData = await logsRes.json()
                    if (logData.success && Array.isArray(logData.logs)) {
                        // Join logs to search across lines if needed, or iterate
                        // Pattern: "Take a peek over at https://..."
                        const combinedLogs = logData.logs.join('\n')
                        // Regex to capture URL. Handles variations.
                        const match = combinedLogs.match(/Take a peek over at[\s\S]*?(https:\/\/[a-zA-Z0-9.-]+\.pages\.dev)/)
                        if (match && match[1]) {
                            // Clean potential trailing characters (like colors codes if raw, though usually stripped)
                            // The provided log sample looks clean.
                            domain = match[1].trim()
                            // Remove trailing dot if present (common in sentences)
                            if (domain.endsWith('.')) domain = domain.slice(0, -1)

                            console.log(`[Domain Check] Found via Logs: ${domain}`)
                        }
                    }
                }
            } catch (logError) {
                console.error(`[Domain Check] Log parsing error:`, logError)
            }
        }

        // 3. Update Database if Found
        if (domain) {
            const client = await clientPromise
            const db = client.db()

            // Try updating with numeric ID
            const numericId = parseInt(repoId)
            let updateResult

            if (!isNaN(numericId)) {
                updateResult = await db.collection("users").updateOne(
                    {
                        id: session.user.id,
                        "projects.githubRepoId": numericId
                    },
                    {
                        $set: { "projects.$.cloudflareUrl": domain }
                    }
                )
            }

            // Fallback to string ID if numeric failed
            if (!updateResult || updateResult.matchedCount === 0) {
                 await db.collection("users").updateOne(
                    {
                        id: session.user.id,
                        "projects.githubRepoId": repoId
                    },
                    {
                        $set: { "projects.$.cloudflareUrl": domain }
                    }
                )
            }

            return NextResponse.json({ success: true, domain })
        }

        return NextResponse.json({ success: false, message: "Domain not found yet" })

    } catch (e: any) {
        console.error("Domain fetch error:", e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
