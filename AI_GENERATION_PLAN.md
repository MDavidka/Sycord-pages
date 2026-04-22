# Sycord UI Builder — AI Orchestration Pipeline

> **Project:** AI-powered shadcn/ui website builder  
> **Stack:** Next.js · TypeScript · OpenRouter · shadcn/ui  
> **Status:** Steps 0.5 → 3 defined below. `converter.txt` pending.

---

## Overview

This pipeline turns a natural-language prompt into a working shadcn/ui component tree. The AI generates a strict JSON spec, a regex-based converter validates and transforms it into TypeScript, and the builder renders real code into the codebase.

```
User Prompt
    │
    ▼
[Step 0.5] OpenRouter AI Call
    │  creates → ui-tree JSON  →  saved to codebase
    ▼
[Step 1]  prompt.txt (shadcn cheat sheet)
    │  constrains → AI output format
    ▼
[Step 2]  converter.ts  (regex + validator)
    │  reads JSON → validates → maps imports
    ▼
[Step 3]  code generator
           emits → .tsx files with real shadcn/ui code
```

---

## Step 0.5 — OpenRouter: File Structure & AI Call

### Purpose
Use OpenRouter to call an LLM that reads `prompt.txt` (the shadcn cheat sheet) and generates a valid `ui-tree` JSON file, then saves it to the project codebase.

### File Structure

```
project-root/
├── .ai/
│   ├── prompt.txt              ← shadcn/ui cheat sheet (system prompt)
│   ├── shadcn-cheatsheet.json  ← full component registry + prop definitions
│   └── shadcn-orchestration.json ← orchestration rules, regex, importMap
│
├── builder/
│   ├── openrouter.ts           ← OpenRouter API client
│   ├── generate.ts             ← calls OpenRouter, saves output JSON
│   ├── converter.ts            ← JSON → TypeScript/JSX (Step 2 + 3)
│   └── types.ts                ← UITreeRoot, UINode interfaces
│
├── generated/
│   └── [component-name].json   ← AI-generated ui-tree JSON (auto-saved here)
│
└── src/
    └── components/
        └── generated/
            └── [ComponentName].tsx  ← Final emitted TypeScript component
```

### OpenRouter Call (`builder/openrouter.ts`)

```typescript
// builder/openrouter.ts
import fs from 'fs'
import path from 'path'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!
const MODEL = 'anthropic/claude-3.5-sonnet' // or openai/gpt-4o, etc.

const systemPrompt = fs.readFileSync(
  path.resolve('.ai/prompt.txt'),
  'utf-8'
)

export async function generateComponentJSON(userPrompt: string): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://sycord.app',
      'X-Title': 'Sycord Builder'
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' }
    })
  })

  const data = await response.json()
  return data.choices[0].message.content
}
```

### Auto-Save Generated JSON (`builder/generate.ts`)

```typescript
// builder/generate.ts
import fs from 'fs'
import path from 'path'
import { generateComponentJSON } from './openrouter'

export async function generateAndSave(
  userPrompt: string,
  componentName: string
): Promise<string> {
  const jsonString = await generateComponentJSON(userPrompt)

  // Validate it is parseable before saving
  JSON.parse(jsonString)

  const outputPath = path.resolve(`generated/${componentName}.json`)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, jsonString, 'utf-8')

  console.log(`✅ Saved: ${outputPath}`)
  return outputPath
}
```

---

## Step 1 — `prompt.txt`: The shadcn/ui Cheat Sheet System Prompt

### Purpose
`prompt.txt` is the **system prompt** sent to OpenRouter on every call. It contains the strict shadcn/ui JSON schema rules so the AI always outputs a valid `ui-tree` JSON and nothing else.

### Location
```
.ai/prompt.txt
```

### What `prompt.txt` Must Tell the AI

```
You are a UI component JSON generator for shadcn/ui.

RULES:
1. Always output valid JSON that matches the ui-tree schema below.
2. Never output prose, markdown, or explanation — only JSON.
3. All component names must be PascalCase and exist in the registry below.
4. Use $state.foo for state bindings and $handler.bar for callbacks.
5. Respect allowed parent-child composition rules strictly.

--- ui-tree SCHEMA ---
{
  "type": "ui-tree",
  "version": "1.0",
  "importsMode": "auto",
  "component": {
    "name": "<ComponentName>",
    "props": { ... },
    "children": [ ... ],
    "text": "<optional leaf text>"
  }
}

--- COMPONENT REGISTRY ---
[Paste the full shadcn-cheatsheet.json components block here]

--- COMPOSITION RULES ---
- DialogContent must be a child of Dialog
- TabsTrigger and TabsContent must share matching value strings
- SelectItem must be inside SelectContent
- AccordionItem must be inside Accordion
- CardHeader, CardContent, CardFooter must be inside Card

--- PROP ENUM RULES ---
Button.variant: default | outline | ghost | destructive | secondary | link
Button.size: default | xs | sm | lg | icon
Card.size: default | sm
Accordion.type: single | multiple
SheetContent.side: top | right | bottom | left
Tabs.orientation: horizontal | vertical
```

### How It Drives Step 2
Because `prompt.txt` strictly enforces PascalCase names, enum prop values, and `$state`/`$handler` prefixes, the converter in Step 2 can rely on regex to detect and transform these reliably without defensive guessing.

---

## Step 2 — Converter: Regex-Based JSON → TypeScript

### Purpose
`converter.ts` reads the saved `generated/*.json` file, validates it using regex rules and composition checks, collects all imports, and transforms the tree into a TypeScript component string.

> **Note:** The full converter implementation will be defined in `converter.txt`.  
> This section defines the interface, input/output contract, and regex rules the converter must implement.

### Input
A `ui-tree` JSON file from `generated/`.

### Output
A `.tsx` file written to `src/components/generated/`.

### Regex Rules the Converter Must Apply

| Check | Pattern | Purpose |
|-------|---------|---------|
| Valid component name | `^[A-Z][A-Za-z0-9]+$` | Reject unknown or lowercase names |
| Alias detection | `^[a-z][a-z0-9-]*$` | Normalize `dialog` → `Dialog` |
| State binding | `^\$state\.[A-Za-z_][A-Za-z0-9_]*$` | Convert `$state.open` → React `useState` |
| Handler binding | `^\$handler\.[A-Za-z_][A-Za-z0-9_]*$` | Convert `$handler.onSubmit` → function ref |
| Enum prop guard | `^(default\|outline\|ghost\|destructive\|secondary\|link\|xs\|sm\|lg\|icon)$` | Fast reject invalid variant values |
| Import path safety | `^@\/components\/ui\/[a-z0-9-]+$` | Validate generated import paths |

### Converter Interface (to be implemented in `converter.txt`)

```typescript
// builder/converter.ts

import type { UITreeRoot, UINode } from './types'

export interface ConversionResult {
  imports: string      // grouped import statements
  component: string    // full TSX component string
  filePath: string     // absolute path where file is written
}

export function convertJSONToTypeScript(
  jsonPath: string,
  componentName: string
): ConversionResult

// Internal functions the converter must implement:
// validateRoot(tree: UITreeRoot): void
// normalizeNames(node: UINode): UINode
// validateComposition(node: UINode): void
// validateProps(node: UINode): void
// collectImports(node: UINode): Map<string, Set<string>>
// renderNode(node: UINode, depth?: number): string
// resolveStateBindings(props: Record<string, unknown>): string
```

### What the Converter Produces

**Input JSON:**
```json
{
  "type": "ui-tree",
  "version": "1.0",
  "component": {
    "name": "Button",
    "props": { "variant": "outline", "onClick": "$handler.handleClick" },
    "text": "Click me"
  }
}
```

**Output TSX:**
```tsx
import { Button } from '@/components/ui/button'

interface Props {
  handleClick: () => void
}

export function GeneratedComponent({ handleClick }: Props) {
  return (
    <Button variant="outline" onClick={handleClick}>
      Click me
    </Button>
  )
}
```

---

## Step 3 — Builder: Converting JSON to Real Code in the Codebase

### Purpose
Step 3 is the execution step. After the converter produces the `.tsx` string, the builder writes it to disk and optionally re-exports it via an index file.

### Flow

```typescript
// Usage in your builder pipeline
import { generateAndSave } from './builder/generate'
import { convertJSONToTypeScript } from './builder/converter'

async function buildComponent(prompt: string, name: string) {
  // Step 0.5 + 1: AI generates JSON using prompt.txt, saves to codebase
  const jsonPath = await generateAndSave(prompt, name)

  // Step 2: Regex converter validates + maps JSON
  // Step 3: Emits real .tsx file
  const result = convertJSONToTypeScript(jsonPath, name)

  console.log(`✅ Component written: ${result.filePath}`)
  console.log(`📦 Imports:\n${result.imports}`)
}

buildComponent(
  'Create a login card with email input, password input, and a submit button',
  'LoginCard'
)
```

### Output Written to Codebase

```
src/
└── components/
    └── generated/
        ├── LoginCard.tsx      ← Step 3 output
        ├── ProfileDialog.tsx
        └── index.ts           ← auto-updated barrel export
```

### Auto-Updated Barrel (`src/components/generated/index.ts`)

```typescript
export { LoginCard } from './LoginCard'
export { ProfileDialog } from './ProfileDialog'
// new exports appended automatically by builder
```

---

## TypeScript Types (`builder/types.ts`)

```typescript
export interface UITreeRoot {
  type: 'ui-tree'
  version: string
  importsMode?: 'auto' | 'manual'
  component: UINode
}

export interface UINode {
  id?: string
  name: string
  props?: Record<string, unknown>
  text?: string
  condition?: string
  slot?: string
  repeat?: {
    source: string
    item: string
    key?: string
  }
  children?: UINode[]
}
```

### Importing JSON into TypeScript

**`tsconfig.json` (required settings):**
```json
{
  "compilerOptions": {
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "moduleResolution": "bundler",
    "strict": true
  }
}
```

**Using the JSON at runtime:**
```typescript
import spec from '../generated/LoginCard.json'
import type { UITreeRoot } from './types'

const tree = spec as UITreeRoot
```

**Or with runtime validation via Zod:**
```typescript
import { z } from 'zod'

const UINodeSchema: z.ZodType<UINode> = z.lazy(() =>
  z.object({
    name: z.string().regex(/^[A-Z][A-Za-z0-9]+$/),
    props: z.record(z.unknown()).optional(),
    text: z.string().optional(),
    children: z.array(UINodeSchema).optional()
  })
)

const tree = UINodeSchema.parse(spec)
```

---

## Environment Variables

```env
# .env.local
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
```

---

## Next Steps

| Step | File | Status |
|------|------|--------|
| 0.5 | `builder/openrouter.ts` + `builder/generate.ts` | ✅ Defined |
| 1 | `.ai/prompt.txt` | ✅ Defined |
| 2 | `builder/converter.ts` | ⏳ Pending `converter.txt` |
| 3 | Builder pipeline + barrel export | ⏳ Depends on Step 2 |

> **Up next:** Define `converter.txt` — the full regex validation and JSX rendering logic.
