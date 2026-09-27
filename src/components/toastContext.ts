import { createContext, useContext } from 'react'

export type ToastKind = 'ok' | 'error'
export type Show = (text: string, kind?: ToastKind) => void

export const ToastContext = createContext<Show>(() => {})

/** Shows a short message at the bottom of the screen. */
export function useToast(): Show {
  return useContext(ToastContext)
}
