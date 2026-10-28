import { useSyncExternalStore } from 'react'

// tailwind's md, the breakpoint the pages already use: below it the screen is narrow
export const ANCHA = '(min-width: 48rem)'

const sinMedia = () => typeof window === 'undefined' || typeof window.matchMedia !== 'function'

function suscribir(avisar: () => void) {
  if (sinMedia()) return () => {}
  const m = window.matchMedia(ANCHA)
  m.addEventListener('change', avisar)
  return () => m.removeEventListener('change', avisar)
}

// whether the screen is at least md wide, following it when it changes. without matchMedia (jsdom) it is wide
export function usePantallaAncha(): boolean {
  return useSyncExternalStore(
    suscribir,
    () => sinMedia() || window.matchMedia(ANCHA).matches,
    () => true
  )
}
