import type { ReactNode } from 'react'

type BadgeProps = {
  children: ReactNode
  tone?: 'default' | 'muted'
  className?: string
}

export function Badge({ children, tone = 'default', className = '' }: BadgeProps) {
  const baseClass =
    'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide'
  const toneClass = tone === 'muted' ? 'border-white/10 text-slate-300' : ''

  return <span className={`${baseClass} ${toneClass} ${className}`}>{children}</span>
}
