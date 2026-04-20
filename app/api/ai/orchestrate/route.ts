import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { componentManifest } from "@/lib/ai-builder/manifest"
import { assemble } from "@/lib/ai-builder/assemble"
import { FunctionJsonSchema, createStyleJsonSchema } from "@/lib/ai-builder/schemas"
import type { StyleJson } from "@/lib/ai-builder/types"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const styleSchema = createStyleJsonSchema(Object.keys(componentManifest))
    const styleJson = styleSchema.parse(body.styleJson) as StyleJson
    const functionJson = FunctionJsonSchema.parse(body.functionJson)
    const tsx = assemble(styleJson, functionJson)

    return NextResponse.json({
      tsx,
    })
  } catch (error: any) {
    console.error("[ai-builder] orchestrate error:", error)
    return NextResponse.json({ message: error.message || "Failed to orchestrate TSX" }, { status: 500 })
  }
}
