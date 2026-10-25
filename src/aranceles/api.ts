import { api } from '@wasichai/core'
import { useQuery } from '@tanstack/react-query'
import type { TramosCollection } from './tipos'

// the tramos of the vías with the arancel of one year; core's client adds the /api base and the Bearer token
export function useArancelesVia(anio: number) {
  return useQuery({
    queryKey: ['aranceles-via', anio],
    queryFn: () => api<TramosCollection>(`/catastro/vias/aranceles?anio=${anio}`),
    retry: false
  })
}
