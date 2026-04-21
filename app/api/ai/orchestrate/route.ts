import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import fs from "fs"
import path from "path"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { styleJson, functionJson, projectId, pageName } = await request.json()

    if (!styleJson || !functionJson || !projectId || !pageName) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 })
    }

    // 1. Resolve Imports
    const shadcnMappingsPath = path.join(process.cwd(), "lib", "shadcn_library_complete.json")
    let shadcnMappings: Record<string, string> = {}
    try {
      const data = fs.readFileSync(shadcnMappingsPath, "utf8")
      shadcnMappings = JSON.parse(data)
    } catch (e) {
      console.error("Failed to read shadcn mappings:", e)
    }

    const imports = new Set<string>()
    imports.add('import React, { useState } from "react"')
    
    // Scan for Lucide icons in JSX
    const lucideMatches = styleJson.sections.map((s: any) => s.jsx).join(" ").match(/[A-Z][a-zA-Z]+(?=\s+from|"|'|\s|\/|>)/g) || []
    const commonLucideIcons = ["Sparkles", "ArrowRight", "CheckCircle2", "ChevronRight", "Code", "Layout", "Globe", "Database"]
    const iconsToImport = new Set<string>()
    
    // This is a bit naive but should work for most cases
    lucideMatches.forEach((match: string) => {
        if (commonLucideIcons.includes(match) || match.length > 3) {
            // Very simplified check to avoid importing components as icons
            if (!styleJson.sections.some((s: any) => s.components && s.components.includes(match))) {
                iconsToImport.add(match)
            }
        }
    })

    if (iconsToImport.size > 0) {
        imports.add(`import { ${Array.from(iconsToImport).join(", ")} } from "lucide-react"`)
    } else {
        imports.add('import { Sparkles, ArrowRight } from "lucide-react"')
    }

    styleJson.sections.forEach((section: any) => {
      if (section.components) {
        section.components.forEach((comp: string) => {
          if (shadcnMappings[comp]) {
            imports.add(shadcnMappings[comp])
          }
        })
      }
    })

    // 2. Build Component Body
    let stateDecls = ""
    if (functionJson.state) {
      functionJson.state.forEach((s: any) => {
        stateDecls += `  const [${s.name}, set${s.name.charAt(0).toUpperCase() + s.name.slice(1)}] = useState(${JSON.stringify(s.init)})\n`
      })
    }

    let handlerDecls = ""
    if (functionJson.logic) {
      functionJson.logic.forEach((l: any) => {
        if (l.handlers) {
          l.handlers.forEach((h: any) => {
            handlerDecls += `  const ${h.name} = () => {\n    ${h.code}\n  }\n\n`
          })
        }
      })
    }

    // 3. Build JSX
    let jsxBody = styleJson.sections.map((s: any) => s.jsx).join("\n")

    const finalCode = `
${Array.from(imports).join("\n")}

export default function GeneratedPage() {
${stateDecls}
${handlerDecls}
  return (
    <div className="min-h-screen bg-background text-foreground">
      ${jsxBody}
    </div>
  )
}
`

    // 4. Save to Database
    const client = await clientPromise
    const db = client.db()

    if (!ObjectId.isValid(projectId)) {
        return NextResponse.json({ message: "Invalid project ID" }, { status: 400 })
    }

    const updateResult = await db.collection("users").updateOne(
      {
        id: session.user.id,
        "projects": {
          $elemMatch: {
            _id: new ObjectId(projectId),
            "pages.name": pageName
          }
        }
      },
      {
        $set: {
          "projects.$[proj].pages.$[page].content": finalCode,
          "projects.$[proj].pages.$[page].usedFor": "AI Orchestration",
          "projects.$[proj].pages.$[page].updatedAt": new Date()
        }
      },
      {
        arrayFilters: [
          { "proj._id": new ObjectId(projectId) },
          { "page.name": pageName }
        ]
      }
    )

    if (updateResult.matchedCount === 0) {
      const pushResult = await db.collection("users").updateOne(
        {
          id: session.user.id,
          "projects._id": new ObjectId(projectId)
        },
        {
          $push: {
            "projects.$.pages": {
              name: pageName,
              content: finalCode,
              usedFor: "AI Orchestration",
              createdAt: new Date(),
              updatedAt: new Date()
            }
          } as any
        }
      )

      if (pushResult.matchedCount === 0) {
        return NextResponse.json({ message: "Project not found" }, { status: 404 })
      }
    }

    return NextResponse.json({ success: true, code: finalCode })

  } catch (error: any) {
    console.error("Error in orchestrate:", error)
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}
