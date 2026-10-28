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

// «95.25 m²», «+15.25 m²» with signo, «—» when there is no number: an area, up to 2 decimals
export function metros(v: Monto, { signo = false }: { signo?: boolean } = {}): string {
  if (v === null || v === undefined || v === '' || !Number.isFinite(Number(v))) return '—'
  const n = Number(v)
  const cuerpo = `${Math.abs(n).toLocaleString('es-PE', { maximumFractionDigits: 2 })} m²`
  const cero = Number(Math.abs(n).toFixed(2)) === 0
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

// the zone catastro-ui shows the instants in when the app config has none: the municipalidad's
export const ZONA_LIMA = 'America/Lima'

// a DATETIME is an instant: «2026-10-20T03:00:00Z» → «19/10/2026 22:00» in Lima, whatever the browser's zone. one
// without an offset is UTC, the way Core stores it
export function fechaHora(iso: string | null | undefined, zona: string = ZONA_LIMA): string {
  if (!iso) return '—'
  const conZona = /(Z|[+-]\d{2}:?\d{2})$/i.test(iso) || !iso.includes('T') ? iso : `${iso}Z`
  const instante = new Date(conZona)
  if (Number.isNaN(instante.getTime())) return iso
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: zona,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    })
      .formatToParts(instante)
      .map((p) => [p.type, p.value])
  )
  return `${partes.day}/${partes.month}/${partes.year} ${partes.hour}:${partes.minute}`
}

// the year in a zone: the 31st of December at 20:00 in Lima is already the next year in UTC
export const anioEn = (zona: string = ZONA_LIMA, ahora: Date = new Date()) =>
  Number(new Intl.DateTimeFormat('en-GB', { timeZone: zona, year: 'numeric' }).format(ahora))
