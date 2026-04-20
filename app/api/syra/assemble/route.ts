import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { StyleJsonSchema, FunctionJsonSchema } from "@/lib/syra/zod-schemas"
import { assemble, validateTsx } from "@/lib/syra/orchestrator"

/**
 * Stage 4 — Orchestrator (no AI)
 * Deterministically assembles a .tsx file from the two JSON blobs.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!(session?.user as any)?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const validatedStyle    = StyleJsonSchema.parse(body?.styleJson)
    const validatedFunction = FunctionJsonSchema.parse(body?.functionJson)

    const tsx = assemble(validatedStyle as any, validatedFunction)

    // Stage 5 lightweight build gate
    const { valid, errors } = validateTsx(tsx)

    return NextResponse.json({ tsx, valid, errors })
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}
