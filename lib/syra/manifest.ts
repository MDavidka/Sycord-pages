import { readFileSync } from "fs"
import path from "path"

function readComponent(filename: string): string {
  try {
    return readFileSync(path.join(process.cwd(), "components/ui", filename), "utf-8")
  } catch {
    return `// Component source not available: ${filename}`
  }
}

// All shadcn/ui components available in this project.
// Keys are the whitelist for the Architect AI cheatsheet.
export const componentManifest: Record<string, string> = {
  // Alert
  Alert:            readComponent("alert.tsx"),
  AlertTitle:       readComponent("alert.tsx"),
  AlertDescription: readComponent("alert.tsx"),

  // AlertDialog
  AlertDialog:            readComponent("alert-dialog.tsx"),
  AlertDialogTrigger:     readComponent("alert-dialog.tsx"),
  AlertDialogContent:     readComponent("alert-dialog.tsx"),
  AlertDialogHeader:      readComponent("alert-dialog.tsx"),
  AlertDialogTitle:       readComponent("alert-dialog.tsx"),
  AlertDialogDescription: readComponent("alert-dialog.tsx"),
  AlertDialogFooter:      readComponent("alert-dialog.tsx"),
  AlertDialogAction:      readComponent("alert-dialog.tsx"),
  AlertDialogCancel:      readComponent("alert-dialog.tsx"),

  // Avatar
  Avatar:         readComponent("avatar.tsx"),
  AvatarImage:    readComponent("avatar.tsx"),
  AvatarFallback: readComponent("avatar.tsx"),

  // Badge
  Badge: readComponent("badge.tsx"),

  // Button
  Button: readComponent("button.tsx"),

  // Card
  Card:            readComponent("card.tsx"),
  CardHeader:      readComponent("card.tsx"),
  CardTitle:       readComponent("card.tsx"),
  CardDescription: readComponent("card.tsx"),
  CardContent:     readComponent("card.tsx"),
  CardFooter:      readComponent("card.tsx"),
  CardAction:      readComponent("card.tsx"),

  // Dialog
  Dialog:            readComponent("dialog.tsx"),
  DialogContent:     readComponent("dialog.tsx"),
  DialogHeader:      readComponent("dialog.tsx"),
  DialogTitle:       readComponent("dialog.tsx"),
  DialogDescription: readComponent("dialog.tsx"),
  DialogFooter:      readComponent("dialog.tsx"),
  DialogTrigger:     readComponent("dialog.tsx"),

  // DropdownMenu
  DropdownMenu:          readComponent("dropdown-menu.tsx"),
  DropdownMenuTrigger:   readComponent("dropdown-menu.tsx"),
  DropdownMenuContent:   readComponent("dropdown-menu.tsx"),
  DropdownMenuItem:      readComponent("dropdown-menu.tsx"),
  DropdownMenuLabel:     readComponent("dropdown-menu.tsx"),
  DropdownMenuSeparator: readComponent("dropdown-menu.tsx"),

  // Input / Label
  Input: readComponent("input.tsx"),
  Label: readComponent("label.tsx"),

  // Progress
  Progress: readComponent("progress.tsx"),

  // Sheet
  Sheet:            readComponent("sheet.tsx"),
  SheetContent:     readComponent("sheet.tsx"),
  SheetHeader:      readComponent("sheet.tsx"),
  SheetTitle:       readComponent("sheet.tsx"),
  SheetDescription: readComponent("sheet.tsx"),
  SheetFooter:      readComponent("sheet.tsx"),
  SheetTrigger:     readComponent("sheet.tsx"),

  // Skeleton
  Skeleton: readComponent("skeleton.tsx"),

  // Switch
  Switch: readComponent("switch.tsx"),

  // Textarea
  Textarea: readComponent("textarea.tsx"),
}

/**
 * Flat list of allowed component names (used as Architect AI cheatsheet
 * and as the Zod enum whitelist). Typed as a non-empty tuple so z.enum()
 * accepts it directly.
 */
export const allowedComponentNames = Object.keys(
  componentManifest,
) as [string, ...string[]]
