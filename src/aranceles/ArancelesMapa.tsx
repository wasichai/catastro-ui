import { useEffect, useRef } from 'react'
import { Map, NavigationControl, Popup, ScaleControl, setWorkerUrl } from 'maplibre-gl'
import type { LngLatBoundsLike } from 'maplibre-gl'
import { DESPLAZAMIENTO, FILTRO_CON_VALOR, FILTRO_SIN_ARANCEL_ANIO, FILTRO_SIN_ASIGNAR, GRIS, colorPorValor } from './colores'
import { popupHtml } from './popup'
import type { TramoProps, TramosCollection } from './tipos'

const FUENTE = 'aranceles-via'
const CAPAS = ['con-valor', 'sin-arancel-anio', 'sin-asignar'].map((id) => `${FUENTE}-${id}`)

// the same raster basemap as @wasichai/gis, so no key is needed
const ESTILO = {
  version: 8 as const,
  sources: {
    osm: { type: 'raster' as const, tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap contributors' }
  },
  layers: [{ id: 'osm', type: 'raster' as const, source: 'osm' }]
}

interface Props {
  datos: TramosCollection | undefined
  cortes: number[]
  workerUrl?: string
}

function limites(datos: TramosCollection): LngLatBoundsLike | null {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity]
  const recorrer = (c: unknown) => {
    if (!Array.isArray(c)) return
    if (typeof c[0] === 'number' && typeof c[1] === 'number') {
      x0 = Math.min(x0, c[0])
      y0 = Math.min(y0, c[1])
      x1 = Math.max(x1, c[0])
      y1 = Math.max(y1, c[1])
    } else c.forEach(recorrer)
  }
  datos.features.forEach((f) => recorrer(f.geometry.coordinates))
  return Number.isFinite(x0)
    ? [
        [x0, y0],
        [x1, y1]
      ]
    : null
}

// the map: the tramos as lines, coloured by valor_m2 in classes; grey solid where the year has no arancel, grey dashed
// where the tramo was never assigned one. frentes IZQUIERDO and DERECHO are offset to their side of the eje
export default function ArancelesMapa({ datos, cortes, workerUrl }: Props) {
  const contenedor = useRef<HTMLDivElement>(null)
  const mapa = useRef<Map | null>(null)
  const listo = useRef(false)
  const ultimo = useRef({ datos, cortes })
  const encuadrado = useRef(false)
  ultimo.current = { datos, cortes }

  const aplicar = () => {
    const m = mapa.current
    if (!m || !listo.current) return
    const { datos: d, cortes: c } = ultimo.current
    ;(m.getSource(FUENTE) as { setData(d: unknown): void } | undefined)?.setData(d ?? { type: 'FeatureCollection', features: [] })
    m.setPaintProperty(`${FUENTE}-con-valor`, 'line-color', colorPorValor(c))
    if (d?.features.length && !encuadrado.current) {
      const caja = limites(d)
      if (caja) m.fitBounds(caja, { padding: 40, animate: false })
      encuadrado.current = true
    }
  }

  useEffect(() => {
    if (!contenedor.current || mapa.current) return
    // gis hands the worker to maplibre only when its own map mounts; this page may open first
    if (workerUrl) {
      try {
        setWorkerUrl(workerUrl)
      } catch {
        // maplibre already has workers: the url it was given before is the one in use
      }
    }
    const m = new Map({ container: contenedor.current, style: ESTILO, center: [-75.73, -14.07], zoom: 12, attributionControl: { compact: true } })
    m.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    m.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left')
    m.on('load', () => {
      m.addSource(FUENTE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      const base = { type: 'line' as const, source: FUENTE, layout: { 'line-cap': 'round' as const, 'line-join': 'round' as const } }
      m.addLayer({
        ...base,
        id: `${FUENTE}-con-valor`,
        filter: FILTRO_CON_VALOR,
        paint: { 'line-color': colorPorValor(ultimo.current.cortes), 'line-width': 3, 'line-offset': DESPLAZAMIENTO }
      })
      m.addLayer({
        ...base,
        id: `${FUENTE}-sin-arancel-anio`,
        filter: FILTRO_SIN_ARANCEL_ANIO,
        paint: { 'line-color': GRIS, 'line-width': 3, 'line-offset': DESPLAZAMIENTO }
      })
      m.addLayer({
        ...base,
        id: `${FUENTE}-sin-asignar`,
        filter: FILTRO_SIN_ASIGNAR,
        paint: { 'line-color': GRIS, 'line-width': 3, 'line-dasharray': [2, 2], 'line-offset': DESPLAZAMIENTO }
      })
      for (const capa of CAPAS) {
        m.on('click', capa, (e) => {
          const propiedades = e.features?.[0]?.properties as TramoProps | undefined
          if (propiedades) new Popup({ closeButton: false }).setLngLat(e.lngLat).setHTML(popupHtml(propiedades)).addTo(m)
        })
        m.on('mouseenter', capa, () => (m.getCanvas().style.cursor = 'pointer'))
        m.on('mouseleave', capa, () => (m.getCanvas().style.cursor = ''))
      }
      listo.current = true
      aplicar()
    })
    const observador = new ResizeObserver(() => m.resize())
    observador.observe(contenedor.current)
    mapa.current = m
    return () => {
      observador.disconnect()
      listo.current = false
      encuadrado.current = false
      m.remove()
      mapa.current = null
    }
  }, [])

  useEffect(aplicar, [datos, cortes])

  return <div ref={contenedor} className="h-full w-full" />
}
