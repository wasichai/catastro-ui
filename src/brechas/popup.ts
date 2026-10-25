import { soles } from '../comun/formato'
import { popupDeFilas } from '../comun/popup'
import { ETIQUETA_CATEGORIA, ETIQUETA_CONFIANZA, ETIQUETA_ESTADO } from './colores'
import type { LoteProps } from './tipos'

// the popup of a lote: its codes, the difference and the decision. maplibre drops null properties: they arrive as
// undefined
export function popupHtml(p: LoteProps): string {
  return popupDeFilas(p.codigo_municipal ?? 'Sin código municipal', [
    ['Código catastral', p.codigo_catastro ?? '—'],
    ['Categoría', ETIQUETA_CATEGORIA[p.categoria] ?? p.categoria ?? '—'],
    ['Confianza', ETIQUETA_CONFIANZA[p.confianza] ?? p.confianza ?? '—'],
    ['Diferencia de impuesto', soles(p.delta_impuesto, { signo: true })],
    ['Supera 5 UIT', p.supera_5_uit ? 'Sí' : 'No'],
    ['Estado', ETIQUETA_ESTADO[p.estado] ?? p.estado ?? 'Pendiente']
  ])
}
