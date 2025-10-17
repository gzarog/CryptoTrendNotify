import { forwardRef } from 'react'

import { cn } from '../../lib/utils'

export const Card = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'group rounded-3xl border border-white/10 bg-card/75 p-6 text-card-foreground shadow-[0_25px_45px_-35px_rgba(15,23,42,0.7)] backdrop-blur transition hover:border-white/20 hover:shadow-[0_35px_65px_-35px_rgba(14,116,144,0.5)]',
        className,
      )}
      {...props}
    />
  ),
)

Card.displayName = 'Card'

export const CardHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col gap-1 text-left', className)} {...props} />
  ),
)

CardHeader.displayName = 'CardHeader'

export const CardTitle = forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('text-lg font-semibold tracking-tight text-white', className)} {...props} />
  ),
)

CardTitle.displayName = 'CardTitle'

export const CardDescription = forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
  ),
)

CardDescription.displayName = 'CardDescription'

export const CardContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('mt-4 flex flex-col gap-4', className)} {...props} />,
)

CardContent.displayName = 'CardContent'
