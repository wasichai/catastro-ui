import { lazy, Suspense, useMemo, useState } from 'react'
import { ApiError, PageHeader } from '@wasichai/core'
import { GRIS, clasesDeLeyenda, cortes as calcularCortes, valoresDe } from './colores'
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

function Muestra({ color, punteado }: { color: string; punteado?: boolean }) {
  return <span aria-hidden className="inline-block w-6 shrink-0" style={{ borderTop: `3px ${punteado ? 'dashed' : 'solid'} ${color}` }} />
}

export function ArancelesViaPage({ workerUrl }: { workerUrl?: string }) {
  const actual = new Date().getFullYear()
  const [anio, setAnio] = useState(actual)
  const consulta = useArancelesVia(anio)
  const datos = consulta.data
  const cortes = useMemo(() => calcularCortes(valoresDe(datos?.features ?? [])), [datos])
  const leyenda = useMemo(() => clasesDeLeyenda(cortes), [cortes])

  return (
    <div className="flex h-full flex-col gap-3">
      <PageHeader title="Aranceles por vía" subtitle="Valor por m² de cada tramo de vía, según el año" />
      <div className="flex items-center gap-2">
        <label htmlFor="anio-aranceles" className="text-sm text-ink-muted">
          Año
        </label>
        <select
          id="anio-aranceles"
          value={anio}
          onChange={(e) => setAnio(Number(e.target.value))}
          className="rounded-md border border-border bg-surface px-2 py-1 text-sm"
        >
          {aniosDisponibles(actual).map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        {consulta.isFetching && <span className="text-sm text-ink-muted">Cargando…</span>}
      </div>
      {consulta.isError ? (
        <p role="alert" className="rounded-md border border-border bg-danger-soft p-3 text-sm text-danger">
          {mensajeDeError(consulta.error)}
        </p>
      ) : (
        <div className="relative min-h-96 flex-1 overflow-hidden rounded-md border border-border">
          <Suspense fallback={<div className="h-full w-full bg-surface-muted" />}>
            <ArancelesMapa datos={datos} cortes={cortes} workerUrl={workerUrl} />
          </Suspense>
          <ul aria-label="Leyenda" className="absolute bottom-8 left-2 space-y-1 rounded-md border border-border bg-surface/95 p-2 text-xs text-ink shadow">
            <li className="font-medium">Valor por m² ({anio})</li>
            {leyenda.map((c) => (
              <li key={c.etiqueta} className="flex items-center gap-2">
                <span aria-hidden className="inline-block h-3 w-6 shrink-0 rounded-sm" style={{ background: c.color }} />
                {c.etiqueta}
              </li>
            ))}
            <li className="flex items-center gap-2">
              <Muestra color={GRIS} />
              {`sin arancel ${anio}`}
            </li>
            <li className="flex items-center gap-2">
              <Muestra color={GRIS} punteado />
              sin asignar
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}
