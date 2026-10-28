import { QueryClient, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { BrowserRouter } from 'react-router'
import {
  coreModule,
  createApiClient,
  createRegistry,
  createWasichaiI18n,
  resolveConfig,
  useApiClient,
  useAuth,
  WasichaiProviders,
  WasichaiRoutes,
  type WasichaiConfig
} from '@wasichai/core'
import { gisModule } from '@wasichai/gis'
import { viewsModule } from '@wasichai/views'
import { arancelesModule } from './arancelesModule'
import { brechasModule } from './brechasModule'
import { ZONA_LIMA } from './comun/formato'

// what a municipalidad's name says before the place: «Municipalidad Provincial de Ica» is «Ica»
const TIPO_DE_MUNICIPALIDAD = /^municipalidad(\s+(provincial|distrital|metropolitana))?\s+de\s+/i

// the app's name for the organization's institution (the core's GET /organizations/current name): «Catastro Ica» for
// «Municipalidad Provincial de Ica», «Catastro» without one, before signing in, while it loads or if it fails
export function nombreApp(institucion?: string | null): string {
  const lugar = institucion?.trim().replace(TIPO_DE_MUNICIPALIDAD, '').trim()
  return lugar ? `Catastro ${lugar}` : 'Catastro'
}

export const CONFIG: Partial<WasichaiConfig> = {
  apiBaseUrl: '/api',
  // the neutral one: the shell and the tab name the organization's institution once signed in (nombreApp)
  appName: nombreApp(null),
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
// workerUrl is maplibre's worker script, which main.tsx bundles: gis draws the lote and predio geometries with it.
// it is WasichaiApp's wiring by hand: WasichaiApp reads its config once, and one build serves several municipalidades,
// so the name in the shell follows the organization of whoever signs in (WasichaiProviders takes a config that changes)
export function AdminApp({ workerUrl }: { workerUrl?: string }) {
  // map controls need maplibre's css: it comes with the admin, not in the first bundle
  useEffect(() => {
    void import('maplibre-gl/dist/maplibre-gl.css')
  }, [])
  const [app] = useState(() => {
    const config = resolveConfig(CONFIG)
    const modules = [viewsModule(), gisModule({ workerUrl, wmsAuth: true }), arancelesModule({ workerUrl }), brechasModule({ workerUrl })]
    const registry = createRegistry([coreModule, ...modules])
    const apiClient = createApiClient({ baseUrl: config.apiBaseUrl, storagePrefix: config.storagePrefix })
    const i18n = createWasichaiI18n({ languages: config.languages, storageKey: apiClient.keys.lang, modules: registry.modules })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } })
    return { config, registry, apiClient, i18n, queryClient }
  })
  const [institucion, setInstitucion] = useState<string | null>(null)
  const appName = nombreApp(institucion)
  const config = useMemo(() => ({ ...app.config, appName }), [app.config, appName])
  // index.html's <title> is the neutral one: the tab says what the shell says
  useEffect(() => {
    document.title = appName
  }, [appName])

  return (
    <WasichaiProviders config={config} registry={app.registry} apiClient={app.apiClient} i18n={app.i18n} queryClient={app.queryClient}>
      <Institucion onCambio={setInstitucion} />
      <BrowserRouter basename={config.basename}>
        <WasichaiRoutes />
      </BrowserRouter>
    </WasichaiProviders>
  )
}

// the name of the signed-in user's organization (the core's GET /organizations/current), asked once per organization:
// null signed out, while it loads or if it fails
function Institucion({ onCambio }: { onCambio: (nombre: string | null) => void }) {
  const { user } = useAuth()
  const apiClient = useApiClient()
  const organizacion = useQuery({
    queryKey: ['catastro', 'organizacion', user?.organizationId],
    queryFn: () => apiClient.request<{ name?: string | null }>('/organizations/current'),
    enabled: user != null,
    staleTime: Infinity
  })
  const nombre = user ? (organizacion.data?.name ?? null) : null
  useEffect(() => {
    onCambio(nombre)
  }, [nombre, onCambio])
  return null
}
