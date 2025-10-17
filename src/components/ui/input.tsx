import { forwardRef } from 'react'

import { cn } from '../../lib/utils'

export type InputProps = React.ComponentPropsWithoutRef<'input'> & {
  leading?: React.ReactNode
  trailing?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', leading, trailing, ...props }, ref) => {
    if (!leading && !trailing) {
      return (
        <input
          ref={ref}
          type={type}
          className={cn(
            'flex h-11 w-full rounded-2xl border border-input bg-background/60 px-4 text-sm font-medium text-foreground shadow-sm transition placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            className,
          )}
          {...props}
        />
      )
    }

    return (
      <div
        className={cn(
          'flex h-11 w-full items-center gap-3 rounded-2xl border border-input bg-background/60 px-4 text-sm font-medium text-foreground shadow-sm ring-offset-background transition focus-within:ring-2 focus-within:ring-ring',
          className,
        )}
      >
        {leading && <span className="text-xs text-muted-foreground">{leading}</span>}
        <input
          ref={ref}
          type={type}
          className="h-full w-full bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-none"
          {...props}
        />
        {trailing && <span className="text-xs text-muted-foreground">{trailing}</span>}
      </div>
    )
  },
)

Input.displayName = 'Input'
