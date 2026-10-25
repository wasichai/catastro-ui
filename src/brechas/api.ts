import { ApiError, api, type ApiClient } from '@wasichai/core'
import { useMutation, useQuery, useQueryClient, type Query } from '@tanstack/react-query'
import { minimoValido } from './colores'
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
  if (minimoValido(filtros.min_delta) !== null) p.set('min_delta', filtros.min_delta.trim())
  for (const [k, v] of Object.entries(extra)) p.set(k, String(v))
  return p
}

// no corte loaded yet: /panel, /fichas and /lotes answer 404
export const sinCortes = (error: unknown) => error instanceof ApiError && error.status === 404

// the last data stays on screen while the next loads, but only within the same corte (queryKey[2]): data of another
// corte would let a decision go with the wrong year
const delMismoCorte =
  <T>(corte: string | undefined) =>
  (anterior: T | undefined, consulta: Query<T, Error, T, readonly unknown[]> | undefined) =>
    consulta?.queryKey[2] === corte ? anterior : undefined

export function useCortes() {
  return useQuery({ queryKey: ['brechas', 'cortes'], queryFn: () => api<Corte[]>(`${BASE}/cortes`), retry: false })
}

export function usePanel(corte: string | undefined) {
  return useQuery({
    queryKey: ['brechas', 'panel', corte],
    queryFn: () => api<Panel>(`${BASE}/panel?${parametros(corte, FILTROS_VACIOS)}`),
    enabled: !!corte,
    retry: false
  })
}

export function useFichas(corte: string | undefined, filtros: Filtros, orden: Orden, page: number, size: number) {
  const qs = parametros(corte, filtros, { orden, page, size }).toString()
  return useQuery({
    queryKey: ['brechas', 'fichas', corte, qs],
    queryFn: () => api<Pagina<Ficha>>(`${BASE}/fichas?${qs}`),
    enabled: !!corte,
    placeholderData: delMismoCorte<Pagina<Ficha>>(corte),
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

// the lotes of a corte weigh megabytes: they come once per corte and sector (the lotes do not carry it), and the map
// applies the other filters itself (filtroDeLotes). a decision invalidates them, since they carry the estado
export function useLotes(corte: string | undefined, sector: string) {
  const qs = parametros(corte, { ...FILTROS_VACIOS, sector }).toString()
  return useQuery({
    queryKey: ['brechas', 'lotes', corte, qs],
    queryFn: () => api<LotesCollection>(`${BASE}/lotes?${qs}`),
    select: conDeltaNumerico,
    enabled: !!corte,
    staleTime: 5 * 60_000,
    placeholderData: delMismoCorte<LotesCollection>(corte),
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

// the API writes a decision per code, one after another: 500 codes take a while. the client waits up to 2 minutes
export const ESPERA_DECISION_MS = 120_000

// a decision refreshes everything the dashboard shows of the corte: panel, fichas and lotes. the result shows at
// once; the refetch does not hold it
export function useDecidir() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (d: Decision) =>
      api<ResultadoDecision>(`${BASE}/decisiones`, { method: 'POST', body: JSON.stringify(d), signal: AbortSignal.timeout(ESPERA_DECISION_MS) }),
    onSuccess: () => {
      void cliente.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'brechas' && ['panel', 'fichas', 'lotes'].includes(q.queryKey[1] as string) })
    }
  })
}

// a name the file systems take: no | (the corte's key has one), / or the like
const nombreSeguro = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '_')

function nombreDeArchivo(respuesta: Response, corte: string | undefined): string {
  const disposicion = respuesta.headers.get('Content-Disposition') ?? ''
  const nombre = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposicion)?.[1]
  if (nombre) {
    try {
      return nombreSeguro(decodeURIComponent(nombre))
    } catch {
      // a stray % in the name: take it as it came
      return nombreSeguro(nombre)
    }
  }
  return nombreSeguro(`brechas-${corte ?? 'corte'}.csv`)
}

// the CSV needs the Bearer token, so a plain link cannot download it: the file is fetched with core's token and
// handed to the browser as a blob. a 401 drops the token, as core's api() does: the next request signs the user out
export async function descargarCsv(cliente: Pick<ApiClient, 'baseUrl' | 'getToken' | 'setToken'>, corte: string | undefined, filtros: Filtros, orden: Orden) {
  const headers = new Headers({ Accept: 'text/csv' })
  const token = cliente.getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const respuesta = await fetch(`${cliente.baseUrl}${BASE}/fichas.csv?${parametros(corte, filtros, { orden })}`, { headers })
  if (respuesta.status === 401) cliente.setToken(null)
  if (!respuesta.ok) throw new ApiError(respuesta.status, respuesta.statusText)
  const url = URL.createObjectURL(await respuesta.blob())
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreDeArchivo(respuesta, corte)
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  // some browsers still read the url after click(): it is revoked on the next tick
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
