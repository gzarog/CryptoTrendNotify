import { forwardRef } from 'react'
import * as RadixLabel from '@radix-ui/react-label'

import { cn } from '../../lib/utils'

export type LabelProps = React.ComponentPropsWithoutRef<typeof RadixLabel.Root>

export const Label = forwardRef<React.ElementRef<typeof RadixLabel.Root>, LabelProps>(
  ({ className, ...props }, ref) => (
    <RadixLabel.Root
      ref={ref}
      className={cn(
        'text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground transition peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        className,
      )}
      {...props}
    />
  ),
)

Label.displayName = 'Label'
