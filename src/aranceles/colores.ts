import type { ExpressionSpecification } from 'maplibre-gl'
import type { TramoFeature } from './tipos'

// the one place where the colours of the map live. a sequential palette (light to dark = cheaper to dearer), fixed
// hex because maplibre does not read the oklch of wasichai's themes; the theme tokens have no sequential scale
export const PALETA = ['#fee391', '#fec44f', '#fe9929', '#d95f0e', '#993404'] as const
export const GRIS = '#9ca3af'

export const CLASES = PALETA.length

// the 4 cut points that split the valor_m2 values into 5 quantile classes, in whole soles, strictly ascending
// (maplibre's step needs that): repeated values collapse, so there may be fewer than 5 classes, or none
export function cortes(valores: number[]): number[] {
  const orden = valores.filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  if (!orden.length) return []
  const cortes: number[] = []
  for (let i = 1; i < CLASES; i++) {
    const corte = Math.round(orden[Math.min(orden.length - 1, Math.floor((i * orden.length) / CLASES))]!)
    if (!cortes.length || corte > cortes[cortes.length - 1]!) cortes.push(corte)
  }
  // a cut at the minimum would leave the first class empty
  while (cortes.length && cortes[0]! <= Math.round(orden[0]!)) cortes.shift()
  return cortes
}

export function valoresDe(features: TramoFeature[]): number[] {
  return features.flatMap((f) => (typeof f.properties.valor_m2 === 'number' ? [f.properties.valor_m2] : []))
}

export interface ClaseLeyenda {
  color: string
  etiqueta: string
}

const soles = (n: number) => `S/ ${n}`

// one legend entry per class, the same colour the map paints it with
export function clasesDeLeyenda(cortesDados: number[], hayValores = true): ClaseLeyenda[] {
  // a year with no values paints every line grey: no class to show
  if (!hayValores) return []
  if (!cortesDados.length) return [{ color: PALETA[PALETA.length - 1]!, etiqueta: 'Todos los valores' }]
  const ultimo = cortesDados.length
  return Array.from({ length: ultimo + 1 }, (_, i) => ({
    color: PALETA[i]!,
    etiqueta:
      i === 0
        ? `Menos de ${soles(cortesDados[0]!)}`
        : i === ultimo
          ? `${soles(cortesDados[ultimo - 1]!)} o más`
          : `${soles(cortesDados[i - 1]!)} a menos de ${soles(cortesDados[i]!)}`
  }))
}

// the colour of a line with an arancel: a step on valor_m2 over the cuts
export function colorPorValor(cortesDados: number[]): ExpressionSpecification {
  if (!cortesDados.length) return PALETA[PALETA.length - 1]! as unknown as ExpressionSpecification
  const pasos = cortesDados.flatMap((corte, i) => [corte, PALETA[i + 1]!])
  return ['step', ['get', 'valor_m2'], PALETA[0], ...pasos] as unknown as ExpressionSpecification
}

// the frentes are drawn beside the eje: izquierdo to the left of the line's direction, derecho to the right
export const DESPLAZAMIENTO_PX = 4
export const DESPLAZAMIENTO: ExpressionSpecification = ['match', ['get', 'lado'], 'IZQUIERDO', -DESPLAZAMIENTO_PX, 'DERECHO', DESPLAZAMIENTO_PX, 0]

const SIN_ASIGNAR: ExpressionSpecification = ['==', ['get', 'asignacion'], 'SIN_ARANCEL']
const CON_VALOR: ExpressionSpecification = ['==', ['typeof', ['get', 'valor_m2']], 'number']

// the three kinds of line, one filter each
export const FILTRO_CON_VALOR: ExpressionSpecification = ['all', ['!', SIN_ASIGNAR], CON_VALOR]
export const FILTRO_SIN_ARANCEL_ANIO: ExpressionSpecification = ['all', ['!', SIN_ASIGNAR], ['!', CON_VALOR]]
export const FILTRO_SIN_ASIGNAR: ExpressionSpecification = SIN_ASIGNAR
