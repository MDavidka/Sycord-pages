const importMap: Record<string, string> = {
  Button: `import { Button } from "@/components/ui/button"`,
  Card: `import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"`,
  CardHeader: `import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"`,
  CardTitle: `import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"`,
  CardContent: `import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"`,
  CardFooter: `import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"`,
  Badge: `import { Badge } from "@/components/ui/badge"`,
  Input: `import { Input } from "@/components/ui/input"`,
  Label: `import { Label } from "@/components/ui/label"`,
}

export function buildImports(usedComponents: string[], includeState = true): string {
  const lines = new Set<string>()

  usedComponents.forEach((componentName) => {
    const importLine = importMap[componentName]
    if (importLine) {
      lines.add(importLine)
    }
  })

  if (includeState) {
    lines.add(`import { useState } from "react"`)
  }

  return [...lines].join("\n")
}
