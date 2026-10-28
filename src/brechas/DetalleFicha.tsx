import { ApiError, LoadingState } from '@wasichai/core'
import { Badge, Dialog, DialogContent, DialogDescription, DialogTitle, Table, Td, Th } from '@wasichai/ui'
import { metros, soles } from '../comun/formato'
import { ErrorCarga } from '../comun/ui'
import { useFicha } from './api'
import { COLOR_CATEGORIA, COLOR_NIVEL, ETIQUETA_CATEGORIA, ETIQUETA_ESTADO, ETIQUETA_NIVEL } from './colores'
import type { Ficha, Nivel } from './tipos'

// how the table names a ficha: its codigo_municipal, else its codigo_catastro, else its predio's code (SIN_CATASTRO)
export const nombreDeFicha = (f: Pick<Ficha, 'codigo_municipal' | 'codigo_catastro' | 'codigo_predio' | 'id'>) =>
  f.codigo_municipal ?? f.codigo_catastro ?? (f.codigo_predio ? `Predio ${f.codigo_predio}` : f.id)

// the area catastro surveyed beyond what was declared, on the pisos found in both: the Δ of the PAR niveles where
// catastro is larger. a piso in only one of them is not a difference of area but a missing piso, so it is left out
export function excesoPar(niveles: Nivel[]): number {
  return niveles.reduce((suma, n) => {
    const d = Number(n.delta)
    return n.estado === 'PAR' && n.delta !== null && Number.isFinite(d) && d > 0 ? suma + d : suma
  }, 0)
}

function mensajeDeError(error: Error): string {
  if (error instanceof ApiError && error.status === 404) return 'La ficha ya no está en este corte.'
  if (error instanceof ApiError && error.status === 403) return 'No tienes permiso para ver esta ficha.'
  return 'No se pudo cargar la ficha.'
}

function TablaNiveles({ niveles }: { niveles: Nivel[] }) {
  if (!niveles.length) return <p className="text-sm text-ink-muted">Sin niveles en este corte</p>
  return (
    <div className="space-y-2">
      <p className="text-sm text-ink">
        {'Más área en catastro en los pisos de ambos: '}
        <span className="font-medium tabular-nums">{metros(excesoPar(niveles), { signo: true })}</span>
      </p>
      <div className="overflow-x-auto rounded-md border border-border">
        <Table aria-label="Niveles de la ficha">
          <thead>
            <tr>
              <Th>Piso</Th>
              <Th className="text-right">Área rentas</Th>
              <Th className="text-right">Área catastro</Th>
              <Th className="text-right">Δ m²</Th>
              <Th>Estado</Th>
            </tr>
          </thead>
          <tbody>
            {niveles.map((n, i) => (
              <tr key={`${n.piso ?? 'sin'}-${i}`}>
                <Td className="tabular-nums">{n.piso ?? '—'}</Td>
                <Td className="text-right tabular-nums whitespace-nowrap">{metros(n.area_rentas)}</Td>
                <Td className="text-right tabular-nums whitespace-nowrap">{metros(n.area_catastro)}</Td>
                <Td className="text-right font-medium tabular-nums whitespace-nowrap">{metros(n.delta, { signo: true })}</Td>
                <Td>
                  <Badge className="gap-1 whitespace-nowrap">
                    <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: COLOR_NIVEL[n.estado] }} />
                    {ETIQUETA_NIVEL[n.estado] ?? n.estado}
                  </Badge>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  )
}

export interface DetalleFichaProps {
  corte: string | undefined
  // the row of the table that was opened; null when the dialog is closed
  ficha: Ficha | null
  onCerrar: () => void
}

// one ficha of the corte: what the table says of it, and the areas of its pisos as srtm matched them. the row shows at
// once; the niveles come from GET /fichas/{id}
export function DetalleFicha({ corte, ficha, onCerrar }: DetalleFichaProps) {
  const detalle = useFicha(corte, ficha?.id ?? null)
  return (
    <Dialog open={ficha !== null} onOpenChange={(a) => !a && onCerrar()}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto">
        {ficha && (
          <>
            <DialogTitle className="text-lg font-semibold break-all text-ink">{`Ficha ${nombreDeFicha(ficha)}`}</DialogTitle>
            <DialogDescription className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
              <span className="inline-flex items-center gap-1">
                <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: COLOR_CATEGORIA[ficha.categoria] }} />
                {ETIQUETA_CATEGORIA[ficha.categoria] ?? ficha.categoria}
              </span>
              <span>{`Diferencia de impuesto ${soles(ficha.delta_impuesto, { signo: true })}`}</span>
              <span>{ETIQUETA_ESTADO[ficha.estado] ?? ficha.estado}</span>
            </DialogDescription>
            <section aria-labelledby="niveles-ficha" className="mt-4 space-y-2">
              <h3 id="niveles-ficha" className="text-sm font-semibold text-ink">
                Niveles
              </h3>
              {detalle.isError ? (
                <ErrorCarga onReintentar={() => void detalle.refetch()}>{mensajeDeError(detalle.error)}</ErrorCarga>
              ) : detalle.data ? (
                // an API older than catastro-backend#75 answers no niveles
                <TablaNiveles niveles={detalle.data.niveles ?? []} />
              ) : (
                <LoadingState />
              )}
            </section>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
