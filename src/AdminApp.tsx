import { useEffect } from 'react'
import { WasichaiApp, type WasichaiConfig } from '@wasichai/core'
import { gisModule } from '@wasichai/gis'
import { viewsModule } from '@wasichai/views'
import { arancelesModule } from './arancelesModule'
import { brechasModule } from './brechasModule'
import { ZONA_LIMA } from './comun/formato'

export const CONFIG: Partial<WasichaiConfig> = {
  apiBaseUrl: '/api',
  appName: 'Catastro Perené',
  appTagline: 'Administración',
  storagePrefix: 'catastro',
  basename: '/',
  // the seed's admin, in development only
  defaultLoginEmail: import.meta.env.DEV ? 'admin@wasichai.local' : undefined,
  // the DATETIME fields are read and written as Lima wall time, whatever the browser's zone
  timeZone: ZONA_LIMA,
  // catastro-backend's model lives in its repository (model/model.json): the admin warns that what is changed here is
  // not kept there and the next apply may undo it
  modelInRepository: true
}

// the whole app is wasichai's admin, at "/": core plus the modules catastro-backend runs (views, gis).
// workerUrl is maplibre's worker script, which main.tsx bundles: gis draws the lote and predio geometries with it
export function AdminApp({ workerUrl }: { workerUrl?: string }) {
  // map controls need maplibre's css: it comes with the admin, not in the first bundle
  useEffect(() => {
    void import('maplibre-gl/dist/maplibre-gl.css')
  }, [])
  return <WasichaiApp config={CONFIG} modules={[viewsModule(), gisModule({ workerUrl }), arancelesModule({ workerUrl }), brechasModule({ workerUrl })]} />
}
