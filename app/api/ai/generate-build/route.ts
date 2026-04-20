import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import ts from "typescript"

const BUILD_COMMANDS = [
  "./node_modules/.bin/tsc --noEmit",
  "npm run lint",
  "npm run build",
]

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const tsx = typeof body.tsx === "string" ? body.tsx : ""

    if (!tsx.trim()) {
      return NextResponse.json({ message: "Missing TSX source" }, { status: 400 })
    }

    const transpile = ts.transpileModule(tsx, {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2020,
      },
      reportDiagnostics: true,
    })

    const diagnostics = (transpile.diagnostics || []).map((item) => {
      const message = ts.flattenDiagnosticMessageText(item.messageText, "\n")
      return {
        code: item.code,
        category: ts.DiagnosticCategory[item.category],
        message,
      }
    })

    return NextResponse.json({
      success: diagnostics.length === 0,
      diagnostics,
      commands: BUILD_COMMANDS,
    })
  } catch (error: any) {
    console.error("[ai-builder] generate-build error:", error)
    return NextResponse.json({ message: error.message || "Build gate failed" }, { status: 500 })
  }
}
