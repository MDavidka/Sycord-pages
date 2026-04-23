import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getSystemPrompts, saveSystemPrompts } from "@/lib/ai-prompts";

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.email !== "dmarton336@gmail.com") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const prompts = await getSystemPrompts()
  return NextResponse.json({
    aiCheatSheet: prompts.builderCheatSheet,
    converterCheatSheet: prompts.builderFunction, // Using this existing field for the converter cheat sheet
  })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.email !== "dmarton336@gmail.com") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { aiCheatSheet, converterCheatSheet } = await req.json()

  await saveSystemPrompts({
    builderCheatSheet: aiCheatSheet,
    builderFunction: converterCheatSheet
  })

  return NextResponse.json({ success: true })
}
