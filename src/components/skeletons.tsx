type SkeletonProps = {
  className?: string
}

function baseClasses(additional?: string) {
  return ['animate-pulse bg-slate-700/40', additional].filter(Boolean).join(' ')
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={baseClasses(className)} aria-hidden="true" />
}

type ChartSkeletonProps = {
  className?: string
}

export function ChartSkeleton({ className }: ChartSkeletonProps) {
  return (
    <div
      className={`flex h-full min-h-[260px] flex-col gap-4 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 p-6 ${
        className ?? ''
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-40 rounded-md" />
          <Skeleton className="h-3 w-24 rounded-md" />
        </div>
        <Skeleton className="h-7 w-24 rounded-full" />
      </div>
      <div className="flex flex-1 flex-col gap-3">
        <Skeleton className="h-3 w-16 rounded-full" />
        <Skeleton className="h-full min-h-[180px] w-full rounded-2xl" />
      </div>
    </div>
  )
}

type SignalCardSkeletonProps = {
  className?: string
}

export function SignalCardSkeleton({ className }: SignalCardSkeletonProps) {
  return (
    <article
      className={`flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4 ${className ?? ''}`}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-32 rounded-md" />
          <Skeleton className="h-5 w-24 rounded-md" />
        </div>
        <div className="flex flex-col items-end gap-2 text-right">
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-3 w-24 rounded-md" />
        </div>
      </header>

      <section className="grid gap-3 text-sm text-slate-200 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-3 w-24 rounded-md" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-full rounded-md" />
            <Skeleton className="h-3 w-11/12 rounded-md" />
            <Skeleton className="h-3 w-9/12 rounded-md" />
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-3 w-24 rounded-md" />
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2 rounded-xl border border-white/5 bg-white/5 p-3">
              <Skeleton className="h-3 w-8 rounded-md" />
              <Skeleton className="h-4 w-20 rounded-md" />
            </div>
            <div className="flex flex-col gap-2 rounded-xl border border-white/5 bg-white/5 p-3">
              <Skeleton className="h-3 w-8 rounded-md" />
              <Skeleton className="h-4 w-20 rounded-md" />
            </div>
          </div>
        </div>
      </section>

      <footer className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-3 w-24 rounded-full" />
        <Skeleton className="h-3 w-20 rounded-full" />
        <Skeleton className="h-3 w-16 rounded-full" />
      </footer>
    </article>
  )
}

