import type { ClaseLeyenda } from '../aranceles/colores'
import { useCapasGis, useServiciosGeoServer } from './api'
import { COLOR_SELECCION, COLOREAR, type Colorear } from './colores'
import type { CapaGis, CapaWms } from './tipos'

const control = 'h-8 rounded-md border border-border bg-surface px-2 text-sm text-ink'

// the WMS url of a published layer: its own, or the service's with the layer name
export function urlWms(capa: CapaGis, servicioWms: string): string {
  if (capa.wms) return capa.wms
  return `${servicioWms}${servicioWms.includes('?') ? '&' : '?'}layers=${encodeURIComponent(capa.layerName)}`
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
  const publicadas = (capas.data ?? []).filter((c) => c.published)
  const prendida = (id: string) => wms.find((c) => c.id === id)

  return (
    <div className="space-y-3 text-sm">
      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        Colorear lotes por
        <select value={colorear} onChange={(e) => onColorear(e.target.value as Colorear)} className={control}>
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
                        onWms(
                          e.target.checked
                            ? [...wms, { id: c.layerName, url: urlWms(c, servicios.data!.wms), opacity: OPACIDAD_INICIAL }]
                            : wms.filter((w) => w.id !== c.layerName)
                        )
                      }
                    />
                    <span className="truncate" title={c.layerName}>
                      {c.label || c.layerName}
                    </span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    aria-label={`Opacidad de ${c.label || c.layerName}`}
                    disabled={!on}
                    value={Math.round((on?.opacity ?? OPACIDAD_INICIAL) * 100)}
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

function Muestra({ color, linea }: { color: string; linea?: boolean }) {
  return linea ? (
    <span aria-hidden className="inline-block w-6 shrink-0" style={{ borderTop: `3px solid ${color}` }} />
  ) : (
    <span aria-hidden className="inline-block h-3 w-6 shrink-0 rounded-sm" style={{ background: color }} />
  )
}

// the legend of the lotes (and of the vías when they are on), with the colours the map paints
export function Leyenda({ colorear, clases, vias, anio }: { colorear: Colorear; clases: ClaseLeyenda[]; vias: ClaseLeyenda[] | null; anio?: number }) {
  return (
    <ul
      aria-label="Leyenda"
      className="absolute bottom-8 left-2 max-h-[70%] space-y-1 overflow-y-auto rounded-md border border-border bg-surface/95 p-2 text-xs text-ink shadow"
    >
      <li className="font-medium">{COLOREAR[colorear]}</li>
      {clases.map((c) => (
        <li key={c.etiqueta} className="flex items-center gap-2">
          <Muestra color={c.color} />
          {c.etiqueta}
        </li>
      ))}
      <li className="flex items-center gap-2">
        <span aria-hidden className="inline-block h-3 w-6 shrink-0 rounded-sm border-2" style={{ borderColor: COLOR_SELECCION }} />
        Lotes elegidos
      </li>
      {vias && (
        <>
          <li className="pt-1 font-medium">{`Vías: valor por m²${anio ? ` (${anio})` : ''}`}</li>
          {vias.map((c) => (
            <li key={`via-${c.etiqueta}`} className="flex items-center gap-2">
              <Muestra color={c.color} linea />
              {c.etiqueta}
            </li>
          ))}
        </>
      )}
    </ul>
  )
}
