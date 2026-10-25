import type { ExpressionSpecification } from 'maplibre-gl'
import { GRIS, clasesDeLeyenda, colorPorValor, cortes, type ClaseLeyenda } from '../aranceles/colores'
import type { Categoria, Confianza, Estado, LoteFeature } from './tipos'

// the fixed categorical colours of the dashboard: the map, its legend and the bars all read them from here. hex, like
// the aranceles palette, because maplibre does not read the oklch of wasichai's themes
export const COLOR_CATEGORIA: Record<Categoria, string> = {
  OMISO: '#e15759',
  SUBVALUADO: '#f28e2b',
  SIN_VALOR: '#edc948',
  SIN_CATASTRO: '#b07aa1',
  SOBREVALUADO: '#4e79a7',
  COINCIDE: '#59a14f',
  SIN_LEVANTAR: GRIS
}

export const COLOR_CONFIANZA: Record<Confianza, string> = { CONFIABLE: '#59a14f', DUDOSO: '#f28e2b', SIN_LEVANTAR: GRIS }

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

export const ETIQUETA_ESTADO: Record<Estado, string> = {
  PENDIENTE: 'Pendiente',
  A_INSPECCIONAR: 'A inspeccionar',
  INSPECCIONADO: 'Inspeccionado',
  A_FISCALIZAR: 'A fiscalizar',
  DESCARTADO: 'Descartado'
}

// the selected lotes: an outline over whatever colour they have
export const COLOR_SELECCION = '#111827'

export type Colorear = 'categoria' | 'delta' | 'confianza' | 'estado'

export const COLOREAR: Record<Colorear, string> = { categoria: 'Categoría', delta: 'Δ impuesto', confianza: 'Confianza', estado: 'Estado' }

const CATEGORICOS = {
  categoria: [COLOR_CATEGORIA, ETIQUETA_CATEGORIA],
  confianza: [COLOR_CONFIANZA, ETIQUETA_CONFIANZA],
  estado: [COLOR_ESTADO, ETIQUETA_ESTADO]
} as const

function porClave(campo: string, colores: Record<string, string>): ExpressionSpecification {
  return ['match', ['get', campo], ...Object.entries(colores).flat(), GRIS] as unknown as ExpressionSpecification
}

export function deltasDe(features: LoteFeature[]): number[] {
  return features.flatMap((f) => (typeof f.properties.delta_impuesto === 'number' ? [f.properties.delta_impuesto] : []))
}

// the fill of a lote under each colouring: a match on the key, or the aranceles' quantile step on Δ impuesto (grey
// where there is none)
export function colorDeLote(modo: Colorear, cortesDelta: number[]): ExpressionSpecification {
  if (modo === 'delta')
    return ['case', ['==', ['typeof', ['get', 'delta_impuesto']], 'number'], colorPorValor(cortesDelta, 'delta_impuesto'), GRIS] as ExpressionSpecification
  return porClave(modo, CATEGORICOS[modo][0])
}

// the legend entries of a colouring, the same colours the map paints with
export function leyendaDe(modo: Colorear, deltas: number[]): ClaseLeyenda[] {
  if (modo === 'delta') return clasesDeLeyenda(cortes(deltas), deltas.length > 0)
  const [colores, etiquetas] = CATEGORICOS[modo]
  return Object.entries(colores).map(([clave, color]) => ({ color, etiqueta: (etiquetas as Record<string, string>)[clave]! }))
}
