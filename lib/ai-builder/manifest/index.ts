import { readFileSync } from "node:fs"
import { join } from "node:path"

function safeRead(relativePath: string): string {
  try {
    return readFileSync(join(process.cwd(), relativePath), "utf-8")
  } catch {
    return ""
  }
}

const CARD_SOURCE = safeRead("components/ui/card.tsx")

export const componentManifest: Record<string, string> = {
  Button: safeRead("components/ui/button.tsx"),
  Card: CARD_SOURCE,
  CardHeader: CARD_SOURCE,
  CardTitle: CARD_SOURCE,
  CardContent: CARD_SOURCE,
  CardFooter: CARD_SOURCE,
  Badge: safeRead("components/ui/badge.tsx"),
  Input: safeRead("components/ui/input.tsx"),
  Label: safeRead("components/ui/label.tsx"),
}
