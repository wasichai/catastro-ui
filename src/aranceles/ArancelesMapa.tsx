import { useEffect, useRef } from 'react'
import type { Map } from 'maplibre-gl'
import type { StyleClasses } from '@wasichai/gis'
import { crearMapaBase, limites } from '../comun/mapa'
import { agregarCapasVias, pintarVias } from './capasVias'
import type { TramosCollection } from './tipos'

const FUENTE = 'aranceles-via'

interface Props {
  datos: TramosCollection | undefined
  clases: StyleClasses
  workerUrl?: string
}

// the map: the tramos of the vías with the arancel of the year (see capasVias)
export default function ArancelesMapa({ datos, clases, workerUrl }: Props) {
  const contenedor = useRef<HTMLDivElement>(null)
  const mapa = useRef<Map | null>(null)
  const listo = useRef(false)
  const ultimo = useRef({ datos, clases })
  const encuadrado = useRef(false)
  ultimo.current = { datos, clases }

  const aplicar = () => {
    const m = mapa.current
    if (!m || !listo.current) return
    const { datos: d, clases: c } = ultimo.current
    ;(m.getSource(FUENTE) as { setData(d: unknown): void } | undefined)?.setData(d ?? { type: 'FeatureCollection', features: [] })
    pintarVias(m, FUENTE, c)
    if (d?.features.length && !encuadrado.current) {
      const caja = limites(d)
      if (caja) m.fitBounds(caja, { padding: 40, animate: false })
      encuadrado.current = true
    }
  }

  useEffect(() => {
    if (!contenedor.current || mapa.current) return
    const { mapa: m, desmontar } = crearMapaBase(contenedor.current, workerUrl)
    m.on('load', () => {
      agregarCapasVias(m, FUENTE, ultimo.current.clases)
      listo.current = true
      aplicar()
    })
    mapa.current = m
    return () => {
      listo.current = false
      encuadrado.current = false
      desmontar()
      mapa.current = null
    }
  }, [])

  useEffect(aplicar, [datos, clases])

  return <div ref={contenedor} className="h-full w-full" />
}
