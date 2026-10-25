import { useState, type FormEvent } from 'react'
import { ApiError } from '@wasichai/core'
import { Alert, Button, Dialog, DialogContent, DialogDescription, DialogTitle, Label, Textarea } from '@wasichai/ui'
import { cantidad, plural } from '../comun/formato'
import { useDecidir } from './api'
import { ETIQUETA_ESTADO } from './colores'
import type { Decision, ResultadoDecision } from './tipos'

// what a decision can move a ficha to; PENDIENTE is where every ficha starts
export const DECISIONES = ['A_INSPECCIONAR', 'INSPECCIONADO', 'A_FISCALIZAR', 'DESCARTADO'] as const satisfies readonly Decision['estado'][]

// the API takes up to 500 codes per decision
export const MAXIMO = 500

export interface DialogoDecisionProps {
  abierto: boolean
  onAbierto: (abierto: boolean) => void
  codigos: string[]
  anio: number
  // after a decision is saved: the page clears its selection
  onDecidido: () => void
}

// the API's field names, as the form calls them
const CAMPOS: Record<string, string> = { codigos: 'Fichas', anio: 'Año', estado: 'Nuevo estado', nota: 'Nota', motivo_descarte: 'Motivo del descarte' }

function mensajeDeError(error: Error): string {
  if (error instanceof ApiError && error.status === 403) return 'No tienes permiso para decidir sobre las brechas.'
  if (error instanceof ApiError && error.violations.length) return error.violations.map((v) => `${CAMPOS[v.field] ?? v.field}: ${v.message}`).join('. ')
  return 'No se pudo guardar la decisión.'
}

// the decision over the chosen fichas: a state, a note and, to discard them, the reason. the server sets who and when
export function DialogoDecision({ abierto, onAbierto, codigos, anio, onDecidido }: DialogoDecisionProps) {
  const [estado, setEstado] = useState<Decision['estado']>('A_INSPECCIONAR')
  const [nota, setNota] = useState('')
  const [motivo, setMotivo] = useState('')
  const [faltaMotivo, setFaltaMotivo] = useState(false)
  const [resultado, setResultado] = useState<ResultadoDecision | null>(null)
  const decidir = useDecidir()

  const cambiarAbierto = (a: boolean) => {
    // each opening starts clean: state, note and reason of the last one do not carry over
    if (!a) {
      setEstado('A_INSPECCIONAR')
      setNota('')
      setMotivo('')
      setResultado(null)
      setFaltaMotivo(false)
      decidir.reset()
    }
    onAbierto(a)
  }

  const guardar = async (e: FormEvent) => {
    e.preventDefault()
    if (estado === 'DESCARTADO' && !motivo.trim()) {
      setFaltaMotivo(true)
      return
    }
    setFaltaMotivo(false)
    const cuerpo: Decision = { codigos, anio, estado }
    if (nota.trim()) cuerpo.nota = nota.trim()
    if (estado === 'DESCARTADO') cuerpo.motivo_descarte = motivo.trim()
    try {
      setResultado(await decidir.mutateAsync(cuerpo))
      setNota('')
      setMotivo('')
      onDecidido()
    } catch {
      // the error shows from the mutation's state
    }
  }

  const demasiadas = codigos.length > MAXIMO

  return (
    <Dialog open={abierto} onOpenChange={cambiarAbierto}>
      <DialogContent className="max-w-lg">
        <DialogTitle className="text-lg font-semibold text-ink">Decidir sobre las fichas</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-ink-muted">
          {`${plural(resultado ? resultado.actualizadas + resultado.creadas + resultado.errores.length : codigos.length, 'ficha', 'fichas')} del año ${anio}.`}
        </DialogDescription>
        {resultado ? (
          <div className="mt-4 space-y-3" role="status" aria-label="Resultado de la decisión">
            <p className="text-sm text-ink">
              {`Actualizadas: ${cantidad(resultado.actualizadas)} · Creadas: ${cantidad(resultado.creadas)} · Con error: ${cantidad(resultado.errores.length)}`}
            </p>
            {resultado.errores.length > 0 && (
              <ul aria-label="Errores" className="max-h-40 list-disc overflow-y-auto pl-5 text-sm text-danger">
                {resultado.errores.map((e) => (
                  <li key={e.codigo}>{`${e.codigo}: ${e.error}`}</li>
                ))}
              </ul>
            )}
            <div className="flex justify-end">
              <Button onClick={() => cambiarAbierto(false)}>Listo</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={guardar} className="mt-4 space-y-4" noValidate>
            <p className="max-h-20 overflow-y-auto font-mono text-xs text-ink-muted">{codigos.join(', ')}</p>
            <div className="space-y-1">
              <Label htmlFor="decision-estado">Nuevo estado</Label>
              <select
                id="decision-estado"
                value={estado}
                onChange={(e) => setEstado(e.target.value as Decision['estado'])}
                className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm text-ink"
              >
                {DECISIONES.map((d) => (
                  <option key={d} value={d}>
                    {ETIQUETA_ESTADO[d]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="decision-nota">Nota</Label>
              <Textarea id="decision-nota" value={nota} onChange={(e) => setNota(e.target.value)} rows={2} />
            </div>
            {estado === 'DESCARTADO' && (
              <div className="space-y-1">
                <Label htmlFor="decision-motivo">Motivo del descarte (obligatorio)</Label>
                <Textarea
                  id="decision-motivo"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={2}
                  required
                  aria-required
                  aria-invalid={faltaMotivo}
                  aria-describedby={faltaMotivo ? 'decision-motivo-error' : undefined}
                />
                {faltaMotivo && (
                  <p id="decision-motivo-error" role="alert" className="text-sm text-danger">
                    Escribe el motivo del descarte.
                  </p>
                )}
              </div>
            )}
            {demasiadas && <Alert tone="warning">{`Elige hasta ${cantidad(MAXIMO)} fichas por decisión; hay ${cantidad(codigos.length)}.`}</Alert>}
            {decidir.isError && <Alert tone="danger">{mensajeDeError(decidir.error)}</Alert>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => cambiarAbierto(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={decidir.isPending || demasiadas || !codigos.length}>
                {decidir.isPending ? 'Guardando…' : 'Guardar decisión'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
