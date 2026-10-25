import type { ExpressionSpecification } from 'maplibre-gl'
import { colorExpression, type StyleClasses } from '@wasichai/gis'
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

const enteros = (n: number) => soles(n, { minimo: 0, maximo: 0 })

// the quantile classes of the values in gis' shape (StyleClasses), so the map paints them with gis' colorExpression
// and the legend lists them with legendItems. they are computed here, not by the server's style-classes: the page
// shows the arancel of any year, and the year's values come from GET /vias/aranceles, not from a stored field
export function clasesPorValor(valores: number[], campo = 'valor_m2'): StyleClasses {
  valores = valores.filter((v) => Number.isFinite(v))
  const clases: StyleClasses = { by: campo, type: 'quantiles', classes: [] }
  // no values paints every line grey: no class to show
  if (!valores.length) return clases
  // the first class starts at the smallest value: gis' step paints below it as «other»
  const minimo = Math.floor(valores.reduce((a, b) => Math.min(a, b)))
  const cortesDados = cortes(valores)
  if (!cortesDados.length) return { ...clases, classes: [{ color: PALETA[PALETA.length - 1]!, label: 'Todos los valores', min: minimo }] }
  const ultimo = cortesDados.length
  return {
    ...clases,
    classes: Array.from({ length: ultimo + 1 }, (_, i) => ({
      color: PALETA[i]!,
      min: i === 0 ? minimo : cortesDados[i - 1]!,
      ...(i < ultimo ? { max: cortesDados[i]! } : {}),
      label:
        i === 0
          ? `Menos de ${enteros(cortesDados[0]!)}`
          : i === ultimo
            ? `${enteros(cortesDados[ultimo - 1]!)} o más`
            : `${enteros(cortesDados[i - 1]!)} a menos de ${enteros(cortesDados[i]!)}`
    }))
  }
}

// the line colour of the classes: gis' expression, or the darkest colour before there are classes
export function colorPorValor(clases: StyleClasses | undefined): string | ExpressionSpecification {
  return clases?.classes.length ? colorExpression(clases) : PALETA[PALETA.length - 1]!
}
