import React from "react"
import type { BuilderNode } from "../document/types"
import { builderRegistry } from "./registry"

export function renderBuilderNode(node: BuilderNode): React.ReactNode {
  const Component = builderRegistry[node.component] ?? "div"
  const children = node.children?.map((child) => <React.Fragment key={child.id}>{renderBuilderNode(child)}</React.Fragment>)
  if (node.text) {
    return React.createElement(Component, { ...node.props, "data-node-id": node.id }, node.text, children)
  }
  return React.createElement(Component, { ...node.props, "data-node-id": node.id }, children)
}
