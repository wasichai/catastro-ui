import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Download, MapPinned } from 'lucide-react'
import { ApiError, EmptyState, LoadingState, PageHeader, useApiClient, useAuth } from '@wasichai/core'
import { Alert, Button } from '@wasichai/ui'
import { useArancelesVia } from '../aranceles/api'
import { clasesDeLeyenda, cortes as calcularCortes, valoresDe } from '../comun/colores'
import { fecha, plural } from '../comun/formato'
import { CONTROL, ErrorCarga } from '../comun/ui'
import { FILTROS_VACIOS, descargarCsv, sinCortes, useCortes, useFichas, useLotes, usePanel } from './api'
import { CapasMapa, Leyenda } from './CapasMapa'
import { filtroDeLotes, leyendaDe, type Colorear } from './colores'
import { DialogoDecision } from './DialogoDecision'
import { Indicadores } from './Indicadores'
import { FiltrosFichas, TablaFichas } from './TablaFichas'
import type { CapaWms, Corte, Filtros, Orden } from './tipos'

// maplibre weighs more than the rest of the app: the map loads when the page opens, not with the first bundle
const BrechasMapa = lazy(() => import('./BrechasMapa'))

export const nombreDeCorte = (c: Pick<Corte, 'fecha' | 'anio'>) => `${fecha(c.fecha)} · año ${c.anio}`

function mensajeDeError(error: Error): string {
  if (error instanceof ApiError && error.status === 403) return 'No tienes permiso para ver las brechas.'
  return 'No se pudieron cargar las brechas.'
}

function mensajeDeCsv(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) return 'Tu sesión venció. Vuelve a iniciar sesión para exportar.'
  if (error instanceof ApiError && error.status === 403) return 'No tienes permiso para exportar las brechas.'
  return 'No se pudo exportar el CSV.'
}

function SinCortes() {
  return (
    <EmptyState title="Todavía no hay cortes de brecha cargados" icon={MapPinned}>
      <div className="max-w-prose space-y-2 text-sm text-ink-muted">
        <p>Pide al equipo técnico que cargue el corte más reciente de la brecha; esta página lo mostrará en cuanto esté.</p>
        <details>
          <summary className="cursor-pointer">Detalle técnico</summary>
          <p className="mt-1">
            El corte es la carpeta que publica srtm (docs/informes/brecha: manifiesto.json y los Parquet). Se carga en catastro-backend con{' '}
            <code className="rounded bg-surface-muted px-1 font-mono text-xs">model/importar_corte_brecha.py</code>.
          </p>
        </details>
      </div>
    </EmptyState>
  )
}

const ENCABEZADO = (
  <PageHeader title="Brechas" subtitle="Lo que la municipalidad cobra frente a lo que levantó el catastro, por corte, y las decisiones sobre cada ficha" />
)

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
  const lotes = useLotes(corte, filtros.sector)
  // the year of the corte chosen: the list of cortes already has it, so it never lags behind the panel
  const anio = cortes.data?.find((c) => c.clave === corte)?.anio ?? panel.data?.corte.anio
  const vias = useArancelesVia(anio, mostrarVias)

  const filtro = useMemo(() => filtroDeLotes(filtros), [filtros])
  const clases = useMemo(() => leyendaDe(colorear), [colorear])
  const valoresVias = useMemo(() => valoresDe(vias.data?.features ?? []), [vias.data])
  const cortesVias = useMemo(() => calcularCortes(valoresVias), [valoresVias])
  const lista = useMemo(() => [...seleccion], [seleccion])

  // fewer fichas after a decision or a filter: the page goes back to the last one that exists
  const totalPaginas = fichas.data?.totalPages
  useEffect(() => {
    if (totalPaginas !== undefined && page > 0 && page >= totalPaginas) setPage(Math.max(0, totalPaginas - 1))
  }, [totalPaginas, page])

  // a new filter clears the selection, so no decision goes over fichas that are no longer on screen
  const cambiarFiltros = (f: Filtros) => {
    setFiltros(f)
    setPage(0)
    setSeleccion(new Set())
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
    } catch (e) {
      setErrorCsv(mensajeDeCsv(e))
    } finally {
      setExportando(false)
    }
  }

  if (cortes.isPending)
    return (
      <div className="space-y-3">
        {ENCABEZADO}
        <LoadingState />
      </div>
    )
  if (sinCortes(cortes.error) || (cortes.isSuccess && !cortes.data.length))
    return (
      <div className="space-y-3">
        {ENCABEZADO}
        <SinCortes />
      </div>
    )
  if (cortes.error)
    return (
      <div className="space-y-3">
        {ENCABEZADO}
        <ErrorCarga onReintentar={() => void cortes.refetch()}>{mensajeDeError(cortes.error)}</ErrorCarga>
      </div>
    )

  const cargando = panel.isFetching || fichas.isFetching || lotes.isFetching

  return (
    <div className="flex flex-col gap-4">
      {ENCABEZADO}
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
          className={CONTROL}
        >
          {cortes.data?.map((c) => (
            <option key={c.clave} value={c.clave}>
              {nombreDeCorte(c)}
            </option>
          ))}
        </select>
        <span role="status" className="text-sm text-ink-muted">
          {cargando ? 'Cargando…' : ''}
        </span>
      </div>

      {panel.isError ? (
        // the corte went away after the list was read: the selector stays, to choose another
        sinCortes(panel.error) ? (
          <Alert tone="warning">
            <span className="flex flex-wrap items-center gap-2">
              El corte elegido ya no está cargado.
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setCorteElegido(undefined)
                  void cortes.refetch()
                }}
              >
                Ver el más reciente
              </Button>
            </span>
          </Alert>
        ) : (
          <ErrorCarga onReintentar={() => void panel.refetch()}>{mensajeDeError(panel.error)}</ErrorCarga>
        )
      ) : panel.data ? (
        <Indicadores panel={panel.data} />
      ) : (
        <LoadingState />
      )}

      <section aria-label="Visor" className="grid gap-3 lg:grid-cols-[16rem_1fr]">
        <CapasMapa colorear={colorear} onColorear={setColorear} mostrarVias={mostrarVias} onMostrarVias={setMostrarVias} anio={anio} wms={wms} onWms={setWms} />
        <div className="relative h-[32rem] overflow-hidden rounded-md border border-border">
          <Suspense fallback={<div className="h-full w-full bg-surface-muted" />}>
            <BrechasMapa
              corte={corte}
              lotes={lotes.data}
              filtro={filtro}
              colorear={colorear}
              seleccion={lista}
              onSeleccionar={elegir}
              vias={vias.data}
              mostrarVias={mostrarVias}
              cortesVias={cortesVias}
              wms={wms}
              workerUrl={workerUrl}
            />
          </Suspense>
          {lotes.isError && (
            <ErrorCarga className="absolute inset-x-2 top-2" onReintentar={() => void lotes.refetch()}>
              No se pudieron cargar los lotes del mapa.
            </ErrorCarga>
          )}
          <Leyenda colorear={colorear} clases={clases} vias={mostrarVias ? clasesDeLeyenda(cortesVias, valoresVias.length > 0) : null} anio={anio} />
        </div>
      </section>

      <section aria-label="Fichas" className="space-y-3">
        <FiltrosFichas filtros={filtros} onCambio={cambiarFiltros} orden={orden} onOrden={(o) => (setOrden(o), setPage(0))} />
        <div className="flex flex-wrap items-center gap-2">
          <span role="status" className="text-sm text-ink">
            {seleccion.size ? plural(seleccion.size, 'ficha elegida', 'fichas elegidas') : 'Ninguna ficha elegida'}
          </span>
          {seleccion.size > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setSeleccion(new Set())}>
              Quitar la selección
            </Button>
          )}
          <span className="flex-1" />
          {puedeDecidir && (
            <Button size="sm" disabled={!seleccion.size || anio === undefined} onClick={() => setDecidiendo(lista)}>
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
          <ErrorCarga onReintentar={() => void fichas.refetch()}>{mensajeDeError(fichas.error)}</ErrorCarga>
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
