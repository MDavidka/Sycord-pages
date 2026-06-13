import type { BlockConfig } from "@/lib/builder/types"

export function DividerBlock({ block }: { block: BlockConfig }) {
  const { variant } = block
  const height = Number(block.props.height) || 60
  const width = (block.props.width as string) || "full"
  const widthClass = width === "narrow" ? "max-w-32" : width === "centered" ? "max-w-xs" : "w-full"

  if (variant === "space") {
    return <div style={{ height: `${height}px` }} />
  }

  if (variant === "dots") {
    return (
      <div className="flex items-center justify-center gap-2 py-8" style={{ minHeight: `${height}px` }}>
        {[0, 1, 2].map((i) => (
          <span key={i} className="w-1.5 h-1.5 rounded-full bg-text-3" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center" style={{ minHeight: `${height}px` }}>
      <div className={`${widthClass} mx-auto border-t border-border-default`} />
    </div>
  )
}
