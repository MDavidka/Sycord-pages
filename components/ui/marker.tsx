import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const markerVariants = cva(
  "group/marker relative flex min-h-4 w-full items-center gap-2 text-left text-sm text-muted-foreground [&_svg:not([class*='size-'])]:size-4 [a]:underline [a]:underline-offset-3 [a]:hover:text-foreground",
  {
    variants: {
      variant: {
        default: '',
        separator:
          'before:mr-1 before:h-px before:min-w-0 before:flex-1 before:bg-border after:ml-1 after:h-px after:min-w-0 after:flex-1 after:bg-border',
        border: 'border-b border-border pb-2',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Marker({
  className,
  variant = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'div'> &
  VariantProps<typeof markerVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'div'

  return <Comp className={cn(markerVariants({ variant }), className)} {...props} />
}

function MarkerIcon({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      aria-hidden
      className={cn('shrink-0 [&_svg]:pointer-events-none', className)}
      {...props}
    />
  )
}

function MarkerContent({ className, ...props }: React.ComponentProps<'span'>) {
  return <span className={cn('min-w-0 flex-1', className)} {...props} />
}

export { Marker, MarkerIcon, MarkerContent, markerVariants }
