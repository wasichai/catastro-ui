import { lazy, Suspense, useMemo, useState } from 'react'
import { ApiError, PageHeader, useWasichaiConfig } from '@wasichai/core'
import { MapLegend, legendItems } from '@wasichai/gis'
import { GRIS, clasesPorValor, valoresDe } from '../comun/colores'
import { ZONA_LIMA, anioEn } from '../comun/formato'
import { CONTROL, ErrorCarga } from '../comun/ui'
import { AbrirVistaDeMapa } from '../comun/VistaDeMapa'
import { useArancelesVia } from './api'

// maplibre weighs more than the rest of the app: the map loads when the page opens, not with the first bundle
const ArancelesMapa = lazy(() => import('./ArancelesMapa'))

export const ANIOS_ATRAS = 3
export const ANIOS_ADELANTE = 1

export function aniosDisponibles(actual: number): number[] {
  return Array.from({ length: ANIOS_ATRAS + ANIOS_ADELANTE + 1 }, (_, i) => actual - ANIOS_ATRAS + i)
}

function mensajeDeError(error: Error): string {
  if (error instanceof ApiError && error.status === 403) return 'No tienes permiso para ver los aranceles por vía.'
  return 'No se pudieron cargar los aranceles por vía.'
}

// the dashed grey line of the tramos never assigned an arancel, which gis' legend has no swatch for
function Muestra({ color }: { color: string }) {
  return <span aria-hidden className="inline-block w-5 shrink-0" style={{ borderTop: `3px dashed ${color}` }} />
}

export function ArancelesViaPage({ workerUrl }: { workerUrl?: string }) {
  // the year of the app's zone (Lima), the one tramo_via.valor_m2 holds
  const actual = anioEn(useWasichaiConfig().timeZone ?? ZONA_LIMA)
  const [anio, setAnio] = useState(actual)
  const consulta = useArancelesVia(anio)
  const datos = consulta.data
  const clases = useMemo(() => clasesPorValor(valoresDe(datos?.features ?? [])), [datos])
  // the year's classes, then the solid grey of the tramos without that year's arancel (gis' legend draws swatches; the
  // dashed line of «sin asignar» goes in its own entry below)
  const leyenda = useMemo(() => [...legendItems(clases), { label: `sin arancel ${anio}`, color: GRIS }], [clases, anio])

  return (
    <div className="flex h-full flex-col gap-3">
      <PageHeader title="Aranceles por vía" subtitle="Valor por m² de cada tramo de vía, según el año" />
      <div className="flex items-center gap-2">
        <label htmlFor="anio-aranceles" className="text-sm text-ink-muted">
          Año
        </label>
        <select id="anio-aranceles" value={anio} onChange={(e) => setAnio(Number(e.target.value))} className={CONTROL}>
          {aniosDisponibles(actual).map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        {/* always there, so screen readers announce the text when it changes */}
        <span role="status" className="text-sm text-ink-muted">
          {consulta.isFetching ? 'Cargando…' : ''}
        </span>
        <span className="flex-1" />
        <AbrirVistaDeMapa objeto="tramo_via" vista="aranceles_valor" title="El valor por m² del año actual, en el mapa de GIS" />
      </div>
      {consulta.isError ? (
        <ErrorCarga>{mensajeDeError(consulta.error)}</ErrorCarga>
      ) : (
        <div className="relative min-h-96 flex-1 overflow-hidden rounded-md border border-border">
          <Suspense fallback={<div className="h-full w-full bg-surface-muted" />}>
            <ArancelesMapa datos={datos} clases={clases} workerUrl={workerUrl} />
          </Suspense>
          <section
            aria-label="Leyenda"
            className="absolute bottom-8 left-2 space-y-1 rounded-md border border-border bg-surface/95 p-2 text-xs text-ink shadow"
          >
            <MapLegend title={`Valor por m² (${anio})`} items={leyenda} showOther={false} className="text-xs" />
            <p className="flex items-center gap-2 text-ink-muted">
              <Muestra color={GRIS} />
              sin asignar
            </p>
          </section>
        </div>
      )}
    </div>
  )
}
