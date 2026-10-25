import { useQuery } from '@tanstack/react-query'
import { Map as IconoMapa } from 'lucide-react'
import { Link } from 'react-router'
import { api, useWasichaiLinks } from '@wasichai/core'
import type { MapViewRecord } from '@wasichai/gis'
import { Button } from '@wasichai/ui'

// a saved map view of gis (model/vistas_de_mapa.py creates them). the same query gis' own useMapView makes, which
// @wasichai/gis does not export: same key, so both share the cache. a view that is not there (404) or cannot be read
// (403) is an error, not retried
export function useVistaDeMapa(objeto: string, nombre: string) {
  return useQuery({
    queryKey: ['gis', 'map-views', objeto, nombre],
    queryFn: () => api<MapViewRecord>(`/gis/objects/${objeto}/map-views/${encodeURIComponent(nombre)}`),
    retry: false
  })
}

// the map page's query for a saved view. @wasichai/gis 1.2.0 loads ?view= but does not colour the map from the
// view's style, while ?by=&type=&classes= does: the view's style goes in the url too
export function enlaceDeVista(vista: MapViewRecord): Record<string, string> {
  const q: Record<string, string> = { object: vista.objectName, geometry: vista.geometryName, view: vista.name }
  if (vista.style) {
    q.by = vista.style.by
    q.type = vista.style.type
    if (vista.style.classes) q.classes = String(vista.style.classes)
  }
  return q
}

// «Abrir como vista de mapa»: gis' map page with the saved view, its colours and its legend. hidden while the view is
// not there, or when the app has no gis map page
export function AbrirVistaDeMapa({ objeto, vista, title }: { objeto: string; vista: string; title?: string }) {
  const links = useWasichaiLinks()
  const { data } = useVistaDeMapa(objeto, vista)
  if (!data || !links.has('gis:map')) return null
  return (
    <Button variant="secondary" size="sm" asChild>
      <Link to={links.to('gis:map', {}, enlaceDeVista(data))} title={title}>
        <IconoMapa aria-hidden className="h-4 w-4" />
        Abrir como vista de mapa
      </Link>
    </Button>
  )
}
