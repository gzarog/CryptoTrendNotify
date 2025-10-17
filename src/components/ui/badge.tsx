import { cn } from '../../lib/utils'

type BadgeVariant = 'default' | 'outline' | 'success' | 'warning' | 'danger'

const variantClass: Record<BadgeVariant, string> = {
  default: 'border border-white/15 bg-white/10 text-xs font-semibold text-primary-foreground',
  outline: 'border border-white/15 bg-transparent text-xs font-semibold text-foreground',
  success: 'border border-emerald-500/20 bg-emerald-500/10 text-xs font-semibold text-emerald-200',
  warning: 'border border-amber-500/20 bg-amber-500/10 text-xs font-semibold text-amber-200',
  danger: 'border border-rose-500/20 bg-rose-500/10 text-xs font-semibold text-rose-200',
}

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-3 py-1 uppercase tracking-[0.18em]',
        variantClass[variant],
        className,
      )}
      {...props}
    />
  )
}
