"use client"

import React from "react"
import type { ComponentNode } from "../catalog/components"
import { COMPONENT_CATALOG } from "../catalog/components"
import { RuntimeComponents } from "./registry"

function pickProps(node: ComponentNode): Record<string, unknown> {
  const allowed = COMPONENT_CATALOG[node.component]?.allowedProps ?? []
  const props: Record<string, unknown> = {}
  for (const key of allowed) {
    const value = node.props?.[key]
    if (value === undefined) continue
    if (typeof value === "function") continue
    if (key === "class" && typeof value === "string") {
      props.className = value
      continue
    }
    props[key] = value
  }
  return props
}

export function renderComponentNode(node: ComponentNode): React.ReactNode {
  const Component = RuntimeComponents[node.component as keyof typeof RuntimeComponents] ?? RuntimeComponents.Container
  const props = pickProps(node)
  if (node.component === "Heading" && typeof props.level !== "number") {
    props.level = 2
  }
  if (node.component === "Link" && typeof props.href !== "string") {
    props.href = "#"
  }
  if (node.component === "Section" && typeof props.anchor === "string" && typeof props.id !== "string") {
    props.id = props.anchor
  }
  const children: React.ReactNode[] = []
  if (node.text) children.push(node.text)
  for (const child of node.children ?? []) {
    children.push(renderComponentNode(child))
  }
  return (
    <Component key={node.id} {...props}>
      {children.length ? children : undefined}
    </Component>
  )
}

export function renderPageTree(tree: ComponentNode): React.ReactNode {
  return renderComponentNode(tree)
}
