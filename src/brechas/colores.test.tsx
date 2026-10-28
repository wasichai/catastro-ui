import { describe, expect, it } from 'vitest'
import { GRIS } from '../comun/colores'
import { FILTROS_VACIOS, parametros } from './api'
import { colorExpression } from '@wasichai/gis'
import { COLOR_CATEGORIA, DIVERGENTE, clasesDeLote, colorDeLote, leyendaDe } from './colores'
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
    expect(expresion).toEqual(colorExpression(clasesDeLote('categoria')))
    expect(expresion.slice(0, 2)).toEqual(['match', ['to-string', ['get', 'categoria']]])
    expect(expresion.slice(2, 4)).toEqual(['OMISO', COLOR_CATEGORIA.OMISO])
    // gis' grey for anything else
    expect(expresion.at(-1)).toBe('#9e9e9e')
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
    expect(leyendaDe('confianza').map((c) => c.label)).toEqual(['Confiable', 'Dudoso', 'Sin levantar'])
  })

  it('names the symmetric classes of the difference with their sign, the same whatever the data', () => {
    expect(leyendaDe('delta').map((c) => c.label)).toEqual([
      '+S/\u00a0500 o más',
      '+S/\u00a050 a +S/\u00a0500',
      '+S/\u00a01 a +S/\u00a050',
      'Sin cambio (−S/\u00a01 a +S/\u00a01)',
      '−S/\u00a050 a −S/\u00a01',
      '−S/\u00a0500 a −S/\u00a050',
      'Menos de −S/\u00a0500',
      'Sin dato (sin levantar)'
    ])
    expect(leyendaDe('delta').map((c) => c.color)).toEqual([...[...DIVERGENTE.sube].reverse(), DIVERGENTE.neutro, ...DIVERGENTE.baja.slice().reverse(), GRIS])
  })
})

describe('minimo de la diferencia', () => {
  it('sends a minimum of 0 or more, never a negative one', () => {
    expect(parametros(undefined, { ...FILTROS_VACIOS, min_delta: '-5' }).has('min_delta')).toBe(false)
    expect(parametros(undefined, { ...FILTROS_VACIOS, min_delta: '0' }).get('min_delta')).toBe('0')
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
    expect(html).toContain('+S/\u00a012.50')
    expect(html).toContain('A fiscalizar')
  })

  it('treats the properties maplibre drops (undefined) like null', () => {
    const html = popupHtml({ codigo_municipal: 'M1' } as LoteProps)
    expect(html).not.toContain('undefined')
    expect(html).toContain('Pendiente')
    expect(html).toContain('Sin confianza')
    expect(html).not.toContain('Aviso')
  })

  it('says when the code has more than one ficha', () => {
    expect(popupHtml({ ...props, fichas: 2 })).toContain('Este código tiene 2 fichas; el mapa muestra la de mayor diferencia')
    expect(popupHtml({ ...props, fichas: 1 })).not.toContain('Aviso')
  })
})
