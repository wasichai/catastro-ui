import { Map, NavigationControl, ScaleControl, setWorkerUrl } from 'maplibre-gl'
import type { LngLatBoundsLike, MapOptions } from 'maplibre-gl'

// the same raster basemap as @wasichai/gis, so no key is needed
export const ESTILO = {
  version: 8 as const,
  sources: {
    osm: {
      type: 'raster' as const,
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors'
    }
  },
  layers: [{ id: 'osm', type: 'raster' as const, source: 'osm' }]
}

// the box around every coordinate of the features
export function limites(datos: { features: { geometry: { coordinates: unknown } }[] }): LngLatBoundsLike | null {
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

// the map every catastro page draws on: the basemap over Perené/Ica, the zoom and scale controls, and a resize when
// its box changes. desmontar() undoes it all
export function crearMapaBase(contenedor: HTMLElement, workerUrl: string | undefined, opciones: Partial<MapOptions> = {}) {
  // gis hands the worker to maplibre only when its own map mounts; this page may open first
  if (workerUrl) {
    try {
      setWorkerUrl(workerUrl)
    } catch {
      // maplibre already has workers: the url it was given before is the one in use
    }
  }
  const mapa = new Map({ container: contenedor, style: ESTILO, center: [-75.73, -14.07], zoom: 12, attributionControl: { compact: true }, ...opciones })
  mapa.addControl(new NavigationControl({ showCompass: false }), 'top-right')
  mapa.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left')
  const observador = new ResizeObserver(() => mapa.resize())
  observador.observe(contenedor)
  return {
    mapa,
    desmontar: () => {
      observador.disconnect()
      mapa.remove()
    }
  }
}
