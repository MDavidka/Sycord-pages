"use client"

import React, { createContext, useCallback, useContext, useMemo, useState } from "react"
import { applyBuilderPatch, applyBuilderPatches, type BuilderPatch } from "@/lib/ai-ui-builder/document/patches"
import { createDefaultBuilderDocument, type BuilderDocument } from "@/lib/ai-ui-builder/document/types"
import { validateBuilderDocument } from "@/lib/ai-ui-builder/document/validate"

interface BuilderState {
  document: BuilderDocument
  patchHistory: BuilderPatch[]
  selectedNodeId: string | null
  undoStack: BuilderDocument[]
  redoStack: BuilderDocument[]
  validationErrors: string[]
  applyPatch: (patch: BuilderPatch) => void
  applyPatches: (patches: BuilderPatch[]) => void
  selectNode: (nodeId: string | null) => void
  undo: () => void
  redo: () => void
  setDocument: (doc: BuilderDocument) => void
}

const BuilderContext = createContext<BuilderState | null>(null)

export function BuilderProvider({
  children,
  initialDocument,
}: {
  children: React.ReactNode
  initialDocument?: BuilderDocument
}) {
  const [document, setDocumentState] = useState<BuilderDocument>(initialDocument ?? createDefaultBuilderDocument())
  const [patchHistory, setPatchHistory] = useState<BuilderPatch[]>([])
  const [undoStack, setUndoStack] = useState<BuilderDocument[]>([])
  const [redoStack, setRedoStack] = useState<BuilderDocument[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  const syncValidation = useCallback((next: BuilderDocument) => {
    const validation = validateBuilderDocument(next)
    setValidationErrors(validation.ok ? [] : validation.errors)
  }, [])

  const setDocument = useCallback((next: BuilderDocument) => {
    setDocumentState(next)
    syncValidation(next)
  }, [syncValidation])

  const applyPatch = useCallback(
    (patch: BuilderPatch) => {
      const result = applyBuilderPatch(document, patch)
      if (!result.ok) {
        setValidationErrors(result.error ? [result.error] : ["Patch failed"])
        return
      }
      const nextDocument = {
        ...result.document,
        history: [...result.document.history, patch],
      }
      setUndoStack((prev) => [...prev, document])
      setRedoStack([])
      setPatchHistory((prev) => [...prev, patch])
      setDocument(nextDocument)
    },
    [document, setDocument],
  )

  const applyPatches = useCallback(
    (patches: BuilderPatch[]) => {
      if (patches.length === 0) return
      const result = applyBuilderPatches(document, patches)
      if (!result.ok) {
        setValidationErrors(result.error ? [result.error] : ["Patch failed"])
        return
      }
      const nextDocument = {
        ...result.document,
        history: [...result.document.history, ...patches],
      }
      setUndoStack((prev) => [...prev, document])
      setRedoStack([])
      setPatchHistory((prev) => [...prev, ...patches])
      setDocument(nextDocument)
    },
    [document, setDocument],
  )

  const undo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev
      const next = prev[prev.length - 1]
      setRedoStack((redo) => [...redo, document])
      setDocumentState(next)
      syncValidation(next)
      return prev.slice(0, -1)
    })
  }, [document, syncValidation])

  const redo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev
      const next = prev[prev.length - 1]
      setUndoStack((undoPrev) => [...undoPrev, document])
      setDocumentState(next)
      syncValidation(next)
      return prev.slice(0, -1)
    })
  }, [document, syncValidation])

  const value = useMemo<BuilderState>(
    () => ({
      document,
      patchHistory,
      selectedNodeId,
      undoStack,
      redoStack,
      validationErrors,
      applyPatch,
      applyPatches,
      selectNode: setSelectedNodeId,
      undo,
      redo,
      setDocument,
    }),
    [document, patchHistory, selectedNodeId, undoStack, redoStack, validationErrors, applyPatch, applyPatches, undo, redo, setDocument],
  )

  return <BuilderContext.Provider value={value}>{children}</BuilderContext.Provider>
}

export function useBuilderState() {
  const ctx = useContext(BuilderContext)
  if (!ctx) throw new Error("useBuilderState must be used within BuilderProvider")
  return ctx
}
