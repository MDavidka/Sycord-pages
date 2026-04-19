import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { styleJson, functionJson, shadcnLibrary } = await request.json();

    let imports = new Set(["import React, { useState, useEffect } from 'react';"]);
    let componentBody = [];
    let uiStructure = "";

    // Parse Logic Blocks
    if (functionJson?.logicBlocks) {
      for (const block of functionJson.logicBlocks) {
        if (block.code) componentBody.push(block.code);
        if (block.handler) componentBody.push(block.handler);
      }
    }

    // Helper to process styleJson to UI layout
    const processLayout = (layoutItems: any[]) => {
      let jsx = "";
      for (const item of layoutItems) {
        // Find import path
        if (shadcnLibrary && shadcnLibrary[item.component]) {
           imports.add(`import { ${item.component} } from '${shadcnLibrary[item.component].path}';`);
        } else {
           // fallback import
           imports.add(`import { ${item.component} } from '@/components/ui/${item.component.toLowerCase()}';`);
        }

        let propsString = "";
        if (item.props) {
            for (const [key, val] of Object.entries(item.props)) {
                if (key !== "children") {
                    if (typeof val === "string") {
                       propsString += ` ${key}="${val}"`;
                    } else {
                       propsString += ` ${key}={${JSON.stringify(val)}}`;
                    }
                }
            }
        }

        // Match handler if ID matches in function json
        if (item.id && functionJson?.logicBlocks) {
            const block = functionJson.logicBlocks.find((b: any) => b.targetId === item.id);
            if (block && block.event) {
               const handlerName = block.handler.match(/const\s+([a-zA-Z0-9_]+)\s*=/)?.[1] || "handleEvent";
               propsString += ` ${block.event}={${handlerName}}`;
            }
        }

        jsx += `<${item.component}${propsString}>`;

        if (item.props?.children && typeof item.props.children === "string") {
            jsx += item.props.children;
        }

        if (item.children) {
            jsx += processLayout(item.children);
        }

        jsx += `</${item.component}>\n`;
      }
      return jsx;
    };

    if (styleJson?.layout) {
       uiStructure = processLayout(styleJson.layout);
    }

    const finalCode = `
${Array.from(imports).join('\n')}
import { cn } from "@/lib/utils";

export default function ${styleJson.pageId || "GeneratedComponent"}() {
  ${componentBody.join('\n  ')}

  return (
    <div className="w-full min-h-screen bg-background">
      ${uiStructure}
    </div>
  );
}
`;

    return NextResponse.json({
      code: finalCode,
      filename: `src/pages/${styleJson.pageId || "page"}.tsx`
    });

  } catch (error: any) {
    console.error("[Orchestrator] Error:", error);
    return NextResponse.json({ message: error.message || "Failed to orchestrate code" }, { status: 500 });
  }
}
