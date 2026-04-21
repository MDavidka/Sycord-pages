const fs = require('fs');

const testCases = [
  // 1. Extra markdown and text
  `Here is your plan:
  \`\`\`json
  [
    {
      "path": "/",
      "title": "Home",
      "structure": { "component": "div", "children": [] }
    }
  ]
  \`\`\`
  Have fun!`,

  // 2. No markdown, extra text, single object (not an array)
  `Sure, here is the JSON:
  {
    "path": "/about",
    "title": "About",
    "structure": { "component": "p", "text": "Hello" }
  }
  Hope this helps!`,

  // 3. Just the JSON without arrays
  `{ "path": "/test", "title": "Test", "structure": { "component": 123, "children": "not an array" } }`
];

// Replicate architect parsing logic
function parseArchitect(content) {
    let jsonString = content;
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      jsonString = codeBlockMatch[1];
    } else {
      // Fallback: Find first [ or { and last ] or }
      const firstBracket = content.indexOf('[');
      const firstBrace = content.indexOf('{');
      const firstIndex = [firstBracket, firstBrace].filter(i => i >= 0).sort((a, b) => a - b)[0];

      const lastBracket = content.lastIndexOf(']');
      const lastBrace = content.lastIndexOf('}');
      const lastIndex = [lastBracket, lastBrace].filter(i => i >= 0).sort((a, b) => b - a)[0];

      if (firstIndex !== undefined && lastIndex !== undefined && lastIndex >= firstIndex) {
        jsonString = content.substring(firstIndex, lastIndex + 1);
      }
    }

    jsonString = jsonString.trim();

    let jsonPlan;
    try {
      jsonPlan = JSON.parse(jsonString)
      // Ensure the result is an array
      if (!Array.isArray(jsonPlan)) {
        jsonPlan = [jsonPlan];
      }
    } catch (e) {
      console.error("Failed to parse Architect JSON:", e.message)
      return null;
    }
    return jsonPlan;
}

// Replicate orchestrator logic
function extractUsedComponents(node, set) {
  if (!node) return
  if (typeof node.component === "string" && node.component[0] === node.component[0].toUpperCase()) {
    set.add(node.component)
  }
  if (node.children && Array.isArray(node.children)) {
    node.children.forEach(c => extractUsedComponents(c, set))
  }
}

function jsonToJsx(node) {
  if (typeof node === "string") return `{${node}}`
  if (node.text) return node.text

  const Comp = node.component || "div"

  let propsStr = ""
  if (node.props) {
    propsStr = Object.entries(node.props)
      .map(([k, v]) => {
        if (typeof v === "string") return `${k}="${v}"`
        return `${k}={${JSON.stringify(v)}}`
      })
      .join(" ")
  }

  const hasChildren = Array.isArray(node.children) && node.children.length > 0

  if (!hasChildren) {
    return `<${Comp} ${propsStr} />`
  }

  const childrenJsx = node.children.map(c => jsonToJsx(c)).join("\n")
  return `<${Comp} ${propsStr}>\n${childrenJsx}\n</${Comp}>`
}


testCases.forEach((content, index) => {
    console.log(`\n--- Test Case ${index + 1} ---`);
    const plan = parseArchitect(content);
    console.log("Parsed Plan:", JSON.stringify(plan));

    if (plan) {
        plan.forEach(page => {
            const set = new Set();
            try {
                extractUsedComponents(page.structure, set);
                console.log("Used Components:", Array.from(set));
                const jsx = jsonToJsx(page.structure);
                console.log("Generated JSX:", jsx);
            } catch (e) {
                console.error("Orchestrator logic crashed:", e);
            }
        });
    }
});
