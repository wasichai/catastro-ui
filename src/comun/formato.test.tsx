import { describe, expect, it } from 'vitest'
import { anioEn, fecha, fechaHora, metros, plural, soles } from './formato'

describe('soles', () => {
  it('writes thousands and two decimals, a minus sign for negatives and a plus when asked', () => {
    expect(soles(12345.5)).toBe('S/\u00a012,345.50')
    // a no-break space after «S/», so the amount never wraps inside
    expect(soles(1)).not.toContain(' ')
    expect(soles('-50')).toBe('−S/\u00a050.00')
    expect(soles(50, { signo: true })).toBe('+S/\u00a050.00')
    expect(soles(0, { signo: true })).toBe('S/\u00a00.00')
    expect(soles(-0.001)).toBe('S/\u00a00.00')
    expect(soles(1200, { minimo: 0, maximo: 0 })).toBe('S/\u00a01,200')
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

describe('fechaHora', () => {
  it('writes an instant in Lima time, whatever the zone of the browser', () => {
    // 03:00 UTC is 22:00 of the day before in Lima (UTC−5, no daylight saving)
    expect(fechaHora('2026-10-20T03:00:00Z')).toBe('19/10/2026 22:00')
    expect(fechaHora('2026-10-20T03:00:00.123Z')).toBe('19/10/2026 22:00')
    expect(fechaHora('2026-10-20T08:30:00-05:00')).toBe('20/10/2026 08:30')
    // Core's instants without an offset are UTC
    expect(fechaHora('2026-10-20T03:00:00')).toBe('19/10/2026 22:00')
    expect(fechaHora('2026-10-20T03:00:00Z', 'UTC')).toBe('20/10/2026 03:00')
    expect(fechaHora(null)).toBe('—')
    expect(fechaHora('no es fecha')).toBe('no es fecha')
  })
})

describe('anioEn', () => {
  it('is the year of the zone, not of UTC', () => {
    const nocheVieja = new Date('2027-01-01T01:00:00Z')
    expect(anioEn('America/Lima', nocheVieja)).toBe(2026)
    expect(anioEn('UTC', nocheVieja)).toBe(2027)
  })
})

describe('metros', () => {
  it('writes an area with up to two decimals, its sign when asked and a dash without a number', () => {
    expect(metros(95.25)).toBe('95.25 m²')
    expect(metros('1200.5000000000')).toBe('1,200.5 m²')
    expect(metros(15.25, { signo: true })).toBe('+15.25 m²')
    expect(metros(-30, { signo: true })).toBe('−30 m²')
    expect(metros(0.001, { signo: true })).toBe('0 m²')
    expect(metros(null)).toBe('—')
    expect(metros('abc')).toBe('—')
  })
})
