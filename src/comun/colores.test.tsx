import { describe, expect, it } from 'vitest'
import { colorExpression, legendItems } from '@wasichai/gis'
import { PALETA, clasesPorValor, colorPorValor, cortes } from './colores'

describe('cortes', () => {
  it('splits the values into 5 quantile classes, in whole soles', () => {
    const valores = Array.from({ length: 100 }, (_, i) => 100.4 + i)
    expect(cortes(valores)).toEqual([120, 140, 160, 180])
  })

  it('collapses repeated values, down to no cut at all', () => {
    expect(cortes([50, 50, 50, 50, 50, 50])).toEqual([])
    expect(cortes([])).toEqual([])
    expect(cortes([10, 10, 10, 10, 10, 90, 90, 90, 90, 90])).toEqual([90])
  })
})

describe('clasesPorValor', () => {
  const valores = Array.from({ length: 100 }, (_, i) => 100.4 + i)

  it('has a class per interval, each with its palette colour, as gis legend items', () => {
    const clases = clasesPorValor(valores)
    expect(clases).toMatchObject({ by: 'valor_m2', type: 'quantiles' })
    expect(legendItems(clases).map((c) => c.label)).toEqual([
      'Menos de S/\u00a0120',
      'S/\u00a0120 a menos de S/\u00a0140',
      'S/\u00a0140 a menos de S/\u00a0160',
      'S/\u00a0160 a menos de S/\u00a0180',
      'S/\u00a0180 o más'
    ])
    expect(legendItems(clases).map((c) => c.color)).toEqual([...PALETA])
    expect(clases.classes.map((c) => [c.min, c.max])).toEqual([
      [100, 120],
      [120, 140],
      [140, 160],
      [160, 180],
      [180, undefined]
    ])
  })

  it('paints with gis step over the same cuts, from the smallest value', () => {
    const clases = clasesPorValor([100.4, 150, 200, 250, 300])
    expect(colorPorValor(clases)).toEqual(colorExpression(clases))
    const [, , paso] = colorPorValor(clases) as unknown as [string, unknown, unknown[]]
    expect(paso.slice(0, 5)).toEqual(['step', ['get', 'valor_m2'], expect.any(String), 100, PALETA[0]])
  })

  it('has no class without values, and one when every value is the same', () => {
    expect(clasesPorValor([]).classes).toEqual([])
    expect(colorPorValor(clasesPorValor([]))).toBe(PALETA[4])
    expect(legendItems(clasesPorValor([50, 50, 50]))).toEqual([{ label: 'Todos los valores', color: PALETA[4] }])
  })
})
