'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { cn } from '@/lib/utils'
import {
  Code2,
  Cpu,
  FileCode,
  GitBranch,
  Layers,
  Rocket,
  Server,
  Sparkles,
  Workflow,
  Wrench,
  Box,
} from 'lucide-react'

export function BuilderPipelineDocs({ isDark = true }: { isDark?: boolean }) {
  const [open, setOpen] = useState(false)

  return (
    <Card className={cn(
      "border-white/10",
      isDark ? 'bg-white/[0.04]' : 'bg-white'
    )}>
      <CardHeader className="cursor-pointer" onClick={() => setOpen(!open)}>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Workflow className="h-4 w-4 text-blue-400" />
              How Syra builds websites
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              AI pipeline: prompt → architecture → shadcn components → files → deploy
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-[10px]">
            {open ? 'Hide' : 'Show'}
          </Badge>
        </div>
      </CardHeader>

      {open && (
        <>
          <Separator className="border-white/5" />
          <CardContent className="pt-4 space-y-5">
            <PipelineStep
              icon={<Sparkles className="h-4 w-4 text-yellow-400" />}
              step="1. Prompt & System Context"
              description={[
                "User prompt is wrapped with the Syra system prompt (700+ lines) containing: engineering rules, Next.js App Router conventions, the full 57-component shadcn/ui catalog, mobile-first design philosophy, 2026 AI design standards, and the SHADCN-ONLY MANDATE that forbids custom CSS/Tailwind styling.",
                "The AI's model name (syra-nano / syra-base / syra-havy) determines which LLM provider is used: Gemini Flash, DeepSeek V4 Pro, or Gemini 3.1 Pro.",
                "All requests flow through /api/ai/chat — the server-side route that proxies to the correct provider.",
              ]}
            />

            <PipelineStep
              icon={<Layers className="h-4 w-4 text-purple-400" />}
              step="2. Architecture Planning"
              description={[
                "AI outputs a plan with routes (app/ directory pages), components needed, state management, and styling approach.",
                "Multi-page routing is mandatory: business site needs /, /about, /services, /contact, /blog. SaaS needs /, /pricing, /login, /dashboard, /dashboard/settings.",
                "AI identifies which shadcn components are needed for each page section.",
              ]}
            />

            <PipelineStep
              icon={<Box className="h-4 w-4 text-emerald-400" />}
              step="3. Deep Memory Context"
              description={[
                "AI reads .glovix/deep-memory.md (or fallbacks) for context on previous mistakes, logic, and project state.",
                "AI maintains .glovix/glovix.md containing Plan, Details, Files, and Structure.",
                "AI uses saveKnowledge to store logic in short form in deep-think to a separated knowledge block.",
                "AI uses listKnowledge and callKnowledge to list and retrieve separated knowledge blocks to move forward."
              ]}
            />

            <PipelineStep
              icon={<Box className="h-4 w-4 text-green-400" />}
              step="4. Component Installation (shadcn CLI)"
              description={[
                "AI calls addShadcnComponent({ components: [...] }) to install needed UI primitives via npx shadcn@latest add.",
                "This runs the official shadcn CLI which generates properly typed, accessible Radix UI components into components/ui/.",
                "Installed files are automatically persisted to the project's Pages in MongoDB — the durable source of truth.",
                "The AI NEVER writes component files manually. Every UI element must come from this step.",
              ]}
            />

            <PipelineStep
              icon={<FileCode className="h-4 w-4 text-blue-400" />}
              step="5. File Generation"
              description={[
                "AI creates files using batchCreateFiles() for speed (3-5x faster than sequential) or createFile() for individual files.",
                "Files saved include: app/page.tsx (and sub-routes), app/layout.tsx, app/globals.css, components/*.tsx, lib/utils.ts.",
                "Every file save goes through two layers: (1) in-memory Zustand store for UI reactivity, (2) MongoDB Pages API for durability.",
                "A third layer (WebContainer in-browser filesystem) provides live preview but is best-effort — Pages is the source of truth.",
                "AI marks client components with 'use client', server components are default in App Router.",
              ]}
            />

            <PipelineStep
              icon={<Wrench className="h-4 w-4 text-amber-400" />}
              step="6. Validation & Type Checking"
              description={[
                "After each batch of files, AI runs typeCheck() which calls /api/workspace/diagnostics on the server-side sandbox.",
                "Returns structured TypeScript errors with file, line, and message. Errors feed into the Error Panel UI.",
                "AI iterates: readFile affected files → editFile to fix → typeCheck to verify → repeat until zero errors.",
                "Error Boundary components protect the builder UI from crashing on broken code.",
              ]}
            />

            <PipelineStep
              icon={<GitBranch className="h-4 w-4 text-orange-400" />}
              step="7. Version Control (save)"
              description={[
                "When ready, AI calls save() → pushes all project files to a GitHub repository via /api/workspace/github-save.",
                "Creates the repository on first save. Subsequent saves push to the same repo.",
                "The GitHub repo is what Dokploy builds from — save() must run before deploy().",
              ]}
            />

            <PipelineStep
              icon={<Server className="h-4 w-4 text-cyan-400" />}
              step="8. Docker Deployment (deploy)"
              description={[
                "AI calls deploy() → single API call that: creates/updates Dokploy application, sets Dockerfile build type, configures the public domain as <app>.sycord.site, attaches GitHub source, and triggers the Docker build.",
                "Dokploy Docker containers handle all npm install / npm run build — the AI never runs build commands locally.",
                "If integration env vars are missing, deployment pauses and prompts the user via integration().",
                "Returns the live sycord.site URL on success.",
              ]}
            />

            <PipelineStep
              icon={<Code2 className="h-4 w-4 text-pink-400" />}
              step="9. Codebase Documentation"
              description={[
                "AI creates .glovix/codebase.md with a structured project overview: tech stack, file structure, component descriptions, routing table, and external dependencies.",
                "This file is read by the next chat session for context continuity.",
                ".glovix/context.md (if present) is read FIRST on any subsequent session to resume work seamlessly.",
              ]}
            />

            <Separator className="border-white/5" />

            <Accordion type="single" collapsible>
              <AccordionItem value="tech" className="border-white/5">
                <AccordionTrigger className="text-xs text-white/50 hover:text-white/70">
                  Technical Architecture Details
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-2">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TechCard
                      title="State Management"
                      items={['Zustand (single store, 403 lines)', 'Memoized selectors for performance', 'LocalStorage persistence for settings', 'React Context for auth provider']}
                    />
                    <TechCard
                      title="AI Provider Routing"
                      items={['/api/ai/chat detects model prefix', 'deepseek-* → api.deepseek.com', 'Default → Gemini Vertex AI', 'Both stream OpenAI-compatible SSE']}
                    />
                    <TechCard
                      title="File Persistence"
                      items={['Pages API (MongoDB) — durable truth', 'Zustand store — UI reactivity', 'WebContainer FS — live preview only', '.glovix/ files excluded from pages']}
                    />
                    <TechCard
                      title="Frontend Stack"
                      items={['Next.js 16 + React 19', 'Tailwind CSS v4 + tailwind-merge', '54 shadcn/ui components (Radix)', 'Monaco editor for code viewing', 'Framer Motion for animations']}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </>
      )}
    </Card>
  )
}

function PipelineStep({ icon, step, description }: {
  icon: React.ReactNode
  step: string
  description: string[]
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 shrink-0 rounded-lg bg-white/[0.06] p-2 h-fit">
        {icon}
      </div>
      <div className="min-w-0 space-y-1.5">
        <p className="text-sm font-medium text-white/90">{step}</p>
        {description.map((d, i) => (
          <p key={i} className="text-xs text-white/50 leading-relaxed">{d}</p>
        ))}
      </div>
    </div>
  )
}

function TechCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <p className="text-xs font-semibold text-white/70 mb-2">{title}</p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-[11px] text-white/40 flex items-start gap-1.5">
            <span className="text-white/20 mt-0.5">•</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
