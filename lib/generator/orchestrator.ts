import type { StyleJSON, FunctionJSON, CheatSheet, StyleComponentChild, LogicBlock } from "./types";

interface OrchestratorResult {
  tsx: string;
  imports: string[];
  errors: string[];
}

/**
 * Algorithmic orchestrator - combines StyleJSON + FunctionJSON into valid TSX
 * NO AI involved - purely data transformation and validation
 */
export function orchestrate(
  styleJSON: StyleJSON,
  functionJSON: FunctionJSON,
  cheatSheet: CheatSheet
): OrchestratorResult {
  const errors: string[] = [];
  
  try {
    // Validate inputs
    if (!styleJSON || !functionJSON || !cheatSheet) {
      return {
        tsx: "",
        imports: [],
        errors: ["Missing required input: styleJSON, functionJSON, or cheatSheet"]
      };
    }

    if (!styleJSON.layout || !Array.isArray(styleJSON.layout)) {
      return {
        tsx: "",
        imports: [],
        errors: ["StyleJSON.layout must be an array"]
      };
    }

    if (!functionJSON.logicBlocks || !Array.isArray(functionJSON.logicBlocks)) {
      return {
        tsx: "",
        imports: [],
        errors: ["FunctionJSON.logicBlocks must be an array"]
      };
    }

    const usedComponents = new Set<string>();
    const importMap = new Map<string, Set<string>>();
    
    // Collect all used components with error handling
    function collectComponents(item: unknown, path: string = ""): void {
      if (!item || typeof item !== "object") return;
      
      const obj = item as Record<string, unknown>;
      const component = obj.component;
      
      if (typeof component !== "string") {
        errors.push(`Invalid component at ${path}: component must be a string`);
        return;
      }
      
      usedComponents.add(component);
      
      if (obj.children && Array.isArray(obj.children)) {
        obj.children.forEach((child, idx) => {
          collectComponents(child, `${path}.children[${idx}]`);
        });
      }
    }
    
    styleJSON.layout.forEach((item, idx) => collectComponents(item, `layout[${idx}]`));
    
    // Build import map from cheat sheet
    usedComponents.forEach(compName => {
      const compDef = cheatSheet.components.find(c => c.name === compName);
      if (!compDef) {
        errors.push(`Component "${compName}" not found in cheatsheet`);
        return;
      }
      
      const path = compDef.importPath;
      if (!importMap.has(path)) {
        importMap.set(path, new Set());
      }
      importMap.get(path)!.add(compName);
    });
    
    // Generate import statements
    const imports: string[] = [
      '"use client";',
      '',
      'import { useState, useEffect } from "react";'
    ];
    
    importMap.forEach((components, path) => {
      const sorted = Array.from(components).sort();
      imports.push(`import { ${sorted.join(", ")} } from "${path}";`);
    });
    
    // Build handler map from function JSON with validation
    const handlerMap = new Map<string, { event: string; handlerName: string }>();
    const stateBlocks: string[] = [];
    const effectBlocks: string[] = [];
    const handlerBlocks: string[] = [];
    
    functionJSON.logicBlocks.forEach((block: unknown, idx: number) => {
      if (!block || typeof block !== "object") {
        errors.push(`Invalid logic block at index ${idx}: must be an object`);
        return;
      }
      
      const logicBlock = block as Record<string, unknown>;
      const type = logicBlock.type;
      
      if (type === "state" || type === "effect") {
        const code = logicBlock.code;
        if (typeof code !== "string") {
          errors.push(`${type} block at index ${idx}: code must be a string`);
          return;
        }
        
        if (type === "state") {
          stateBlocks.push(code);
        } else {
          effectBlocks.push(code);
        }
      } else if ("targetId" in logicBlock) {
        // Handler block
        const targetId = logicBlock.targetId;
        const event = logicBlock.event;
        const handler = logicBlock.handler;
        
        if (typeof targetId !== "string" || typeof event !== "string" || typeof handler !== "string") {
          errors.push(`Handler block at index ${idx}: targetId, event, and handler must be strings`);
          return;
        }
        
        // Extract handler name from handler code
        const handlerMatch = handler.match(/const\s+(\w+)\s*=/);
        const handlerName = handlerMatch ? handlerMatch[1] : `handle${targetId}`;
        handlerMap.set(targetId, { event, handlerName });
        handlerBlocks.push(handler);
      }
    });
    
    // Generate JSX from style JSON with error handling
    function renderComponent(item: unknown, indent: number, path: string = ""): string {
      if (!item || typeof item !== "object") {
        errors.push(`Invalid component at ${path}: must be an object`);
        return "";
      }
      
      const spaces = "  ".repeat(indent);
      const obj = item as Record<string, unknown>;
      const component = obj.component as string;
      const props = obj.props as Record<string, unknown> || {};
      const children = obj.children as unknown[];
      const id = obj.id as string | undefined;
      
      if (!component) {
        errors.push(`Component at ${path} has no name`);
        return "";
      }
      
      // Build props string
      const propEntries: string[] = [];
      
      Object.entries(props).forEach(([key, value]) => {
        if (key === "children" && typeof value === "string") {
          return; // Will be handled as text children
        }
        
        if (value === null || value === undefined) {
          return; // Skip null/undefined props
        }
        
        if (typeof value === "string") {
          propEntries.push(`${key}="${value}"`);
        } else if (typeof value === "boolean") {
          propEntries.push(value ? key : `${key}={false}`);
        } else if (typeof value === "number") {
          propEntries.push(`${key}={${value}}`);
        } else {
          try {
            propEntries.push(`${key}={${JSON.stringify(value)}}`);
          } catch (e) {
            errors.push(`Failed to serialize prop "${key}" at ${path}`);
          }
        }
      });
      
      // Add handler if this element has one
      if (id && handlerMap.has(id)) {
        const { event, handlerName } = handlerMap.get(id)!;
        propEntries.push(`${event}={${handlerName}}`);
      }
      
      const propsStr = propEntries.length > 0 ? " " + propEntries.join(" ") : "";
      
      // Handle text children from props
      const textChild = props.children as string | undefined;
      
      // Handle component children
      if (!children || children.length === 0) {
        if (textChild) {
          return `${spaces}<${component}${propsStr}>${textChild}</${component}>`;
        }
        return `${spaces}<${component}${propsStr} />`;
      }
      
      const childrenJSX = children
        .map((child, idx) => renderComponent(child, indent + 1, `${path}.children[${idx}]`))
        .filter(jsx => jsx.length > 0)
        .join("\n");
      
      if (!childrenJSX) {
        return `${spaces}<${component}${propsStr} />`;
      }
      
      return `${spaces}<${component}${propsStr}>\n${childrenJSX}\n${spaces}</${component}>`;
    }
    
    const layoutJSX = styleJSON.layout
      .map((item, idx) => renderComponent(item, 2, `layout[${idx}]`))
      .filter(jsx => jsx.length > 0)
      .join("\n\n");
    
    // Build complete component
    const componentName = (styleJSON.pageId || "GeneratedPage")
      .split(/[_-]/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join("");
    
    const stateSection = stateBlocks.length > 0 
      ? stateBlocks.map(s => `  ${s}`).join("\n") + "\n\n"
      : "";
      
    const handlerSection = handlerBlocks.length > 0
      ? handlerBlocks.map(h => `  ${h}`).join("\n\n") + "\n\n"
      : "";
      
    const effectSection = effectBlocks.length > 0
      ? effectBlocks.map(e => `  ${e}`).join("\n\n") + "\n\n"
      : "";
    
    const tsx = `${imports.join("\n")}

export default function ${componentName}() {
${stateSection}${handlerSection}${effectSection}  return (
    <div className="min-h-screen">
${layoutJSX}
    </div>
  );
}
`;

    return {
      tsx,
      imports: Array.from(importMap.keys()),
      errors
    };
  } catch (error) {
    return {
      tsx: "",
      imports: [],
      errors: [`Orchestration failed: ${error instanceof Error ? error.message : "Unknown error"}`]
    };
  }
}
