export interface StyleNode {
  id: string
  component: string
  label?: string
  variant?: string
  className?: string
  onClick?: string
  children?: StyleNode[]
  [key: string]: string | StyleNode[] | undefined
}

export interface StyleJson {
  root: StyleNode
}

export interface FunctionJson {
  state: string[]
  handlers: Record<string, string>
  render_injections: Record<string, Record<string, string>>
}
