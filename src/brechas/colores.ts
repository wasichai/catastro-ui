import type { ExpressionSpecification } from 'maplibre-gl'
import { GRIS, type ClaseLeyenda } from '../comun/colores'
import { soles } from '../comun/formato'
import type { Categoria, Confianza, Estado, Filtros } from './tipos'

// the fixed categorical colours of the dashboard: the map, its legend, the chips and the bars all read them from here.
// hex, like the aranceles palette, because maplibre does not read the oklch of wasichai's themes. OMISO (red) and
// COINCIDE (teal) are told apart with deuteranopia too
export const COLOR_CATEGORIA: Record<Categoria, string> = {
  OMISO: '#e15759',
  SUBVALUADO: '#f28e2b',
  SIN_VALOR: '#edc948',
  SIN_CATASTRO: '#b07aa1',
  SOBREVALUADO: '#4e79a7',
  COINCIDE: '#76b7b2',
  SIN_LEVANTAR: GRIS
}

export const COLOR_CONFIANZA: Record<Confianza, string> = { CONFIABLE: '#4e79a7', DUDOSO: '#f28e2b', SIN_LEVANTAR: GRIS }

export const COLOR_ESTADO: Record<Estado, string> = {
  PENDIENTE: '#76b7b2',
  A_INSPECCIONAR: '#f28e2b',
  INSPECCIONADO: '#4e79a7',
  A_FISCALIZAR: '#e15759',
  DESCARTADO: GRIS
}

export const ETIQUETA_CATEGORIA: Record<Categoria, string> = {
  OMISO: 'Omiso',
  SIN_CATASTRO: 'Sin catastro',
  SIN_VALOR: 'Sin valor',
  SUBVALUADO: 'Subvaluado',
  SOBREVALUADO: 'Sobrevaluado',
  COINCIDE: 'Coincide',
  SIN_LEVANTAR: 'Sin levantar'
}

export const ETIQUETA_CONFIANZA: Record<Confianza, string> = { CONFIABLE: 'Confiable', DUDOSO: 'Dudoso', SIN_LEVANTAR: 'Sin levantar' }

// cortes before srtm#204 have fichas without confianza
export const etiquetaConfianza = (c: Confianza | null | undefined) => (c ? (ETIQUETA_CONFIANZA[c] ?? c) : 'Sin confianza')
export const colorConfianza = (c: Confianza | null | undefined) => (c ? (COLOR_CONFIANZA[c] ?? GRIS) : GRIS)

export const ETIQUETA_ESTADO: Record<Estado, string> = {
  PENDIENTE: 'Pendiente',
  A_INSPECCIONAR: 'A inspeccionar',
  INSPECCIONADO: 'Inspeccionado',
  A_FISCALIZAR: 'A fiscalizar',
  DESCARTADO: 'Descartado'
}

// the selected lotes: a magenta outline, outside every palette and visible on the basemap and in both themes
export const COLOR_SELECCION = '#d100d1'

// the difference of impuesto (catastro − declarado) on a diverging scale centred on 0: reds where catastro would
// charge more (money left on the table), blues where it would charge less, near white for no change. the classes are
// fixed and symmetric, so a colour means the same in every corte and under every filter
export const DIVERGENTE = {
  // strongest to weakest
  baja: ['#2166ac', '#67a9cf', '#d1e5f0'],
  // a light grey, not white: the lotes «sin cambio» (most of them) stay visible on the basemap
  neutro: '#e0e0e0',
  // weakest to strongest
  sube: ['#fddbc7', '#ef8a62', '#b2182b']
} as const

// below S/ 1 either way is «no change»
export const UMBRAL = 1
export const MAGNITUDES = [50, 500] as const

const [A, B] = MAGNITUDES

export function colorDelta(): ExpressionSpecification {
  const { baja, neutro, sube } = DIVERGENTE
  return [
    'case',
    ['==', ['typeof', ['get', 'delta_impuesto']], 'number'],
    ['step', ['get', 'delta_impuesto'], baja[0], -B, baja[1], -A, baja[2], -UMBRAL, neutro, UMBRAL, sube[0], A, sube[1], B, sube[2]],
    GRIS
  ] as ExpressionSpecification
}

const s = (n: number) => soles(n, { minimo: 0, maximo: 0, signo: true })

// the legend of the diverging scale, from the largest rise to the largest drop
export const LEYENDA_DELTA: ClaseLeyenda[] = [
  { color: DIVERGENTE.sube[2], etiqueta: `${s(B)} o más` },
  { color: DIVERGENTE.sube[1], etiqueta: `${s(A)} a ${s(B)}` },
  { color: DIVERGENTE.sube[0], etiqueta: `${s(UMBRAL)} a ${s(A)}` },
  { color: DIVERGENTE.neutro, etiqueta: `Sin cambio (${s(-UMBRAL)} a ${s(UMBRAL)})` },
  { color: DIVERGENTE.baja[2], etiqueta: `${s(-A)} a ${s(-UMBRAL)}` },
  { color: DIVERGENTE.baja[1], etiqueta: `${s(-B)} a ${s(-A)}` },
  { color: DIVERGENTE.baja[0], etiqueta: `Menos de ${s(-B)}` },
  { color: GRIS, etiqueta: 'Sin dato (sin levantar)' }
]

// the colour of a difference outside the map (the bars of the sectores): the strongest of its side
export const colorDeSigno = (n: number) => (n < 0 ? DIVERGENTE.baja[0] : DIVERGENTE.sube[2])

export type Colorear = 'categoria' | 'delta' | 'confianza' | 'estado'

export const COLOREAR: Record<Colorear, string> = {
  categoria: 'Categoría',
  delta: 'Diferencia de impuesto (catastro − declarado)',
  confianza: 'Confianza',
  estado: 'Estado'
}

const CATEGORICOS = {
  categoria: [COLOR_CATEGORIA, ETIQUETA_CATEGORIA],
  confianza: [COLOR_CONFIANZA, ETIQUETA_CONFIANZA],
  estado: [COLOR_ESTADO, ETIQUETA_ESTADO]
} as const

// the fill of a lote under each colouring: a match on the key, or the diverging scale of the difference
export function colorDeLote(modo: Colorear): ExpressionSpecification {
  if (modo === 'delta') return colorDelta()
  return ['match', ['get', modo], ...Object.entries(CATEGORICOS[modo][0]).flat(), GRIS] as unknown as ExpressionSpecification
}

// the legend entries of a colouring, the same colours the map paints with
export function leyendaDe(modo: Colorear): ClaseLeyenda[] {
  if (modo === 'delta') return LEYENDA_DELTA
  const [colores, etiquetas] = CATEGORICOS[modo]
  return Object.entries(colores).map(([clave, color]) => ({ color, etiqueta: (etiquetas as Record<string, string>)[clave]! }))
}

// the minimum difference the user typed, when it is a number of 0 or more; the API refuses a negative one
export function minimoValido(texto: string): number | null {
  const n = Number(texto)
  return texto.trim() && Number.isFinite(n) && n >= 0 ? n : null
}

// the lotes come once per corte (and sector, which they do not carry): the other filters are applied on the map, the
// same as the API applies them to the fichas. null = no filter
export function filtroDeLotes(f: Filtros): ExpressionSpecification | null {
  const condiciones: unknown[] = []
  for (const campo of ['categoria', 'confianza', 'estado'] as const) if (f[campo].length) condiciones.push(['in', ['get', campo], ['literal', f[campo]]])
  // as the API: a lote without supera_5_uit (a corte without UIT) counts as not over
  if (f.supera_5_uit === 'true') condiciones.push(['==', ['get', 'supera_5_uit'], true])
  if (f.supera_5_uit === 'false') condiciones.push(['!=', ['get', 'supera_5_uit'], true])
  // as the API: a minimum leaves out the lotes without a difference
  const minimo = minimoValido(f.min_delta)
  if (minimo !== null) condiciones.push(['all', ['==', ['typeof', ['get', 'delta_impuesto']], 'number'], ['>=', ['abs', ['get', 'delta_impuesto']], minimo]])
  return condiciones.length ? (['all', ...condiciones] as ExpressionSpecification) : null
}
