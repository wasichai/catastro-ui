import { describe, expect, it } from 'vitest'
import { fecha, plural, soles } from './formato'

describe('soles', () => {
  it('writes thousands and two decimals, a minus sign for negatives and a plus when asked', () => {
    expect(soles(12345.5)).toBe('S/ 12,345.50')
    expect(soles('-50')).toBe('−S/ 50.00')
    expect(soles(50, { signo: true })).toBe('+S/ 50.00')
    expect(soles(0, { signo: true })).toBe('S/ 0.00')
    expect(soles(-0.001)).toBe('S/ 0.00')
    expect(soles(1200, { minimo: 0, maximo: 0 })).toBe('S/ 1,200')
    expect(soles(null)).toBe('—')
    expect(soles('x')).toBe('—')
  })
})

describe('plural y fecha', () => {
  it('agree in number and write the date as dd/mm/aaaa', () => {
    expect(plural(1, 'ficha elegida', 'fichas elegidas')).toBe('1 ficha elegida')
    expect(plural(1200, 'ficha', 'fichas')).toBe('1,200 fichas')
    expect(fecha('2026-04-01')).toBe('01/04/2026')
    expect(fecha('2026-04-01T10:00:00')).toBe('01/04/2026')
    expect(fecha(null)).toBe('—')
  })
})
