import { useEffect, useRef, useState } from 'react'
import { Badge, Input, PageSizePagination, Table, Td, Th } from '@wasichai/ui'
import { COLOR_CATEGORIA, COLOR_CONFIANZA, COLOR_ESTADO, ETIQUETA_CATEGORIA, ETIQUETA_CONFIANZA, ETIQUETA_ESTADO } from './colores'
import { soles } from './popup'
import { CATEGORIAS, CONFIANZAS, ESTADOS, type Ficha, type Filtros, type Orden, type Pagina } from './tipos'

export const TAMANIOS = [25, 50, 100] as const

export const SIN_CODIGO = 'Sin código municipal: la ficha no está en el padrón de catastro y no se puede decidir sobre ella'

const ORDENES: Record<Orden, string> = { delta_desc: 'Δ impuesto, de mayor a menor', delta_asc: 'Δ impuesto, de menor a mayor', codigo: 'Código catastral' }

const control = 'h-8 rounded-md border border-border bg-surface px-2 text-sm text-ink'

// a text the user types: the query waits until they stop, so each key does not ask the API again
function useDiferido(valor: string, ms = 300): string {
  const [diferido, setDiferido] = useState(valor)
  useEffect(() => {
    const t = setTimeout(() => setDiferido(valor), ms)
    return () => clearTimeout(t)
  }, [valor, ms])
  return diferido
}

function Opciones<K extends string>({
  titulo,
  claves,
  etiquetas,
  colores,
  elegidas,
  onCambio
}: {
  titulo: string
  claves: readonly K[]
  etiquetas: Record<K, string>
  colores: Record<K, string>
  elegidas: K[]
  onCambio: (k: K[]) => void
}) {
  return (
    <fieldset className="flex flex-wrap items-center gap-1">
      <legend className="sr-only">{titulo}</legend>
      <span aria-hidden className="mr-1 text-xs text-ink-muted">
        {titulo}
      </span>
      {claves.map((k) => {
        const activa = elegidas.includes(k)
        return (
          <button
            key={k}
            type="button"
            aria-pressed={activa}
            onClick={() => onCambio(activa ? elegidas.filter((e) => e !== k) : [...elegidas, k])}
            className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${activa ? 'border-ink bg-surface-muted text-ink' : 'border-border text-ink-muted'}`}
          >
            <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: colores[k] }} />
            {etiquetas[k]}
          </button>
        )
      })}
    </fieldset>
  )
}

// the filters of the table, which the map and the CSV follow too. sector and Δ mínimo wait for the user to stop typing
export function FiltrosFichas({
  filtros,
  onCambio,
  orden,
  onOrden
}: {
  filtros: Filtros
  onCambio: (f: Filtros) => void
  orden: Orden
  onOrden: (o: Orden) => void
}) {
  const [sector, setSector] = useState(filtros.sector)
  const [minDelta, setMinDelta] = useState(filtros.min_delta)
  const sectorDiferido = useDiferido(sector)
  const minDeltaDiferido = useDiferido(minDelta)
  const ultimo = useRef(filtros)
  ultimo.current = filtros
  useEffect(() => {
    const f = ultimo.current
    if (f.sector !== sectorDiferido || f.min_delta !== minDeltaDiferido) onCambio({ ...f, sector: sectorDiferido, min_delta: minDeltaDiferido })
  }, [sectorDiferido, minDeltaDiferido])

  return (
    <div role="search" aria-label="Filtros de las fichas" className="space-y-2">
      <Opciones
        titulo="Categoría"
        claves={CATEGORIAS}
        etiquetas={ETIQUETA_CATEGORIA}
        colores={COLOR_CATEGORIA}
        elegidas={filtros.categoria}
        onCambio={(categoria) => onCambio({ ...filtros, categoria })}
      />
      <Opciones
        titulo="Confianza"
        claves={CONFIANZAS}
        etiquetas={ETIQUETA_CONFIANZA}
        colores={COLOR_CONFIANZA}
        elegidas={filtros.confianza}
        onCambio={(confianza) => onCambio({ ...filtros, confianza })}
      />
      <Opciones
        titulo="Estado"
        claves={ESTADOS}
        etiquetas={ETIQUETA_ESTADO}
        colores={COLOR_ESTADO}
        elegidas={filtros.estado}
        onCambio={(estado) => onCambio({ ...filtros, estado })}
      />
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Sector
          <Input value={sector} onChange={(e) => setSector(e.target.value)} className="h-8 w-24" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Supera 5 UIT
          <select
            value={filtros.supera_5_uit}
            onChange={(e) => onCambio({ ...filtros, supera_5_uit: e.target.value as Filtros['supera_5_uit'] })}
            className={control}
          >
            <option value="">Todas</option>
            <option value="true">Sí</option>
            <option value="false">No</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Δ mínimo (S/)
          <Input type="number" min={0} step="any" value={minDelta} onChange={(e) => setMinDelta(e.target.value)} className="h-8 w-28" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Orden
          <select value={orden} onChange={(e) => onOrden(e.target.value as Orden)} className={control}>
            {Object.entries(ORDENES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}

const ubicacion = (f: Ficha) => [f.sector, f.manzana, f.lote].map((x) => x ?? '—').join('-')

export interface TablaFichasProps {
  pagina: Pagina<Ficha> | undefined
  seleccion: ReadonlySet<string>
  onAlternar: (codigo: string) => void
  onElegirPagina: (codigos: string[], elegir: boolean) => void
  page: number
  size: number
  onPage: (p: number) => void
  onSize: (s: number) => void
}

// the fichas of the corte, a page at a time. the checkboxes are the same selection as the map's; a ficha without
// codigo_municipal cannot be chosen, since a decision is kept by that code
export function TablaFichas({ pagina, seleccion, onAlternar, onElegirPagina, page, size, onPage, onSize }: TablaFichasProps) {
  const filas = pagina?.content ?? []
  const elegibles = filas.flatMap((f) => (f.codigo_municipal ? [f.codigo_municipal] : []))
  const todas = elegibles.length > 0 && elegibles.every((c) => seleccion.has(c))
  const algunas = elegibles.some((c) => seleccion.has(c))
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="overflow-x-auto">
        <Table aria-label="Fichas de la brecha">
          <thead>
            <tr>
              <Th className="w-8">
                <input
                  type="checkbox"
                  aria-label="Elegir todas las fichas de la página"
                  checked={todas}
                  ref={(el) => {
                    if (el) el.indeterminate = algunas && !todas
                  }}
                  disabled={!elegibles.length}
                  onChange={() => onElegirPagina(elegibles, !todas)}
                />
              </Th>
              <Th>Código municipal</Th>
              <Th>Código catastral</Th>
              <Th>Sector-Mz-Lote</Th>
              <Th>Uso</Th>
              <Th>Categoría</Th>
              <Th>Confianza</Th>
              <Th className="text-right">Impuesto declarado</Th>
              <Th className="text-right">Impuesto catastro</Th>
              <Th className="text-right">Δ impuesto</Th>
              <Th>5 UIT</Th>
              <Th>Estado</Th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr>
                <Td colSpan={12} className="text-center text-ink-muted">
                  {pagina ? 'Ninguna ficha cumple los filtros.' : 'Cargando…'}
                </Td>
              </tr>
            )}
            {filas.map((f) => {
              const codigo = f.codigo_municipal
              const elegida = !!codigo && seleccion.has(codigo)
              return (
                <tr key={f.id} aria-selected={elegida} className={elegida ? 'bg-surface-muted' : undefined}>
                  <Td>
                    {codigo ? (
                      <input type="checkbox" aria-label={`Elegir ${codigo}`} checked={elegida} onChange={() => onAlternar(codigo)} />
                    ) : (
                      <span title={SIN_CODIGO}>
                        <input type="checkbox" aria-label={`${f.codigo_catastro}: ${SIN_CODIGO}`} disabled />
                      </span>
                    )}
                  </Td>
                  <Td className="font-mono text-xs">{codigo ?? '—'}</Td>
                  <Td className="font-mono text-xs">{f.codigo_catastro}</Td>
                  <Td className="whitespace-nowrap">{ubicacion(f)}</Td>
                  <Td>{f.uso ?? '—'}</Td>
                  <Td>
                    <Badge className="gap-1">
                      <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: COLOR_CATEGORIA[f.categoria] }} />
                      {ETIQUETA_CATEGORIA[f.categoria] ?? f.categoria}
                    </Badge>
                  </Td>
                  <Td title={f.confianza_motivo ?? undefined}>
                    <span aria-hidden className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: COLOR_CONFIANZA[f.confianza] }} />
                    {ETIQUETA_CONFIANZA[f.confianza] ?? f.confianza}
                  </Td>
                  <Td className="text-right tabular-nums whitespace-nowrap">{soles(f.impuesto_declarado)}</Td>
                  <Td className="text-right tabular-nums whitespace-nowrap">{soles(f.impuesto_catastro)}</Td>
                  <Td className="text-right font-medium tabular-nums whitespace-nowrap">{soles(f.delta_impuesto)}</Td>
                  <Td>{f.supera_5_uit ? 'Sí' : 'No'}</Td>
                  <Td title={f.nota ?? undefined}>{ETIQUETA_ESTADO[f.estado] ?? f.estado}</Td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      </div>
      <PageSizePagination page={page} size={size} total={pagina?.totalElements ?? 0} onPage={onPage} onSize={onSize} sizes={TAMANIOS} />
    </div>
  )
}
