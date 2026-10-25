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

// «Abrir como vista de mapa»: gis' map page with the saved view, its colours and its legend. hidden while the view is
// not there, or when the app has no gis map page
export function AbrirVistaDeMapa({ objeto, vista, title }: { objeto: string; vista: string; title?: string }) {
  const links = useWasichaiLinks()
  const { data } = useVistaDeMapa(objeto, vista)
  if (!data || !links.has('gis:map')) return null
  return (
    <Button variant="secondary" size="sm" asChild>
      <Link to={links.to('gis:map', {}, { object: data.objectName, geometry: data.geometryName, view: data.name })} title={title}>
        <IconoMapa aria-hidden className="h-4 w-4" />
        Abrir como vista de mapa
      </Link>
    </Button>
  )
}
