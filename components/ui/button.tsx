import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-1 focus-visible:ring-ring active:scale-[0.97] cursor-pointer",
  {
    variants: {
      variant: {
        default:
          'bg-foreground text-background border border-foreground hover:bg-foreground/90',
        secondary:
          'bg-surface text-foreground border border-border hover:bg-surface-muted',
        ghost:
          'bg-transparent text-text-secondary border border-transparent hover:bg-surface-muted hover:text-foreground',
        outline:
          'border border-border bg-surface text-foreground hover:bg-surface-muted',
        destructive:
          'bg-surface text-destructive border border-border hover:bg-destructive/10',
        link: 'text-foreground underline-offset-4 hover:underline border-transparent bg-transparent',
      },
      size: {
        default: 'h-[44px] px-4 rounded-[18px] text-sm',
        sm: 'h-9 px-3 rounded-[14px] text-xs gap-1.5',
        lg: 'h-12 px-6 rounded-[20px] text-base gap-2.5',
        icon: 'size-[44px] rounded-[18px] p-0',
        'icon-sm': 'size-9 rounded-[14px] p-0',
        'icon-lg': 'size-12 rounded-[20px] p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

function Button({

  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
