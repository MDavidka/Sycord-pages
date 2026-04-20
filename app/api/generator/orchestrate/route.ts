import { NextRequest, NextResponse } from "next/server";
import { orchestrate } from "@/lib/generator/orchestrator";
import type { StyleJSON, FunctionJSON, CheatSheet, OrchestrateResponse } from "@/lib/generator/types";

export async function POST(request: NextRequest): Promise<NextResponse<OrchestrateResponse>> {
  try {
    const { styleJSON, functionJSON, cheatSheet } = await request.json() as {
      styleJSON: StyleJSON;
      functionJSON: FunctionJSON;
      cheatSheet: CheatSheet;
    };

    if (!styleJSON || !functionJSON || !cheatSheet) {
      return NextResponse.json({
        success: false,
        error: "Missing styleJSON, functionJSON, or cheatSheet"
      }, { status: 400 });
    }

    // Orchestration is non-AI - direct code transformation with error handling
    const result = orchestrate(styleJSON, functionJSON, cheatSheet);

    // Return errors even if transformation succeeded (validation warnings)
    return NextResponse.json({
      success: result.errors.length === 0,
      outputTSX: result.tsx,
      imports: result.imports,
      error: result.errors.length > 0 ? result.errors.join("; ") : undefined
    });

  } catch (error) {
    console.error("[Orchestrator Error]", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Orchestration failed"
    }, { status: 500 });
  }
}
