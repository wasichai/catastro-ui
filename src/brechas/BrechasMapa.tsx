import { useEffect, useRef } from 'react'
import { Map, NavigationControl, Popup, ScaleControl, setWorkerUrl } from 'maplibre-gl'
import type { ExpressionSpecification, RasterTileSource } from 'maplibre-gl'
import { WMS_TILE_SIZE, wmsTileUrl } from '@wasichai/gis'
import { ESTILO, limites } from '../aranceles/ArancelesMapa'
import { DESPLAZAMIENTO, FILTRO_CON_VALOR, FILTRO_SIN_ARANCEL_ANIO, FILTRO_SIN_ASIGNAR, GRIS, colorPorValor } from '../aranceles/colores'
import type { TramosCollection } from '../aranceles/tipos'
import { COLOR_SELECCION, colorDeLote, type Colorear } from './colores'
import { popupHtml } from './popup'
import type { CapaWms, LoteProps, LotesCollection } from './tipos'

const LOTES = 'brechas-lotes'
const RELLENO = `${LOTES}-relleno`
const BORDE = `${LOTES}-borde`
const SELECCION = `${LOTES}-seleccion`
const VIAS = 'brechas-vias'
const CAPAS_VIAS = ['con-valor', 'sin-arancel-anio', 'sin-asignar'].map((id) => `${VIAS}-${id}`)
const WMS = 'brechas-wms-'

const VACIO = { type: 'FeatureCollection' as const, features: [] }

export interface BrechasMapaProps {
  lotes: LotesCollection | undefined
  colorear: Colorear
  cortesDelta: number[]
  // the codigo_municipal of the selected lotes, shared with the table
  seleccion: string[]
  // a click replaces the selection with its lote (adds it with Shift); a Shift + drag box adds every lote inside
  onSeleccionar: (codigos: string[], agregar: boolean) => void
  vias: TramosCollection | undefined
  mostrarVias: boolean
  cortesVias: number[]
  wms: CapaWms[]
  workerUrl?: string
}

const filtroSeleccion = (codigos: string[]) => ['in', ['get', 'codigo_municipal'], ['literal', codigos]] as unknown as ExpressionSpecification

// GeoServer's layers, as raster tiles in EPSG:3857 under the lotes: the same url gis' own map builds
function sincronizarWms(m: Map, capas: CapaWms[]) {
  const quedan = new Set(capas.map((c) => WMS + c.id))
  for (const id of (m.getStyle().layers ?? []).map((l) => l.id).filter((id) => id.startsWith(WMS) && !quedan.has(id))) {
    m.removeLayer(id)
    m.removeSource(id)
  }
  for (const capa of capas) {
    const id = WMS + capa.id
    const teselas = wmsTileUrl(capa.url, WMS_TILE_SIZE)
    const fuente = m.getSource(id) as RasterTileSource | undefined
    if (fuente && fuente.tiles?.[0] === teselas) {
      m.setPaintProperty(id, 'raster-opacity', capa.opacity)
      continue
    }
    if (m.getLayer(id)) m.removeLayer(id)
    if (fuente) m.removeSource(id)
    m.addSource(id, { type: 'raster', tiles: [teselas], tileSize: WMS_TILE_SIZE })
    m.addLayer({ id, type: 'raster', source: id, paint: { 'raster-opacity': capa.opacity } }, RELLENO)
  }
}

// the lotes of the brecha coloured by the chosen key, the vías with their arancel and GeoServer's WMS layers. the
// selection is drawn as a dark outline and goes back to the page through onSeleccionar
export default function BrechasMapa(props: BrechasMapaProps) {
  const contenedor = useRef<HTMLDivElement>(null)
  const mapa = useRef<Map | null>(null)
  const listo = useRef(false)
  const encuadrado = useRef(false)
  const ultimo = useRef(props)
  ultimo.current = props

  const aplicar = () => {
    const m = mapa.current
    if (!m || !listo.current) return
    const p = ultimo.current
    ;(m.getSource(LOTES) as { setData(d: unknown): void } | undefined)?.setData(p.lotes ?? VACIO)
    m.setPaintProperty(RELLENO, 'fill-color', colorDeLote(p.colorear, p.cortesDelta))
    m.setFilter(SELECCION, filtroSeleccion(p.seleccion))
    ;(m.getSource(VIAS) as { setData(d: unknown): void } | undefined)?.setData(p.mostrarVias && p.vias ? p.vias : VACIO)
    m.setPaintProperty(`${VIAS}-con-valor`, 'line-color', colorPorValor(p.cortesVias))
    for (const capa of CAPAS_VIAS) m.setLayoutProperty(capa, 'visibility', p.mostrarVias ? 'visible' : 'none')
    sincronizarWms(m, p.wms)
    if (p.lotes?.features.length && !encuadrado.current) {
      const caja = limites(p.lotes)
      if (caja) m.fitBounds(caja, { padding: 40, animate: false })
      encuadrado.current = true
    }
  }

  useEffect(() => {
    if (!contenedor.current || mapa.current) return
    // gis hands the worker to maplibre only when its own map mounts; this page may open first
    if (props.workerUrl) {
      try {
        setWorkerUrl(props.workerUrl)
      } catch {
        // maplibre already has workers: the url it was given before is the one in use
      }
    }
    // Shift + drag is the selection box here, not maplibre's box zoom
    const m = new Map({
      container: contenedor.current,
      style: ESTILO,
      center: [-75.73, -14.07],
      zoom: 12,
      boxZoom: false,
      attributionControl: { compact: true }
    })
    m.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    m.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left')
    m.on('load', () => {
      m.addSource(LOTES, { type: 'geojson', data: VACIO })
      m.addLayer({ id: RELLENO, type: 'fill', source: LOTES, paint: { 'fill-color': GRIS, 'fill-opacity': 0.6 } })
      m.addLayer({ id: BORDE, type: 'line', source: LOTES, paint: { 'line-color': '#ffffff', 'line-width': 0.5 } })
      m.addSource(VIAS, { type: 'geojson', data: VACIO })
      const base = { type: 'line' as const, source: VIAS, layout: { 'line-cap': 'round' as const, 'line-join': 'round' as const } }
      const paint = { 'line-width': 3, 'line-offset': DESPLAZAMIENTO }
      m.addLayer({ ...base, id: `${VIAS}-con-valor`, filter: FILTRO_CON_VALOR, paint: { ...paint, 'line-color': GRIS } })
      m.addLayer({ ...base, id: `${VIAS}-sin-arancel-anio`, filter: FILTRO_SIN_ARANCEL_ANIO, paint: { ...paint, 'line-color': GRIS } })
      m.addLayer({ ...base, id: `${VIAS}-sin-asignar`, filter: FILTRO_SIN_ASIGNAR, paint: { ...paint, 'line-color': GRIS, 'line-dasharray': [2, 2] } })
      m.addLayer({ id: SELECCION, type: 'line', source: LOTES, filter: filtroSeleccion([]), paint: { 'line-color': COLOR_SELECCION, 'line-width': 2.5 } })
      m.on('click', RELLENO, (e) => {
        const propiedades = e.features?.[0]?.properties as LoteProps | undefined
        if (!propiedades) return
        new Popup({ closeButton: false }).setLngLat(e.lngLat).setHTML(popupHtml(propiedades)).addTo(m)
        if (propiedades.codigo_municipal) ultimo.current.onSeleccionar([propiedades.codigo_municipal], e.originalEvent.shiftKey)
      })
      m.on('mouseenter', RELLENO, () => (m.getCanvas().style.cursor = 'pointer'))
      m.on('mouseleave', RELLENO, () => (m.getCanvas().style.cursor = ''))
      listo.current = true
      aplicar()
    })

    // the selection box: Shift + drag draws it, and on release every lote under it joins the selection
    const lienzo = m.getCanvasContainer()
    let inicio: [number, number] | null = null
    let recuadro: HTMLDivElement | null = null
    const punto = (e: MouseEvent): [number, number] => {
      const r = lienzo.getBoundingClientRect()
      return [e.clientX - r.left - lienzo.clientLeft, e.clientY - r.top - lienzo.clientTop]
    }
    const mover = (e: MouseEvent) => {
      if (!inicio) return
      const fin = punto(e)
      if (!recuadro) {
        recuadro = document.createElement('div')
        recuadro.setAttribute('aria-hidden', 'true')
        Object.assign(recuadro.style, {
          position: 'absolute',
          top: '0',
          left: '0',
          pointerEvents: 'none',
          border: `2px dashed ${COLOR_SELECCION}`,
          background: 'rgba(17, 24, 39, 0.1)'
        })
        lienzo.appendChild(recuadro)
      }
      const [x0, y0] = [Math.min(inicio[0], fin[0]), Math.min(inicio[1], fin[1])]
      recuadro.style.transform = `translate(${x0}px, ${y0}px)`
      recuadro.style.width = `${Math.abs(fin[0] - inicio[0])}px`
      recuadro.style.height = `${Math.abs(fin[1] - inicio[1])}px`
    }
    const soltar = (e: MouseEvent) => {
      document.removeEventListener('mousemove', mover)
      document.removeEventListener('mouseup', soltar)
      m.dragPan.enable()
      const desde = inicio
      inicio = null
      recuadro?.remove()
      recuadro = null
      if (!desde || !listo.current) return
      const hasta = punto(e)
      if (Math.abs(hasta[0] - desde[0]) < 3 && Math.abs(hasta[1] - desde[1]) < 3) return
      const codigos = m.queryRenderedFeatures([desde, hasta], { layers: [RELLENO] }).flatMap((f) => {
        const codigo = (f.properties as Partial<LoteProps>).codigo_municipal
        return codigo ? [codigo] : []
      })
      if (codigos.length) ultimo.current.onSeleccionar([...new Set(codigos)], true)
    }
    const bajar = (e: MouseEvent) => {
      if (!e.shiftKey || e.button !== 0) return
      e.preventDefault()
      m.dragPan.disable()
      inicio = punto(e)
      document.addEventListener('mousemove', mover)
      document.addEventListener('mouseup', soltar)
    }
    lienzo.addEventListener('mousedown', bajar, true)

    const observador = new ResizeObserver(() => m.resize())
    observador.observe(contenedor.current)
    mapa.current = m
    return () => {
      lienzo.removeEventListener('mousedown', bajar, true)
      document.removeEventListener('mousemove', mover)
      document.removeEventListener('mouseup', soltar)
      observador.disconnect()
      listo.current = false
      encuadrado.current = false
      m.remove()
      mapa.current = null
    }
  }, [])

  useEffect(aplicar, [props.lotes, props.colorear, props.cortesDelta, props.seleccion, props.vias, props.mostrarVias, props.cortesVias, props.wms])

  return (
    <div
      ref={contenedor}
      role="region"
      aria-label="Mapa de lotes. Clic elige un lote; Mayús + arrastre agrega los lotes del recuadro a la selección"
      className="h-full w-full"
    />
  )
}
