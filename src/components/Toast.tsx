import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type Show, type ToastKind } from './toastContext'

type Toast = { id: number; text: string; kind: ToastKind }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null)
  const seq = useRef(0)

  const show = useCallback<Show>((text, kind = 'ok') => {
    setToast({ id: ++seq.current, text, kind })
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), toast.kind === 'error' ? 6000 : 2500)
    return () => clearTimeout(t)
  }, [toast])

  // Last-resort safety net: surface unexpected async errors instead of failing silently.
  useEffect(() => {
    const onRejection = (e: PromiseRejectionEvent) => {
      const msg = e.reason instanceof Error ? e.reason.message : 'Something went wrong.'
      show(msg, 'error')
    }
    window.addEventListener('unhandledrejection', onRejection)
    return () => window.removeEventListener('unhandledrejection', onRejection)
  }, [show])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-region" aria-live="polite" role="status">
        {toast && (
          <div key={toast.id} className={`toast ${toast.kind}`} onClick={() => setToast(null)}>
            {toast.text}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}
