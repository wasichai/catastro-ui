import { describe, expect, it } from 'vitest'
import { PALETA, clasesDeLeyenda, colorPorValor, cortes } from './colores'

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

describe('leyenda', () => {
  it('has a class per interval, each with its palette colour', () => {
    const clases = clasesDeLeyenda([120, 140, 160, 180])
    expect(clases.map((c) => c.etiqueta)).toEqual([
      'Menos de S/ 120',
      'S/ 120 a menos de S/ 140',
      'S/ 140 a menos de S/ 160',
      'S/ 160 a menos de S/ 180',
      'S/ 180 o más'
    ])
    expect(clases.map((c) => c.color)).toEqual([...PALETA])
  })

  it('paints with a step over the same cuts', () => {
    expect(colorPorValor([120, 140])).toEqual(['step', ['get', 'valor_m2'], PALETA[0], 120, PALETA[1], 140, PALETA[2]])
  })
})
