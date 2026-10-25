import { describe, expect, it } from 'vitest'
import { GRIS } from '../comun/colores'
import { FILTROS_VACIOS, parametros } from './api'
import { COLOR_CATEGORIA, DIVERGENTE, colorDeLote, filtroDeLotes, leyendaDe } from './colores'
import { popupHtml } from './popup'
import type { LoteProps } from './tipos'

// evaluates the step of the diverging scale the way maplibre does: the output of the last stop <= the value
function pasoDe(valor: number): string {
  const [, , paso] = colorDeLote('delta') as unknown as [string, unknown, unknown[]]
  const [, , primero, ...resto] = paso as [string, unknown, string, ...(number | string)[]]
  let color = primero
  for (let i = 0; i < resto.length; i += 2) if (valor >= (resto[i] as number)) color = resto[i + 1] as string
  return color
}

describe('colorDeLote', () => {
  it('matches the category against the fixed palette, grey for anything else', () => {
    const expresion = colorDeLote('categoria') as unknown[]
    expect(expresion.slice(0, 2)).toEqual(['match', ['get', 'categoria']])
    expect(expresion).toContain(COLOR_CATEGORIA.OMISO)
    expect(expresion.at(-1)).toBe(GRIS)
  })

  it('paints the difference on a diverging scale centred on 0: red up, blue down, near white for no change', () => {
    expect(pasoDe(0)).toBe(DIVERGENTE.neutro)
    expect(pasoDe(0.5)).toBe(DIVERGENTE.neutro)
    expect(pasoDe(-0.5)).toBe(DIVERGENTE.neutro)
    expect(pasoDe(10)).toBe(DIVERGENTE.sube[0])
    expect(pasoDe(100)).toBe(DIVERGENTE.sube[1])
    expect(pasoDe(5000)).toBe(DIVERGENTE.sube[2])
    expect(pasoDe(-10)).toBe(DIVERGENTE.baja[2])
    expect(pasoDe(-100)).toBe(DIVERGENTE.baja[1])
    expect(pasoDe(-5000)).toBe(DIVERGENTE.baja[0])
    // a lote without a difference is grey
    const [caso, , , sinDato] = colorDeLote('delta') as unknown as unknown[]
    expect(caso).toBe('case')
    expect(sinDato).toBe(GRIS)
  })
})

describe('leyendaDe', () => {
  it('has an entry per category, in the palette colours', () => {
    expect(leyendaDe('confianza').map((c) => c.etiqueta)).toEqual(['Confiable', 'Dudoso', 'Sin levantar'])
  })

  it('names the symmetric classes of the difference with their sign, the same whatever the data', () => {
    expect(leyendaDe('delta').map((c) => c.etiqueta)).toEqual([
      '+S/ 500 o más',
      '+S/ 50 a +S/ 500',
      '+S/ 1 a +S/ 50',
      'Sin cambio (−S/ 1 a +S/ 1)',
      '−S/ 50 a −S/ 1',
      '−S/ 500 a −S/ 50',
      'Menos de −S/ 500',
      'Sin dato (sin levantar)'
    ])
    expect(leyendaDe('delta').map((c) => c.color)).toEqual([...[...DIVERGENTE.sube].reverse(), DIVERGENTE.neutro, ...DIVERGENTE.baja.slice().reverse(), GRIS])
  })
})

describe('filtroDeLotes', () => {
  it('is null without filters, and applies the table filters but sector on the map', () => {
    expect(filtroDeLotes(FILTROS_VACIOS)).toBeNull()
    expect(filtroDeLotes({ ...FILTROS_VACIOS, sector: '02' })).toBeNull()
    expect(filtroDeLotes({ ...FILTROS_VACIOS, categoria: ['OMISO'], supera_5_uit: 'false', min_delta: '100' })).toEqual([
      'all',
      ['in', ['get', 'categoria'], ['literal', ['OMISO']]],
      ['==', ['get', 'supera_5_uit'], false],
      ['>=', ['abs', ['to-number', ['get', 'delta_impuesto'], 0]], 100]
    ])
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

  it('escapes the codes and names the category, the difference and the state', () => {
    const html = popupHtml(props)
    expect(html).toContain('M&lt;1&gt;')
    expect(html).toContain('Subvaluado')
    expect(html).toContain('Dudoso')
    expect(html).toContain('+S/ 12.50')
    expect(html).toContain('A fiscalizar')
  })

  it('treats the properties maplibre drops (undefined) like null', () => {
    const html = popupHtml({ codigo_municipal: 'M1' } as LoteProps)
    expect(html).not.toContain('undefined')
    expect(html).toContain('Pendiente')
  })
})
