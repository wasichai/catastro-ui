import type { ExpressionSpecification } from 'maplibre-gl'
import { soles } from './formato'

// the sequential palette of the maps (light to dark = cheaper to dearer) and its quantile classes. fixed hex because
// maplibre does not read the oklch of wasichai's themes; the theme tokens have no sequential scale
export const PALETA = ['#fee391', '#fec44f', '#fe9929', '#d95f0e', '#993404'] as const
export const GRIS = '#9ca3af'

export const CLASES = PALETA.length

// the 4 cut points that split the values into 5 quantile classes, in whole soles, strictly ascending (maplibre's step
// needs that): repeated values collapse, so there may be fewer than 5 classes, or none
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

// the numeric values of one property of the features
export function valoresDe(features: { properties: object }[], campo = 'valor_m2'): number[] {
  return features.flatMap((f) => {
    const v = (f.properties as Record<string, unknown>)[campo]
    return typeof v === 'number' ? [v] : []
  })
}

export interface ClaseLeyenda {
  color: string
  etiqueta: string
}

const enteros = (n: number) => soles(n, { minimo: 0, maximo: 0 })

// one legend entry per class, the same colour the map paints it with
export function clasesDeLeyenda(cortesDados: number[], hayValores = true): ClaseLeyenda[] {
  // no values paints every line grey: no class to show
  if (!hayValores) return []
  if (!cortesDados.length) return [{ color: PALETA[PALETA.length - 1]!, etiqueta: 'Todos los valores' }]
  const ultimo = cortesDados.length
  return Array.from({ length: ultimo + 1 }, (_, i) => ({
    color: PALETA[i]!,
    etiqueta:
      i === 0
        ? `Menos de ${enteros(cortesDados[0]!)}`
        : i === ultimo
          ? `${enteros(cortesDados[ultimo - 1]!)} o más`
          : `${enteros(cortesDados[i - 1]!)} a menos de ${enteros(cortesDados[i]!)}`
  }))
}

// a step on a numeric property over the cuts
export function colorPorValor(cortesDados: number[], campo = 'valor_m2'): ExpressionSpecification {
  if (!cortesDados.length) return PALETA[PALETA.length - 1]! as unknown as ExpressionSpecification
  const pasos = cortesDados.flatMap((corte, i) => [corte, PALETA[i + 1]!])
  return ['step', ['get', campo], PALETA[0], ...pasos] as unknown as ExpressionSpecification
}
