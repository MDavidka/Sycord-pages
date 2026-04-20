import type { CheatSheet, StyleJSON, BlankFunction } from "./types";

export function buildStylePrompt(userPrompt: string, cheatSheet: CheatSheet): string {
  const componentList = cheatSheet.components.map(c => {
    const propsStr = c.props.map(p => `${p.name}${p.required ? "" : "?"}: ${p.type}`).join(", ");
    return `- ${c.name}: ${c.description} | Props: { ${propsStr} }`;
  }).join("\n");

  return `You are a UI structure generator. Create a style JSON that defines a page layout using ONLY these shadcn/ui components.

AVAILABLE COMPONENTS:
${componentList}

USER REQUEST:
${userPrompt}

RULES:
1. Output ONLY valid JSON, no markdown, no explanation
2. Every interactive element (Button, Input, etc.) MUST have a unique "id" field
3. Use unique, descriptive IDs like "hero_cta_button", "email_input", "submit_form_btn"
4. IDs should indicate purpose: "newsletter_submit", "theme_toggle", "nav_login"
5. Only use components from the list above
6. Use reasonable Tailwind classes in className props

OUTPUT FORMAT:
{
  "pageId": "unique_page_id",
  "path": "/page-path",
  "layout": [
    {
      "id": "section_id",
      "component": "ComponentName",
      "props": { "className": "tailwind classes" },
      "children": [
        { "id": "unique_id", "component": "Button", "props": { "variant": "default" } }
      ]
    }
  ]
}

Generate the style JSON now:`;
}

export function buildFunctionPrompt(
  styleJSON: StyleJSON,
  blankFunctions: BlankFunction[],
  cheatSheet: CheatSheet
): string {
  const functionIds = blankFunctions.map(f => `- ${f.id}: targetId="${f.targetId}", event="${f.event}"`).join("\n");
  
  const componentEvents = cheatSheet.components
    .filter(c => c.props.some(p => p.name.startsWith("on")))
    .map(c => {
      const events = c.props.filter(p => p.name.startsWith("on")).map(p => p.name);
      return `- ${c.name}: ${events.join(", ")}`;
    }).join("\n");

  return `You are a React logic generator. Create function implementations for the blank function IDs identified in the style JSON.

STYLE JSON:
${JSON.stringify(styleJSON, null, 2)}

BLANK FUNCTIONS TO IMPLEMENT:
${functionIds}

COMPONENT EVENTS REFERENCE:
${componentEvents}

RULES:
1. Output ONLY valid JSON, no markdown, no explanation
2. Generate real TypeScript/React code for each handler
3. Include necessary useState and useEffect blocks
4. Handler names should match the function IDs
5. Use proper React patterns (no direct DOM manipulation)

OUTPUT FORMAT:
{
  "targetPage": "${styleJSON.pageId}",
  "logicBlocks": [
    {
      "type": "state",
      "code": "const [stateName, setStateName] = useState(initialValue);"
    },
    {
      "targetId": "element_id",
      "event": "onClick",
      "handler": "const handleElementClick = () => { /* logic */ };"
    },
    {
      "type": "effect",
      "code": "useEffect(() => { /* effect logic */ }, [deps]);"
    }
  ]
}

Generate the function JSON now:`;
}

export function extractBlankFunctions(styleJSON: StyleJSON): BlankFunction[] {
  const blankFunctions: BlankFunction[] = [];
  
  function processItem(item: { id?: string; component: string; props: Record<string, unknown>; children?: unknown[] }) {
    if (item.id) {
      // Check for interactive components that need handlers
      const interactiveComponents = ["Button", "Input", "Textarea", "Switch", "Checkbox", "Select"];
      if (interactiveComponents.includes(item.component)) {
        const event = item.component === "Input" || item.component === "Textarea" ? "onChange" : "onClick";
        blankFunctions.push({
          id: `handle_${item.id}`,
          targetId: item.id,
          event,
          filled: false
        });
      }
    }
    
    if (item.children && Array.isArray(item.children)) {
      item.children.forEach((child) => {
        if (typeof child === "object" && child !== null) {
          processItem(child as { id?: string; component: string; props: Record<string, unknown>; children?: unknown[] });
        }
      });
    }
  }
  
  styleJSON.layout.forEach(item => processItem(item));
  
  return blankFunctions;
}
