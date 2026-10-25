import { escapar } from '../aranceles/popup'
import { ETIQUETA_CATEGORIA, ETIQUETA_CONFIANZA, ETIQUETA_ESTADO } from './colores'
import type { Decimal, LoteProps } from './tipos'

export function soles(v: Decimal | undefined): string {
  if (v === null || v === undefined || v === '' || !Number.isFinite(Number(v))) return '—'
  return `S/ ${Number(v).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// the popup of a lote: its codes, the gap and the decision. the same markup as the aranceles' popup
export function popupHtml(p: LoteProps): string {
  const fila = (k: string, v: string) =>
    `<div style="display:flex;gap:8px"><span style="color:var(--ink-muted)">${escapar(k)}</span><span>${escapar(v)}</span></div>`
  return (
    `<div data-theme="light" style="color:var(--ink);font:12px/1.5 ui-sans-serif,system-ui">` +
    `<div style="font-weight:600">${escapar(p.codigo_municipal ?? 'Sin código municipal')}</div>` +
    [
      fila('Código catastral', p.codigo_catastro ?? '—'),
      fila('Categoría', ETIQUETA_CATEGORIA[p.categoria] ?? p.categoria ?? '—'),
      fila('Confianza', ETIQUETA_CONFIANZA[p.confianza] ?? p.confianza ?? '—'),
      fila('Δ impuesto', soles(p.delta_impuesto)),
      fila('Supera 5 UIT', p.supera_5_uit ? 'Sí' : 'No'),
      fila('Estado', ETIQUETA_ESTADO[p.estado] ?? p.estado ?? 'Pendiente')
    ].join('') +
    `</div>`
  )
}
