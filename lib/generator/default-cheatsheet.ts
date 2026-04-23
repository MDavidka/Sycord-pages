import type { CheatSheet } from "./types";

/**
 * Semantic component reference for AI generator
 * Contains only component names, prop schemas, and import paths
 * NO code examples - transformer loads actual component files from disk
 */
export const defaultCheatSheet: CheatSheet = {
  version: "1.0.0",
  updatedAt: new Date().toISOString(),
  components: [
    {
      name: "Button",
      importPath: "@/components/ui/button",
      description: "Interactive button with multiple variants",
      props: [
        { name: "variant", type: '"default" | "destructive" | "outline" | "secondary" | "ghost" | "link"', required: false, default: "default", description: "Visual style variant" },
        { name: "size", type: '"default" | "sm" | "lg" | "icon"', required: false, default: "default", description: "Button size" },
        { name: "disabled", type: "boolean", required: false, default: "false", description: "Disable interactions" },
        { name: "className", type: "string", required: false, description: "Additional CSS classes" },
        { name: "onClick", type: "() => void", required: false, description: "Click handler function" }
      ],
      children: "text"
    },
    {
      name: "Card",
      importPath: "@/components/ui/card",
      description: "Container card with optional header, content, and footer",
      props: [
        { name: "className", type: "string", required: false, description: "Additional CSS classes" }
      ],
      children: "components"
    },
    {
      name: "CardHeader",
      importPath: "@/components/ui/card",
      description: "Header section of a Card",
      props: [
        { name: "className", type: "string", required: false, description: "Additional CSS classes" }
      ],
      children: "components"
    },
    {
      name: "CardTitle",
      importPath: "@/components/ui/card",
      description: "Title text inside CardHeader",
      props: [
        { name: "className", type: "string", required: false, description: "Additional CSS classes" },
        { name: "children", type: "string", required: true, description: "Title text content" }
      ],
      children: "text"
    },
    {
      name: "CardDescription",
      importPath: "@/components/ui/card",
      description: "Description text inside CardHeader",
      props: [
        { name: "className", type: "string", required: false, description: "Additional CSS classes" },
        { name: "children", type: "string", required: true, description: "Description text" }
      ],
      children: "text"
    },
    {
      name: "CardContent",
      importPath: "@/components/ui/card",
      description: "Main content area of a Card",
      props: [
        { name: "className", type: "string", required: false, description: "Additional CSS classes" }
      ],
      children: "components"
    },
    {
      name: "CardFooter",
      importPath: "@/components/ui/card",
      description: "Footer section of a Card",
      props: [
        { name: "className", type: "string", required: false, description: "Additional CSS classes" }
      ],
      children: "components"
    },
    {
      name: "Input",
      importPath: "@/components/ui/input",
      description: "Text input field",
      props: [
        { name: "type", type: "string", required: false, default: "text", description: "Input type (text, email, password, etc.)" },
        { name: "placeholder", type: "string", required: false, description: "Placeholder text" },
        { name: "value", type: "string", required: false, description: "Controlled value" },
        { name: "onChange", type: "(e: ChangeEvent) => void", required: false, description: "Change handler" },
        { name: "disabled", type: "boolean", required: false, description: "Disable input" },
        { name: "className", type: "string", required: false, description: "Additional CSS classes" }
      ],
      children: "none"
    },
    {
      name: "Label",
      importPath: "@/components/ui/label",
      description: "Form label associated with inputs",
      props: [
        { name: "htmlFor", type: "string", required: false, description: "ID of associated input" },
        { name: "className", type: "string", required: false, description: "Additional CSS classes" }
      ],
      children: "text"
    },
    {
      name: "Textarea",
      importPath: "@/components/ui/textarea",
      description: "Multi-line text input",
      props: [
        { name: "placeholder", type: "string", required: false, description: "Placeholder text" },
        { name: "value", type: "string", required: false, description: "Controlled value" },
        { name: "onChange", type: "(e: ChangeEvent) => void", required: false, description: "Change handler" },
        { name: "rows", type: "number", required: false, description: "Number of visible rows" },
        { name: "className", type: "string", required: false, description: "Additional CSS classes" }
      ],
      children: "none"
    },
    {
      name: "Badge",
      importPath: "@/components/ui/badge",
      description: "Small status indicator or label",
      props: [
        { name: "variant", type: '"default" | "secondary" | "destructive" | "outline"', required: false, default: "default", description: "Visual variant" },
        { name: "className", type: "string", required: false, description: "Additional CSS classes" }
      ],
      children: "text"
    },
    {
      name: "Avatar",
      importPath: "@/components/ui/avatar",
      description: "User avatar with image or fallback",
      props: [
        { name: "className", type: "string", required: false, description: "Additional CSS classes" }
      ],
      children: "components"
    },
    {
      name: "AvatarImage",
      importPath: "@/components/ui/avatar",
      description: "Image inside Avatar",
      props: [
        { name: "src", type: "string", required: true, description: "Image source URL" },
        { name: "alt", type: "string", required: false, description: "Alt text" }
      ],
      children: "none"
    },
    {
      name: "AvatarFallback",
      importPath: "@/components/ui/avatar",
      description: "Fallback content when Avatar image fails",
      props: [
        { name: "className", type: "string", required: false, description: "Additional CSS classes" }
      ],
      children: "text"
    },
    {
      name: "Separator",
      importPath: "@/components/ui/separator",
      description: "Visual divider line",
      props: [
        { name: "orientation", type: '"horizontal" | "vertical"', required: false, default: "horizontal", description: "Line orientation" },
        { name: "className", type: "string", required: false, description: "Additional CSS classes" }
      ],
      children: "none"
    },
    {
      name: "Tabs",
      importPath: "@/components/ui/tabs",
      description: "Tabbed content container",
      props: [
        { name: "defaultValue", type: "string", required: true, description: "Default active tab value" },
        { name: "className", type: "string", required: false, description: "Additional CSS classes" }
      ],
      children: "components"
    },
    {
      name: "TabsList",
      importPath: "@/components/ui/tabs",
      description: "Container for tab triggers",
      props: [
        { name: "className", type: "string", required: false, description: "Additional CSS classes" }
      ],
      children: "components"
    },
    {
      name: "TabsTrigger",
      importPath: "@/components/ui/tabs",
      description: "Clickable tab button",
      props: [
        { name: "value", type: "string", required: true, description: "Tab identifier value" },
        { name: "className", type: "string", required: false, description: "Additional CSS classes" }
      ],
      children: "text"
    },
    {
      name: "TabsContent",
      importPath: "@/components/ui/tabs",
      description: "Content panel for a tab",
      props: [
        { name: "value", type: "string", required: true, description: "Tab identifier value" },
        { name: "className", type: "string", required: false, description: "Additional CSS classes" }
      ],
      children: "components"
    },
    {
      name: "Switch",
      importPath: "@/components/ui/switch",
      description: "Toggle switch control",
      props: [
        { name: "checked", type: "boolean", required: false, description: "Controlled checked state" },
        { name: "onCheckedChange", type: "(checked: boolean) => void", required: false, description: "Change handler" },
        { name: "disabled", type: "boolean", required: false, description: "Disable switch" },
        { name: "className", type: "string", required: false, description: "Additional CSS classes" }
      ],
      children: "none"
    },
    {
      name: "Checkbox",
      importPath: "@/components/ui/checkbox",
      description: "Checkbox input control",
      props: [
        { name: "checked", type: "boolean", required: false, description: "Controlled checked state" },
        { name: "onCheckedChange", type: "(checked: boolean) => void", required: false, description: "Change handler" },
        { name: "disabled", type: "boolean", required: false, description: "Disable checkbox" },
        { name: "id", type: "string", required: false, description: "Element ID for label association" }
      ],
      children: "none"
    },
    {
      name: "Progress",
      importPath: "@/components/ui/progress",
      description: "Progress bar indicator",
      props: [
        { name: "value", type: "number", required: false, default: "0", description: "Progress value (0-100)" },
        { name: "className", type: "string", required: false, description: "Additional CSS classes" }
      ],
      children: "none"
    },
    {
      name: "Skeleton",
      importPath: "@/components/ui/skeleton",
      description: "Loading placeholder skeleton",
      props: [
        { name: "className", type: "string", required: false, description: "Size and shape classes" }
      ],
      children: "none"
    },
    {
      name: "ScrollArea",
      importPath: "@/components/ui/scroll-area",
      description: "Custom scrollable area with styled scrollbar",
      props: [
        { name: "className", type: "string", required: false, description: "Additional CSS classes" }
      ],
      children: "components"
    },
    {
      name: "Alert",
      importPath: "@/components/ui/alert",
      description: "Alert message container",
      props: [
        { name: "variant", type: '"default" | "destructive"', required: false, default: "default", description: "Alert variant" },
        { name: "className", type: "string", required: false, description: "Additional CSS classes" }
      ],
      children: "components"
    },
    {
      name: "AlertTitle",
      importPath: "@/components/ui/alert",
      description: "Alert title text",
      props: [
        { name: "className", type: "string", required: false, description: "Additional CSS classes" }
      ],
      children: "text"
    },
    {
      name: "AlertDescription",
      importPath: "@/components/ui/alert",
      description: "Alert description text",
      props: [
        { name: "className", type: "string", required: false, description: "Additional CSS classes" }
      ],
      children: "text"
    }
  ]
};
