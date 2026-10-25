import { useEffect } from 'react'
import { WasichaiApp } from '@wasichai/core'
import { gisModule } from '@wasichai/gis'
import { viewsModule } from '@wasichai/views'
import { arancelesModule } from './arancelesModule'

// the whole app is wasichai's admin, at "/": core plus the modules catastro-backend runs (views, gis).
// workerUrl is maplibre's worker script, which main.tsx bundles: gis draws the lote and predio geometries with it
export function AdminApp({ workerUrl }: { workerUrl?: string }) {
  // map controls need maplibre's css: it comes with the admin, not in the first bundle
  useEffect(() => {
    void import('maplibre-gl/dist/maplibre-gl.css')
  }, [])
  return (
    <WasichaiApp
      config={{
        apiBaseUrl: '/api',
        appName: 'Catastro Perené',
        appTagline: 'Administración',
        storagePrefix: 'catastro',
        basename: '/',
        // the seed's admin, in development only
        defaultLoginEmail: import.meta.env.DEV ? 'admin@wasichai.local' : undefined
      }}
      modules={[viewsModule(), gisModule({ workerUrl }), arancelesModule({ workerUrl })]}
    />
  )
}
