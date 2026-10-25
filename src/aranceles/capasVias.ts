import { Popup } from 'maplibre-gl'
import type { Map } from 'maplibre-gl'
import { GRIS, colorPorValor } from '../comun/colores'
import { DESPLAZAMIENTO, FILTRO_CON_VALOR, FILTRO_SIN_ARANCEL_ANIO, FILTRO_SIN_ASIGNAR } from './colores'
import { popupHtml } from './popup'
import type { TramoProps } from './tipos'

const VACIO = { type: 'FeatureCollection' as const, features: [] }

// the ids of the three line layers of a vías source
export const capasDeVias = (fuente: string) => ['con-valor', 'sin-arancel-anio', 'sin-asignar'].map((id) => `${fuente}-${id}`)

// the tramos as lines, coloured by valor_m2 in classes; grey solid where the year has no arancel, grey dashed where the
// tramo was never assigned one. frentes IZQUIERDO and DERECHO are offset to their side of the eje. a click opens the
// tramo's popup. «Aranceles por vía» and «Brechas» both draw them with this
export function agregarCapasVias(m: Map, fuente: string, cortes: number[] = []) {
  m.addSource(fuente, { type: 'geojson', data: VACIO })
  const base = { type: 'line' as const, source: fuente, layout: { 'line-cap': 'round' as const, 'line-join': 'round' as const } }
  const paint = { 'line-width': 3, 'line-offset': DESPLAZAMIENTO }
  const [conValor, sinArancelAnio, sinAsignar] = capasDeVias(fuente) as [string, string, string]
  m.addLayer({ ...base, id: conValor, filter: FILTRO_CON_VALOR, paint: { ...paint, 'line-color': colorPorValor(cortes) } })
  m.addLayer({ ...base, id: sinArancelAnio, filter: FILTRO_SIN_ARANCEL_ANIO, paint: { ...paint, 'line-color': GRIS } })
  m.addLayer({ ...base, id: sinAsignar, filter: FILTRO_SIN_ASIGNAR, paint: { ...paint, 'line-color': GRIS, 'line-dasharray': [2, 2] } })
  for (const capa of capasDeVias(fuente)) {
    m.on('click', capa, (e) => {
      const propiedades = e.features?.[0]?.properties as TramoProps | undefined
      if (propiedades) new Popup({ closeButton: false }).setLngLat(e.lngLat).setHTML(popupHtml(propiedades)).addTo(m)
    })
    m.on('mouseenter', capa, () => (m.getCanvas().style.cursor = 'pointer'))
    m.on('mouseleave', capa, () => (m.getCanvas().style.cursor = ''))
  }
}

// the classes of the lines with a value
export function pintarVias(m: Map, fuente: string, cortes: number[]) {
  m.setPaintProperty(`${fuente}-con-valor`, 'line-color', colorPorValor(cortes))
}

export function verVias(m: Map, fuente: string, visibles: boolean) {
  for (const capa of capasDeVias(fuente)) m.setLayoutProperty(capa, 'visibility', visibles ? 'visible' : 'none')
}
