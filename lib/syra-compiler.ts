import { callModel, extractJson } from "@/lib/ai-provider"

function capitalize(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function compileNode(node: any): string {
  if (node.textContent && !node.component) return node.textContent;

  let propsString = Object.entries(node.props || {})
    .map(([key, value]) => {
      if (key === 'bind') return `value={${value}} onChange={(e) => set${capitalize(value as string)}(e.target.value)}`;
      return typeof value === 'string' ? `${key}="${value}"` : `${key}={${value}}`;
    })
    .join(' ');

  let childrenString = (node.children || []).map(compileNode).join('\n');
  if (node.textContent) {
      childrenString = node.textContent + (childrenString ? '\n' + childrenString : '');
  }

  if (!node.component) {
    return childrenString;
  }

  const space = propsString ? ' ' : '';

  if (!childrenString) {
      return `<${node.component}${space}${propsString} />`;
  }

  return `<${node.component}${space}${propsString}>\n${childrenString}\n</${node.component}>`;
}

export function generateFile(pageJson: any) {
  const imports = pageJson.imports && pageJson.imports.length > 0 ? `import { ${pageJson.imports.join(', ')} } from "@/components/ui";` : '';
  const state = (pageJson.state || []).map((s: any) => `const [${s.name}, set${capitalize(s.name)}] = useState(${JSON.stringify(s.default)});`).join('\n');
  const jsx = compileNode(pageJson.tree);

  return `
"use client";
import React, { useState } from "react";
${imports}

export default function Page() {
  ${state}
  return (
    ${jsx}
  );
}
  `.trim();
}
