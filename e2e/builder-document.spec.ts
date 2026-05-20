import React from "react"
import { test, expect } from "@playwright/test"
import { renderToStaticMarkup } from "react-dom/server"
import { createDefaultBuilderDocument } from "../lib/ai-ui-builder/document/types"
import { applyBuilderPatch } from "../lib/ai-ui-builder/document/patches"
import { validateBuilderDocument } from "../lib/ai-ui-builder/document/validate"
import { builderDocumentToManifest } from "../lib/ai-ui-builder/document/convert"
import { renderPageTree } from "../lib/ai-ui-builder/runtime/render-node"

test("default builder document validates", () => {
  const doc = createDefaultBuilderDocument()
  const result = validateBuilderDocument(doc)
  expect(result.ok).toBeTruthy()
})

test("patch engine updates text nodes", () => {
  const doc = createDefaultBuilderDocument()
  const result = applyBuilderPatch(doc, {
    op: "replace",
    path: "/pages/0/tree/children/0/children/0/children/0/children/0/text",
    value: "Updated heading",
  })
  expect(result.ok).toBeTruthy()
  expect((result.document.pages[0].tree.children?.[0].children?.[0].children?.[0].children?.[0] as any).text).toBe("Updated heading")
})

test("builder document exports to manifest with custom sections", () => {
  const doc = createDefaultBuilderDocument()
  const manifest = builderDocumentToManifest(doc)
  expect(manifest.pages.length).toBeGreaterThan(0)
  expect(manifest.pages[0].sections[0].kind).toBe("custom")
  expect(manifest.pages[0].sections[0].componentTree).toBeDefined()
})

test("runtime renderer outputs markup", () => {
  const doc = createDefaultBuilderDocument()
  const markup = renderToStaticMarkup(React.createElement(React.Fragment, null, renderPageTree(doc.pages[0].tree)))
  expect(markup).toContain("Describe your site")
})
