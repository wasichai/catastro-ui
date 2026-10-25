import { Card, CardBody } from '@wasichai/ui'
import { GRIS } from '../aranceles/colores'
import { COLOR_CATEGORIA, COLOR_CONFIANZA, COLOR_ESTADO, ETIQUETA_CATEGORIA, ETIQUETA_CONFIANZA, ETIQUETA_ESTADO } from './colores'
import { soles } from './popup'
import type { Panel } from './tipos'

export const cantidad = (n: number | null | undefined) => (typeof n === 'number' ? n.toLocaleString('es-PE') : '—')

function Kpi({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle?: string }) {
  return (
    <Card role="group" aria-label={etiqueta}>
      <CardBody className="space-y-1">
        <p className="text-sm text-ink-muted">{etiqueta}</p>
        <p className="text-2xl font-semibold text-ink tabular-nums">{valor}</p>
        {detalle && <p className="text-xs text-ink-muted">{detalle}</p>}
      </CardBody>
    </Card>
  )
}

export interface Barra {
  clave: string
  etiqueta: string
  // what sets the length of the bar
  valor: number
  texto: string
  color: string
}

// a bar per entry, as long as its share of the longest: plain css, no chart library
export function Barras({ titulo, barras }: { titulo: string; barras: Barra[] }) {
  const maximo = Math.max(0, ...barras.map((b) => Math.abs(b.valor)))
  return (
    <Card>
      <CardBody>
        <h3 className="mb-2 text-sm font-medium text-ink">{titulo}</h3>
        {barras.length === 0 ? (
          <p className="text-sm text-ink-muted">Sin datos.</p>
        ) : (
          <ul aria-label={titulo} className="space-y-1.5">
            {barras.map((b) => (
              <li key={b.clave} className="grid grid-cols-[7rem_1fr_auto] items-center gap-2 text-xs">
                <span className="truncate text-ink" title={b.etiqueta}>
                  {b.etiqueta}
                </span>
                <span aria-hidden className="h-2.5 rounded-sm bg-surface-muted">
                  <span
                    data-testid={`barra-${b.clave}`}
                    className="block h-full rounded-sm"
                    style={{ width: `${maximo ? (Math.abs(b.valor) / maximo) * 100 : 0}%`, background: b.color }}
                  />
                </span>
                <span className="text-ink-muted tabular-nums">{b.texto}</span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}

const fichasYDelta = (fichas: number, delta: unknown) => `${cantidad(fichas)} · ${soles(delta as number | null)}`

// the header of the corte: the KPIs and the bars, counted over every ficha of the corte
export function Indicadores({ panel }: { panel: Panel }) {
  const { kpis } = panel
  return (
    <section aria-label="Indicadores del corte" className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi etiqueta="Δ impuesto" valor={soles(kpis.delta_impuesto)} detalle={`${cantidad(kpis.fichas)} fichas`} />
        <Kpi etiqueta="Δ confiable" valor={soles(kpis.delta_impuesto_confiable)} detalle="Solo las fichas confiables" />
        <Kpi etiqueta="Omisos estimados" valor={cantidad(kpis.omisos_estimado)} />
        <Kpi etiqueta="Superan 5 UIT" valor={cantidad(kpis.supera_5_uit)} detalle="Δ de autoavalúo" />
        <Kpi etiqueta="Pendientes de decidir" valor={cantidad(kpis.pendientes)} detalle={`de ${cantidad(kpis.fichas)}`} />
        <Kpi etiqueta="Con geometría" valor={cantidad(kpis.con_geometria)} detalle={`de ${cantidad(kpis.fichas)}`} />
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Barras
          titulo="Por categoría"
          barras={panel.por_categoria.map((c) => ({
            clave: c.clave,
            etiqueta: ETIQUETA_CATEGORIA[c.clave] ?? c.clave,
            valor: c.fichas,
            texto: fichasYDelta(c.fichas, c.delta_impuesto),
            color: COLOR_CATEGORIA[c.clave] ?? GRIS
          }))}
        />
        <Barras
          titulo="Por confianza"
          barras={panel.por_confianza.map((c) => ({
            clave: c.clave,
            etiqueta: ETIQUETA_CONFIANZA[c.clave] ?? c.clave,
            valor: c.fichas,
            texto: fichasYDelta(c.fichas, c.delta_impuesto),
            color: COLOR_CONFIANZA[c.clave] ?? GRIS
          }))}
        />
        <Barras
          titulo="Por estado"
          barras={panel.por_estado.map((c) => ({
            clave: c.clave,
            etiqueta: ETIQUETA_ESTADO[c.clave] ?? c.clave,
            valor: c.fichas,
            texto: cantidad(c.fichas),
            color: COLOR_ESTADO[c.clave] ?? GRIS
          }))}
        />
        <Barras
          titulo="Sectores con más Δ impuesto"
          barras={panel.top_sectores.map((s, i) => ({
            clave: `sector-${s.sector ?? i}`,
            etiqueta: s.sector ? `Sector ${s.sector}` : 'Sin sector',
            valor: Number(s.delta_impuesto) || 0,
            texto: fichasYDelta(s.fichas, s.delta_impuesto),
            color: COLOR_CATEGORIA.SOBREVALUADO
          }))}
        />
      </div>
    </section>
  )
}
