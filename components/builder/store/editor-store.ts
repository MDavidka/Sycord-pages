"use client"

import { create } from "zustand"

export type Viewport = "desktop" | "tablet" | "mobile"

interface EditorState {
  selectedBlockId: string | null
  viewport: Viewport
  jsonDrawerOpen: boolean
  historyOpen: boolean
  shortcutsModalOpen: boolean
  previewMode: boolean
  // Generation state
  isGenerating: boolean
  generationPrompt: string | null
  generationError: string | null
  // Bumped when a block requests the full edit panel (used to open it on mobile)
  editRequestId: number
  selectBlock: (id: string | null) => void
  setViewport: (vp: Viewport) => void
  toggleJsonDrawer: () => void
  toggleHistory: () => void
  toggleShortcutsModal: () => void
  togglePreview: () => void
  setGenerating: (prompt: string | null) => void
  setGenerationError: (err: string | null) => void
  clearGeneration: () => void
  requestEdit: (id: string) => void
}

export const useEditorStore = create<EditorState>()((set) => ({
  selectedBlockId: null,
  viewport: "desktop",
  jsonDrawerOpen: false,
  historyOpen: false,
  shortcutsModalOpen: false,
  previewMode: false,
  isGenerating: false,
  generationPrompt: null,
  generationError: null,
  editRequestId: 0,
  selectBlock: (id) => set({ selectedBlockId: id }),
  setViewport: (vp) => set({ viewport: vp }),
  toggleJsonDrawer: () => set((s) => ({ jsonDrawerOpen: !s.jsonDrawerOpen })),
  toggleHistory: () => set((s) => ({ historyOpen: !s.historyOpen })),
  toggleShortcutsModal: () => set((s) => ({ shortcutsModalOpen: !s.shortcutsModalOpen })),
  togglePreview: () => set((s) => ({ previewMode: !s.previewMode, ...(!s.previewMode ? { selectedBlockId: null } : {}) })),
  setGenerating: (prompt) => set({ isGenerating: !!prompt, generationPrompt: prompt, generationError: null }),
  setGenerationError: (err) => set({ generationError: err }),
  clearGeneration: () => set({ isGenerating: false, generationPrompt: null }),
  requestEdit: (id) => set((s) => ({ selectedBlockId: id, editRequestId: s.editRequestId + 1 })),
}))
