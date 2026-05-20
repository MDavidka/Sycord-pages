import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { runAIWebsiteBuilder } from "@/lib/ai-website-builder"
import {
  applyBuilderPatches,
  type BuilderPatch,
} from "@/lib/ai-ui-builder/document/patches"
import {
  manifestToBuilderDocument,
} from "@/lib/ai-ui-builder/document/convert"
import {
  createDefaultBuilderDocument,
  type BuilderDocument,
} from "@/lib/ai-ui-builder/document/types"
import { validateBuilderDocument } from "@/lib/ai-ui-builder/document/validate"
import type { ComponentNode } from "@/lib/ai-ui-builder/catalog/components"

interface BuilderStreamRequest {
  prompt?: string
  quality?: "fast" | "best"
  document?: BuilderDocument
  selectedNodeId?: string
}

function findNodePath(
  node: ComponentNode,
  targetId: string,
  basePath: string,
): string | null {
  if (node.id === targetId) return basePath
  for (let i = 0; i < (node.children?.length ?? 0); i += 1) {
    const child = node.children?.[i]
    if (!child) continue
    const result = findNodePath(child, targetId, `${basePath}/children/${i}`)
    if (result) return result
  }
  return null
}

function buildQuickEditPatches(
  document: BuilderDocument,
  prompt: string,
  selectedNodeId?: string,
): BuilderPatch[] {
  const pageIndex = 0
  const page = document.pages[pageIndex]
  if (!page) return []
  const targetId = selectedNodeId ?? page.tree.id
  const path = findNodePath(page.tree, targetId, `/pages/${pageIndex}/tree`)
  if (!path) return []
  return [{ op: "replace", path: `${path}/text`, value: prompt }]
}

function normalizeDocument(payload: BuilderDocument | undefined): BuilderDocument {
  if (!payload) return createDefaultBuilderDocument()
  const validation = validateBuilderDocument(payload)
  if (!validation.ok) return createDefaultBuilderDocument()
  return payload
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as BuilderStreamRequest
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : ""
  const quality = body.quality === "fast" ? "fast" : "best"
  const selectedNodeId = typeof body.selectedNodeId === "string" ? body.selectedNodeId : undefined
  const currentDocument = normalizeDocument(body.document)

  let patches: BuilderPatch[] = []
  let nextDocument = currentDocument
  let error: string | undefined

  if (quality === "fast" && prompt) {
    patches = buildQuickEditPatches(currentDocument, prompt, selectedNodeId)
  } else if (prompt) {
    try {
      const result = await runAIWebsiteBuilder(prompt, { quality })
      nextDocument = manifestToBuilderDocument(result.manifest)
      patches = [{ op: "replace", path: "", value: nextDocument }]
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
      patches = buildQuickEditPatches(currentDocument, prompt, selectedNodeId)
    }
  }

  if (patches.length > 0) {
    const applied = applyBuilderPatches(currentDocument, patches)
    if (applied.ok) {
      nextDocument = applied.document
    } else {
      error = applied.error ?? "Failed to apply patches"
    }
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      const push = (payload: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`))
      }
      if (error) push({ type: "error", message: error })
      if (patches.length > 0) push({ type: "patches", patches })
      if (patches.length === 0 && prompt) {
        push({
          type: "document",
          document: nextDocument,
        })
      }
      push({ type: "done" })
      controller.close()
    },
  })

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/jsonl",
      "Cache-Control": "no-cache",
    },
  })
}
