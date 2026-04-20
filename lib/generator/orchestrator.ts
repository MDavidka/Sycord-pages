import type { StyleJSON, FunctionJSON, CheatSheet, StyleComponentChild, LogicBlock } from "./types";

interface OrchestratorResult {
  tsx: string;
  imports: string[];
}

export function orchestrate(
  styleJSON: StyleJSON,
  functionJSON: FunctionJSON,
  cheatSheet: CheatSheet
): OrchestratorResult {
  const usedComponents = new Set<string>();
  const importMap = new Map<string, Set<string>>();
  
  // Collect all used components
  function collectComponents(item: { component: string; children?: unknown[] }) {
    usedComponents.add(item.component);
    if (item.children && Array.isArray(item.children)) {
      item.children.forEach((child) => {
        if (typeof child === "object" && child !== null && "component" in child) {
          collectComponents(child as { component: string; children?: unknown[] });
        }
      });
    }
  }
  
  styleJSON.layout.forEach(item => collectComponents(item));
  
  // Build import map from cheat sheet
  usedComponents.forEach(compName => {
    const compDef = cheatSheet.components.find(c => c.name === compName);
    if (compDef) {
      const path = compDef.importPath;
      if (!importMap.has(path)) {
        importMap.set(path, new Set());
      }
      importMap.get(path)!.add(compName);
    }
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
  
  // Build handler map from function JSON
  const handlerMap = new Map<string, { event: string; handlerName: string }>();
  const stateBlocks: string[] = [];
  const effectBlocks: string[] = [];
  const handlerBlocks: string[] = [];
  
  functionJSON.logicBlocks.forEach((block: LogicBlock) => {
    if ("type" in block && block.type === "state") {
      stateBlocks.push(block.code);
    } else if ("type" in block && block.type === "effect") {
      effectBlocks.push(block.code);
    } else if ("targetId" in block) {
      // Extract handler name from handler code
      const handlerMatch = block.handler.match(/const\s+(\w+)\s*=/);
      const handlerName = handlerMatch ? handlerMatch[1] : `handle${block.targetId}`;
      handlerMap.set(block.targetId, { event: block.event, handlerName });
      handlerBlocks.push(block.handler);
    }
  });
  
  // Generate JSX from style JSON
  function renderComponent(item: StyleComponentChild | { id?: string; component: string; props: Record<string, unknown>; children?: StyleComponentChild[] }, indent: number): string {
    const spaces = "  ".repeat(indent);
    const { component, props, children } = item;
    const id = "id" in item ? item.id : undefined;
    
    // Build props string
    const propEntries: string[] = [];
    
    Object.entries(props).forEach(([key, value]) => {
      if (key === "children" && typeof value === "string") {
        // Will be handled as children
        return;
      }
      if (typeof value === "string") {
        propEntries.push(`${key}="${value}"`);
      } else if (typeof value === "boolean") {
        propEntries.push(value ? key : `${key}={false}`);
      } else if (typeof value === "number") {
        propEntries.push(`${key}={${value}}`);
      } else {
        propEntries.push(`${key}={${JSON.stringify(value)}}`);
      }
    });
    
    // Add handler if this element has one
    if (id && handlerMap.has(id)) {
      const { event, handlerName } = handlerMap.get(id)!;
      propEntries.push(`${event}={${handlerName}}`);
    }
    
    const propsStr = propEntries.length > 0 ? " " + propEntries.join(" ") : "";
    
    // Handle children
    const textChild = props.children as string | undefined;
    
    if (!children || children.length === 0) {
      if (textChild) {
        return `${spaces}<${component}${propsStr}>${textChild}</${component}>`;
      }
      return `${spaces}<${component}${propsStr} />`;
    }
    
    const childrenJSX = children
      .map(child => renderComponent(child, indent + 1))
      .join("\n");
    
    return `${spaces}<${component}${propsStr}>\n${childrenJSX}\n${spaces}</${component}>`;
  }
  
  const layoutJSX = styleJSON.layout
    .map(item => renderComponent(item, 2))
    .join("\n");
  
  // Build complete component
  const componentName = styleJSON.pageId
    .split("_")
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
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
    imports: Array.from(importMap.keys())
  };
}
