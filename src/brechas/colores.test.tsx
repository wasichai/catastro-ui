import { describe, expect, it } from 'vitest'
import { GRIS, PALETA } from '../aranceles/colores'
import { FILTROS_VACIOS, parametros } from './api'
import { COLOR_CATEGORIA, colorDeLote, leyendaDe } from './colores'
import { popupHtml, soles } from './popup'
import type { LoteProps } from './tipos'

describe('colorDeLote', () => {
  it('matches the category against the fixed palette, grey for anything else', () => {
    const expresion = colorDeLote('categoria', []) as unknown[]
    expect(expresion.slice(0, 2)).toEqual(['match', ['get', 'categoria']])
    expect(expresion).toContain(COLOR_CATEGORIA.OMISO)
    expect(expresion.at(-1)).toBe(GRIS)
  })

  it('steps on Δ impuesto with the aranceles quantiles', () => {
    expect(colorDeLote('delta', [10, 50])).toEqual([
      'case',
      ['==', ['typeof', ['get', 'delta_impuesto']], 'number'],
      ['step', ['get', 'delta_impuesto'], PALETA[0], 10, PALETA[1], 50, PALETA[2]],
      GRIS
    ])
  })
})

describe('leyendaDe', () => {
  it('has an entry per category, in the palette colours', () => {
    const clases = leyendaDe('confianza', [])
    expect(clases.map((c) => c.etiqueta)).toEqual(['Confiable', 'Dudoso', 'Sin levantar'])
  })

  it('takes the quantile classes for Δ impuesto, and none without values', () => {
    expect(
      leyendaDe(
        'delta',
        Array.from({ length: 100 }, (_, i) => i + 0.4)
      ).map((c) => c.etiqueta)[0]
    ).toBe('Menos de S/ 20')
    expect(leyendaDe('delta', [])).toEqual([])
  })
})

describe('parametros', () => {
  it('leaves out what is not set and joins the multi-valued filters with commas', () => {
    expect(parametros(undefined, FILTROS_VACIOS).toString()).toBe('')
    const p = parametros('org|2026-10-18', { ...FILTROS_VACIOS, categoria: ['OMISO', 'SUBVALUADO'], sector: ' 02 ', min_delta: 'x' }, { page: 1 })
    expect(p.get('corte')).toBe('org|2026-10-18')
    expect(p.get('categoria')).toBe('OMISO,SUBVALUADO')
    expect(p.get('sector')).toBe('02')
    expect(p.has('min_delta')).toBe(false)
    expect(p.get('page')).toBe('1')
  })
})

describe('popupHtml', () => {
  const props: LoteProps = {
    codigo_municipal: 'M<1>',
    codigo_catastro: 'CC-1',
    categoria: 'SUBVALUADO',
    confianza: 'DUDOSO',
    delta_impuesto: 12.5,
    estado: 'A_FISCALIZAR',
    supera_5_uit: true
  }

  it('escapes the codes and names the category, the gap and the state', () => {
    const html = popupHtml(props)
    expect(html).toContain('M&lt;1&gt;')
    expect(html).toContain('Subvaluado')
    expect(html).toContain('Dudoso')
    expect(html).toContain(soles(12.5))
    expect(html).toContain('A fiscalizar')
  })

  it('treats the properties maplibre drops (undefined) like null', () => {
    const html = popupHtml({ codigo_municipal: 'M1' } as LoteProps)
    expect(html).not.toContain('undefined')
    expect(html).toContain('Pendiente')
  })
})
