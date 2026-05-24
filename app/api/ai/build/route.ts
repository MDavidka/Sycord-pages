import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { callModel, extractJson, extractCode, type ChatMessage } from "@/lib/ai-provider"
import { getSystemPrompts } from "@/lib/ai-prompts"
import { readFileSync, existsSync } from "fs"
import { join } from "path"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

interface PageStructure { name:string; usedFor:string; description:string; route:string; priority:number }
interface BuildHistoryEntry { prompt:string; model:string; timestamp:number; files:string[]; steps:Array<{title:string;content:string}> }
interface EditOp { name:string; action:"rewrite"|"delete"|"move"|"add"; code:string; target?:string }

const SHADCN_DEP_MAP:Record<string,string[]>={
  accordion:["@radix-ui/react-accordion"],"alert-dialog":["@radix-ui/react-alert-dialog"],alert:[],
  "aspect-ratio":["@radix-ui/react-aspect-ratio"],avatar:["@radix-ui/react-avatar"],badge:[],breadcrumb:[],
  button:["@radix-ui/react-slot","class-variance-authority"],calendar:["react-day-picker","date-fns"],card:[],
  carousel:["embla-carousel-react"],chart:["recharts"],checkbox:["@radix-ui/react-checkbox"],
  collapsible:["@radix-ui/react-collapsible"],combobox:["cmdk","@radix-ui/react-popover"],command:["cmdk"],
  "context-menu":["@radix-ui/react-context-menu"],"data-table":[],"date-picker":["react-day-picker","date-fns","@radix-ui/react-popover"],
  dialog:["@radix-ui/react-dialog"],drawer:["vaul"],"dropdown-menu":["@radix-ui/react-dropdown-menu"],
  empty:[],field:[],form:["react-hook-form","@hookform/resolvers","zod"],
  "hover-card":["@radix-ui/react-hover-card"],input:[],"input-group":[],"input-otp":["input-otp"],item:[],kbd:[],
  label:["@radix-ui/react-label"],menubar:["@radix-ui/react-menubar"],
  "navigation-menu":["@radix-ui/react-navigation-menu"],pagination:[],popover:["@radix-ui/react-popover"],
  progress:["@radix-ui/react-progress"],"radio-group":["@radix-ui/react-radio-group"],
  resizable:["react-resizable-panels"],"scroll-area":["@radix-ui/react-scroll-area"],select:["@radix-ui/react-select"],
  separator:["@radix-ui/react-separator"],sheet:["@radix-ui/react-dialog"],sidebar:[],skeleton:[],
  slider:["@radix-ui/react-slider"],sonner:["sonner"],spinner:[],switch:["@radix-ui/react-switch"],table:[],
  tabs:["@radix-ui/react-tabs"],textarea:[],toast:["@radix-ui/react-toast"],toggle:["@radix-ui/react-toggle"],
  "toggle-group":["@radix-ui/react-toggle-group"],tooltip:["@radix-ui/react-tooltip"],typography:[],
}
const CORE_DEPS=["next","react","react-dom"]
const UTILITY_DEPS=["clsx","tailwind-merge","class-variance-authority","lucide-react","tailwindcss-animate"]
const HISTORY_MAX=50

function buildDependencyReport():string { return Object.entries(SHADCN_DEP_MAP).filter(([,v])=>v.length>0).map(([k,v])=>`  ${k} → ${v.join(", ")}`).join("\n") }

// ═══════════════════════════════════════════════════════════════════
// STRICT TYPE RULES — exact prop interfaces from this project's shadcn
// ═══════════════════════════════════════════════════════════════════

const STRICT_TYPE_RULES = `⚠️  CRITICAL — Use ONLY these exact prop values. Any other value will cause TypeScript errors.

Button variant: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
Button size: "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg"
Button props: variant, size, asChild, className, children, disabled, onClick, type, form, ...rest

Badge variant: "default" | "secondary" | "destructive" | "outline"
Badge props: variant, asChild, className, children
Badge: NO "success" "info" "warning" "primary" variants!

Input props: type("text"|"email"|"password"|"number"|"search"|"url"|"tel"|"file"), placeholder, value, onChange, className, disabled, required, ...rest
Input: NO "variant" prop!

Card exports: Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter
Card components accept: className, children, ...props (NO "variant" prop on Card)

Select exports: Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectLabel, SelectItem, SelectSeparator, SelectScrollUpButton, SelectScrollDownButton
SelectItem prop: value (string, required)

Dialog exports: Dialog, DialogTrigger, DialogPortal, DialogClose, DialogOverlay, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription
DialogContent: showCloseButton? (boolean) — close button is shown by default

Tabs exports: Tabs, TabsList, TabsTrigger, TabsContent
TabsTrigger prop: value (string, required)
TabsContent prop: value (string, required)

Sheet exports: Sheet, SheetTrigger, SheetClose, SheetPortal, SheetOverlay, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription
Sheet props: side ("top"|"right"|"bottom"|"left"), modal (boolean)

Breadcrumb exports: Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator, BreadcrumbEllipsis

Accordion exports: Accordion, AccordionItem, AccordionTrigger, AccordionContent
AccordionItem prop: value (string, required)

Alert exports: Alert, AlertTitle, AlertDescription
Avatar exports: Avatar, AvatarImage, AvatarFallback
Skeleton exports: Skeleton
Spinner exports: Spinner
Separator exports: Separator
Label exports: Label
Tooltip exports: Tooltip, TooltipContent, TooltipProvider, TooltipTrigger
Popover exports: Popover, PopoverTrigger, PopoverContent, PopoverAnchor
Switch exports: Switch
Checkbox exports: Checkbox
Textarea exports: Textarea
Progress exports: Progress
Slider exports: Slider
Table exports: Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption
ScrollArea exports: ScrollArea, ScrollBar
Pagination exports: Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious
DropdownMenu: DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuGroup
NavigationMenu: NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuTrigger, NavigationMenuContent, NavigationMenuLink
`

// ═══════════════════════════════════════════════════════════════════
// CODE CLEANER — strips ALL meta-tags, fences, and descriptions
// ═══════════════════════════════════════════════════════════════════

function stripAllArtifacts(code: string): string {
  if (!code) return ""
  let out = code
  // Strip bracket meta-tags of any kind
  out = out.replace(/\[\s*\/?\s*(?:code|CODE|file|FILE|usedfor|usedFor|USEDFOR|component|COMPONENT|page|PAGE|name|NAME)\s*\](?:\s*\[?\/?(?:code|CODE|file|FILE|usedfor|usedFor|USEDFOR|component|COMPONENT|page|PAGE|name|NAME)\s*\])?/gi, "")
  // Strip standalone closing bracket tags
  out = out.replace(/\[\s*\/\s*(?:code|CODE|file|FILE|usedfor|usedFor|USEDFOR|component|COMPONENT|page|PAGE|name|NAME)\s*\]/gi, "")
  // Strip markdown fences
  out = out.replace(/^```[a-zA-Z0-9]*\s*$/gm, "")
  // Strip ### FILE: headers
  out = out.replace(/^###\s*FILE:.*$/gm, "")
  // Strip leading "Here is..." type prose on its own line
  out = out.replace(/^(?:Here is|This is|Below is|Following is|This will|I have|I've|I will|The code|The file|This code|The following)\s.{0,200}$/gm, "")
  // Strip trailing prose that starts with sentence patterns
  out = out.replace(/\n(?:This|Here|Please|Let|Note|Feel free|You can|Make sure|Don't forget|Remember|The above|I hope|Enjoy|Ready to|Now you)\s.{0,500}$/gm, "")
  // Strip lines that are entirely prose (no code characters — no semicolons, braces, import/export, etc.)
  out = out.split("\n").filter(line => {
    const t = line.trim()
    if (!t) return true
    if (/[{}();=<>\[\]\&\|\^\~\`\$\%\#\@\!\?\*\+\/\-]/.test(t)) return true
    if (/^(?:import|export|const|let|var|function|class|interface|type|enum|return|if|for|while|switch|case|break|continue|try|catch|finally|throw|new|delete|typeof|instanceof|void|yield|await|async|default|extends|implements|static|public|private|protected|readonly|abstract|as|from|require|module)($|\s)/i.test(t)) return true
    if (/^["']use (client|server|strict)["']/.test(t)) return true
    if (/^[\/\*]/.test(t)) return true
    if (/^@(tailwind|layer|apply|media|keyframes)/.test(t)) return true
    if (/^<(div|span|section|main|header|footer|nav|article|aside|ul|ol|li|p|h[1-6]|a|img|button|input|form|table|tbody|thead|tr|th|td|svg|path|br|hr|pre|code|picture|source|figure|figcaption|blockquote|label|select|textarea|option|html|head|body|meta|link|title)\b/i.test(t)) return true
    if (/^(<\/[\w-]+>|\/>)/.test(t)) return true
    if (/^[a-z]/.test(t) && !/[{}();=<>\[\]&\|\^\~\`\$\%\#\@\!\?\*\+\/\-]/.test(t) && t.split(/\s+/).length > 5) return false
    return true
  }).join("\n")
  // Strip leading/trailing empty lines
  out = out.replace(/^\s*\n+/, "").replace(/\n+\s*$/, "")
  // Collapse triple+ newlines
  out = out.replace(/\n{3,}/g, "\n\n")
  // Strip leading description lines (prose before the actual code)
  const codeStart = out.search(/(?:^|\n)\s*(?:"use client"|"use strict"|import\b|export\b|const\b|let\b|var\b|function\b|interface\b|type\b|class\b|@tailwind|@layer|\/\/|\/\*|\{)/m)
  if (codeStart > 0) out = out.slice(codeStart)
  // Strip trailing prose (after the last code-like line)
  const lines = out.split("\n")
  let lastCodeLine = lines.length - 1
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim()
    if (/^(?:export\b|import\b|const\b|let\b|var\b|function\b|interface\b|type\b|class\b|return\b|if\s*\(|}\s*$|\)\s*;|\)\s*=>|^\s*\{|^\s*\}|^\s*\]|^\s*\)|^\s*<|^\s*\/>|^\s*\/\*\*|^\s*\*\/|^\s*\* |^\s*\/\/|@layer|@tailwind|@apply)/.test(line) || /^[\s]*$/.test(line)) {
      lastCodeLine = i
      continue
    }
    break
  }
  if (lastCodeLine < lines.length - 1) {
    out = lines.slice(0, lastCodeLine + 1).join("\n")
  }
  // Remove remaining stray bracket-only lines
  out = out.replace(/^\s*\[$|^\s*\]$/gm, "")
  return out.trim()
}
function loadCheatsheet(): string {
  const p = join(process.cwd(),"components.json")
  if (!existsSync(p)) return "No cheatsheet"
  try {
    const d = JSON.parse(readFileSync(p,"utf-8"))
    if (!d?.components) return "No cheatsheet"
    return (d.components as Array<{slug:string;name:string;import_path:string;exports:string[];purpose:string;composition?:string}>).map(c => {
      const deps = SHADCN_DEP_MAP[c.slug]??[]
      const dd = deps.length?`\n  npm: ${deps.join(", ")}`:"  npm: none"
      return [`${c.name} (${c.slug})`,`  import { ${(c.exports||[]).join(", ")} } from "${c.import_path}"`,`  ${c.purpose}`,dd,c.composition?`  nest: ${c.composition}`:""].filter(Boolean).join("\n")
    }).join("\n\n")
  } catch { return "No cheatsheet" }
}

async function loadExistingPages(projectId:string,userId:string):Promise<Array<{name:string;code:string;usedFor:string}>> {
  try {
    const c = await clientPromise; const db = c.db()
    const u = await db.collection("users").findOne({id:userId,projects:{$elemMatch:{_id:new ObjectId(projectId)}}},{projection:{"projects.$":1}})
    return u?.projects?.[0]?.pages?.map((p:any)=>({name:p.name,code:p.content||p.code||"",usedFor:p.usedFor||""}))||[]
  } catch { return [] }
}
async function saveHistory(projectId:string,userId:string,entry:BuildHistoryEntry) {
  try {
    const c = await clientPromise; const db = c.db()
    const u = await db.collection("users").findOne({id:userId}); if(!u) return
    const proj = u.projects?.find((p:any)=>p._id.toString()===projectId); if(!proj) return
    const h = (proj.buildHistory||[]) as BuildHistoryEntry[]; h.unshift(entry); if(h.length>HISTORY_MAX) h.length=HISTORY_MAX
    await db.collection("users").updateOne({id:userId,"projects._id":new ObjectId(projectId)},{$set:{"projects.$.buildHistory":h}})
  } catch {}
}

// ═══════════════════════════════════════════════════════════════════
// PROMPTS
// ═══════════════════════════════════════════════════════════════════

const STRUCTURE_RULES = `Next.js App Router architect.

Return a single JSON array — NOTHING else. The FIRST byte of your response MUST be "[". The LAST byte MUST be "]".
NO prose, NO markdown, NO code fences, NO "Here is...", NO explanation, NO comments. ONLY the JSON array.

The JSON array must contain 7-14 objects with EXACTLY these fields:
  "name"     — file path string (e.g. "app/page.tsx")
  "usedFor"  — short plain English description (not "[usedFor]" or brackets, just words like "Homepage hero section")
  "description" — 1-2 sentence technical description of the file's contents
  "route"    — URL path or "n/a" (e.g. "/", "/about", "n/a")
  "priority" — integer 1-100 (lower = earlier in pipeline order)

MANDATORY files (these MUST be included):
  {"name":"package.json","usedFor":"npm config","description":"package.json with all dependencies","route":"n/a","priority":1}
  {"name":"tsconfig.json","usedFor":"TypeScript config","description":"tsconfig with path aliases","route":"n/a","priority":2}
  {"name":"lib/types.ts","usedFor":"shared types","description":"TypeScript interfaces and enums","route":"n/a","priority":3}
  {"name":"lib/utils.ts","usedFor":"cn utility","description":"cn() helper with clsx+tailwind-merge","route":"n/a","priority":4}
  {"name":"app/globals.css","usedFor":"global styles","description":"Tailwind directives and CSS custom properties","route":"n/a","priority":5}
  {"name":"app/layout.tsx","usedFor":"root layout","description":"Root layout with metadata, fonts, and providers","route":"n/a","priority":6}
  {"name":"app/page.tsx","usedFor":"homepage","description":"Landing page for the described website","route":"/","priority":7}

IMPORTANT: ALL string values must contain ONLY plain English text — NO square brackets, NO placeholders like "[usedFor]" or "[name]", NO JSON inside strings. Every field must be meaningful and specific to the user's request.

Return ONLY the JSON array. No other output whatsoever.`

function structPrompt(prompt:string,cheatsheet:string,depReport:string):ChatMessage[]{return[
  {role:"system",content:[STRUCTURE_RULES,`\nshadcn/ui:\n${cheatsheet}`,`\nNPM deps:\n${depReport}`].join("\n")},
  {role:"user",content:prompt},
]}

const CODE_RULES = `Production Next.js App Router + TypeScript.

THE RULES:
1. FIRST character of your response MUST be code (import, export, "use client", function, const, let, var, interface, type, class, or //).
2. Return ONLY the source code. NOTHING else.
3. NO prose — no "Here is the code", no "This component...", no "Let me know if...".
4. NO markdown fences (\`\`\`typescript etc) — raw code only.
5. NO [code] [/code] or any other bracket-style tags.
6. NO leading or trailing blank lines containing only whitespace.
7. NO JSON wrappers around the code. NO "code" field objects. Just the raw code.

100% SHADCN/UI: Never raw <button> <input> <select> <textarea> <label> <form>.
Use: Button Input Textarea Select SelectTrigger SelectContent SelectItem Label Form FormField FormItem FormControl FormMessage Checkbox Switch RadioGroup Card CardHeader CardContent CardFooter Separator Tabs TabsList TabsTrigger TabsContent Sheet SheetTrigger SheetContent Dialog DialogTrigger DialogContent Accordion AccordionItem AccordionTrigger AccordionContent Badge Avatar Skeleton Tooltip Popover DropdownMenu Breadcrumb Pagination.

Allowed raw HTML (structural only): div span section main header footer nav article aside ul ol li img a h1-h6 p table thead tbody tr th td br hr pre code svg picture source figure figcaption blockquote.

NEXT.JS: Server Components by default. "use client" ONLY for hooks/events. layout.tsx exports metadata object with title+description. page.tsx exports default async function. Always: import { cn } from "@/lib/utils"; wrap all classNames in cn(). Dark mode via class strategy. Mobile-first responsive: base + sm: + md: + lg:.

${STRICT_TYPE_RULES}

RETURN ONLY RAW CODE. NO [code] / [file] / [usedfor] / [usedFor] / [component] / [page] bracket tags. NO fences. NO descriptions. NO metadata tags inline. FIRST CHARACTER is code. LAST CHARACTER is code.`

const EDIT_RULES = `You are editing an existing Next.js project. Apply the user's requested change.

Respond with file blocks ONLY. NO prose, NO "Here is...", NO explanations, NO markdown outside of file blocks.

Format — EXACTLY this, nothing else:
### FILE: path/to/file.tsx
<complete new code — NOT diffs, NOT descriptions, NOT extra comments>

### FILE: path/to/file.tsx
<complete new code>

Special actions:
- DELETE: ### FILE: path/to/file.tsx\\nDELETE
- MOVE:   ### FILE: old/path.tsx\\nMOVE_TO: new/path.tsx
- ADD:    ### FILE: new/path.tsx\\n<complete code>

NO prose between file blocks. NO introductory text. NO closing remarks.
Each ### FILE: block must be immediately followed by the complete code on the next line.

${STRICT_TYPE_RULES}

Production quality. 100% shadcn/ui. cn() for classNames. Mobile-first. FIRST char must be "#".`

function codePrompt(pages:PageStructure[],cur:PageStructure,prev:Array<{name:string;code:string;usedFor?:string}>,cheatsheet:string,depReport:string,custom?:string):ChatMessage[]{
  const list=pages.map(p=>`- ${p.name} (${p.usedFor}): ${p.description}`).join("\n")
  let pb=""
  if(prev.length) pb="\n\nALREADY GENERATED:\n"+prev.map(f=>`--- ${f.name} ---\n${f.code}`).join("\n\n")
  const pts=[CODE_RULES,`\nNPM deps:\n${depReport}`,`\nshadcn/ui:\n${cheatsheet}`]
  if(custom&&custom.length>10&&custom!=="Generation code prompting is disabled.") pts.push(`\nBUILD RULES:\n${custom}`)
  pts.push(`\nALL FILES:\n${list}`,pb)
  return[{role:"system",content:pts.join("\n")},{role:"user",content:`Write production code for ${cur.name} (${cur.usedFor}).`}]
}

function editPrompt(userReq:string, existing:Array<{name:string;code:string;usedFor:string}>,cheatsheet:string,depReport:string,custom?:string):ChatMessage[]{
  const fl=existing.map(f=>`--- ${f.name} (${f.usedFor||""}) ---\n${f.code}`).join("\n\n")
  const pts=[EDIT_RULES,`\nNPM deps:\n${depReport}`,`\nshadcn/ui:\n${cheatsheet}`]
  if(custom&&custom.length>10&&custom!=="Generation code prompting is disabled.") pts.push(`\nBUILD RULES:\n${custom}`)
  pts.push(`\nEXISTING FILES:\n${fl}`)
  return[{role:"system",content:pts.join("\n")},{role:"user",content:`Apply: ${userReq}`}]
}
function parseEdit(content:string):EditOp[]{
  const ops:EditOp[]=[]
  const blocks=content.split(/^###\s*FILE:\s*/gm)
  for(const b of blocks){
    const t=b.trim(); if(!t) continue
    const nl=t.indexOf("\n"); const name=(nl>0?t.slice(0,nl):t).trim()
    const body=nl>0?t.slice(nl+1).trim():""
    if(body==="DELETE") ops.push({name,action:"delete",code:""})
    else if(body.startsWith("MOVE_TO:")) ops.push({name,action:"move",code:"",target:body.slice(8).trim()})
    else if(body){ const clean=stripAllArtifacts(body); if(name&&clean) ops.push({name,action:"rewrite",code:clean}) }
  }
  if(!ops.length){ const clean=stripAllArtifacts(content); if(clean) ops.push({name:"edit",action:"rewrite",code:clean}) }
  return ops
}

// ═══════════════════════════════════════════════════════════════════
// GET — read codebase / history
// ═══════════════════════════════════════════════════════════════════

export async function GET(request:NextRequest){
  const session=await getServerSession(authOptions); if(!session?.user?.id) return new Response("Unauthorized",{status:401})
  const url=new URL(request.url); const pid=url.searchParams.get("projectId")||""
  const file=url.searchParams.get("file")||""; const hist=url.searchParams.get("history")==="1"
  if(!pid||!ObjectId.isValid(pid)) return NextResponse.json({error:"Invalid projectId"},{status:400})
  try {
    const c=await clientPromise; const db=c.db()
    const u=await db.collection("users").findOne({id:session.user.id,projects:{$elemMatch:{_id:new ObjectId(pid)}}},{projection:{"projects.$":1}})
    if(!u?.projects?.[0]) return NextResponse.json({error:"Not found"},{status:404})
    const proj=u.projects[0]; const pages=(proj.pages||[]).map((p:any)=>({name:p.name,usedFor:p.usedFor||"",code:p.content||p.code||"",updatedAt:p.updatedAt}))
    const history=proj.buildHistory||[]
    if(hist) return NextResponse.json({history:history.slice(0,HISTORY_MAX)})
    if(file){ const pg=pages.find((p:any)=>p.name===file); return pg?NextResponse.json({file:pg}):NextResponse.json({error:"File not found"},{status:404}) }
    return NextResponse.json({pages,history:history.slice(0,HISTORY_MAX)})
  } catch(e:any){ return NextResponse.json({error:e.message},{status:500}) }
}

// ═══════════════════════════════════════════════════════════════════
// POST
// ═══════════════════════════════════════════════════════════════════

export async function POST(request:NextRequest){
  const session=await getServerSession(authOptions); if(!session?.user?.id) return new Response("Unauthorized",{status:401})
  const enc=new TextEncoder(); let closed=false
  const stream=new ReadableStream({async start(ctrl){
    const push=(ev:string,d:any)=>{if(closed)return;try{ctrl.enqueue(enc.encode(`event: ${ev}\ndata: ${JSON.stringify(d)}\n\n`))}catch{closed=true}}
    const done=()=>{if(closed)return;try{ctrl.enqueue(enc.encode("event: done\ndata: {}\n\n"));ctrl.close()}catch{};closed=true}
    const hsteps:Array<{title:string;content:string}>=[]
    try {
      const body=await request.json().catch(()=>({})); const prompt=String(body.prompt??"").trim()
      const pid=String(body.projectId??""); const mode=String(body.mode??"generate")
      const model={id:String(body.modelId??"deepseek-v4-pro"),provider:String(body.provider??"DeepSeek")}
      if(!prompt||!pid){push("error",{message:"prompt + projectId required"});done();return}
      const cheatsheet=loadCheatsheet(); const depReport=buildDependencyReport()
      let customBuilderCode=""
      try{const{builderCode}=await getSystemPrompts();if(builderCode&&builderCode.length>10&&builderCode!=="Generation code prompting is disabled.")customBuilderCode=builderCode}catch{}
      // STEP 1
      const s1={id:"step-1",title:mode==="edit"?"🔄 Edit":"📝 Input",content:`"${prompt}"\nModel: ${model.provider} · ${model.id}`,timestamp:Date.now()}
      push("step",s1); hsteps.push({title:s1.title,content:s1.content})
      // EDIT MODE
      if(mode==="edit"){
        push("step",{id:"step-2",title:"📂 Reading project",content:"Loading existing files...",timestamp:Date.now()})
        const existing=await loadExistingPages(pid,session.user.id)
        push("step",{id:"step-2",title:"📂 Project loaded",content:`${existing.length} file${existing.length===1?"":"s"}`,timestamp:Date.now()})
        const existingNames=new Set(existing.map(f=>f.name))
        push("step",{id:"step-3",title:"🤖 AI analyzing",content:`Files: ${existing.map(f=>f.name).join(", ")}`,timestamp:Date.now()})
        hsteps.push({title:"🤖 Editing",content:`${existing.length} files`})
        const er=await callModel({model,messages:editPrompt(prompt,existing,cheatsheet,depReport,customBuilderCode),temperature:0.2})
        if(!er.ok){push("step",{id:"step-err",title:"❌ Failed",content:er.message,timestamp:Date.now()});hsteps.push({title:"❌",content:er.message});await saveHistory(pid,session.user.id,{prompt,model:model.id,timestamp:Date.now(),files:[],steps:hsteps});done();return}
        const ops=parseEdit(er.content); const applied:string[]=[]
        for(const op of ops){
          if(op.action==="delete"){push("step",{id:"step-3",title:`🗑️ ${op.name}`,content:"Deleted",timestamp:Date.now()});push("page",{name:op.name,code:"",usedFor:"deleted",timestamp:Date.now()});applied.push(`-${op.name}`)}
          else if(op.action==="move"){push("step",{id:"step-3",title:`📁 ${op.name} → ${op.target}`,content:"Moved",timestamp:Date.now()});push("page",{name:op.name,code:"MOVE_TO:"+(op.target||""),usedFor:"moved",timestamp:Date.now()});if(op.target)push("page",{name:op.target,code:existing.find(f=>f.name===op.name)?.code||"",usedFor:"moved",timestamp:Date.now()});applied.push(`${op.name}→${op.target}`)}
          else if(op.action==="rewrite"||op.action==="add"){const isNew=!existingNames.has(op.name);const a=isNew?"➕":"✏️";push("step",{id:"step-3",title:`${a} ${op.name}`,content:`${op.code.length.toLocaleString()} chars`,timestamp:Date.now()});push("page",{name:op.name,code:op.code,usedFor:"updated",timestamp:Date.now()});applied.push((isNew?"+":"~")+op.name)}
        }
        push("step",{id:"step-4",title:"✅ Applied",content:applied.join("\n"),timestamp:Date.now()})
        hsteps.push({title:"✅ Changes",content:applied.join("\n")})
        if(ObjectId.isValid(pid)) try {
          const c=await clientPromise; const db=c.db()
          for(const op of ops){
            if(op.action==="delete") await db.collection("users").updateOne({id:session.user.id,"projects._id":new ObjectId(pid)},{$pull:{"projects.$.pages":{name:op.name}} as any})
            else if(op.action==="move"){
              const src=existing.find(f=>f.name===op.name); if(src&&op.target) await db.collection("users").updateOne({id:session.user.id,"projects._id":new ObjectId(pid)},{$pull:{"projects.$.pages":{name:op.name}} as any}).then(()=>db.collection("users").updateOne({id:session.user.id,"projects._id":new ObjectId(pid)},{$push:{"projects.$.pages":{name:op.target,content:src.code,usedFor:src.usedFor,createdAt:new Date(),updatedAt:new Date()}} as any}))
            } else if(op.code){
              const ur=await db.collection("users").updateOne({id:session.user.id,projects:{$elemMatch:{_id:new ObjectId(pid),"pages.name":op.name}}},{$set:{"projects.$[proj].pages.$[pg].content":op.code,"projects.$[proj].pages.$[pg].usedFor":"updated","projects.$[proj].pages.$[pg].updatedAt":new Date()}},{arrayFilters:[{"proj._id":new ObjectId(pid)},{"pg.name":op.name}]})
              if(ur.matchedCount===0) await db.collection("users").updateOne({id:session.user.id,"projects._id":new ObjectId(pid)},{$push:{"projects.$.pages":{name:op.name,content:op.code,usedFor:"new",createdAt:new Date(),updatedAt:new Date()}} as any})
            }
          }
          push("step",{id:"step-done",title:"💾 Saved",content:`${ops.length} operations saved.`,timestamp:Date.now()})
        } catch(e:any){push("step",{id:"step-done",title:"⚠️ DB fail",content:e.message,timestamp:Date.now()})}
        await saveHistory(pid,session.user.id,{prompt,model:model.id,timestamp:Date.now(),files:applied,steps:hsteps})
        done(); return
      }
      // GENERATE MODE
      push("step",{id:"step-2",title:"🏗️ Planning",content:"Designing file tree...",timestamp:Date.now()})
      const sr=await callModel({model,messages:structPrompt(prompt,cheatsheet,depReport),temperature:0.3})
      let pages:PageStructure[]=extractJson<PageStructure[]>(sr.ok?sr.content:"[]")||[]
      if(!Array.isArray(pages)||!pages.length) pages=[
        {name:"package.json",usedFor:"npm config",description:"package.json with all deps",route:"n/a",priority:1},
        {name:"tsconfig.json",usedFor:"TypeScript config",description:"tsconfig with paths alias",route:"n/a",priority:2},
        {name:"lib/types.ts",usedFor:"shared types",description:"TypeScript interfaces",route:"n/a",priority:3},
        {name:"lib/utils.ts",usedFor:"cn utility",description:"cn() helper with clsx+tailwind-merge",route:"n/a",priority:4},
        {name:"app/globals.css",usedFor:"global styles",description:"Tailwind directives + tokens",route:"n/a",priority:5},
        {name:"app/layout.tsx",usedFor:"root layout",description:"Root layout with metadata, fonts, providers",route:"n/a",priority:6},
        {name:"app/page.tsx",usedFor:"homepage",description:"Landing page with hero, features, CTA",route:"/",priority:7},
      ]
      push("step",{id:"step-2",title:"🏗️ Structure",content:`${pages.length} files:\n${pages.map(p=>`  • ${p.name} [${p.priority}] ${p.usedFor}`).join("\n")}`,timestamp:Date.now()})
      hsteps.push({title:"🏗️",content:`${pages.length} files`})
      const generated:Array<{name:string;code:string;usedFor:string;timestamp:number}>=[]
      const sorted=[...pages].sort((a,b)=>a.priority-b.priority)
      for(let i=0;i<sorted.length;i++){
        const pg=sorted[i]
        push("step",{id:"step-3",title:`${i+1}/${sorted.length} ${pg.name}`,content:pg.description,timestamp:Date.now()})
        const msgs=codePrompt(sorted,pg,generated,cheatsheet,depReport,customBuilderCode)
        const res=await callModel({model,messages:msgs,temperature:0.2})
        if(res.ok){
          let code=stripAllArtifacts(res.content)
          if(!code||code.length<3) code=extractCode(res.content,pg.name.endsWith(".tsx")||pg.name.endsWith(".ts")?"ts":undefined)||res.content
          code=stripAllArtifacts(code)
          generated.push({name:pg.name,code,usedFor:pg.usedFor,timestamp:Date.now()})
          push("step",{id:"step-3",title:`✅ ${pg.name}`,content:`${code.length.toLocaleString()} chars`,timestamp:Date.now()})
          push("page",{name:pg.name,code,usedFor:pg.usedFor,timestamp:Date.now()})
        } else push("step",{id:"step-3",title:`❌ ${pg.name}`,content:res.message,timestamp:Date.now()})
      }
      // STEP 4 — dependency audit
      push("step",{id:"step-4",title:"📦 Audit",content:"Scanning imports + package.json...",timestamp:Date.now()})
      const usedComps=new Set<string>()
      for(const pg of generated) for(const m of pg.code.matchAll(/from\s+["']@\/components\/ui\/([a-zA-Z0-9-]+)["']/g)) usedComps.add(m[1])
      const rt=process.cwd(); const exist:string[]=[]; const miss:string[]=[]
      for(const s of usedComps){if(!/^[a-zA-Z][a-zA-Z0-9-]*$/.test(s))continue;existsSync(join(rt,"components","ui",`${s}.tsx`))?exist.push(s):miss.push(s)}
      const pkg=generated.find(p=>p.name==="package.json"); let dgap=""
      if(pkg) try{
        const pj=JSON.parse(pkg.code); const pd={...(pj.dependencies||{}),...(pj.devDependencies||{})}
        const needed=new Set<string>(); for(const c of usedComps) for(const d of(SHADCN_DEP_MAP[c]||[])) needed.add(d)
        for(const d of CORE_DEPS) needed.add(d); for(const d of UTILITY_DEPS) needed.add(d)
        const gaps=[...needed].filter(d=>!pd[d])
        if(gaps.length) dgap=`\n\n⚠️  DEPLOYMENT WARNING — missing deps:\n${gaps.map(d=>`  MISSING: ${d}`).join("\n")}\n\nRun these before deploying.`
      } catch{}
      let rpt=`${usedComps.size} shadcn/ui imports`
      if(exist.length) rpt+=`\n\n✅ On disk (${exist.length}):\n${exist.map(s=>`  • ${s} → components/ui/${s}.tsx`).join("\n")}`
      if(miss.length) rpt+=`\n\n⬜ Need install (${miss.length}):\n${miss.map(s=>`  • npx shadcn@latest add ${s}`).join("\n")}`
      if(!usedComps.size) rpt="No shadcn/ui imports."
      rpt+=dgap
      push("step",{id:"step-4",title:"📦 Audit",content:rpt,timestamp:Date.now()})
      hsteps.push({title:"📦 Audit",content:`${usedComps.size} component${usedComps.size===1?"":"s"}`})
      // SAVE
      if(ObjectId.isValid(pid)&&generated.length) try{
        const c=await clientPromise; const db=c.db()
        for(const pg of generated){
          const ur=await db.collection("users").updateOne({id:session.user.id,projects:{$elemMatch:{_id:new ObjectId(pid),"pages.name":pg.name}}},{$set:{"projects.$[proj].pages.$[pg].content":pg.code,"projects.$[proj].pages.$[pg].usedFor":pg.usedFor,"projects.$[proj].pages.$[pg].updatedAt":new Date()}},{arrayFilters:[{"proj._id":new ObjectId(pid)},{"pg.name":pg.name}]})
          if(ur.matchedCount===0) await db.collection("users").updateOne({id:session.user.id,"projects._id":new ObjectId(pid)},{$push:{"projects.$.pages":{name:pg.name,content:pg.code,usedFor:pg.usedFor,createdAt:new Date(),updatedAt:new Date()}} as any})
        }
        push("step",{id:"step-done",title:"💾 Saved",content:`${generated.length} files saved.`,timestamp:Date.now()})
      } catch(e:any){push("step",{id:"step-done",title:"⚠️",content:e.message,timestamp:Date.now()})}
      hsteps.push({title:"💾",content:`${generated.length} files`})
      await saveHistory(pid,session.user.id,{prompt,model:model.id,timestamp:Date.now(),files:generated.map(p=>p.name),steps:hsteps})
      done()
    } catch(err:any){push("error",{message:`Crash: ${err.message}`});hsteps.push({title:"❌",content:err.message});done()}
  },cancel(){closed=true}})
  return new Response(stream,{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache",Connection:"keep-alive"}})
}
