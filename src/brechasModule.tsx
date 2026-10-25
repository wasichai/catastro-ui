import type { WasichaiModule } from '@wasichai/core'
import { ChartColumnBig } from 'lucide-react'

export const BRECHAS_MODULE_ID = 'brechas'

export interface BrechasModuleOptions {
  // maplibre's worker script, the same one gisModule gets
  workerUrl?: string
}

// «Brechas»: the dashboard of a corte of srtm's brecha, its map and the decisions over its fichas. the page is lazy,
// so the map stays out of the first bundle
export function brechasModule({ workerUrl }: BrechasModuleOptions = {}): WasichaiModule {
  return {
    id: BRECHAS_MODULE_ID,
    basePath: 'brechas',
    routes: [
      {
        id: 'panel',
        path: 'panel',
        lazy: () => import('./brechas/BrechasPage').then((m) => ({ default: () => <m.BrechasPage workerUrl={workerUrl} /> }))
      }
    ],
    navGroups: [{ id: 'fiscalizacion', labelKey: 'brechas:nav.fiscalizacion', order: 26 }],
    nav: [
      {
        group: 'fiscalizacion',
        labelKey: 'brechas:nav.brechas',
        order: 10,
        icon: ChartColumnBig,
        route: 'panel',
        // the endpoints read brecha_ficha: the menu shows only to who can READ it; an admin can everything
        visible: (permissions) => !!permissions && (permissions.admin || (permissions.objects.brecha_ficha ?? []).includes('READ'))
      }
    ],
    i18n: { es: { nav: { fiscalizacion: 'Fiscalización', brechas: 'Brechas' } } }
  }
}
