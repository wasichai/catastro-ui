import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, renderWithProviders, type FetchMock, type MockRoute } from '@wasichai/testing'
import { brechasModule } from '../brechasModule'
import type { BrechasMapaProps } from './BrechasMapa'
import { BrechasPage } from './BrechasPage'
import type { Corte, Ficha, LoteFeature, Panel } from './tipos'

// jsdom has no webgl: the map is a stub that shows what it was given and lets the test select like a click or a box
vi.mock('./BrechasMapa', () => ({
  default: (p: BrechasMapaProps) => (
    <div data-testid="mapa">
      <span data-testid="mapa-lotes">{p.lotes?.features.length ?? 0} lotes</span>
      <span data-testid="mapa-seleccion">{p.seleccion.join(',')}</span>
      <span data-testid="mapa-wms">{p.wms.map((w) => `${w.id}@${w.opacity}`).join(',')}</span>
      <span data-testid="mapa-vias">{p.mostrarVias ? `${p.vias?.features.length ?? 0} vías` : 'sin vías'}</span>
      <span data-testid="mapa-colorear">{p.colorear}</span>
      <button onClick={() => p.onSeleccionar(['M2', 'M3'], true)}>recuadro M2 M3</button>
      <button onClick={() => p.onSeleccionar(['M1'], false)}>clic M1</button>
    </div>
  )
}))

// fictitious data, built here
const CORTE_A = 'ica-prueba|2026-10-18'
const CORTE_B = 'ica-prueba|2026-04-01'
const cortes: Corte[] = [
  { clave: CORTE_A, fecha: '2026-10-18', anio: 2026, corrida: 'r2', total_fichas: 3, delta_impuesto: 850.5, cargado_en: '2026-10-19T10:00:00' },
  { clave: CORTE_B, fecha: '2026-04-01', anio: 2025, corrida: 'r1', total_fichas: 2, delta_impuesto: 120, cargado_en: '2026-04-02T10:00:00' }
]

const panel = (anio = 2026, clave = CORTE_A): Panel => ({
  corte: { clave, fecha: '2026-10-18', anio, corrida: 'r2' },
  kpis: { fichas: 30, delta_impuesto: 850.5, delta_impuesto_confiable: 600, omisos_estimado: 3, supera_5_uit: 2, pendientes: 25, con_geometria: 28 },
  por_categoria: [
    { clave: 'OMISO', fichas: 10, delta_impuesto: 500 },
    { clave: 'COINCIDE', fichas: 5, delta_impuesto: 0 }
  ],
  por_confianza: [{ clave: 'CONFIABLE', fichas: 20, delta_impuesto: 600 }],
  por_estado: [
    { clave: 'PENDIENTE', fichas: 25 },
    { clave: 'DESCARTADO', fichas: 5 }
  ],
  top_sectores: [{ sector: '02', fichas: 8, delta_impuesto: 400 }]
})

const ficha = (i: number, codigo: string | null, extra: Partial<Ficha> = {}): Ficha => ({
  id: `f${i}`,
  codigo_catastro: `CC-${i}`,
  codigo_municipal: codigo,
  codigo_predio: null,
  categoria: 'OMISO',
  confianza: 'CONFIABLE',
  confianza_motivo: null,
  sector: '02',
  manzana: '10',
  lote: String(i),
  uso: 'VIVIENDA',
  autoavaluo_declarado: 0,
  autoavaluo_catastro: 10000,
  delta_autoavaluo: 10000,
  impuesto_declarado: 0,
  impuesto_catastro: 20,
  delta_impuesto: 20,
  delta_arbitrios: 0,
  estimado: false,
  motivo: null,
  supera_5_uit: false,
  estado: 'PENDIENTE',
  responsable: null,
  nota: null,
  decidido_en: null,
  con_geometria: true,
  ...extra
})

const fichas = [ficha(1, 'M1'), ficha(2, 'M2'), ficha(3, null, { categoria: 'SIN_CATASTRO' })]
const pagina = { content: fichas, page: 0, size: 50, totalElements: 3, totalPages: 1 }

const lote = (codigo: string): LoteFeature => ({
  type: 'Feature',
  id: codigo,
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [-75.7, -14.0],
        [-75.69, -14.0],
        [-75.69, -14.01],
        [-75.7, -14.0]
      ]
    ]
  },
  properties: {
    codigo_municipal: codigo,
    codigo_catastro: `CC-${codigo}`,
    categoria: 'OMISO',
    confianza: 'CONFIABLE',
    delta_impuesto: 20,
    estado: 'PENDIENTE',
    supera_5_uit: false
  }
})

const rutas = (extra: MockRoute[] = []): MockRoute[] => [
  ...extra,
  { path: '/catastro/brechas/cortes', body: cortes },
  { path: '/catastro/brechas/panel', body: panel() },
  { path: '/catastro/brechas/fichas', body: pagina },
  { path: '/catastro/brechas/lotes', body: { type: 'FeatureCollection', features: [lote('M1'), lote('M2')] } },
  { path: '/gis/services', body: { enabled: false, url: '', workspace: '', wms: '', wfs: '', wmts: '' } }
]

const parametrosDe = (url: string) => new URL(url, 'http://localhost').searchParams
const llamadas = (f: FetchMock, path: string) => f.calls.filter((c) => c.path.split('?')[0] === path)

let fetch: FetchMock | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  fetch?.restore()
  vi.restoreAllMocks()
})

const abrir = async (extra: MockRoute[] = [], permissions?: { admin: boolean; objects: Record<string, string[]> }) => {
  fetch = mockFetch(rutas(extra))
  renderWithProviders(<BrechasPage />, permissions ? { permissions } : {})
  await screen.findByRole('cell', { name: 'M1' })
  return fetch
}

describe('BrechasPage', () => {
  it('shows the KPIs and the bars of the corte', async () => {
    await abrir()
    expect(within(screen.getByRole('group', { name: 'Δ impuesto' })).getByText('S/ 850.50')).toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: 'Δ confiable' })).getByText('S/ 600.00')).toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: 'Omisos estimados' })).getByText('3')).toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: 'Superan 5 UIT' })).getByText('2')).toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: 'Pendientes de decidir' })).getByText('25')).toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: 'Con geometría' })).getByText('28')).toBeInTheDocument()
    const categorias = screen.getByRole('list', { name: 'Por categoría' })
    expect(within(categorias).getByText('Omiso')).toBeInTheDocument()
    expect(within(categorias).getByText('10 · S/ 500.00')).toBeInTheDocument()
    expect(screen.getByTestId('barra-OMISO')).toHaveStyle({ width: '100%' })
    expect(screen.getByTestId('barra-COINCIDE')).toHaveStyle({ width: '50%' })
    expect(within(screen.getByRole('list', { name: 'Por estado' })).getByText('Descartado')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Por confianza' })).getByText('Confiable')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Sectores con más Δ impuesto' })).getByText('Sector 02')).toBeInTheDocument()
    expect(screen.getByTestId('mapa-lotes')).toHaveTextContent('2 lotes')
    // the most recent corte, by default
    expect(parametrosDe(llamadas(fetch!, '/catastro/brechas/panel')[0]!.url).get('corte')).toBe(CORTE_A)
  })

  it('sends each filter to the fichas and the lotes, and the order to the fichas', async () => {
    const f = await abrir()
    await userEvent.click(screen.getByRole('button', { name: 'Omiso' }))
    await userEvent.click(screen.getByRole('button', { name: 'Subvaluado' }))
    await userEvent.click(within(screen.getByRole('group', { name: 'Confianza' })).getByRole('button', { name: 'Dudoso' }))
    await userEvent.click(within(screen.getByRole('group', { name: 'Estado' })).getByRole('button', { name: 'A inspeccionar' }))
    await userEvent.selectOptions(screen.getByLabelText('Supera 5 UIT'), 'true')
    await userEvent.type(screen.getByLabelText('Sector'), '02')
    await userEvent.type(screen.getByLabelText('Δ mínimo (S/)'), '100')
    await userEvent.selectOptions(screen.getByLabelText('Orden'), 'delta_asc')
    const esperado = {
      corte: CORTE_A,
      categoria: 'OMISO,SUBVALUADO',
      confianza: 'DUDOSO',
      estado: 'A_INSPECCIONAR',
      supera_5_uit: 'true',
      sector: '02',
      min_delta: '100'
    }
    const cumple = (url: string) => Object.entries(esperado).every(([k, v]) => parametrosDe(url).get(k) === v)
    await vi.waitFor(() =>
      expect(llamadas(f, '/catastro/brechas/fichas').some((c) => cumple(c.url) && parametrosDe(c.url).get('orden') === 'delta_asc')).toBe(true)
    )
    expect(llamadas(f, '/catastro/brechas/lotes').some((c) => cumple(c.url) && !parametrosDe(c.url).has('page'))).toBe(true)
    const ultima = parametrosDe(llamadas(f, '/catastro/brechas/fichas').at(-1)!.url)
    expect(ultima.get('page')).toBe('0')
    expect(ultima.get('size')).toBe('50')
    // a filter turned off leaves the query
    await userEvent.click(screen.getByRole('button', { name: 'Omiso' }))
    await vi.waitFor(() => expect(parametrosDe(llamadas(f, '/catastro/brechas/fichas').at(-1)!.url).get('categoria')).toBe('SUBVALUADO'))
  })

  it('asks for the other corte when it changes, and clears the selection', async () => {
    const f = await abrir()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Elegir M1' }))
    expect(screen.getByTestId('mapa-seleccion')).toHaveTextContent('M1')
    await userEvent.selectOptions(screen.getByLabelText('Corte'), CORTE_B)
    for (const path of ['/catastro/brechas/panel', '/catastro/brechas/fichas', '/catastro/brechas/lotes'])
      await vi.waitFor(() => expect(llamadas(f, path).some((c) => parametrosDe(c.url).get('corte') === CORTE_B)).toBe(true))
    expect(screen.getByTestId('mapa-seleccion')).toBeEmptyDOMElement()
    expect(screen.getByRole('option', { name: '01/04/2026 · año 2025' })).toBeInTheDocument()
  })

  it('keeps the map and the table on the same selection', async () => {
    await abrir()
    await userEvent.click(screen.getByRole('button', { name: 'recuadro M2 M3' }))
    expect(screen.getByRole('checkbox', { name: 'Elegir M2' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Elegir M1' })).not.toBeChecked()
    expect(screen.getByText('2 fichas elegidas')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Elegir M1' }))
    expect(screen.getByTestId('mapa-seleccion')).toHaveTextContent('M2,M3,M1')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Elegir M2' }))
    expect(screen.getByTestId('mapa-seleccion')).toHaveTextContent('M3,M1')
    // a click on the map replaces the selection
    await userEvent.click(screen.getByRole('button', { name: 'clic M1' }))
    expect(screen.getByTestId('mapa-seleccion')).toHaveTextContent(/^M1$/)
    // the page checkbox takes the fichas that can be chosen
    await userEvent.click(screen.getByRole('checkbox', { name: 'Elegir todas las fichas de la página' }))
    expect(screen.getByTestId('mapa-seleccion')).toHaveTextContent('M1,M2')
    await userEvent.click(screen.getByRole('button', { name: 'Quitar la selección' }))
    expect(screen.getByTestId('mapa-seleccion')).toBeEmptyDOMElement()
  })

  it('does not let a ficha without codigo_municipal be chosen, and says why', async () => {
    await abrir()
    const sinCodigo = screen.getByRole('checkbox', { name: /^CC-3: Sin código municipal/ })
    expect(sinCodigo).toBeDisabled()
    expect(sinCodigo.parentElement).toHaveAttribute('title', expect.stringContaining('no se puede decidir'))
  })

  it('sends the decision over the chosen fichas, asks for the reason to discard and refreshes the corte', async () => {
    const f = await abrir([
      { method: 'POST', path: '/catastro/brechas/decisiones', body: { actualizadas: 1, creadas: 0, errores: [{ codigo: 'M2', error: 'sin ficha' }] } }
    ])
    expect(screen.getByRole('button', { name: 'Decidir…' })).toBeDisabled()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Elegir M1' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Elegir M2' }))
    await userEvent.click(screen.getByRole('button', { name: 'Decidir…' }))
    const dialogo = await screen.findByRole('dialog')
    await userEvent.selectOptions(within(dialogo).getByLabelText('Nuevo estado'), 'DESCARTADO')
    await userEvent.type(within(dialogo).getByLabelText('Nota'), 'visto en campo')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar decisión' }))
    expect(within(dialogo).getByRole('alert')).toHaveTextContent('Escribe el motivo del descarte.')
    expect(f.calls.some((c) => c.method === 'POST')).toBe(false)
    const antes = {
      panel: llamadas(f, '/catastro/brechas/panel').length,
      fichas: llamadas(f, '/catastro/brechas/fichas').length,
      lotes: llamadas(f, '/catastro/brechas/lotes').length
    }
    await userEvent.type(within(dialogo).getByLabelText('Motivo del descarte (obligatorio)'), 'predio demolido')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar decisión' }))
    expect(await within(dialogo).findByText('Actualizadas: 1 · Creadas: 0 · Con error: 1')).toBeInTheDocument()
    expect(within(dialogo).getByRole('list', { name: 'Errores' })).toHaveTextContent('M2: sin ficha')
    expect(f.calls.find((c) => c.method === 'POST')!.body).toEqual({
      codigos: ['M1', 'M2'],
      anio: 2026,
      estado: 'DESCARTADO',
      nota: 'visto en campo',
      motivo_descarte: 'predio demolido'
    })
    await vi.waitFor(() => {
      expect(llamadas(f, '/catastro/brechas/panel').length).toBeGreaterThan(antes.panel)
      expect(llamadas(f, '/catastro/brechas/fichas').length).toBeGreaterThan(antes.fichas)
      expect(llamadas(f, '/catastro/brechas/lotes').length).toBeGreaterThan(antes.lotes)
    })
    expect(screen.getByTestId('mapa-seleccion')).toBeEmptyDOMElement()
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Listo' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('sends a state other than DESCARTADO without a reason', async () => {
    const f = await abrir([{ method: 'POST', path: '/catastro/brechas/decisiones', body: { actualizadas: 0, creadas: 1, errores: [] } }])
    await userEvent.click(screen.getByRole('checkbox', { name: 'Elegir M1' }))
    await userEvent.click(screen.getByRole('button', { name: 'Decidir…' }))
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).queryByLabelText('Motivo del descarte (obligatorio)')).not.toBeInTheDocument()
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar decisión' }))
    expect(await within(dialogo).findByText('Actualizadas: 0 · Creadas: 1 · Con error: 0')).toBeInTheDocument()
    expect(f.calls.find((c) => c.method === 'POST')!.body).toEqual({ codigos: ['M1'], anio: 2026, estado: 'A_INSPECCIONAR' })
  })

  it('hides the decision without UPDATE on decision_brecha', async () => {
    await abrir([], { admin: false, objects: { brecha_ficha: ['READ'], decision_brecha: ['READ'] } })
    expect(screen.queryByRole('button', { name: 'Decidir…' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeInTheDocument()
  })

  it('shows the decision with UPDATE on decision_brecha', async () => {
    await abrir([], { admin: false, objects: { brecha_ficha: ['READ'], decision_brecha: ['READ', 'UPDATE'] } })
    expect(screen.getByRole('button', { name: 'Decidir…' })).toBeInTheDocument()
  })

  it('downloads the CSV of the current filters with the Bearer token', async () => {
    localStorage.setItem('wasichai-test.token', 'tok-ficticio')
    await abrir()
    await userEvent.click(screen.getByRole('button', { name: 'Omiso' }))
    const simulado = globalThis.fetch
    const pedidos: { url: string; init?: RequestInit }[] = []
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      if (!String(url).includes('fichas.csv')) return simulado(url, init)
      pedidos.push({ url: String(url), init })
      return new Response('﻿codigo_catastro\nCC-1\n', {
        headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="brechas-ica-prueba.csv"' }
      })
    }) as typeof globalThis.fetch
    const crear = vi.fn(() => 'blob:ficticio')
    const revocar = vi.fn()
    Object.assign(URL, { createObjectURL: crear, revokeObjectURL: revocar })
    let descarga = ''
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      descarga = this.download
    })
    await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }))
    await vi.waitFor(() => expect(descarga).toBe('brechas-ica-prueba.csv'))
    expect(pedidos).toHaveLength(1)
    expect(pedidos[0]!.url.split('?')[0]).toBe('/api/catastro/brechas/fichas.csv')
    const p = parametrosDe(pedidos[0]!.url)
    expect(p.get('corte')).toBe(CORTE_A)
    expect(p.get('categoria')).toBe('OMISO')
    expect(p.get('orden')).toBe('delta_desc')
    expect(p.has('page')).toBe(false)
    expect(new Headers(pedidos[0]!.init?.headers).get('Authorization')).toBe('Bearer tok-ficticio')
    expect(crear).toHaveBeenCalledOnce()
    expect(revocar).toHaveBeenCalledWith('blob:ficticio')
  })

  it('says so when the CSV fails', async () => {
    await abrir()
    await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }))
    // the mock has no route for the CSV: a 404
    expect(await screen.findByText('No se pudo exportar el CSV.')).toBeInTheDocument()
  })

  it('lists the published WMS layers of GeoServer and hands them to the map with their opacity', async () => {
    const f = await abrir([
      {
        path: '/gis/services',
        body: { enabled: true, url: 'http://gs.test/geoserver', workspace: 'catastro', wms: 'http://gs.test/geoserver/catastro/wms', wfs: '', wmts: '' }
      },
      {
        path: '/gis/layers',
        body: [
          {
            objectName: 'predio_catastral',
            geometryName: 'lote_geom',
            label: 'Lotes',
            layerName: 'catastro:predio_catastral',
            published: true,
            wms: 'http://gs.test/geoserver/catastro/wms?layers=catastro:predio_catastral',
            wfs: ''
          },
          { objectName: 'tramo_via', geometryName: 'geom', label: 'Vías', layerName: 'catastro:tramo_via', published: true, wms: '', wfs: '' },
          { objectName: 'zona', geometryName: 'geom', label: 'Zonas', layerName: 'catastro:zona', published: false, wms: '', wfs: '' }
        ]
      }
    ])
    const lista = await screen.findByRole('list', { name: 'Capas WMS' })
    expect(within(lista).getAllByRole('listitem')).toHaveLength(2)
    expect(within(lista).queryByText('Zonas')).not.toBeInTheDocument()
    expect(screen.queryByText('GeoServer no está activo')).not.toBeInTheDocument()
    const opacidad = within(lista).getByRole('slider', { name: 'Opacidad de Lotes' })
    expect(opacidad).toBeDisabled()
    await userEvent.click(within(lista).getByRole('checkbox', { name: 'Lotes' }))
    expect(screen.getByTestId('mapa-wms')).toHaveTextContent('catastro:predio_catastral@0.7')
    fireEvent.change(opacidad, { target: { value: '40' } })
    expect(screen.getByTestId('mapa-wms')).toHaveTextContent('catastro:predio_catastral@0.4')
    await userEvent.click(within(lista).getByRole('checkbox', { name: 'Vías' }))
    expect(screen.getByTestId('mapa-wms')).toHaveTextContent('catastro:predio_catastral@0.4,catastro:tramo_via@0.7')
    await userEvent.click(within(lista).getByRole('checkbox', { name: 'Lotes' }))
    expect(screen.getByTestId('mapa-wms')).toHaveTextContent(/^catastro:tramo_via@0.7$/)
    expect(llamadas(f, '/gis/layers')).toHaveLength(1)
  })

  it('says GeoServer is off and does not ask for its layers', async () => {
    const f = await abrir()
    expect(await screen.findByText('GeoServer no está activo')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Capas WMS' })).not.toBeInTheDocument()
    expect(llamadas(f, '/gis/layers')).toHaveLength(0)
  })

  it('turns on the vías with the arancel of the corte year', async () => {
    const f = await abrir([{ path: '/catastro/vias/aranceles', body: { type: 'FeatureCollection', features: [] } }])
    expect(llamadas(f, '/catastro/vias/aranceles')).toHaveLength(0)
    await userEvent.click(screen.getByRole('checkbox', { name: /Vías con arancel/ }))
    await vi.waitFor(() => expect(screen.getByTestId('mapa-vias')).toHaveTextContent('0 vías'))
    expect(parametrosDe(llamadas(f, '/catastro/vias/aranceles')[0]!.url).get('anio')).toBe('2026')
    expect(within(screen.getByRole('list', { name: 'Leyenda' })).getByText('Vías: valor por m² (2026)')).toBeInTheDocument()
  })

  it('changes the colouring of the lotes and its legend', async () => {
    await abrir()
    const leyenda = screen.getByRole('list', { name: 'Leyenda' })
    expect(within(leyenda).getByText('Sin catastro')).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Colorear lotes por'), 'estado')
    expect(screen.getByTestId('mapa-colorear')).toHaveTextContent('estado')
    expect(within(leyenda).getByText('A fiscalizar')).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Colorear lotes por'), 'delta')
    // both lotes have the same Δ: a single class
    expect(within(leyenda).getByText('Todos los valores')).toBeInTheDocument()
  })

  it('explains how to load a corte when there is none', async () => {
    fetch = mockFetch([{ path: '/catastro/brechas/cortes', body: [] }])
    renderWithProviders(<BrechasPage />)
    expect(await screen.findByText('No hay cortes de brecha cargados')).toBeInTheDocument()
    expect(screen.getByText('model/importar_corte_brecha.py')).toBeInTheDocument()
    expect(screen.queryByTestId('mapa')).not.toBeInTheDocument()
  })

  it('shows the same empty state when the panel answers 404', async () => {
    fetch = mockFetch([
      { path: '/catastro/brechas/cortes', body: cortes },
      { path: '/catastro/brechas/panel', status: 404, body: { message: 'No hay cortes de brecha cargados' } }
    ])
    renderWithProviders(<BrechasPage />)
    expect(await screen.findByText('model/importar_corte_brecha.py')).toBeInTheDocument()
  })

  it('shows a 403 as a message', async () => {
    fetch = mockFetch([{ path: '/catastro/brechas/cortes', status: 403, body: { message: 'Forbidden' } }])
    renderWithProviders(<BrechasPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('No tienes permiso para ver las brechas.')
  })
})

describe('brechasModule', () => {
  const visible = brechasModule().nav![0]!.visible!
  it('shows the menu to who can READ brecha_ficha, and to an admin', () => {
    expect(visible({ admin: false, objects: { brecha_ficha: ['READ'] } })).toBe(true)
    expect(visible({ admin: false, objects: { brecha_ficha: ['CREATE'] } })).toBe(false)
    expect(visible({ admin: false, objects: { decision_brecha: ['READ', 'UPDATE'] } })).toBe(false)
    expect(visible({ admin: false, objects: {} })).toBe(false)
    expect(visible({ admin: true, objects: {} })).toBe(true)
    expect(visible(null)).toBe(false)
  })
})
