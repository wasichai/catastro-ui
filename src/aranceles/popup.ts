import type { Asignacion, TramoProps } from './tipos'

const ASIGNACION: Record<Asignacion, string> = {
  NOMBRE_UNICO: 'Por nombre de la vía',
  CERCANIA: 'Por cercanía',
  LOTES: 'Por los lotes de la urbanización (revisar)',
  SIN_ARANCEL: 'Sin asignar'
}

const LADO = { AMBOS: 'Ambos lados', IZQUIERDO: 'Izquierdo', DERECHO: 'Derecho' } as const

const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export function nombreDeVia(p: Pick<TramoProps, 'tip_via' | 'nom_via'>): string {
  return [p.tip_via, p.nom_via].filter(Boolean).join(' ')
}

export function valorEnTexto(p: Pick<TramoProps, 'valor_m2' | 'id_aranc' | 'asignacion' | 'anio'>): string {
  if (typeof p.valor_m2 === 'number') return `S/ ${p.valor_m2.toLocaleString('es-PE', { maximumFractionDigits: 2 })} por m²`
  return p.asignacion === 'SIN_ARANCEL' || !p.id_aranc ? 'Sin asignar' : `Sin arancel ${p.anio}`
}

// the popup of a tramo: name, SAT code (id_aranc), value per m², and how the arancel was assigned. the same markup
// as gis' popup, so it takes the theme's tokens
export function popupHtml(p: TramoProps): string {
  const fila = (k: string, v: string) =>
    `<div style="display:flex;gap:8px"><span style="color:var(--ink-muted)">${escapar(k)}</span><span>${escapar(v)}</span></div>`
  return (
    `<div data-theme="light" style="color:var(--ink);font:12px/1.5 ui-sans-serif,system-ui">` +
    `<div style="font-weight:600">${escapar(nombreDeVia(p) || 'Vía sin nombre')}</div>` +
    [
      p.cuadra ? fila('Cuadra', p.cuadra) : '',
      fila('Lado', LADO[p.lado] ?? p.lado),
      fila('Código SAT', p.id_aranc ?? '—'),
      fila(`Valor ${p.anio}`, valorEnTexto(p)),
      fila('Asignación', ASIGNACION[p.asignacion] ?? p.asignacion)
    ].join('') +
    `</div>`
  )
}
