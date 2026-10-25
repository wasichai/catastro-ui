import { useEffect, useRef } from 'react'
import { Popup } from 'maplibre-gl'
import type { ExpressionSpecification, Map, RasterTileSource } from 'maplibre-gl'
import { WMS_TILE_SIZE, wmsTileUrl } from '@wasichai/gis'
import { agregarCapasVias, capasDeVias, pintarVias, verVias } from '../aranceles/capasVias'
import type { TramosCollection } from '../aranceles/tipos'
import { GRIS } from '../comun/colores'
import { crearMapaBase, limites } from '../comun/mapa'
import { COLOR_SELECCION, colorDeLote, type Colorear } from './colores'
import { popupHtml } from './popup'
import type { CapaWms, LoteProps, LotesCollection } from './tipos'

const LOTES = 'brechas-lotes'
const RELLENO = `${LOTES}-relleno`
const BORDE = `${LOTES}-borde`
const SELECCION = `${LOTES}-seleccion`
const VIAS = 'brechas-vias'
const CAPAS_VIAS = capasDeVias(VIAS)
const WMS = 'brechas-wms-'

const VACIO = { type: 'FeatureCollection' as const, features: [] }

export interface BrechasMapaProps {
  // a new corte frames the map again
  corte: string | undefined
  lotes: LotesCollection | undefined
  // the filters of the table that the map applies itself (filtroDeLotes); null = every lote
  filtro: ExpressionSpecification | null
  colorear: Colorear
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

// the lotes of the brecha coloured by the chosen key, the vías with their arancel and GeoServer's WMS layers. each
// prop has its own effect, so a selection or an opacity does not send the lotes to the worker again: the GeoJSON goes
// only when it changes, the colours and filters by paint and filter, and the selection by feature-state
export default function BrechasMapa(props: BrechasMapaProps) {
  const contenedor = useRef<HTMLDivElement>(null)
  const mapa = useRef<Map | null>(null)
  const listo = useRef(false)
  const encuadrado = useRef(false)
  // the codes that have elegido = true in the feature-state
  const elegidos = useRef(new Set<string>())
  const ultimo = useRef(props)
  ultimo.current = props

  const conMapa = (f: (m: Map, p: BrechasMapaProps) => void) => () => {
    if (mapa.current && listo.current) f(mapa.current, ultimo.current)
  }

  const marcar = (m: Map, codigo: string, elegido: boolean) => m.setFeatureState({ source: LOTES, id: codigo }, { elegido })

  const aplicarSeleccion = conMapa((m, p) => {
    const nueva = new Set(p.seleccion)
    for (const c of elegidos.current) if (!nueva.has(c)) marcar(m, c, false)
    for (const c of nueva) if (!elegidos.current.has(c)) marcar(m, c, true)
    elegidos.current = nueva
  })

  const aplicarLotes = conMapa((m, p) => {
    ;(m.getSource(LOTES) as { setData(d: unknown): void } | undefined)?.setData(p.lotes ?? VACIO)
    // the new data may bring lotes that were selected before it came
    for (const c of elegidos.current) marcar(m, c, true)
    if (p.lotes?.features.length && !encuadrado.current) {
      const caja = limites(p.lotes)
      if (caja) m.fitBounds(caja, { padding: 40, animate: false })
      encuadrado.current = true
    }
  })

  const aplicarFiltro = conMapa((m, p) => {
    for (const capa of [RELLENO, BORDE, SELECCION]) m.setFilter(capa, p.filtro)
  })
  const aplicarColor = conMapa((m, p) => m.setPaintProperty(RELLENO, 'fill-color', colorDeLote(p.colorear)))
  const aplicarVias = conMapa((m, p) => {
    ;(m.getSource(VIAS) as { setData(d: unknown): void } | undefined)?.setData(p.mostrarVias && p.vias ? p.vias : VACIO)
    verVias(m, VIAS, p.mostrarVias)
  })
  const aplicarCortesVias = conMapa((m, p) => pintarVias(m, VIAS, p.cortesVias))
  const aplicarWms = conMapa((m, p) => sincronizarWms(m, p.wms))

  useEffect(() => {
    if (!contenedor.current || mapa.current) return
    // Shift + drag is the selection box here, not maplibre's box zoom
    const { mapa: m, desmontar } = crearMapaBase(contenedor.current, props.workerUrl, { boxZoom: false })
    m.on('load', () => {
      m.addSource(LOTES, { type: 'geojson', data: VACIO, promoteId: 'codigo_municipal' })
      m.addLayer({ id: RELLENO, type: 'fill', source: LOTES, paint: { 'fill-color': GRIS, 'fill-opacity': 0.6 } })
      m.addLayer({ id: BORDE, type: 'line', source: LOTES, paint: { 'line-color': '#374151', 'line-width': 0.5, 'line-opacity': 0.5 } })
      agregarCapasVias(m, VIAS)
      m.addLayer({
        id: SELECCION,
        type: 'line',
        source: LOTES,
        paint: { 'line-color': COLOR_SELECCION, 'line-width': 3, 'line-opacity': ['case', ['boolean', ['feature-state', 'elegido'], false], 1, 0] }
      })
      m.on('click', RELLENO, (e) => {
        // a vía over the lote opens its own popup
        if (ultimo.current.mostrarVias && m.queryRenderedFeatures(e.point, { layers: CAPAS_VIAS }).length) return
        const propiedades = e.features?.[0]?.properties as LoteProps | undefined
        if (!propiedades) return
        new Popup({ closeButton: false }).setLngLat(e.lngLat).setHTML(popupHtml(propiedades)).addTo(m)
        if (propiedades.codigo_municipal) ultimo.current.onSeleccionar([propiedades.codigo_municipal], e.originalEvent.shiftKey)
      })
      m.on('mouseenter', RELLENO, () => (m.getCanvas().style.cursor = 'pointer'))
      m.on('mouseleave', RELLENO, () => (m.getCanvas().style.cursor = ''))
      listo.current = true
      for (const aplicar of [aplicarColor, aplicarFiltro, aplicarLotes, aplicarSeleccion, aplicarVias, aplicarCortesVias, aplicarWms]) aplicar()
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
          background: 'rgba(209, 0, 209, 0.1)'
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
      // a Shift + click is the click's, not a box
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

    mapa.current = m
    return () => {
      lienzo.removeEventListener('mousedown', bajar, true)
      document.removeEventListener('mousemove', mover)
      document.removeEventListener('mouseup', soltar)
      listo.current = false
      encuadrado.current = false
      elegidos.current = new Set()
      desmontar()
      mapa.current = null
    }
  }, [])

  // declared before the lotes' effect: the new corte's lotes, when they come, frame the map
  useEffect(() => {
    encuadrado.current = false
  }, [props.corte])
  useEffect(aplicarLotes, [props.lotes])
  useEffect(aplicarFiltro, [props.filtro])
  useEffect(aplicarColor, [props.colorear])
  useEffect(aplicarSeleccion, [props.seleccion])
  useEffect(aplicarVias, [props.vias, props.mostrarVias])
  useEffect(aplicarCortesVias, [props.cortesVias])
  useEffect(aplicarWms, [props.wms])

  return (
    <div
      ref={contenedor}
      role="region"
      aria-label="Mapa de lotes. Clic elige un lote; Mayús + arrastre agrega los lotes del recuadro a la selección"
      className="h-full w-full"
    />
  )
}
