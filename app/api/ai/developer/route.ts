import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { styleJson, componentsSource, model } = await request.json();
    const apiKey = process.env.GOOGLE_AI_API || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ message: "AI service not configured" }, { status: 500 });
    }

    const DEV_MODEL = model || "gemini-1.5-pro"; // Let's use pro for logic
    const GOOGLE_API_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

    const systemPrompt = `You are a Senior React Developer. You will receive a **Style JSON**. Your task is to generate the **Function JSON**.
**Context:** You have access to the component source codes.
**Rules:**
 1. Define all necessary React useState and useEffect blocks.
 2. Create the handler functions for every placeholder ID defined in the Style JSON (e.g., handleCookieClick_001).
 3. Ensure the logic is functional.
 4. Reference the pageId to ensure the logic matches the correct screen.
 5. Output MUST be the Function JSON format provided.

**Component Sources Context:**
${componentsSource || "No components context provided."}
`;

    const response = await fetch(GOOGLE_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: DEV_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Style JSON: ${JSON.stringify(styleJson)}` }
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
      functionJson: JSON.parse(responseText),
    });
  } catch (error: any) {
    console.error("[Developer] Error:", error);
    return NextResponse.json({ message: error.message || "Failed to generate Function JSON" }, { status: 500 });
  }
}
