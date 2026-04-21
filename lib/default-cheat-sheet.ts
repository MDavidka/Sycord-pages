export const DEFAULT_AI_BUILDER_CHEATSHEET = `[
  {
    "component": "Button",
    "description": "A clickable button element",
    "variants": ["default", "destructive", "outline", "secondary", "ghost", "link"],
    "sizes": ["default", "sm", "lg", "icon"],
    "props": {
      "variant": "string",
      "size": "string",
      "className": "string",
      "onClick": "function"
    }
  },
  {
    "component": "Card",
    "description": "A container for content",
    "props": {
      "className": "string"
    },
    "subComponents": ["CardHeader", "CardTitle", "CardDescription", "CardContent", "CardFooter"]
  },
  {
    "component": "Input",
    "description": "A text input field",
    "props": {
      "type": "string",
      "placeholder": "string",
      "className": "string",
      "value": "string",
      "onChange": "function"
    }
  }
  // ... 40 other components mapped here
]`;

export const DEFAULT_HANDLING_CONVERTER_CHEATSHEET = `{
  "Button": "import { Button } from '@/components/ui/button';\\n\\nexport default function GenButton(props) { return <Button {...props} />; }",
  "Card": "import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';\\n\\nexport { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };",
  "Input": "import { Input } from '@/components/ui/input';\\n\\nexport default function GenInput(props) { return <Input {...props} />; }"
  // ... 40 other components code mapped here
}`;
