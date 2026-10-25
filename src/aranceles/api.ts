import { api } from '@wasichai/core'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { TramosCollection } from './tipos'

// the tramos of the vías with the arancel of one year; core's client adds the /api base and the Bearer token.
// brechas asks for them only while its «Vías con arancel» layer is on
export function useArancelesVia(anio: number | undefined, enabled = true) {
  return useQuery({
    queryKey: ['aranceles-via', anio],
    enabled: enabled && anio !== undefined,
    queryFn: () => api<TramosCollection>(`/catastro/vias/aranceles?anio=${anio}`),
    // the map keeps the last year's lines while the new year loads
    placeholderData: keepPreviousData,
    retry: false
  })
}
