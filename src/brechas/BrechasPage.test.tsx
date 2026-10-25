import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, renderWithProviders, type FetchMock, type MockRoute } from '@wasichai/testing'
import { brechasModule } from '../brechasModule'
import type { BrechasMapaProps } from './BrechasMapa'
import { BrechasPage } from './BrechasPage'
import { DIVERGENTE } from './colores'
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
      <button
        onClick={() =>
          p.onSeleccionar(
            Array.from({ length: 501 }, (_, i) => `G${i}`),
            true
          )
        }
      >
        recuadro grande
      </button>
      <button
        onClick={() =>
          p.onSeleccionar(
            Array.from({ length: 120 }, (_, i) => `G${i}`),
            true
          )
        }
      >
        recuadro mediano
      </button>
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
  kpis: {
    fichas: 30,
    delta_impuesto: 850.5,
    delta_impuesto_confiable: 600,
    omisos_estimado: 3,
    supera_5_uit: 2,
    pendientes: 25,
    con_geometria: 28,
    sin_ficha: 4
  },
  por_categoria: [
    { clave: 'OMISO', fichas: 10, delta_impuesto: 500 },
    { clave: 'COINCIDE', fichas: 5, delta_impuesto: 0 }
  ],
  por_confianza: [
    { clave: 'CONFIABLE', fichas: 20, delta_impuesto: 600 },
    // a corte before srtm#204
    { clave: null, fichas: 2, delta_impuesto: 10 }
  ],
  por_estado: [
    { clave: 'PENDIENTE', fichas: 25 },
    { clave: 'DESCARTADO', fichas: 5 }
  ],
  top_sectores: [
    { sector: '02', fichas: 8, delta_impuesto: 400 },
    { sector: '05', fichas: 3, delta_impuesto: -100 }
  ]
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

const fichas = [
  ficha(1, 'M1'),
  ficha(2, 'M2', { estado: 'A_INSPECCIONAR', responsable: 'analista@prueba.test', decidido_en: '2026-10-20T09:00:00', estimado: true, con_geometria: false }),
  ficha(3, null, { categoria: 'SIN_CATASTRO' }),
  ficha(4, null, { categoria: 'SIN_CATASTRO', codigo_catastro: null, codigo_predio: 'P-9', supera_5_uit: null, confianza: null })
]
// three pages, so the tests can leave the first one
const pagina = { content: fichas, page: 0, size: 50, totalElements: 120, totalPages: 3 }

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
const ultimaDe = (f: FetchMock, path: string) => parametrosDe(llamadas(f, path).at(-1)!.url)

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

const irAPagina2 = async (f: FetchMock) => {
  await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }))
  await vi.waitFor(() => expect(ultimaDe(f, '/catastro/brechas/fichas').get('page')).toBe('1'))
}

const abrirDecision = async (...codigos: string[]) => {
  for (const c of codigos) await userEvent.click(screen.getByRole('checkbox', { name: `Elegir ${c}` }))
  await userEvent.click(screen.getByRole('button', { name: 'Decidir…' }))
  return screen.findByRole('dialog')
}

describe('BrechasPage', () => {
  it('shows the KPIs and the bars of the corte', async () => {
    await abrir()
    expect(within(screen.getByRole('group', { name: 'Diferencia de impuesto' })).getByText('+S/ 850.50')).toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: 'Diferencia confiable' })).getByText('+S/ 600.00')).toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: 'Omisos estimados' })).getByText('3')).toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: 'Superan 5 UIT' })).getByText('2')).toBeInTheDocument()
    const pendientes = within(screen.getByRole('group', { name: 'Pendientes de decidir' }))
    expect(pendientes.getByText('25')).toBeInTheDocument()
    // out of the fichas that have a codigo_municipal
    expect(pendientes.getByText('de 26 con ficha · 4 fichas sin código municipal')).toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: 'Con geometría' })).getByText('28')).toBeInTheDocument()
    const categorias = screen.getByRole('list', { name: 'Por categoría' })
    expect(within(categorias).getByText('Omiso')).toBeInTheDocument()
    expect(within(categorias).getByText('10 · +S/ 500.00')).toBeInTheDocument()
    expect(screen.getByTestId('barra-OMISO')).toHaveStyle({ width: '100%' })
    expect(screen.getByTestId('barra-COINCIDE')).toHaveStyle({ width: '50%' })
    expect(within(screen.getByRole('list', { name: 'Por estado' })).getByText('Descartado')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Por confianza' })).getByText('Confiable')).toBeInTheDocument()
    // the sectores: red where catastro would charge more, blue where less
    const sectores = screen.getByRole('list', { name: 'Sectores con más diferencia de impuesto' })
    expect(within(sectores).getByText('3 · −S/ 100.00')).toBeInTheDocument()
    expect(screen.getByTestId('barra-sector-02')).toHaveStyle({ width: '100%', background: DIVERGENTE.sube[2] })
    expect(screen.getByTestId('barra-sector-05')).toHaveStyle({ width: '25%', background: DIVERGENTE.baja[0] })
    expect(screen.getByTestId('mapa-lotes')).toHaveTextContent('2 lotes')
    // the most recent corte, by default
    expect(parametrosDe(llamadas(fetch!, '/catastro/brechas/panel')[0]!.url).get('corte')).toBe(CORTE_A)
  })

  it('shows the fichas the old cortes or a missing UIT leave half empty', async () => {
    await abrir()
    expect(within(screen.getByRole('list', { name: 'Por confianza' })).getByText('Sin confianza')).toBeInTheDocument()
    const fila = screen.getByRole('cell', { name: 'Predio P-9' }).closest('tr')!
    // the Supera 5 UIT column of a corte without UIT
    const columna = screen.getAllByRole('columnheader').findIndex((c) => c.textContent === 'Supera 5 UIT')
    expect(within(fila).getAllByRole('cell')[columna]).toHaveTextContent(/^—$/)
    expect(within(fila).getByText('Sin confianza')).toBeInTheDocument()
    expect(within(fila).queryByText('No')).not.toBeInTheDocument()
  })

  it('shows who decided, when, and what the map cannot draw', async () => {
    await abrir()
    expect(screen.getByText('por analista@prueba.test el 20/10/2026')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Sin geometría: el lote no aparece en el mapa' })).toBeInTheDocument()
    expect(screen.getByText('(estimado)')).toBeInTheDocument()
  })

  it('sends each filter to the fichas, applies them on the map and goes back to the first page', async () => {
    const f = await abrir()
    await irAPagina2(f)
    await userEvent.click(screen.getByRole('button', { name: 'Omiso' }))
    await userEvent.click(screen.getByRole('button', { name: 'Subvaluado' }))
    await userEvent.click(within(screen.getByRole('group', { name: 'Confianza' })).getByRole('button', { name: 'Dudoso' }))
    await userEvent.click(within(screen.getByRole('group', { name: 'Estado' })).getByRole('button', { name: 'A inspeccionar' }))
    await userEvent.selectOptions(screen.getByLabelText('Supera 5 UIT'), 'true')
    await userEvent.type(screen.getByLabelText('Sector'), '02')
    await userEvent.type(screen.getByLabelText('Diferencia mínima, en valor absoluto (S/)'), '100')
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
    await vi.waitFor(() => expect(llamadas(f, '/catastro/brechas/fichas').some((c) => cumple(c.url) && parametrosDe(c.url).get('page') === '0')).toBe(true))
    // the lotes get the same filters, so the server shows a lote when any of its fichas matches; never a page
    await vi.waitFor(() => expect(llamadas(f, '/catastro/brechas/lotes').some((c) => cumple(c.url))).toBe(true))
    expect(llamadas(f, '/catastro/brechas/lotes').some((c) => parametrosDe(c.url).has('page') || parametrosDe(c.url).has('size'))).toBe(false)
    // the order, the page and the size
    await irAPagina2(f)
    await userEvent.selectOptions(screen.getByLabelText('Orden'), 'delta_asc')
    await vi.waitFor(() => expect(ultimaDe(f, '/catastro/brechas/fichas').get('orden')).toBe('delta_asc'))
    expect(ultimaDe(f, '/catastro/brechas/fichas').get('page')).toBe('0')
    await irAPagina2(f)
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Filas' }), '100')
    await vi.waitFor(() => expect(ultimaDe(f, '/catastro/brechas/fichas').get('size')).toBe('100'))
    expect(ultimaDe(f, '/catastro/brechas/fichas').get('page')).toBe('0')
    // a filter turned off leaves the query
    await userEvent.click(screen.getByRole('button', { name: 'Omiso' }))
    await vi.waitFor(() => expect(ultimaDe(f, '/catastro/brechas/fichas').get('categoria')).toBe('SUBVALUADO'))
  })

  it('says the Pendiente filter includes the fichas without codigo_municipal, which cannot be decided', async () => {
    await abrir()
    expect(screen.queryByText(/sin código municipal, que no se pueden decidir/)).not.toBeInTheDocument()
    await userEvent.click(within(screen.getByRole('group', { name: 'Estado' })).getByRole('button', { name: 'Pendiente' }))
    expect(screen.getByText('Incluye 4 fichas sin código municipal, que no se pueden decidir.')).toBeInTheDocument()
  })

  it('clears the selection when a filter changes', async () => {
    await abrir()
    await userEvent.click(screen.getByRole('button', { name: 'recuadro M2 M3' }))
    expect(screen.getByText('2 fichas elegidas')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Omiso' }))
    expect(screen.getByText('Ninguna ficha elegida')).toBeInTheDocument()
    expect(screen.getByTestId('mapa-seleccion')).toBeEmptyDOMElement()
  })

  it('asks for the other corte when it changes, from its first page, and clears the selection', async () => {
    const f = await abrir()
    await irAPagina2(f)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Elegir M1' }))
    expect(screen.getByTestId('mapa-seleccion')).toHaveTextContent('M1')
    await userEvent.selectOptions(screen.getByLabelText('Corte'), CORTE_B)
    for (const path of ['/catastro/brechas/panel', '/catastro/brechas/fichas', '/catastro/brechas/lotes'])
      await vi.waitFor(() => expect(llamadas(f, path).some((c) => parametrosDe(c.url).get('corte') === CORTE_B)).toBe(true))
    const deB = llamadas(f, '/catastro/brechas/fichas').filter((c) => parametrosDe(c.url).get('corte') === CORTE_B)
    expect(deB.every((c) => parametrosDe(c.url).get('page') === '0')).toBe(true)
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
    expect(screen.getByText('1 ficha elegida')).toBeInTheDocument()
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
    const dialogo = await abrirDecision('M1', 'M2')
    expect(within(dialogo).getByText('2 fichas del año 2026.')).toBeInTheDocument()
    await userEvent.selectOptions(within(dialogo).getByLabelText('Nuevo estado'), 'DESCARTADO')
    await userEvent.type(within(dialogo).getByLabelText('Nota'), 'visto en campo')
    expect(within(dialogo).getByLabelText('Motivo del descarte (obligatorio)')).toHaveAttribute('maxlength', '2000')
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
    const dialogo = await abrirDecision('M1')
    expect(within(dialogo).getByText('1 ficha del año 2026.')).toBeInTheDocument()
    expect(within(dialogo).queryByLabelText('Motivo del descarte (obligatorio)')).not.toBeInTheDocument()
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar decisión' }))
    expect(await within(dialogo).findByText('Actualizadas: 0 · Creadas: 1 · Con error: 0')).toBeInTheDocument()
    expect(f.calls.find((c) => c.method === 'POST')!.body).toEqual({ codigos: ['M1'], anio: 2026, estado: 'A_INSPECCIONAR' })
  })

  it('keeps the notes unless asked to clear them, with an explicit null', async () => {
    const f = await abrir([{ method: 'POST', path: '/catastro/brechas/decisiones', body: { actualizadas: 1, creadas: 0, errores: [] } }])
    const dialogo = await abrirDecision('M1')
    expect(within(dialogo).getByText('Sin nota, cada ficha conserva la que tenía.')).toBeInTheDocument()
    expect(within(dialogo).getByLabelText('Nota')).toHaveAttribute('maxlength', '2000')
    await userEvent.click(within(dialogo).getByRole('checkbox', { name: 'Borrar la nota que tenían' }))
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar decisión' }))
    await within(dialogo).findByText('Actualizadas: 1 · Creadas: 0 · Con error: 0')
    expect(f.calls.find((c) => c.method === 'POST')!.body).toEqual({ codigos: ['M1'], anio: 2026, estado: 'A_INSPECCIONAR', nota: null })
  })

  it('warns that a big batch takes a while, and stops waiting with a clear message', async () => {
    await abrir()
    await userEvent.click(screen.getByRole('button', { name: 'recuadro mediano' }))
    await userEvent.click(screen.getByRole('button', { name: 'Decidir…' }))
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByText(/Se guardan de a 8: 120 fichas pueden tardar unos segundos/)).toBeInTheDocument()
    const simulado = globalThis.fetch
    let senal: AbortSignal | null | undefined
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      if (init?.method !== 'POST') return simulado(url, init)
      senal = init.signal
      throw new DOMException('se acabó la espera', 'TimeoutError')
    }) as typeof globalThis.fetch
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar decisión' }))
    expect(await within(dialogo).findByText(/La decisión tardó demasiado/)).toBeInTheDocument()
    expect(senal).toBeInstanceOf(AbortSignal)
  })

  it('starts each opening of the dialog clean', async () => {
    await abrir()
    let dialogo = await abrirDecision('M1')
    await userEvent.selectOptions(within(dialogo).getByLabelText('Nuevo estado'), 'DESCARTADO')
    await userEvent.type(within(dialogo).getByLabelText('Motivo del descarte (obligatorio)'), 'otro')
    await userEvent.type(within(dialogo).getByLabelText('Nota'), 'nota vieja')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Decidir…' }))
    dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByLabelText('Nuevo estado')).toHaveValue('A_INSPECCIONAR')
    expect(within(dialogo).getByLabelText('Nota')).toHaveValue('')
    expect(within(dialogo).queryByLabelText('Motivo del descarte (obligatorio)')).not.toBeInTheDocument()
  })

  it('does not send more than 500 codes', async () => {
    const f = await abrir()
    await userEvent.click(screen.getByRole('button', { name: 'recuadro grande' }))
    await userEvent.click(screen.getByRole('button', { name: 'Decidir…' }))
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByText('Elige hasta 500 fichas por decisión; hay 501.')).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Guardar decisión' })).toBeDisabled()
    expect(f.calls.some((c) => c.method === 'POST')).toBe(false)
  })

  it('names the field the API refused', async () => {
    fetch = mockFetch(
      rutas([
        {
          method: 'POST',
          path: '/catastro/brechas/decisiones',
          status: 400,
          body: { title: 'Bad Request', errors: [{ field: 'motivo_descarte', message: 'es obligatorio' }] }
        }
      ])
    )
    renderWithProviders(<BrechasPage />)
    await screen.findByRole('cell', { name: 'M1' })
    const dialogo = await abrirDecision('M1')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar decisión' }))
    expect(await within(dialogo).findByText('Motivo del descarte: es obligatorio')).toBeInTheDocument()
  })

  it('says a 403 on the decision is a missing permission', async () => {
    await abrir([{ method: 'POST', path: '/catastro/brechas/decisiones', status: 403, body: { title: 'Forbidden' } }])
    const dialogo = await abrirDecision('M1')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar decisión' }))
    expect(await within(dialogo).findByText('No tienes permiso para decidir sobre las brechas.')).toBeInTheDocument()
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

  describe('CSV', () => {
    const originales = { crear: URL.createObjectURL, revocar: URL.revokeObjectURL }
    let pedidos: { url: string; init?: RequestInit }[]
    let descarga: string
    const revocar = vi.fn()

    // the CSV answers with what the test sets; the rest goes to the mock
    const servirCsv = (respuesta: () => Response) => {
      const simulado = globalThis.fetch
      globalThis.fetch = (async (url: string, init?: RequestInit) => {
        if (!String(url).includes('fichas.csv')) return simulado(url, init)
        pedidos.push({ url: String(url), init })
        return respuesta()
      }) as typeof globalThis.fetch
    }

    beforeEach(() => {
      pedidos = []
      descarga = ''
      revocar.mockReset()
      URL.createObjectURL = () => 'blob:ficticio'
      URL.revokeObjectURL = revocar
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        descarga = this.download
      })
    })
    afterEach(() => {
      URL.createObjectURL = originales.crear
      URL.revokeObjectURL = originales.revocar
    })

    it('downloads the CSV of the current filters with the Bearer token', async () => {
      localStorage.setItem('wasichai-test.token', 'tok-ficticio')
      await abrir()
      await userEvent.click(screen.getByRole('button', { name: 'Omiso' }))
      servirCsv(
        () =>
          new Response('﻿codigo_catastro\nCC-1\n', {
            headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="brechas-ica-prueba.csv"' }
          })
      )
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
      await vi.waitFor(() => expect(revocar).toHaveBeenCalledWith('blob:ficticio'))
    })

    it('names the file after the corte, without characters a file system refuses', async () => {
      await abrir()
      servirCsv(() => new Response('x', { headers: { 'Content-Type': 'text/csv' } }))
      await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }))
      await vi.waitFor(() => expect(descarga).toBe('brechas-ica-prueba_2026-10-18.csv'))
    })

    it('says so when the CSV fails, and asks to sign in again on a 401', async () => {
      localStorage.setItem('wasichai-test.token', 'vencido')
      await abrir()
      servirCsv(() => new Response(null, { status: 500 }))
      await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }))
      expect(await screen.findByText('No se pudo exportar el CSV.')).toBeInTheDocument()
      servirCsv(() => new Response(null, { status: 401 }))
      await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }))
      expect(await screen.findByText('Tu sesión venció. Vuelve a iniciar sesión para exportar.')).toBeInTheDocument()
      expect(localStorage.getItem('wasichai-test.token')).toBeNull()
      expect(descarga).toBe('')
    })
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
    expect(opacidad).toHaveAttribute('aria-valuetext', '70 %')
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

  it('builds a full GetMap for a layer without its own WMS url', async () => {
    const { urlWms } = await import('./CapasMapa')
    const capa = { objectName: 'v', geometryName: 'g', label: 'Vías', layerName: 'catastro:tramo_via', published: true, wms: '' }
    const p = parametrosDe(urlWms(capa, 'http://gs.test/geoserver/catastro/wms')!)
    expect(Object.fromEntries(p)).toEqual({ service: 'WMS', version: '1.1.1', request: 'GetMap', styles: '', layers: 'catastro:tramo_via' })
    expect(urlWms(capa, '')).toBeNull()
  })

  it('says GeoServer is off and does not ask for its layers', async () => {
    const f = await abrir()
    expect(await screen.findByText('GeoServer no está activo')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Capas WMS' })).not.toBeInTheDocument()
    expect(llamadas(f, '/gis/layers')).toHaveLength(0)
  })

  it('tells a failing GeoServer from one that is off', async () => {
    await abrir([{ path: '/gis/services', status: 500, body: { title: 'Error' } }])
    expect(await screen.findByText('No se pudo consultar GeoServer.')).toBeInTheDocument()
    expect(screen.queryByText('GeoServer no está activo')).not.toBeInTheDocument()
  })

  it('turns on the vías with the arancel of the corte year, with their classes in the legend', async () => {
    const tramo = (valor: number) => ({
      type: 'Feature',
      id: `t${valor}`,
      geometry: { type: 'LineString', coordinates: [] },
      properties: {
        cod_via_eje: '1',
        tip_via: 'CA.',
        nom_via: 'X',
        cuadra: '1',
        lado: 'AMBOS',
        id_aranc: 'a',
        asignacion: 'NOMBRE_UNICO',
        anio: 2026,
        valor_m2: valor
      }
    })
    const f = await abrir([{ path: '/catastro/vias/aranceles', body: { type: 'FeatureCollection', features: [tramo(100), tramo(200)] } }])
    expect(llamadas(f, '/catastro/vias/aranceles')).toHaveLength(0)
    await userEvent.click(screen.getByRole('checkbox', { name: /Vías con arancel/ }))
    await vi.waitFor(() => expect(screen.getByTestId('mapa-vias')).toHaveTextContent('2 vías'))
    expect(parametrosDe(llamadas(f, '/catastro/vias/aranceles')[0]!.url).get('anio')).toBe('2026')
    const leyenda = screen.getByRole('list', { name: 'Leyenda' })
    expect(within(leyenda).getByText('Vías: valor por m² (2026)')).toBeInTheDocument()
    expect(within(leyenda).getByText('Menos de S/ 200')).toBeInTheDocument()
    expect(within(leyenda).getByText('S/ 200 o más')).toBeInTheDocument()
  })

  it('changes the colouring of the lotes and its legend', async () => {
    await abrir()
    const leyenda = screen.getByRole('list', { name: 'Leyenda' })
    expect(within(leyenda).getByText('Sin catastro')).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Colorear lotes por'), 'estado')
    expect(screen.getByTestId('mapa-colorear')).toHaveTextContent('estado')
    expect(within(leyenda).getByText('A fiscalizar')).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Colorear lotes por'), 'delta')
    expect(within(leyenda).getByText('+S/ 500 o más')).toBeInTheDocument()
    expect(within(leyenda).getByText('Sin cambio (−S/ 1 a +S/ 1)')).toBeInTheDocument()
    expect(within(leyenda).getByText('Sin dato (sin levantar)')).toBeInTheDocument()
  })

  it('says the lotes failed, over the map, and retries them', async () => {
    const f = await abrir([{ path: '/catastro/brechas/lotes', status: 500, body: { title: 'Error' } }])
    const alerta = await screen.findByText('No se pudieron cargar los lotes del mapa.')
    expect(alerta.closest('[role="alert"]')).not.toBeNull()
    const antes = llamadas(f, '/catastro/brechas/lotes').length
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await vi.waitFor(() => expect(llamadas(f, '/catastro/brechas/lotes').length).toBeGreaterThan(antes))
  })

  it('explains how to load a corte when there is none', async () => {
    fetch = mockFetch([{ path: '/catastro/brechas/cortes', body: [] }])
    renderWithProviders(<BrechasPage />)
    expect(await screen.findByText('Todavía no hay cortes de brecha cargados')).toBeInTheDocument()
    expect(screen.getByText(/Pide al equipo técnico/)).toBeInTheDocument()
    expect(screen.getByText('model/importar_corte_brecha.py')).toBeInTheDocument()
    expect(screen.queryByTestId('mapa')).not.toBeInTheDocument()
  })

  it('keeps the selector when the chosen corte is gone, and goes back to the latest', async () => {
    fetch = mockFetch([
      { path: '/catastro/brechas/cortes', body: cortes },
      { path: '/catastro/brechas/panel', status: 404, body: { message: 'No hay cortes de brecha cargados' } },
      { path: '/catastro/brechas/fichas', body: pagina },
      { path: '/catastro/brechas/lotes', body: { type: 'FeatureCollection', features: [] } }
    ])
    renderWithProviders(<BrechasPage />)
    expect(await screen.findByText('El corte elegido ya no está cargado o se está recargando.')).toBeInTheDocument()
    expect(screen.getByLabelText('Corte')).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Corte'), CORTE_B)
    await userEvent.click(screen.getByRole('button', { name: 'Ver el más reciente' }))
    expect(screen.getByLabelText('Corte')).toHaveValue(CORTE_A)
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
