import { MapLegend, type LegendItem } from '@wasichai/gis'
import { CONTROL } from '../comun/ui'
import { useCapasGis, useServiciosGeoServer } from './api'
import { COLOR_SELECCION, COLOREAR, type Colorear } from './colores'
import type { CapaGis, CapaWms } from './tipos'

// the WMS url of a published layer: its own, or a GetMap on the service with the layer name (wmsTileUrl adds only
// bbox, size, srs, format and transparency). null when there is neither: the layer is not offered
export function urlWms(capa: CapaGis, servicioWms: string | undefined): string | null {
  if (capa.wms) return delMismoOrigen(capa.wms)
  if (!servicioWms) return null
  const p = new URLSearchParams({ service: 'WMS', version: '1.1.1', request: 'GetMap', styles: '', layers: capa.layerName })
  return delMismoOrigen(`${servicioWms}${servicioWms.includes('?') ? '&' : '?'}${p}`)
}

// the urls Core gives are GeoServer's address as Core reaches it (inside the deployment's network), which the browser
// may not reach: a /geoserver/ url is asked to this same origin, whose web server proxies /geoserver/ to GeoServer
export function delMismoOrigen(url: string): string {
  try {
    const u = new URL(url)
    return u.pathname.startsWith('/geoserver/') ? `${u.pathname}${u.search}` : url
  } catch {
    return url
  }
}

export interface CapasMapaProps {
  colorear: Colorear
  onColorear: (c: Colorear) => void
  mostrarVias: boolean
  onMostrarVias: (v: boolean) => void
  anio: number | undefined
  // the WMS layers that are on, by layerName
  wms: CapaWms[]
  onWms: (capas: CapaWms[]) => void
}

export const OPACIDAD_INICIAL = 0.7

// what the map draws: the colouring of the lotes, the vías with their arancel and the layers GeoServer publishes
export function CapasMapa({ colorear, onColorear, mostrarVias, onMostrarVias, anio, wms, onWms }: CapasMapaProps) {
  const servicios = useServiciosGeoServer()
  const activo = servicios.data?.enabled === true
  const capas = useCapasGis(activo)
  const publicadas = (capas.data ?? []).flatMap((c) => {
    const url = c.published ? urlWms(c, servicios.data?.wms) : null
    return url ? [{ ...c, url }] : []
  })
  const prendida = (id: string) => wms.find((c) => c.id === id)
  // two layers with the same label (two geometries of an object) are told apart by the geometry
  const repetidas = new Set(publicadas.map((c) => c.label).filter((l, i, todas) => l && todas.indexOf(l) !== i))
  const nombre = (c: CapaGis) => (c.label ? (repetidas.has(c.label) ? `${c.label} (${c.geometryName})` : c.label) : c.layerName)

  return (
    <div className="space-y-3 text-sm">
      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        Colorear lotes por
        <select value={colorear} onChange={(e) => onColorear(e.target.value as Colorear)} className={CONTROL}>
          {Object.entries(COLOREAR).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="space-y-1">
        <legend className="text-xs font-medium text-ink-muted">Capas</legend>
        <label className="flex items-center gap-2 text-ink">
          <input type="checkbox" checked={mostrarVias} onChange={(e) => onMostrarVias(e.target.checked)} />
          Vías con arancel
          {anio !== undefined && <span className="text-xs text-ink-muted">({anio})</span>}
        </label>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-ink-muted">GeoServer (WMS)</legend>
        {servicios.isPending ? (
          <p className="text-xs text-ink-muted">Cargando…</p>
        ) : servicios.isError ? (
          <p className="text-xs text-danger">No se pudo consultar GeoServer.</p>
        ) : !activo ? (
          <p className="text-xs text-ink-muted">GeoServer no está activo</p>
        ) : capas.isError ? (
          <p className="text-xs text-danger">No se pudieron leer las capas de GeoServer.</p>
        ) : capas.isPending ? (
          <p className="text-xs text-ink-muted">Cargando…</p>
        ) : publicadas.length === 0 ? (
          <p className="text-xs text-ink-muted">No hay capas publicadas.</p>
        ) : (
          <ul aria-label="Capas WMS" className="space-y-2">
            {publicadas.map((c) => {
              const on = prendida(c.layerName)
              return (
                <li key={c.layerName} className="space-y-1">
                  <label className="flex items-center gap-2 text-ink">
                    <input
                      type="checkbox"
                      checked={!!on}
                      onChange={(e) =>
                        onWms(e.target.checked ? [...wms, { id: c.layerName, url: c.url, opacity: OPACIDAD_INICIAL }] : wms.filter((w) => w.id !== c.layerName))
                      }
                    />
                    <span className="truncate" title={c.layerName}>
                      {nombre(c)}
                    </span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    aria-label={`Opacidad de ${nombre(c)}`}
                    disabled={!on}
                    value={Math.round((on?.opacity ?? OPACIDAD_INICIAL) * 100)}
                    aria-valuetext={`${Math.round((on?.opacity ?? OPACIDAD_INICIAL) * 100)} %`}
                    onChange={(e) => onWms(wms.map((w) => (w.id === c.layerName ? { ...w, opacity: Number(e.target.value) / 100 } : w)))}
                    className="w-full"
                  />
                </li>
              )
            })}
          </ul>
        )}
      </fieldset>
    </div>
  )
}

// the legend of the lotes (and of the vías when they are on), with the colours the map paints: gis' MapLegend, plus the
// outline of the selected lotes, which it has no swatch for
export function Leyenda({ colorear, clases, vias, anio }: { colorear: Colorear; clases: LegendItem[]; vias: LegendItem[] | null; anio?: number }) {
  return (
    <section
      aria-label="Leyenda"
      className="absolute bottom-8 left-2 max-h-[70%] space-y-2 overflow-y-auto rounded-md border border-border bg-surface/95 p-2 text-xs text-ink shadow"
    >
      <MapLegend title={COLOREAR[colorear]} items={clases} showOther={false} className="text-xs" />
      <p className="flex items-center gap-2 text-ink-muted">
        <span aria-hidden className="inline-block h-3 w-5 shrink-0 rounded-sm border-2" style={{ borderColor: COLOR_SELECCION }} />
        Lotes elegidos
      </p>
      {vias && <MapLegend title={`Vías: valor por m²${anio ? ` (${anio})` : ''}`} items={vias} showOther={false} className="text-xs" />}
    </section>
  )
}
