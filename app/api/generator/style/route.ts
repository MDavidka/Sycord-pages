import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildStylePrompt, extractBlankFunctions } from "@/lib/generator/prompts";
import type { CheatSheet, StyleJSON, GenerateStyleResponse } from "@/lib/generator/types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(request: NextRequest): Promise<NextResponse<GenerateStyleResponse>> {
  try {
    const { prompt, cheatSheet } = await request.json() as { prompt: string; cheatSheet: CheatSheet };

    if (!prompt || !cheatSheet) {
      return NextResponse.json({
        success: false,
        error: "Missing prompt or cheatSheet"
      }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    const systemPrompt = buildStylePrompt(prompt, cheatSheet);
    
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: systemPrompt }] }],
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 4096,
      }
    });

    const response = result.response;
    const text = response.text();
    
    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }
    
    const styleJSON: StyleJSON = JSON.parse(jsonStr);
    
    // Extract blank functions from the style JSON
    const blankFunctions = extractBlankFunctions(styleJSON);

    return NextResponse.json({
      success: true,
      styleJSON,
      blankFunctions
    });

  } catch (error) {
    console.error("[Generator Style Error]", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Style generation failed"
    }, { status: 500 });
  }
}
