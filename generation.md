# Generation Logic — shadcn/ui Builder

## How It Works

```
JSON in  →  normalize  →  collect  →  render  →  .tsx out
```

Three phases: **collect** all state + handler names, **resolve** every prop value, **render** the JSX tree bottom-up.

---

## Phase 1 — Prop Value Resolution

For every prop value, match in this order and stop at first hit:

| Priority | Pattern | Input example | Emitted JSX |
|----------|---------|--------------|-------------|
| 1 | `$state.x` | `"$state.open"` | `open={open}` |
| 2 | `$handler.x` | `"$handler.onSubmit"` | `onSubmit={onSubmit}` |
| 3 | `"true"` | `"true"` | `asChild` (shorthand) |
| 4 | `"false"` | `"false"` | *(omit prop)* |
| 5 | numeric string | `"700"` | `delayDuration={700}` |
| 6 | anything else | `"outline"` | `variant="outline"` |

---

## Phase 2 — State + Handler Collection

Walk the full tree **before** rendering. Collect every unique `$state.*` and `$handler.*` value.

**State → `useState` declaration:**
```ts
$state.open    →  const [open, setOpen] = useState(false)
$state.value   →  const [value, setValue] = useState('')
$state.count   →  const [count, setCount] = useState(0)
// default fallback:
$state.data    →  const [data, setData] = useState(undefined)
```

Initial value rules: key contains `open/show/visible` → `false`, contains `value/query/text` → `''`, contains `count/index/step` → `0`, else → `undefined`.

**Handler → Props interface entry:**
```ts
$handler.onSubmit  →  onSubmit: () => void
$handler.setOpen   →  setOpen: (value: boolean) => void
```

---

## Phase 3 — Node Rendering

```
renderNode(node, depth):
  if no children AND no text  →  <Name {props} />
  if text AND no children     →  <Name {props}>text</Name>
  if children                 →  <Name {props}>
                                   renderNode(child, depth+1) ...
                                 </Name>
```

Indent = 2 spaces × depth.

---

## Output Order (always this sequence)

```
'use client'

import React from 'react'                     ← only if useState used
import { A, B } from '@/components/ui/x'      ← grouped, sorted A-Z by path

interface Props { ... }                        ← only if $handler.* found

export function ComponentName({ ...handlers }: Props) {
  const [x, setX] = useState(...)             ← one per $state.*

  return (
    <RootNode>
      ...
    </RootNode>
  )
}
```

---

## Worked Example

**Input JSON:**
```json
{
  "type": "ui-tree",
  "component": {
    "name": "Card",
    "children": [
      {
        "name": "CardHeader",
        "children": [
          { "name": "CardTitle", "text": "Login" }
        ]
      },
      {
        "name": "CardContent",
        "children": [
          { "name": "Input", "props": { "placeholder": "Email", "value": "$state.email", "onChange": "$handler.setEmail" } },
          { "name": "Button", "props": { "variant": "default" }, "text": "Submit" }
        ]
      }
    ]
  }
}
```

**Output TSX:**
```tsx
'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

interface Props {
  setEmail: (value: string) => void
}

export function GeneratedComponent({ setEmail }: Props) {
  const [email, setEmailState] = React.useState('')

  return (
    <Card>
      <CardHeader>
        <CardTitle>Login</CardTitle>
      </CardHeader>
      <CardContent>
        <Input placeholder="Email" value={email} onChange={setEmail} />
        <Button variant="default">Submit</Button>
      </CardContent>
    </Card>
  )
}
```

---

## Error Codes

| Code | When |
|------|------|
| `UNKNOWN_COMPONENT` | Name not in import map |
| `INVALID_PROP_VALUE` | Enum value not allowed for that prop |
| `MISSING_REQUIRED_CHILD` | Compound component missing required sub-component |
| `INVALID_STATE_REF` | `$state.` with empty/invalid identifier |
| `JSON_PARSE_ERROR` | Input is not valid JSON |
