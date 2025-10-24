import { createPortal } from 'react-dom'
import { useEffect, useRef } from 'react'

type NotificationDialogProps = {
  isOpen: boolean
  title: string
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement>
  children: React.ReactNode
}

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input[type="text"]:not([disabled])',
  'input[type="radio"]:not([disabled])',
  'input[type="checkbox"]:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function NotificationDialog({
  isOpen,
  title,
  onClose,
  anchorRef,
  children,
}: NotificationDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const titleIdRef = useRef(`notification-dialog-${Math.random().toString(36).slice(2)}`)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    previousFocusRef.current = (document.activeElement as HTMLElement | null) ?? null

    const dialogNode = dialogRef.current

    const focusFirstElement = () => {
      if (!dialogNode) {
        return
      }
      const focusable = dialogNode.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
      if (focusable.length > 0) {
        focusable[0].focus({ preventScroll: true })
      } else {
        dialogNode.focus({ preventScroll: true })
      }
    }

    focusFirstElement()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab' || !dialogNode) {
        return
      }

      const focusable = dialogNode.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
      if (focusable.length === 0) {
        event.preventDefault()
        dialogNode.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault()
          last.focus()
        }
      } else if (document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!dialogNode) {
        return
      }

      const target = event.target as Node | null
      if (target && !dialogNode.contains(target)) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
    }
  }, [isOpen, onClose])

  useEffect(() => {
    if (isOpen) {
      return
    }

    const anchor = anchorRef.current
    const previous = previousFocusRef.current

    const fallback = anchor ?? previous

    if (fallback && typeof fallback.focus === 'function') {
      fallback.focus({ preventScroll: true })
    }

    previousFocusRef.current = null
  }, [isOpen, anchorRef])

  if (!isOpen) {
    return null
  }

  const dialog = (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-4 py-6 sm:items-start sm:justify-end sm:px-6">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" aria-hidden="true"></div>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleIdRef.current}
        className="relative z-10 flex w-full max-w-lg flex-col gap-4 rounded-t-3xl border border-white/10 bg-slate-900/95 p-5 shadow-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 sm:max-w-sm sm:rounded-3xl"
        tabIndex={-1}
      >
        <div className="flex items-center justify-between gap-2">
          <span id={titleIdRef.current} className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {title}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:border-white/20 hover:text-white"
          >
            Close
          </button>
        </div>
        <div className="-mx-1 max-h-[60vh] space-y-3 overflow-y-auto pr-1 text-sm" role="document">
          {children}
        </div>
      </div>
    </div>
  )

  return createPortal(dialog, document.body)
}

