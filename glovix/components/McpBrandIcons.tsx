'use client'

import { cn } from '@/lib/utils'
import { getMcpProvider } from '@/lib/mcp-providers'

export function McpBrandIcon({
  id,
  name,
  className,
}: {
  id: string
  name?: string
  className?: string
}) {
  const provider = getMcpProvider(id) || (name ? getMcpProvider(name) : undefined)
  const src = provider?.logo
  const label = provider?.name || name || id

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        title={label}
        className={cn('h-4 w-4 object-contain', className)}
        draggable={false}
      />
    )
  }

  return (
    <span
      className={cn(
        'inline-flex h-4 w-4 items-center justify-center rounded-[4px] bg-white/10 text-[9px] font-bold uppercase text-white/80',
        className,
      )}
      aria-hidden
    >
      {label.slice(0, 1)}
    </span>
  )
}
