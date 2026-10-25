import { soles } from '../comun/formato'
import { popupDeFilas } from '../comun/popup'
import type { Asignacion, TramoProps } from './tipos'

const ASIGNACION: Record<Asignacion, string> = {
  NOMBRE_UNICO: 'Por nombre de la vía',
  CERCANIA: 'Por cercanía',
  LOTES: 'Por los lotes de la urbanización (revisar)',
  SIN_ARANCEL: 'Sin asignar'
}

const LADO = { AMBOS: 'Ambos lados', IZQUIERDO: 'Izquierdo', DERECHO: 'Derecho' } as const

export function nombreDeVia(p: Pick<TramoProps, 'tip_via' | 'nom_via'>): string {
  return [p.tip_via, p.nom_via].filter(Boolean).join(' ')
}

export function valorEnTexto(p: Pick<TramoProps, 'valor_m2' | 'id_aranc' | 'asignacion' | 'anio'>): string {
  if (typeof p.valor_m2 === 'number') return `${soles(p.valor_m2, { minimo: 0, maximo: 2 })} por m²`
  return p.asignacion === 'SIN_ARANCEL' || !p.id_aranc ? 'Sin asignar' : `Sin arancel ${p.anio}`
}

// the popup of a tramo: name, SAT code (id_aranc), value per m², and how the arancel was assigned
export function popupHtml(p: TramoProps): string {
  return popupDeFilas(nombreDeVia(p) || 'Vía sin nombre', [
    p.cuadra ? ['Cuadra', p.cuadra] : null,
    ['Lado', LADO[p.lado] ?? p.lado],
    ['Código SAT', p.id_aranc ?? '—'],
    [`Valor ${p.anio}`, valorEnTexto(p)],
    ['Asignación', ASIGNACION[p.asignacion] ?? p.asignacion]
  ])
}
