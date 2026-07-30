import * as React from "react"

import { cn } from "@/lib/utils"

// Native HTML <select> wrapper styled to match shadcn theme tokens.
// Use this when you want a plain, unstyled-by-the-OS dropdown without the
// full Radix Select primitive (e.g. inside a tight form row, mobile sheet,
// or anywhere a single line is enough).  All standard <select> props pass
// through.
function NativeSelect({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "border-input bg-background text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full appearance-none rounded-md border px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}

export { NativeSelect }
