import { Card, CardBody } from '@wasichai/ui'
import { GRIS } from '../comun/colores'
import { cantidad, plural, soles } from '../comun/formato'
import { COLOR_CATEGORIA, COLOR_ESTADO, ETIQUETA_CATEGORIA, ETIQUETA_ESTADO, colorConfianza, colorDeSigno, etiquetaConfianza } from './colores'
import type { Panel } from './tipos'

function Kpi({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle?: string }) {
  return (
    <Card role="group" aria-label={etiqueta}>
      <CardBody className="space-y-1">
        <p className="text-sm text-ink-muted">{etiqueta}</p>
        {/* on one line: the grid below gives each card room for it */}
        <p className="text-2xl font-semibold whitespace-nowrap text-ink tabular-nums">{valor}</p>
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
              <li key={b.clave} className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_auto] items-center gap-2 text-xs">
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

// «10 · +S/ 500.00», which may break only after the «·»: a no-break space before it, and soles keeps the amount whole
const fichasYDelta = (fichas: number, delta: unknown) => `${cantidad(fichas)}\u00a0· ${soles(delta as number | null, { signo: true })}`

// the header of the corte: the KPIs and the bars, counted over every ficha of the corte
export function Indicadores({ panel }: { panel: Panel }) {
  const { kpis } = panel
  return (
    <section aria-label="Indicadores del corte" className="@container space-y-3">
      {/* columns by the width of the section, not of the screen (the sidebar takes 15rem of it): a KPI card needs
          ~15rem for «+S/ 1,234,567.89» on one line, a card of bars ~21rem for «1,234 · +S/ 12,345.00» */}
      <div className="grid grid-cols-1 gap-3 @min-[32rem]:grid-cols-2 @min-[48rem]:grid-cols-3 @min-[96rem]:grid-cols-6">
        <Kpi
          etiqueta="Diferencia de impuesto"
          valor={soles(kpis.delta_impuesto, { signo: true })}
          detalle={`Catastro − declarado, en ${plural(kpis.fichas, 'ficha', 'fichas')}`}
        />
        <Kpi etiqueta="Diferencia confiable" valor={soles(kpis.delta_impuesto_confiable, { signo: true })} detalle="Solo las fichas confiables" />
        <Kpi etiqueta="Omisos estimados" valor={soles(kpis.omisos_estimado, { signo: true })} />
        <Kpi etiqueta="Superan 5 UIT" valor={cantidad(kpis.supera_5_uit)} detalle="Diferencia de autoavalúo" />
        <Kpi
          etiqueta="Pendientes de decidir"
          valor={cantidad(kpis.pendientes)}
          detalle={`de ${cantidad(kpis.fichas - kpis.sin_ficha)} con ficha · ${plural(kpis.sin_ficha, 'ficha', 'fichas')} sin código municipal`}
        />
        <Kpi etiqueta="Con geometría" valor={cantidad(kpis.con_geometria)} detalle={`de ${cantidad(kpis.fichas)}`} />
      </div>
      <div className="grid gap-3 @min-[43rem]:grid-cols-2 @min-[87rem]:grid-cols-4">
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
            clave: c.clave ?? 'SIN_CONFIANZA',
            etiqueta: etiquetaConfianza(c.clave),
            valor: c.fichas,
            texto: fichasYDelta(c.fichas, c.delta_impuesto),
            color: colorConfianza(c.clave)
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
          titulo="Sectores con más diferencia de impuesto"
          barras={panel.top_sectores.map((s, i) => ({
            clave: `sector-${s.sector ?? i}`,
            etiqueta: s.sector ? `Sector ${s.sector}` : 'Sin sector',
            valor: Number(s.delta_impuesto) || 0,
            texto: fichasYDelta(s.fichas, s.delta_impuesto),
            // red where catastro would charge more, blue where less, as on the map
            color: colorDeSigno(Number(s.delta_impuesto) || 0)
          }))}
        />
      </div>
    </section>
  )
}
