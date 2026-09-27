import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useBackToClose } from './backStack'

type Props = {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

/** A full-screen panel that slides over the current screen. */
export function Sheet({ title, onClose, children, footer }: Props) {
  const titleId = useId()
  const ref = useRef<HTMLDivElement>(null)
  useBackToClose(onClose)

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
      previousFocus?.focus?.()
    }
  }, [])

  return createPortal(
    <div
      className="sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      ref={ref}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onClose()
        }
      }}
    >
      <header className="sheet-head">
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          <X size={22} aria-hidden="true" />
        </button>
        <h2 id={titleId}>{title}</h2>
        <span className="icon-btn-spacer" aria-hidden="true" />
      </header>
      <div className="sheet-body">{children}</div>
      {footer && <div className="sheet-foot">{footer}</div>}
    </div>,
    document.body,
  )
}
