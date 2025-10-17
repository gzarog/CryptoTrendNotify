import { forwardRef } from 'react'
import { Slot } from '@radix-ui/react-slot'

import { cn } from '../../lib/utils'

const baseClass =
  'inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60'

const variantClass: Record<NonNullable<ButtonProps['variant']>, string> = {
  default:
    'bg-primary text-primary-foreground shadow-glow hover:bg-primary/85 hover:shadow-[0_0_0_1px_rgba(148,163,184,0.25)]',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-white/10',
  outline: 'border border-white/20 bg-transparent text-foreground hover:border-white/40 hover:bg-white/5',
  ghost: 'bg-transparent text-foreground hover:bg-white/10',
  destructive: 'bg-destructive text-destructive-foreground shadow-glow hover:bg-destructive/90',
}

const sizeClass: Record<NonNullable<ButtonProps['size']>, string> = {
  default: 'h-11 px-5',
  sm: 'h-9 px-4 text-xs',
  lg: 'h-12 px-6 text-base',
  icon: 'h-11 w-11',
}

export type ButtonProps = {
  asChild?: boolean
  className?: string
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive'
  size?: 'default' | 'sm' | 'lg' | 'icon'
} & React.ComponentPropsWithoutRef<'button'>

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        className={cn(baseClass, variantClass[variant], sizeClass[size], className)}
        {...props}
      />
    )
  },
)

Button.displayName = 'Button'
