"use client"

import React, { useEffect, useState } from "react"
import { createPortal } from "react-dom"

export function IframePortal({
  iframe,
  children,
}: {
  iframe: HTMLIFrameElement | null
  children: React.ReactNode
}) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (iframe?.contentDocument) setMounted(true)
  }, [iframe])

  if (!iframe?.contentDocument || !mounted) return null
  return createPortal(children, iframe.contentDocument.body)
}
