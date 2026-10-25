// the one way catastro-ui writes amounts and counts, so the legends, the tables and the popups agree
export type Monto = number | string | null | undefined

export interface OpcionesSoles {
  // decimals shown: 2 by default; aranceles' legend uses whole soles
  minimo?: number
  maximo?: number
  // a leading + on positive amounts, for differences
  signo?: boolean
}

// «S/ 1,234.50», «−S/ 50.00», or «+S/ 50» with signo; «—» when there is no number
export function soles(v: Monto, { minimo = 2, maximo = Math.max(2, minimo), signo = false }: OpcionesSoles = {}): string {
  if (v === null || v === undefined || v === '' || !Number.isFinite(Number(v))) return '—'
  const n = Number(v)
  const cuerpo = `S/ ${Math.abs(n).toLocaleString('es-PE', { minimumFractionDigits: minimo, maximumFractionDigits: maximo })}`
  // rounding may turn a tiny negative into zero: no sign then
  const cero = Number(Math.abs(n).toFixed(maximo)) === 0
  if (n < 0 && !cero) return `−${cuerpo}`
  return signo && n > 0 && !cero ? `+${cuerpo}` : cuerpo
}

export const cantidad = (n: number | null | undefined) => (typeof n === 'number' ? n.toLocaleString('es-PE') : '—')

// «1 ficha elegida», «3 fichas elegidas»
export const plural = (n: number, uno: string, varios: string) => `${cantidad(n)} ${n === 1 ? uno : varios}`

// «2026-10-18» → «18/10/2026», without going through Date (no time zone shifts)
export function fecha(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [a, m, d] = iso.slice(0, 10).split('-')
  return d && m && a ? `${d}/${m}/${a}` : iso
}
