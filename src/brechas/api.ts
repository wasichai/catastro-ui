import { ApiError, api, type ApiClient } from '@wasichai/core'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CapaGis, Corte, Decision, Ficha, Filtros, LotesCollection, Orden, Pagina, Panel, ResultadoDecision, ServiciosGeoServer } from './tipos'

const BASE = '/catastro/brechas'

export const FILTROS_VACIOS: Filtros = { categoria: [], confianza: [], estado: [], sector: '', supera_5_uit: '', min_delta: '' }

// the query string of /fichas, /lotes and /fichas.csv: only the filters that are set; the multi-valued ones go
// comma-separated, as the API takes them
export function parametros(corte: string | undefined, filtros: Filtros, extra: Record<string, string | number> = {}): URLSearchParams {
  const p = new URLSearchParams()
  if (corte) p.set('corte', corte)
  for (const campo of ['categoria', 'confianza', 'estado'] as const) if (filtros[campo].length) p.set(campo, filtros[campo].join(','))
  if (filtros.sector.trim()) p.set('sector', filtros.sector.trim())
  if (filtros.supera_5_uit) p.set('supera_5_uit', filtros.supera_5_uit)
  if (filtros.min_delta.trim() && Number.isFinite(Number(filtros.min_delta))) p.set('min_delta', filtros.min_delta.trim())
  for (const [k, v] of Object.entries(extra)) p.set(k, String(v))
  return p
}

// no corte loaded yet: /panel, /fichas and /lotes answer 404
export const sinCortes = (error: unknown) => error instanceof ApiError && error.status === 404

export function useCortes() {
  return useQuery({ queryKey: ['brechas', 'cortes'], queryFn: () => api<Corte[]>(`${BASE}/cortes`), retry: false })
}

export function usePanel(corte: string | undefined) {
  return useQuery({
    queryKey: ['brechas', 'panel', corte],
    queryFn: () => api<Panel>(`${BASE}/panel?${parametros(corte, FILTROS_VACIOS)}`),
    enabled: !!corte,
    placeholderData: keepPreviousData,
    retry: false
  })
}

export function useFichas(corte: string | undefined, filtros: Filtros, orden: Orden, page: number, size: number) {
  const qs = parametros(corte, filtros, { orden, page, size }).toString()
  return useQuery({
    queryKey: ['brechas', 'fichas', qs],
    queryFn: () => api<Pagina<Ficha>>(`${BASE}/fichas?${qs}`),
    enabled: !!corte,
    placeholderData: keepPreviousData,
    retry: false
  })
}

// a DECIMAL may come as text: the map's step needs numbers
function conDeltaNumerico(d: LotesCollection): LotesCollection {
  return {
    ...d,
    features: d.features.map((f) => {
      const v = f.properties.delta_impuesto as unknown
      return v === null || v === undefined || typeof v === 'number' ? f : { ...f, properties: { ...f.properties, delta_impuesto: Number(v) } }
    })
  }
}

export function useLotes(corte: string | undefined, filtros: Filtros) {
  const qs = parametros(corte, filtros).toString()
  return useQuery({
    queryKey: ['brechas', 'lotes', qs],
    queryFn: () => api<LotesCollection>(`${BASE}/lotes?${qs}`),
    select: conDeltaNumerico,
    enabled: !!corte,
    // the map keeps the last lotes while the new filter loads
    placeholderData: keepPreviousData,
    retry: false
  })
}

// the same cache keys as @wasichai/gis' «Capas» page
export function useServiciosGeoServer() {
  return useQuery({ queryKey: ['gis', 'services'], queryFn: () => api<ServiciosGeoServer>('/gis/services'), retry: false })
}

export function useCapasGis(enabled: boolean) {
  return useQuery({ queryKey: ['gis', 'layers'], queryFn: () => api<CapaGis[]>('/gis/layers'), enabled, retry: false })
}

// a decision refreshes everything the dashboard shows of the corte: panel, fichas and lotes
export function useDecidir() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (d: Decision) => api<ResultadoDecision>(`${BASE}/decisiones`, { method: 'POST', body: JSON.stringify(d) }),
    onSuccess: () =>
      cliente.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'brechas' && ['panel', 'fichas', 'lotes'].includes(q.queryKey[1] as string) })
  })
}

function nombreDeArchivo(respuesta: Response, corte: string | undefined): string {
  const disposicion = respuesta.headers.get('Content-Disposition') ?? ''
  const nombre = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposicion)?.[1]
  return nombre ? decodeURIComponent(nombre) : `brechas-${corte ?? 'corte'}.csv`
}

// the CSV needs the Bearer token, so a plain link cannot download it: the file is fetched with core's token and
// handed to the browser as a blob
export async function descargarCsv(cliente: Pick<ApiClient, 'baseUrl' | 'getToken'>, corte: string | undefined, filtros: Filtros, orden: Orden) {
  const headers = new Headers({ Accept: 'text/csv' })
  const token = cliente.getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const respuesta = await fetch(`${cliente.baseUrl}${BASE}/fichas.csv?${parametros(corte, filtros, { orden })}`, { headers })
  if (!respuesta.ok) throw new ApiError(respuesta.status, respuesta.statusText)
  const url = URL.createObjectURL(await respuesta.blob())
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreDeArchivo(respuesta, corte)
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(url)
}
