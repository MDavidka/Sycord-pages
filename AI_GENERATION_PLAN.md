{
  "$schema": "https://ui.shadcn.com",
  "version": "2.x (Tailwind v4)",
  "description": "shadcn/ui component JSON reference for AI builders. Each entry includes: type, props, variants, sub-components, and usage examples.",
  "typeSystem": {
    "compound": "Requires multiple sub-components composed together",
    "atomic": "Standalone, self-contained component",
    "wrapper": "Wraps other content to apply behavior/style",
    "provider": "App-level context — add once in root layout"
  },
  "globalNotes": {
    "installation": "npx shadcn@latest add <component-name>",
    "tailwindVersion": "Requires Tailwind CSS v4",
    "theming": "Configure via components.json and globals.css CSS variables (--primary, --background, --radius, etc.)",
    "darkMode": "Class-based. Set darkMode: 'class' in Tailwind config, managed via next-themes or manual toggle.",
    "asChild": "Most trigger/wrapper components accept asChild={true} to delegate rendering to a child (e.g. <Link> from Next.js)",
    "accessibility": "All components are built on Radix UI primitives — keyboard nav, ARIA, and focus management included."
  },
  "components": {
    "Accordion": {
      "type": "compound",
      "subComponents": ["AccordionItem", "AccordionTrigger", "AccordionContent"],
      "props": {
        "type": { "type": "enum", "values": ["single", "multiple"], "default": "single" },
        "collapsible": { "type": "boolean", "default": false, "note": "Only for type='single'" },
        "defaultValue": { "type": "string | string[]" },
        "value": { "type": "string | string[]" },
        "onValueChange": { "type": "function" }
      },
      "subProps": {
        "AccordionItem": { "value": "string (required)" }
      },
      "example": "<Accordion type='single' collapsible><AccordionItem value='item-1'><AccordionTrigger>Title</AccordionTrigger><AccordionContent>Content</AccordionContent></AccordionItem></Accordion>"
    },
    "Alert": {
      "type": "compound",
      "subComponents": ["AlertTitle", "AlertDescription"],
      "props": {
        "variant": { "type": "enum", "values": ["default", "destructive"], "default": "default" }
      },
      "example": "<Alert variant='destructive'><AlertTitle>Error</AlertTitle><AlertDescription>Something went wrong.</AlertDescription></Alert>"
    },
    "AlertDialog": {
      "type": "compound",
      "subComponents": ["AlertDialogTrigger", "AlertDialogContent", "AlertDialogHeader", "AlertDialogFooter", "AlertDialogTitle", "AlertDialogDescription", "AlertDialogAction", "AlertDialogCancel"],
      "props": {
        "open": { "type": "boolean" },
        "onOpenChange": { "type": "function" }
      },
      "note": "Use for destructive confirmations (delete, irreversible actions)"
    },
    "AspectRatio": {
      "type": "wrapper",
      "props": {
        "ratio": { "type": "number", "default": 1, "note": "e.g. 16/9, 4/3, 1" }
      },
      "example": "<AspectRatio ratio={16/9}><img src='...' alt='...' className='object-cover w-full h-full' /></AspectRatio>"
    },
    "Avatar": {
      "type": "compound",
      "subComponents": ["AvatarImage", "AvatarFallback"],
      "subProps": {
        "AvatarImage": { "src": "string", "alt": "string" },
        "AvatarFallback": { "note": "Rendered when image fails to load" }
      },
      "example": "<Avatar><AvatarImage src='/avatar.png' alt='User' /><AvatarFallback>JD</AvatarFallback></Avatar>"
    },
    "Badge": {
      "type": "atomic",
      "props": {
        "variant": { "type": "enum", "values": ["default", "secondary", "destructive", "outline"], "default": "default" }
      },
      "example": "<Badge variant='secondary'>Beta</Badge>"
    },
    "Breadcrumb": {
      "type": "compound",
      "subComponents": ["BreadcrumbList", "BreadcrumbItem", "BreadcrumbLink", "BreadcrumbPage", "BreadcrumbSeparator", "BreadcrumbEllipsis"],
      "example": "<Breadcrumb><BreadcrumbList><BreadcrumbItem><BreadcrumbLink href='/'>Home</BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage>Current</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb>"
    },
    "Button": {
      "type": "atomic",
      "props": {
        "variant": { "type": "enum", "values": ["default", "outline", "ghost", "destructive", "secondary", "link"], "default": "default" },
        "size": { "type": "enum", "values": ["default", "xs", "sm", "lg", "icon", "icon-xs", "icon-sm", "icon-lg"], "default": "default" },
        "asChild": { "type": "boolean", "default": false },
        "disabled": { "type": "boolean" }
      },
      "notes": [
        "Add data-icon='inline-start' or 'inline-end' on icons inside buttons for correct spacing",
        "Add className='rounded-full' for pill shape",
        "Use asChild with <Link> for router navigation"
      ],
      "example": "<Button variant='outline' size='sm'>Click me</Button>"
    },
    "Calendar": {
      "type": "atomic",
      "props": {
        "mode": { "type": "enum", "values": ["single", "multiple", "range"], "default": "single" },
        "selected": { "type": "Date | Date[] | DateRange" },
        "onSelect": { "type": "function" },
        "disabled": { "type": "Date | function" },
        "defaultMonth": { "type": "Date" },
        "numberOfMonths": { "type": "number" }
      },
      "note": "Built on react-day-picker. Combine with <Popover> for a date picker."
    },
    "Card": {
      "type": "compound",
      "subComponents": ["CardHeader", "CardTitle", "CardDescription", "CardAction", "CardContent", "CardFooter"],
      "props": {
        "size": { "type": "enum", "values": ["default", "sm"], "default": "default" }
      },
      "subProps": {
        "CardAction": "Placed top-right of CardHeader — use for buttons, badges, menus"
      },
      "example": "<Card><CardHeader><CardTitle>Title</CardTitle><CardDescription>Desc</CardDescription><CardAction><Button>X</Button></CardAction></CardHeader><CardContent>Body</CardContent><CardFooter>Footer</CardFooter></Card>"
    },
    "Carousel": {
      "type": "compound",
      "subComponents": ["CarouselContent", "CarouselItem", "CarouselPrevious", "CarouselNext"],
      "props": {
        "opts": { "type": "EmblaOptionsType", "note": "Embla carousel options object" },
        "orientation": { "type": "enum", "values": ["horizontal", "vertical"], "default": "horizontal" },
        "plugins": { "type": "EmblaPluginType[]" }
      },
      "note": "Built on embla-carousel-react"
    },
    "Checkbox": {
      "type": "atomic",
      "props": {
        "checked": { "type": "boolean | 'indeterminate'" },
        "defaultChecked": { "type": "boolean" },
        "onCheckedChange": { "type": "function" },
        "disabled": { "type": "boolean" },
        "id": { "type": "string", "note": "Use with <Label htmlFor>" }
      }
    },
    "Collapsible": {
      "type": "compound",
      "subComponents": ["CollapsibleTrigger", "CollapsibleContent"],
      "props": {
        "open": { "type": "boolean" },
        "defaultOpen": { "type": "boolean" },
        "onOpenChange": { "type": "function" },
        "disabled": { "type": "boolean" }
      }
    },
    "Command": {
      "type": "compound",
      "subComponents": ["CommandInput", "CommandList", "CommandEmpty", "CommandGroup", "CommandItem", "CommandSeparator", "CommandShortcut"],
      "props": {
        "value": { "type": "string" },
        "onValueChange": { "type": "function" },
        "filter": { "type": "function", "signature": "(value: string, search: string) => number" },
        "shouldFilter": { "type": "boolean", "default": true }
      },
      "note": "Built on cmdk. Combine with <Dialog> for a command palette, or <Popover> for a combobox."
    },
    "ContextMenu": {
      "type": "compound",
      "subComponents": ["ContextMenuTrigger", "ContextMenuContent", "ContextMenuItem", "ContextMenuCheckboxItem", "ContextMenuRadioItem", "ContextMenuLabel", "ContextMenuSeparator", "ContextMenuShortcut", "ContextMenuGroup", "ContextMenuSub", "ContextMenuSubTrigger", "ContextMenuSubContent", "ContextMenuRadioGroup"],
      "note": "Shown on right-click. Wrap any element in <ContextMenuTrigger>."
    },
    "Dialog": {
      "type": "compound",
      "subComponents": ["DialogTrigger", "DialogContent", "DialogHeader", "DialogFooter", "DialogTitle", "DialogDescription", "DialogClose"],
      "props": {
        "open": { "type": "boolean" },
        "onOpenChange": { "type": "function" },
        "defaultOpen": { "type": "boolean" }
      },
      "subProps": {
        "DialogContent": {
          "onInteractOutside": "function",
          "onEscapeKeyDown": "function"
        }
      },
      "example": "<Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button>Open</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Title</DialogTitle><DialogDescription>Description</DialogDescription></DialogHeader>Body<DialogFooter><Button>Save</Button></DialogFooter></DialogContent></Dialog>"
    },
    "Drawer": {
      "type": "compound",
      "subComponents": ["DrawerTrigger", "DrawerContent", "DrawerHeader", "DrawerFooter", "DrawerTitle", "DrawerDescription", "DrawerClose"],
      "props": {
        "open": { "type": "boolean" },
        "onOpenChange": { "type": "function" },
        "direction": { "type": "enum", "values": ["bottom", "top", "left", "right"], "default": "bottom" }
      },
      "note": "Built on vaul. Use for mobile-first overlays."
    },
    "DropdownMenu": {
      "type": "compound",
      "subComponents": ["DropdownMenuTrigger", "DropdownMenuContent", "DropdownMenuItem", "DropdownMenuCheckboxItem", "DropdownMenuRadioItem", "DropdownMenuLabel", "DropdownMenuSeparator", "DropdownMenuShortcut", "DropdownMenuGroup", "DropdownMenuSub", "DropdownMenuSubTrigger", "DropdownMenuSubContent", "DropdownMenuRadioGroup"],
      "props": {
        "open": { "type": "boolean" },
        "onOpenChange": { "type": "function" },
        "modal": { "type": "boolean", "default": true }
      },
      "subProps": {
        "DropdownMenuContent": {
          "align": { "values": ["start", "center", "end"], "default": "center" },
          "side": { "values": ["top", "right", "bottom", "left"], "default": "bottom" },
          "sideOffset": "number"
        },
        "DropdownMenuItem": {
          "inset": "boolean",
          "variant": { "values": ["default", "destructive"] },
          "onSelect": "function"
        }
      }
    },
    "Form": {
      "type": "compound",
      "subComponents": ["FormField", "FormItem", "FormLabel", "FormControl", "FormDescription", "FormMessage"],
      "note": "Requires react-hook-form + zod",
      "pattern": "const form = useForm({ resolver: zodResolver(schema) }); <Form {...form}><form onSubmit={form.handleSubmit(onSubmit)}><FormField control={form.control} name='field' render={({ field }) => (<FormItem><FormLabel /><FormControl><Input {...field} /></FormControl><FormDescription /><FormMessage /></FormItem>)} /></form></Form>"
    },
    "HoverCard": {
      "type": "compound",
      "subComponents": ["HoverCardTrigger", "HoverCardContent"],
      "props": {
        "open": { "type": "boolean" },
        "openDelay": { "type": "number", "default": 700 },
        "closeDelay": { "type": "number", "default": 300 }
      }
    },
    "Input": {
      "type": "atomic",
      "props": {
        "type": { "type": "string", "values": ["text", "email", "password", "number", "search", "file", "..."] },
        "placeholder": { "type": "string" },
        "disabled": { "type": "boolean" },
        "value": { "type": "string" },
        "onChange": { "type": "function" }
      }
    },
    "InputOTP": {
      "type": "compound",
      "subComponents": ["InputOTPGroup", "InputOTPSlot", "InputOTPSeparator"],
      "props": {
        "maxLength": { "type": "number", "required": true },
        "value": { "type": "string" },
        "onChange": { "type": "function" },
        "pattern": { "type": "string", "note": "e.g. REGEXP_ONLY_DIGITS from 'input-otp'" }
      },
      "note": "Built on input-otp"
    },
    "Label": {
      "type": "atomic",
      "props": {
        "htmlFor": { "type": "string" }
      }
    },
    "Menubar": {
      "type": "compound",
      "subComponents": ["MenubarMenu", "MenubarTrigger", "MenubarContent", "MenubarItem", "MenubarSeparator", "MenubarLabel", "MenubarCheckboxItem", "MenubarRadioGroup", "MenubarRadioItem", "MenubarShortcut", "MenubarGroup", "MenubarSub", "MenubarSubContent", "MenubarSubTrigger"],
      "note": "Desktop-style application menu bar (like File / Edit / View)"
    },
    "NavigationMenu": {
      "type": "compound",
      "subComponents": ["NavigationMenuList", "NavigationMenuItem", "NavigationMenuTrigger", "NavigationMenuContent", "NavigationMenuLink", "NavigationMenuIndicator", "NavigationMenuViewport"],
      "props": {
        "value": { "type": "string" },
        "onValueChange": { "type": "function" },
        "delayDuration": { "type": "number", "default": 200 }
      }
    },
    "Pagination": {
      "type": "compound",
      "subComponents": ["PaginationContent", "PaginationItem", "PaginationLink", "PaginationPrevious", "PaginationNext", "PaginationEllipsis"],
      "subProps": {
        "PaginationLink": {
          "isActive": "boolean",
          "href": "string",
          "size": { "values": ["default", "sm", "lg", "icon"] }
        }
      }
    },
    "Popover": {
      "type": "compound",
      "subComponents": ["PopoverTrigger", "PopoverContent"],
      "props": {
        "open": { "type": "boolean" },
        "onOpenChange": { "type": "function" },
        "defaultOpen": { "type": "boolean" }
      },
      "subProps": {
        "PopoverContent": {
          "align": { "values": ["start", "center", "end"], "default": "center" },
          "side": { "values": ["top", "right", "bottom", "left"] },
          "sideOffset": { "type": "number", "default": 4 }
        }
      }
    },
    "Progress": {
      "type": "atomic",
      "props": {
        "value": { "type": "number", "note": "0–100" },
        "max": { "type": "number", "default": 100 }
      }
    },
    "RadioGroup": {
      "type": "compound",
      "subComponents": ["RadioGroupItem"],
      "props": {
        "value": { "type": "string" },
        "defaultValue": { "type": "string" },
        "onValueChange": { "type": "function" },
        "disabled": { "type": "boolean" },
        "orientation": { "type": "enum", "values": ["horizontal", "vertical"] }
      },
      "subProps": {
        "RadioGroupItem": {
          "value": "string (required)",
          "id": "string",
          "disabled": "boolean"
        }
      }
    },
    "Resizable": {
      "type": "compound",
      "subComponents": ["ResizablePanelGroup", "ResizablePanel", "ResizableHandle"],
      "subProps": {
        "ResizablePanelGroup": {
          "direction": { "values": ["horizontal", "vertical"], "required": true }
        },
        "ResizablePanel": {
          "defaultSize": "number",
          "minSize": "number",
          "maxSize": "number"
        }
      }
    },
    "ScrollArea": {
      "type": "compound",
      "subComponents": ["ScrollBar"],
      "props": {
        "type": { "type": "enum", "values": ["auto", "always", "scroll", "hover"] },
        "scrollHideDelay": { "type": "number" }
      }
    },
    "Select": {
      "type": "compound",
      "subComponents": ["SelectTrigger", "SelectValue", "SelectContent", "SelectItem", "SelectLabel", "SelectSeparator", "SelectGroup", "SelectScrollUpButton", "SelectScrollDownButton"],
      "props": {
        "value": { "type": "string" },
        "defaultValue": { "type": "string" },
        "onValueChange": { "type": "function" },
        "open": { "type": "boolean" },
        "onOpenChange": { "type": "function" },
        "disabled": { "type": "boolean" }
      },
      "subProps": {
        "SelectTrigger": { "size": { "values": ["sm", "default"] } },
        "SelectContent": { "position": { "values": ["popper", "item-aligned"] } },
        "SelectItem": { "value": "string (required)", "disabled": "boolean" }
      },
      "example": "<Select onValueChange={v => setVal(v)}><SelectTrigger><SelectValue placeholder='Choose...' /></SelectTrigger><SelectContent><SelectItem value='a'>Option A</SelectItem></SelectContent></Select>"
    },
    "Separator": {
      "type": "atomic",
      "props": {
        "orientation": { "type": "enum", "values": ["horizontal", "vertical"], "default": "horizontal" },
        "decorative": { "type": "boolean", "default": true }
      }
    },
    "Sheet": {
      "type": "compound",
      "subComponents": ["SheetTrigger", "SheetContent", "SheetHeader", "SheetFooter", "SheetTitle", "SheetDescription", "SheetClose"],
      "props": {
        "open": { "type": "boolean" },
        "onOpenChange": { "type": "function" }
      },
      "subProps": {
        "SheetContent": {
          "side": { "values": ["top", "right", "bottom", "left"], "default": "right" }
        }
      }
    },
    "Sidebar": {
      "type": "compound",
      "subComponents": ["SidebarProvider", "SidebarTrigger", "SidebarContent", "SidebarHeader", "SidebarFooter", "SidebarGroup", "SidebarGroupLabel", "SidebarGroupContent", "SidebarMenu", "SidebarMenuItem", "SidebarMenuButton", "SidebarMenuSub", "SidebarMenuSubButton", "SidebarMenuSubItem", "SidebarRail", "SidebarInset", "SidebarSeparator"],
      "subProps": {
        "SidebarProvider": {
          "defaultOpen": { "type": "boolean", "default": true },
          "open": { "type": "boolean" },
          "onOpenChange": { "type": "function" }
        }
      }
    },
    "Skeleton": {
      "type": "atomic",
      "props": {
        "className": { "type": "string", "note": "Control dimensions via Tailwind: h-4 w-[250px]" }
      },
      "example": "<Skeleton className='h-4 w-[250px]' />"
    },
    "Slider": {
      "type": "atomic",
      "props": {
        "value": { "type": "number[]" },
        "defaultValue": { "type": "number[]" },
        "onValueChange": { "type": "function" },
        "onValueCommit": { "type": "function" },
        "min": { "type": "number", "default": 0 },
        "max": { "type": "number", "default": 100 },
        "step": { "type": "number", "default": 1 },
        "disabled": { "type": "boolean" },
        "orientation": { "type": "enum", "values": ["horizontal", "vertical"] }
      }
    },
    "Sonner": {
      "type": "provider",
      "note": "Add <Toaster /> once in root layout. Import toast() from 'sonner' anywhere to trigger.",
      "props": {
        "position": { "type": "enum", "values": ["top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right"], "default": "bottom-right" },
        "expand": { "type": "boolean" },
        "richColors": { "type": "boolean" },
        "theme": { "type": "enum", "values": ["light", "dark", "system"] }
      },
      "usage": {
        "basic": "toast('Message')",
        "success": "toast.success('Done!')",
        "error": "toast.error('Failed')",
        "loading": "toast.loading('In progress...')",
        "promise": "toast.promise(myPromise, { loading: '...', success: 'Done', error: 'Error' })",
        "dismiss": "toast.dismiss(id)"
      }
    },
    "Switch": {
      "type": "atomic",
      "props": {
        "checked": { "type": "boolean" },
        "defaultChecked": { "type": "boolean" },
        "onCheckedChange": { "type": "function" },
        "disabled": { "type": "boolean" },
        "id": { "type": "string" }
      }
    },
    "Table": {
      "type": "compound",
      "subComponents": ["TableHeader", "TableBody", "TableFooter", "TableRow", "TableHead", "TableCell", "TableCaption"],
      "example": "<Table><TableHeader><TableRow><TableHead>Name</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell>Value</TableCell></TableRow></TableBody></Table>"
    },
    "Tabs": {
      "type": "compound",
      "subComponents": ["TabsList", "TabsTrigger", "TabsContent"],
      "props": {
        "value": { "type": "string" },
        "defaultValue": { "type": "string" },
        "onValueChange": { "type": "function" },
        "orientation": { "type": "enum", "values": ["horizontal", "vertical"], "default": "horizontal" }
      },
      "subProps": {
        "TabsTrigger": { "value": "string (required)", "disabled": "boolean" },
        "TabsContent": { "value": "string (required)" }
      }
    },
    "Textarea": {
      "type": "atomic",
      "props": {
        "placeholder": { "type": "string" },
        "disabled": { "type": "boolean" },
        "rows": { "type": "number" },
        "value": { "type": "string" },
        "onChange": { "type": "function" }
      }
    },
    "Toast": {
      "type": "legacy",
      "note": "DEPRECATED — prefer Sonner. If still needed: wrap app with <Toaster />, call useToast() hook.",
      "usage": "const { toast } = useToast(); toast({ title: 'Title', description: 'Body', variant: 'destructive' })"
    },
    "Toggle": {
      "type": "atomic",
      "props": {
        "variant": { "type": "enum", "values": ["default", "outline"], "default": "default" },
        "size": { "type": "enum", "values": ["default", "sm", "lg"] },
        "pressed": { "type": "boolean" },
        "defaultPressed": { "type": "boolean" },
        "onPressedChange": { "type": "function" },
        "disabled": { "type": "boolean" },
        "asChild": { "type": "boolean" }
      }
    },
    "ToggleGroup": {
      "type": "compound",
      "subComponents": ["ToggleGroupItem"],
      "props": {
        "type": { "type": "enum", "values": ["single", "multiple"], "required": true },
        "value": { "type": "string | string[]" },
        "onValueChange": { "type": "function" },
        "variant": { "type": "enum", "values": ["default", "outline"] },
        "size": { "type": "enum", "values": ["default", "sm", "lg"] }
      }
    },
    "Tooltip": {
      "type": "compound",
      "subComponents": ["TooltipProvider", "TooltipTrigger", "TooltipContent"],
      "props": {
        "open": { "type": "boolean" },
        "onOpenChange": { "type": "function" },
        "defaultOpen": { "type": "boolean" },
        "delayDuration": { "type": "number", "default": 700 }
      },
      "note": "Wrap app or section once in <TooltipProvider>",
      "example": "<TooltipProvider><Tooltip><TooltipTrigger asChild><Button>Hover</Button></TooltipTrigger><TooltipContent>Tooltip text</TooltipContent></Tooltip></TooltipProvider>"
    }
  },
  "commonPatterns": {
    "combobox": "Combine <Popover> + <Command> — Popover controls open state, Command handles search/filter",
    "datePicker": "Combine <Popover> + <Calendar> — Popover is the anchor, Calendar is the content",
    "commandPalette": "Combine <Dialog> + <Command> — Dialog is the modal, Command handles the search UI",
    "dataTable": "Combine <Table> + @tanstack/react-table for sortable/filterable/paginated tables",
    "confirmDialog": "Use <AlertDialog> for destructive confirmations, <Dialog> for complex multi-step confirmations",
    "formField": "<FormField control={form.control} name='x' render={({ field }) => (<FormItem><FormLabel /><FormControl><Input {...field} /></FormControl><FormDescription /><FormMessage /></FormItem>)} />"
  }
}
