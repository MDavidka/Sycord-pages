import type { ThemeTokens } from "@/lib/ai-website-builder/types"
import type { BuilderComponentName } from "../catalog/components"

export type BuilderActionRef = {
  type: "href" | "submit" | "patch"
  payload: string
}

export type BuilderNode = {
  id: string
  component: BuilderComponentName
  props?: Record<string, unknown>
  text?: string
  children?: BuilderNode[]
}

export type BuilderPage = {
  id: string
  name: string
  path: string
  tree: BuilderNode
}

export type BuilderRoute = {
  id: string
  pageId: string
  path: string
}

export type BuilderPatch =
  | { op: "add"; path: string; value: unknown }
  | { op: "replace"; path: string; value: unknown }
  | { op: "remove"; path: string }

export interface BuilderDocument {
  id: string
  version: number
  pages: BuilderPage[]
  routes: BuilderRoute[]
  theme: ThemeTokens
  componentCatalogVersion: string
  state: "draft" | "stable"
  history: BuilderPatch[]
}

export interface BuilderWorkspaceState {
  currentDocument: BuilderDocument
  patchHistory: BuilderPatch[]
  selectedNodeId?: string
  undoStack: BuilderPatch[][]
  redoStack: BuilderPatch[][]
}
