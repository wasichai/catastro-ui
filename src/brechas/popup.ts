import { soles } from '../comun/formato'
import { popupDeFilas } from '../comun/popup'
import { ETIQUETA_CATEGORIA, ETIQUETA_ESTADO, etiquetaConfianza } from './colores'
import type { LoteProps } from './tipos'

const siNo = (v: boolean | null | undefined) => (v === null || v === undefined ? '—' : v ? 'Sí' : 'No')

// the popup of a lote: its codes, the difference and the decision. maplibre drops null properties: they arrive as
// undefined. the map draws one lote per codigo_municipal: when the code has more fichas, the popup says so
export function popupHtml(p: LoteProps): string {
  const varias = typeof p.fichas === 'number' && p.fichas > 1
  return popupDeFilas(p.codigo_municipal ?? 'Sin código municipal', [
    varias ? ['Aviso', `Este código tiene ${p.fichas} fichas; el mapa muestra la de mayor diferencia y la tabla las lista todas`] : null,
    ['Código catastral', p.codigo_catastro ?? '—'],
    ['Categoría', ETIQUETA_CATEGORIA[p.categoria] ?? p.categoria ?? '—'],
    ['Confianza', etiquetaConfianza(p.confianza)],
    ['Diferencia de impuesto', soles(p.delta_impuesto, { signo: true })],
    ['Supera 5 UIT', siNo(p.supera_5_uit)],
    ['Estado', ETIQUETA_ESTADO[p.estado] ?? p.estado ?? 'Pendiente']
  ])
}
