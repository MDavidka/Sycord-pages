# AI Generator Architecture (Fixed)

## Overview
The generator uses a **3-phase pipeline** with strict separation of concerns:
1. **Style Generator** (AI) → Semantic JSON
2. **Function Generator** (AI) → TypeScript code
3. **Orchestrator** (Algorithmic, NO AI) → Final TSX file

## Key Principle: Semantic Cheatsheet
The cheatsheet contains **ONLY semantic references**, not code:
- Component name (e.g., "Button")
- Prop schemas (e.g., `variant: "default" | "destructive"`)
- Import paths (e.g., `@/components/ui/button`)
- Descriptions and prop metadata

**NO code examples, NO JSX snippets, NO implementation details**

## Phase 1: Style Generator

### Input
- User prompt (e.g., "Create a hero section with a title and button")
- Cheatsheet (semantic component references)

### AI Task
Generate a **semantic layout JSON** that:
- Uses ONLY components from the cheatsheet
- Assigns unique IDs to interactive elements
- Includes props but NO implementation code
- Is language/framework agnostic

### Output: StyleJSON
```json
{
  "pageId": "hero_001",
  "path": "/",
  "layout": [
    {
      "id": "hero_section",
      "component": "Card",
      "props": { "className": "p-10 text-center" },
      "children": [
        {
          "id": "hero_title",
          "component": "CardTitle",
          "props": { "children": "Welcome" }
        },
        {
          "id": "cta_button",
          "component": "Button",
          "props": { "variant": "default" }
        }
      ]
    }
  ]
}
```

### Blank Functions Extracted
The generator then identifies interactive elements and creates blank function placeholders:
```json
[
  { "id": "handle_cta_button", "targetId": "cta_button", "event": "onClick", "filled": false }
]
```

## Phase 2: Function Generator

### Input
- StyleJSON (from Phase 1)
- Blank function IDs (interactive element handlers)
- Cheatsheet (for reference)

### AI Task
Generate **TypeScript handler code** for each blank function:
- useState hooks for state management
- Handler functions (onClick, onChange, etc.)
- useEffect for side effects
- NO component structure, ONLY logic

### Output: FunctionJSON
```json
{
  "targetPage": "hero_001",
  "logicBlocks": [
    {
      "type": "state",
      "code": "const [submitted, setSubmitted] = useState(false);"
    },
    {
      "targetId": "cta_button",
      "event": "onClick",
      "handler": "const handleCtaButton = () => { setSubmitted(true); };"
    },
    {
      "type": "effect",
      "code": "useEffect(() => { console.log('Page loaded'); }, []);"
    }
  ]
}
```

## Phase 3: Orchestrator (Algorithmic)

### Input
- StyleJSON (semantic layout)
- FunctionJSON (handler implementations)
- Cheatsheet (component metadata)

### Process
**NO AI involved** - purely algorithmic transformation:

1. **Validate JSON Structure**
   - Verify StyleJSON.layout is array
   - Verify FunctionJSON.logicBlocks is array
   - Check all components exist in cheatsheet
   - Collect validation errors (non-fatal)

2. **Collect Used Components**
   - Traverse StyleJSON tree
   - Find all `component` names
   - Look up importPath in cheatsheet

3. **Build Import Statements**
   ```typescript
   import { Button, Card, CardTitle } from "@/components/ui/button"
   import { Card, CardHeader, CardContent } from "@/components/ui/card"
   ```

4. **Render JSX**
   - Convert StyleJSON layout to JSX tree
   - Inject handler functions where targetId matches
   - Handle text children and component children

5. **Assemble Component**
   - Add state blocks
   - Add handler functions
   - Add effect blocks
   - Wrap in export component

### Output: TSX File
```typescript
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function Hero001() {
  const [submitted, setSubmitted] = useState(false);

  const handleCtaButton = () => { setSubmitted(true); };

  useEffect(() => { console.log('Page loaded'); }, []);

  return (
    <div className="min-h-screen">
      <Card className="p-10 text-center">
        <CardTitle>Welcome</CardTitle>
        <Button variant="default" onClick={handleCtaButton} />
      </Card>
    </div>
  );
}
```

## Error Handling

### Validation Errors (Non-Fatal)
The orchestrator collects errors but continues if it can generate valid output:
- Missing component in cheatsheet
- Invalid prop values
- Malformed JSON structures

These errors are **collected and reported** in the debug panel without crashing.

### Critical Errors (Fatal)
Generation stops if:
- StyleJSON is invalid (not an array)
- FunctionJSON is invalid (not an array)
- Cannot generate any valid output TSX

### Debug Panel Display
Shows validation errors for each phase:
- **Style Tab**: Any schema validation errors
- **Functions Tab**: Any logic compilation errors
- **Output Tab**: Any orchestration/merge errors

Errors appear as collapsible red boxes with the error message in monospace font.

## Data Flow Diagram

```
User Prompt
    ↓
[Style Generator API] → StyleJSON + BlankFunctions
    ↓
[Function Generator API] → FunctionJSON (fills blanks)
    ↓
[Orchestrator API] → Validates, merges, generates TSX
    ↓
[Debug Panel] → Shows errors, JSON, final code
    ↓
Final TSX (ready for build)
```

## Why This Architecture?

✅ **AI-only generates semantic JSON** - Simple, predictable, easy to validate
✅ **Orchestrator is algorithmic** - No AI hallucinations, 100% deterministic
✅ **Error handling is graceful** - Validates without crashing, shows errors clearly
✅ **Cheatsheet is semantic** - Only references, no code duplication
✅ **Each phase is independent** - Can cache, reuse, or replace individual stages
✅ **Debug visibility** - Shows exactly what each stage produced
