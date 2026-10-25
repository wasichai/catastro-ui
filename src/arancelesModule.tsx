import type { WasichaiModule } from '@wasichai/core'
import { Route } from 'lucide-react'

export const ARANCELES_MODULE_ID = 'aranceles'

export interface ArancelesModuleOptions {
  // maplibre's worker script, the same one gisModule gets
  workerUrl?: string
}

// «Aranceles por vía»: the tramos of the vías coloured by the arancel of a year. the page is lazy, so the map stays
// out of the first bundle
export function arancelesModule({ workerUrl }: ArancelesModuleOptions = {}): WasichaiModule {
  return {
    id: ARANCELES_MODULE_ID,
    basePath: 'aranceles',
    routes: [
      {
        id: 'vias',
        path: 'vias',
        lazy: () => import('./aranceles/ArancelesViaPage').then((m) => ({ default: () => <m.ArancelesViaPage workerUrl={workerUrl} /> }))
      }
    ],
    navGroups: [{ id: 'aranceles', labelKey: 'aranceles:nav.aranceles', order: 25 }],
    nav: [
      {
        group: 'aranceles',
        labelKey: 'aranceles:nav.vias',
        order: 10,
        icon: Route,
        route: 'vias',
        // the menu shows only to who can READ tramo_via; an admin can everything
        visible: (permissions) => !!permissions && (permissions.admin || (permissions.objects.tramo_via ?? []).includes('READ'))
      }
    ],
    i18n: { es: { nav: { aranceles: 'Aranceles', vias: 'Aranceles por vía' } } }
  }
}
