import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { jsonResponse, mockFetch, renderWithProviders, type FetchMock } from '@wasichai/testing'
import { gisModule } from '@wasichai/gis'
import { arancelesModule } from '../arancelesModule'
import { aniosDisponibles, ArancelesViaPage } from './ArancelesViaPage'
import { anioEn } from '../comun/formato'
import { popupHtml } from './popup'
import type { TramoFeature, TramoProps } from './tipos'

// jsdom has no webgl: the map is a stub that says how many tramos it was given
vi.mock('./ArancelesMapa', () => ({
  default: ({ datos }: { datos?: { features: unknown[] } }) => <div data-testid="mapa">{datos?.features.length ?? 0} tramos</div>
}))

const tramo = (i: number, valor: number | null, extra: Partial<TramoProps> = {}): TramoFeature => ({
  type: 'Feature',
  id: `t${i}`,
  geometry: {
    type: 'LineString',
    coordinates: [
      [-75.7, -14.0],
      [-75.69, -14.0]
    ]
  },
  properties: {
    cod_via_eje: '000001',
    tip_via: 'CA.',
    nom_via: `VIA ${i}`,
    cuadra: '1',
    lado: 'AMBOS',
    id_aranc: `00100${i}-01`,
    asignacion: 'NOMBRE_UNICO',
    anio: 2026,
    valor_m2: valor,
    ...extra
  }
})

const coleccion = (valores: number[]) => ({
  type: 'FeatureCollection',
  features: valores.map((v, i) => tramo(i, v))
})

let fetch: FetchMock | null = null
afterEach(() => fetch?.restore())

const anioActual = anioEn('America/Lima')

describe('ArancelesViaPage', () => {
  it('lists the range of years, the current one by default', () => {
    expect(aniosDisponibles(2026)).toEqual([2023, 2024, 2025, 2026, 2027])
  })

  it('draws the legend from the quantiles of the values, plus the grey entries', async () => {
    fetch = mockFetch([{ path: '/catastro/vias/aranceles', body: coleccion(Array.from({ length: 50 }, (_, i) => 100 + i)) }])
    renderWithProviders(<ArancelesViaPage />)
    const leyenda = await screen.findByRole('region', { name: 'Leyenda' })
    expect(within(leyenda).getByRole('figure', { name: `Valor por m² (${anioActual})` })).toBeInTheDocument()
    expect(await within(leyenda).findByText('Menos de S/ 110')).toBeInTheDocument()
    expect(within(leyenda).getByText('S/ 140 o más')).toBeInTheDocument()
    expect(within(leyenda).getByText(`sin arancel ${anioActual}`)).toBeInTheDocument()
    expect(within(leyenda).getByText('sin asignar')).toBeInTheDocument()
    expect(await screen.findByTestId('mapa')).toHaveTextContent('50 tramos')
    expect(fetch.calls.find((c) => c.path.includes('/vias/aranceles'))!.url).toContain(`anio=${anioActual}`)
  })

  it('asks for the year again when it changes', async () => {
    fetch = mockFetch([{ path: '/catastro/vias/aranceles', body: coleccion([100, 200]) }])
    renderWithProviders(<ArancelesViaPage />)
    await screen.findByTestId('mapa')
    await userEvent.selectOptions(screen.getByLabelText('Año'), String(anioActual - 1))
    await vi.waitFor(() => expect(fetch!.calls.some((c) => c.url.includes(`anio=${anioActual - 1}`))).toBe(true))
    expect(await screen.findByText(`sin arancel ${anioActual - 1}`)).toBeInTheDocument()
  })

  it('keeps the lines of the last year while the new one loads, and an empty year has no classes', async () => {
    fetch = mockFetch([{ path: '/catastro/vias/aranceles', body: coleccion([100, 200]) }])
    renderWithProviders(<ArancelesViaPage />)
    await vi.waitFor(() => expect(screen.getByTestId('mapa')).toHaveTextContent('2 tramos'))
    fetch.restore()
    // the new year's response waits until the test lets it through
    let soltar: (r: Response) => void = () => {}
    const original = globalThis.fetch
    globalThis.fetch = (() => new Promise<Response>((r) => (soltar = r))) as typeof globalThis.fetch
    await userEvent.selectOptions(screen.getByLabelText('Año'), String(anioActual - 1))
    expect(screen.getByTestId('mapa')).toHaveTextContent('2 tramos')
    soltar(jsonResponse({ type: 'FeatureCollection', features: [tramo(1, null)] }))
    globalThis.fetch = original
    const leyenda = screen.getByRole('region', { name: 'Leyenda' })
    await vi.waitFor(() => expect(screen.getByTestId('mapa')).toHaveTextContent('1 tramos'))
    expect(within(leyenda).queryByText('Todos los valores')).not.toBeInTheDocument()
    expect(within(leyenda).queryByText(/^Menos de/)).not.toBeInTheDocument()
    // gis' legend, titled with the year, has only the grey of the year without arancel; the dashed «sin asignar» follows
    const clases = within(leyenda).getByRole('figure', { name: `Valor por m² (${anioActual - 1})` })
    expect(
      within(clases)
        .getAllByRole('listitem')
        .map((l) => l.textContent)
    ).toEqual([`sin arancel ${anioActual - 1}`])
    expect(within(leyenda).getByText('sin asignar')).toBeInTheDocument()
  })

  it('keeps the loading status in the page, only its text changes', async () => {
    fetch = mockFetch([{ path: '/catastro/vias/aranceles', body: coleccion([100]) }])
    renderWithProviders(<ArancelesViaPage />)
    const estado = screen.getByRole('status')
    await screen.findByTestId('mapa')
    await vi.waitFor(() => expect(estado).toBeEmptyDOMElement())
    expect(screen.getByRole('status')).toBe(estado)
  })

  it('opens the saved view aranceles_valor in gis, when it exists', async () => {
    fetch = mockFetch([
      { path: '/catastro/vias/aranceles', body: coleccion([100]) },
      {
        path: '/gis/objects/tramo_via/map-views/aranceles_valor',
        body: {
          id: 'v1',
          name: 'aranceles_valor',
          label: 'Aranceles: valor por m²',
          objectName: 'tramo_via',
          geometryName: 'geom',
          style: { by: 'valor_m2', type: 'quantiles', classes: 5 }
        }
      }
    ])
    renderWithProviders(<ArancelesViaPage />, { modules: [gisModule()] })
    const enlace = await screen.findByRole('link', { name: 'Abrir como vista de mapa' })
    expect(enlace).toHaveAttribute('href', '/gis/map?object=tramo_via&geometry=geom&view=aranceles_valor')
  })

  it('has no link to gis while the view does not exist', async () => {
    fetch = mockFetch([{ path: '/catastro/vias/aranceles', body: coleccion([100]) }])
    renderWithProviders(<ArancelesViaPage />, { modules: [gisModule()] })
    await screen.findByTestId('mapa')
    await vi.waitFor(() => expect(fetch!.calls.some((c) => c.path.includes('/map-views/aranceles_valor'))).toBe(true))
    expect(screen.queryByRole('link', { name: 'Abrir como vista de mapa' })).not.toBeInTheDocument()
  })

  it('shows a 403 as a message instead of the map', async () => {
    fetch = mockFetch([{ path: '/catastro/vias/aranceles', status: 403, body: { message: 'Forbidden' } }])
    renderWithProviders(<ArancelesViaPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('No tienes permiso para ver los aranceles por vía.')
    expect(screen.queryByTestId('mapa')).not.toBeInTheDocument()
  })
})

describe('popupHtml', () => {
  it('names the LOTES assignment as one to review', () => {
    const html = popupHtml(tramo(1, 109, { asignacion: 'LOTES', id_aranc: '0010012500-00' }).properties)
    expect(html).toContain('Por los lotes de la urbanización (revisar)')
  })

  it('has the name, the SAT code, the value per m² and the assignment', () => {
    const html = popupHtml(tramo(1, 356, { nom_via: 'LIMA <1>', asignacion: 'CERCANIA', id_aranc: '0010000401-01' }).properties)
    expect(html).toContain('CA. LIMA &lt;1&gt;')
    expect(html).toContain('0010000401-01')
    expect(html).toContain('S/\u00a0356 por m²')
    expect(html).toContain('Por cercanía')
  })

  it('treats the properties maplibre drops (undefined) like null', () => {
    const sinNada = { anio: 2026, lado: 'AMBOS', asignacion: 'SIN_ARANCEL' } as unknown as TramoProps
    const html = popupHtml(sinNada)
    expect(html).toContain('Vía sin nombre')
    expect(html).toContain('Sin asignar')
    expect(html).not.toContain('undefined')
    expect(popupHtml({ ...sinNada, tip_via: null, nom_via: null, id_aranc: null })).toBe(html)
  })

  it('says why there is no value', () => {
    expect(popupHtml(tramo(1, null).properties)).toContain('Sin arancel 2026')
    expect(popupHtml(tramo(1, null, { id_aranc: null, asignacion: 'SIN_ARANCEL' }).properties)).toContain('Sin asignar')
  })
})

describe('arancelesModule', () => {
  const visible = arancelesModule().nav![0]!.visible!
  it('shows the menu only to who can READ tramo_via and arancel', () => {
    expect(visible({ admin: false, objects: { tramo_via: ['READ'], arancel: ['READ'] } })).toBe(true)
    expect(visible({ admin: false, objects: { tramo_via: ['READ'] } })).toBe(false)
    expect(visible({ admin: false, objects: { arancel: ['READ'] } })).toBe(false)
    expect(visible({ admin: false, objects: { tramo_via: ['CREATE'] } })).toBe(false)
    expect(visible({ admin: false, objects: {} })).toBe(false)
    expect(visible({ admin: true, objects: {} })).toBe(true)
    expect(visible(null)).toBe(false)
  })
})
