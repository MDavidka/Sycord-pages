import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { messages, cheatSheet, model } = await request.json();
    const apiKey = process.env.GOOGLE_AI_API || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ message: "AI service not configured" }, { status: 500 });
    }

    const PLAN_MODEL = model || "gemini-1.5-flash";
    const GOOGLE_API_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

    const systemPrompt = `You are a UI Architect. Use the provided cheat_sheet to build a layout.
**Rules:**
1. Use only components and variants listed in the cheat_sheet.
2. Assign a unique id to every interactive element.
3. For any interactivity (clicks, changes), do NOT write code. Instead, assign a unique placeholder function name (e.g., handleCookieClick_001).
4. Output MUST be the Style JSON format provided.

**Cheat Sheet:**
${cheatSheet}`;

    const conversationHistory = messages.map((msg: any) => ({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content
    }));

    const response = await fetch(GOOGLE_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: PLAN_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationHistory
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${await response.text()}`);
    }

    const data = await response.json();
    let responseText = data.choices?.[0]?.message?.content || "";

    // Parse json
    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
    if(jsonMatch) responseText = jsonMatch[1];

    return NextResponse.json({
      styleJson: JSON.parse(responseText),
    });
  } catch (error: any) {
    console.error("[Architect] Error:", error);
    return NextResponse.json({ message: error.message || "Failed to generate Style JSON" }, { status: 500 });
  }
}
