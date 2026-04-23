import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildFunctionPrompt } from "@/lib/generator/prompts";
import type { StyleJSON, BlankFunction, CheatSheet, FunctionJSON, GenerateFunctionsResponse } from "@/lib/generator/types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(request: NextRequest): Promise<NextResponse<GenerateFunctionsResponse>> {
  try {
    const { styleJSON, blankFunctions, cheatSheet } = await request.json() as {
      styleJSON: StyleJSON;
      blankFunctions: BlankFunction[];
      cheatSheet: CheatSheet;
    };

    if (!styleJSON || !blankFunctions || !cheatSheet) {
      return NextResponse.json({
        success: false,
        error: "Missing styleJSON, blankFunctions, or cheatSheet"
      }, { status: 400 });
    }

    // If no blank functions, return empty logic blocks
    if (blankFunctions.length === 0) {
      return NextResponse.json({
        success: true,
        functionJSON: {
          targetPage: styleJSON.pageId,
          logicBlocks: []
        }
      });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    const systemPrompt = buildFunctionPrompt(styleJSON, blankFunctions, cheatSheet);
    
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
    
    // Parse JSON from response
    let jsonStr = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }
    
    const functionJSON: FunctionJSON = JSON.parse(jsonStr);

    return NextResponse.json({
      success: true,
      functionJSON
    });

  } catch (error) {
    console.error("[Generator Functions Error]", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Function generation failed"
    }, { status: 500 });
  }
}
