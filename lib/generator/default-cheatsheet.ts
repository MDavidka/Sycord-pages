import type { CheatSheet } from "./types";

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
      examples: [
        { name: "Primary", code: '<Button variant="default">Click me</Button>' },
        { name: "Destructive", code: '<Button variant="destructive" size="lg">Delete</Button>' }
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
      examples: [
        { name: "Basic", code: '<Card className="p-6"><CardContent>Content here</CardContent></Card>' }
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
      examples: [],
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
      examples: [
        { name: "Basic", code: "<CardTitle>Welcome</CardTitle>" }
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
      examples: [],
      children: "text"
    },
    {
      name: "CardContent",
      importPath: "@/components/ui/card",
      description: "Main content area of a Card",
      props: [
        { name: "className", type: "string", required: false, description: "Additional CSS classes" }
      ],
      examples: [],
      children: "components"
    },
    {
      name: "CardFooter",
      importPath: "@/components/ui/card",
      description: "Footer section of a Card",
      props: [
        { name: "className", type: "string", required: false, description: "Additional CSS classes" }
      ],
      examples: [],
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
      examples: [
        { name: "Basic", code: '<Input placeholder="Enter text..." />' },
        { name: "Email", code: '<Input type="email" placeholder="email@example.com" />' }
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
      examples: [
        { name: "Basic", code: '<Label htmlFor="email">Email</Label>' }
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
      examples: [
        { name: "Basic", code: '<Textarea placeholder="Enter message..." rows={4} />' }
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
      examples: [
        { name: "Default", code: "<Badge>New</Badge>" },
        { name: "Destructive", code: '<Badge variant="destructive">Error</Badge>' }
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
      examples: [
        { name: "Basic", code: '<Avatar><AvatarImage src="/avatar.png" /><AvatarFallback>JD</AvatarFallback></Avatar>' }
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
      examples: [],
      children: "none"
    },
    {
      name: "AvatarFallback",
      importPath: "@/components/ui/avatar",
      description: "Fallback content when Avatar image fails",
      props: [
        { name: "className", type: "string", required: false, description: "Additional CSS classes" }
      ],
      examples: [],
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
      examples: [
        { name: "Horizontal", code: "<Separator />" },
        { name: "Vertical", code: '<Separator orientation="vertical" className="h-6" />' }
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
      examples: [
        { name: "Basic", code: '<Tabs defaultValue="tab1"><TabsList><TabsTrigger value="tab1">Tab 1</TabsTrigger></TabsList><TabsContent value="tab1">Content</TabsContent></Tabs>' }
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
      examples: [],
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
      examples: [],
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
      examples: [],
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
      examples: [
        { name: "Basic", code: "<Switch />" },
        { name: "Controlled", code: '<Switch checked={enabled} onCheckedChange={setEnabled} />' }
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
      examples: [
        { name: "Basic", code: '<Checkbox id="terms" />' }
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
      examples: [
        { name: "Basic", code: "<Progress value={60} />" }
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
      examples: [
        { name: "Text", code: '<Skeleton className="h-4 w-[200px]" />' },
        { name: "Circle", code: '<Skeleton className="h-12 w-12 rounded-full" />' }
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
      examples: [
        { name: "Basic", code: '<ScrollArea className="h-[200px]">Long content here</ScrollArea>' }
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
      examples: [
        { name: "Default", code: "<Alert><AlertTitle>Note</AlertTitle><AlertDescription>Message here</AlertDescription></Alert>" }
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
      examples: [],
      children: "text"
    },
    {
      name: "AlertDescription",
      importPath: "@/components/ui/alert",
      description: "Alert description text",
      props: [
        { name: "className", type: "string", required: false, description: "Additional CSS classes" }
      ],
      examples: [],
      children: "text"
    }
  ]
};
