import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'file:text-foreground placeholder:text-text-muted selection:bg-foreground selection:text-background bg-surface border-border text-foreground h-11 w-full min-w-0 rounded-[14px] border px-3.5 py-2 text-sm shadow-xs transition-colors outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:border-border-strong focus-visible:ring-1 focus-visible:ring-border-strong',
        'aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
