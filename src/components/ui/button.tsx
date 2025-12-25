import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium heroui-transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-heroui-sm hover:bg-primary/90 active:scale-95',
        destructive: 'bg-danger text-danger-foreground shadow-heroui-sm hover:bg-danger/90 active:scale-95',
        outline:
          'border border-divider bg-background dark:bg-content3 shadow-heroui-sm hover:bg-content2 dark:hover:bg-content3 hover:border-primary active:scale-95',
        secondary: 'bg-content2 dark:bg-content3 text-foreground shadow-heroui-sm hover:bg-content3 dark:hover:bg-content4 active:scale-95',
        ghost: 'hover:bg-content2 dark:hover:bg-content3 hover:text-foreground active:scale-95',
        link: 'text-primary underline-offset-4 hover:underline active:scale-95'
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
