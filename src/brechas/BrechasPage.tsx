import { lazy, Suspense, useMemo, useState } from 'react'
import { Download, MapPinned } from 'lucide-react'
import { ApiError, EmptyState, LoadingState, PageHeader, useApiClient, useAuth } from '@wasichai/core'
import { Alert, Button } from '@wasichai/ui'
import { clasesDeLeyenda, cortes as calcularCortes, valoresDe } from '../aranceles/colores'
import { useArancelesVia } from '../aranceles/api'
import { FILTROS_VACIOS, descargarCsv, sinCortes, useCortes, useFichas, useLotes, usePanel } from './api'
import { CapasMapa, Leyenda } from './CapasMapa'
import { deltasDe, leyendaDe, type Colorear } from './colores'
import { DialogoDecision } from './DialogoDecision'
import { cantidad, Indicadores } from './Indicadores'
import { FiltrosFichas, TablaFichas } from './TablaFichas'
import type { CapaWms, Corte, Filtros, Orden } from './tipos'

// maplibre weighs more than the rest of the app: the map loads when the page opens, not with the first bundle
const BrechasMapa = lazy(() => import('./BrechasMapa'))

const fecha = (iso: string) => {
  const [a, m, d] = iso.slice(0, 10).split('-')
  return d && m && a ? `${d}/${m}/${a}` : iso
}

export const nombreDeCorte = (c: Pick<Corte, 'fecha' | 'anio'>) => `${fecha(c.fecha)} · año ${c.anio}`

function mensajeDeError(error: Error): string {
  if (error instanceof ApiError && error.status === 403) return 'No tienes permiso para ver las brechas.'
  return 'No se pudieron cargar las brechas.'
}

function SinCortes() {
  return (
    <EmptyState title="No hay cortes de brecha cargados" icon={MapPinned}>
      <p className="max-w-prose text-sm text-ink-muted">
        Un corte es la foto de la brecha que srtm publica (docs/informes/brecha). Para verlo aquí, cárgalo en catastro-backend con{' '}
        <code className="rounded bg-surface-muted px-1 font-mono text-xs">model/importar_corte_brecha.py</code>, que lee la carpeta del corte (manifiesto.json y
        los Parquet), y vuelve a esta página.
      </p>
    </EmptyState>
  )
}

// «Brechas»: what srtm's brecha found in one corte, on a map and a table, and the decisions taken over its fichas
export function BrechasPage({ workerUrl }: { workerUrl?: string }) {
  const { can } = useAuth()
  const puedeDecidir = can('decision_brecha', 'UPDATE')
  const cliente = useApiClient()

  const cortes = useCortes()
  const [corteElegido, setCorteElegido] = useState<string>()
  const corte = corteElegido ?? cortes.data?.[0]?.clave
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS)
  const [orden, setOrden] = useState<Orden>('delta_desc')
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(50)
  const [colorear, setColorear] = useState<Colorear>('categoria')
  const [mostrarVias, setMostrarVias] = useState(false)
  const [wms, setWms] = useState<CapaWms[]>([])
  const [seleccion, setSeleccion] = useState<ReadonlySet<string>>(new Set())
  const [decidiendo, setDecidiendo] = useState<string[] | null>(null)
  const [errorCsv, setErrorCsv] = useState<string | null>(null)
  const [exportando, setExportando] = useState(false)

  const panel = usePanel(corte)
  const fichas = useFichas(corte, filtros, orden, page, size)
  const lotes = useLotes(corte, filtros)
  const anio = panel.data?.corte.anio ?? cortes.data?.find((c) => c.clave === corte)?.anio
  const vias = useArancelesVia(anio, mostrarVias)

  const deltas = useMemo(() => deltasDe(lotes.data?.features ?? []), [lotes.data])
  const cortesDelta = useMemo(() => calcularCortes(deltas), [deltas])
  const clases = useMemo(() => leyendaDe(colorear, deltas), [colorear, deltas])
  const valoresVias = useMemo(() => valoresDe(vias.data?.features ?? []), [vias.data])
  const cortesVias = useMemo(() => calcularCortes(valoresVias), [valoresVias])
  const lista = useMemo(() => [...seleccion], [seleccion])

  const cambiarFiltros = (f: Filtros) => {
    setFiltros(f)
    setPage(0)
  }
  const elegir = (codigos: string[], agregar: boolean) => setSeleccion((s) => new Set(agregar ? [...s, ...codigos] : codigos))
  const alternar = (codigo: string) =>
    setSeleccion((s) => {
      const n = new Set(s)
      if (!n.delete(codigo)) n.add(codigo)
      return n
    })
  const elegirPagina = (codigos: string[], si: boolean) =>
    setSeleccion((s) => {
      const n = new Set(s)
      for (const c of codigos)
        if (si) n.add(c)
        else n.delete(c)
      return n
    })

  const exportar = async () => {
    setErrorCsv(null)
    setExportando(true)
    try {
      await descargarCsv(cliente, corte, filtros, orden)
    } catch {
      setErrorCsv('No se pudo exportar el CSV.')
    } finally {
      setExportando(false)
    }
  }

  const encabezado = <PageHeader title="Brechas" subtitle="Lo que srtm cobra frente a lo que catastro levantó, por corte, y las decisiones sobre cada ficha" />

  if (cortes.isPending)
    return (
      <div className="space-y-3">
        {encabezado}
        <LoadingState />
      </div>
    )
  if (sinCortes(cortes.error) || (cortes.isSuccess && !cortes.data.length) || sinCortes(panel.error))
    return (
      <div className="space-y-3">
        {encabezado}
        <SinCortes />
      </div>
    )
  const error = cortes.error ?? panel.error
  if (error)
    return (
      <div className="space-y-3">
        {encabezado}
        <p role="alert" className="rounded-md border border-border bg-danger-soft p-3 text-sm text-danger">
          {mensajeDeError(error)}
        </p>
      </div>
    )

  return (
    <div className="flex flex-col gap-4">
      {encabezado}
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="corte-brecha" className="text-sm text-ink-muted">
          Corte
        </label>
        <select
          id="corte-brecha"
          value={corte}
          onChange={(e) => {
            setCorteElegido(e.target.value)
            setPage(0)
            setSeleccion(new Set())
          }}
          className="h-8 rounded-md border border-border bg-surface px-2 text-sm text-ink"
        >
          {cortes.data?.map((c) => (
            <option key={c.clave} value={c.clave}>
              {nombreDeCorte(c)}
            </option>
          ))}
        </select>
        {(panel.isFetching || fichas.isFetching || lotes.isFetching) && <span className="text-sm text-ink-muted">Cargando…</span>}
      </div>

      {panel.data ? <Indicadores panel={panel.data} /> : <LoadingState />}

      <section aria-label="Visor" className="grid gap-3 lg:grid-cols-[16rem_1fr]">
        <CapasMapa colorear={colorear} onColorear={setColorear} mostrarVias={mostrarVias} onMostrarVias={setMostrarVias} anio={anio} wms={wms} onWms={setWms} />
        <div className="relative h-[32rem] overflow-hidden rounded-md border border-border">
          <Suspense fallback={<div className="h-full w-full bg-surface-muted" />}>
            <BrechasMapa
              lotes={lotes.data}
              colorear={colorear}
              cortesDelta={cortesDelta}
              seleccion={lista}
              onSeleccionar={elegir}
              vias={vias.data}
              mostrarVias={mostrarVias}
              cortesVias={cortesVias}
              wms={wms}
              workerUrl={workerUrl}
            />
          </Suspense>
          <Leyenda colorear={colorear} clases={clases} vias={mostrarVias ? clasesDeLeyenda(cortesVias, valoresVias.length > 0) : null} anio={anio} />
        </div>
      </section>

      <section aria-label="Fichas" className="space-y-3">
        <FiltrosFichas filtros={filtros} onCambio={cambiarFiltros} orden={orden} onOrden={(o) => (setOrden(o), setPage(0))} />
        <div className="flex flex-wrap items-center gap-2">
          <span role="status" className="text-sm text-ink">
            {seleccion.size ? `${cantidad(seleccion.size)} fichas elegidas` : 'Ninguna ficha elegida'}
          </span>
          {seleccion.size > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setSeleccion(new Set())}>
              Quitar la selección
            </Button>
          )}
          <span className="flex-1" />
          {puedeDecidir && (
            <Button size="sm" disabled={!seleccion.size} onClick={() => setDecidiendo(lista)}>
              Decidir…
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => void exportar()} disabled={exportando}>
            <Download aria-hidden className="h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
        {errorCsv && <Alert tone="danger">{errorCsv}</Alert>}
        {fichas.isError ? (
          <p role="alert" className="rounded-md border border-border bg-danger-soft p-3 text-sm text-danger">
            {mensajeDeError(fichas.error)}
          </p>
        ) : (
          <TablaFichas
            pagina={fichas.data}
            seleccion={seleccion}
            onAlternar={alternar}
            onElegirPagina={elegirPagina}
            page={page}
            size={size}
            onPage={setPage}
            onSize={(s) => (setSize(s), setPage(0))}
          />
        )}
      </section>

      {puedeDecidir && anio !== undefined && (
        <DialogoDecision
          abierto={decidiendo !== null}
          onAbierto={(a) => !a && setDecidiendo(null)}
          codigos={decidiendo ?? []}
          anio={anio}
          onDecidido={() => setSeleccion(new Set())}
        />
      )}
    </div>
  )
}
