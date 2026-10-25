import { render } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { wmsTileUrl } from '@wasichai/gis'
import type { BrechasMapaProps } from './BrechasMapa'
import type { LoteFeature } from './tipos'

// jsdom has no webgl: a fake maplibre that keeps its sources and layers and lets the test fire its events
const estado = vi.hoisted(() => ({ mapa: null as null | Record<string, unknown> }))

vi.mock('maplibre-gl', () => {
  type Manejador = (e: unknown) => void
  class Map {
    fuentes: Record<string, { setData: ReturnType<typeof vi.fn>; tiles?: string[] }> = {}
    capas: { id: string; antes?: string }[] = []
    eventos: { tipo: string; capa?: string; fn: Manejador }[] = []
    contenedor = document.createElement('div')
    dragPan = { enable: vi.fn(), disable: vi.fn() }
    setPaintProperty = vi.fn()
    setFilter = vi.fn()
    setFeatureState = vi.fn()
    opciones: unknown
    setLayoutProperty = vi.fn()
    fitBounds = vi.fn()
    queryRenderedFeatures = vi.fn((): unknown[] => [])
    constructor(opciones: unknown) {
      this.opciones = opciones
      estado.mapa = this as unknown as Record<string, unknown>
    }
    addControl() {}
    resize() {}
    remove() {}
    getCanvas() {
      return { style: {} }
    }
    getCanvasContainer() {
      return this.contenedor
    }
    on(tipo: string, capa: string | Manejador, fn?: Manejador) {
      this.eventos.push(typeof capa === 'string' ? { tipo, capa, fn: fn! } : { tipo, fn: capa })
    }
    disparar(tipo: string, capa: string | undefined, e: unknown) {
      this.eventos.filter((x) => x.tipo === tipo && x.capa === capa).forEach((x) => x.fn(e))
    }
    addSource(id: string, s: { tiles?: string[] }) {
      this.fuentes[id] = { setData: vi.fn(), tiles: s.tiles }
    }
    getSource(id: string) {
      return this.fuentes[id]
    }
    removeSource(id: string) {
      delete this.fuentes[id]
    }
    addLayer(l: { id: string }, antes?: string) {
      this.capas.push({ id: l.id, antes })
    }
    getLayer(id: string) {
      return this.capas.find((c) => c.id === id)
    }
    removeLayer(id: string) {
      this.capas = this.capas.filter((c) => c.id !== id)
    }
    getStyle() {
      return { layers: this.capas }
    }
  }
  class Popup {
    setLngLat() {
      return this
    }
    setHTML() {
      return this
    }
    addTo() {
      return this
    }
  }
  class Control {}
  return { Map, Popup, NavigationControl: Control, ScaleControl: Control, setWorkerUrl: () => {} }
})

const { default: BrechasMapa } = await import('./BrechasMapa')

interface Falso {
  opciones: Record<string, unknown>
  setFeatureState: ReturnType<typeof vi.fn>
  fitBounds: ReturnType<typeof vi.fn>
  dragPan: { enable: ReturnType<typeof vi.fn>; disable: ReturnType<typeof vi.fn> }
  fuentes: Record<string, { setData: ReturnType<typeof vi.fn>; tiles?: string[] }>
  capas: { id: string; antes?: string }[]
  contenedor: HTMLDivElement
  setFilter: ReturnType<typeof vi.fn>
  setPaintProperty: ReturnType<typeof vi.fn>
  queryRenderedFeatures: ReturnType<typeof vi.fn>
  disparar: (tipo: string, capa: string | undefined, e: unknown) => void
}
const mapa = () => estado.mapa as unknown as Falso

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    disconnect() {}
    unobserve() {}
  } as unknown as typeof ResizeObserver
})

const base = (extra: Partial<BrechasMapaProps> = {}): BrechasMapaProps => ({
  corte: 'c1',
  lotes: { type: 'FeatureCollection', features: [] },
  filtro: null,
  colorear: 'categoria',
  seleccion: [],
  onSeleccionar: vi.fn(),
  vias: undefined,
  mostrarVias: false,
  cortesVias: [],
  wms: [],
  ...extra
})

const lote = (codigo: string): LoteFeature => ({
  type: 'Feature',
  id: codigo,
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [-75.7, -14.0],
        [-75.69, -14.0],
        [-75.7, -14.01]
      ]
    ]
  },
  properties: {
    codigo_municipal: codigo,
    codigo_catastro: codigo,
    categoria: 'OMISO',
    confianza: 'CONFIABLE',
    delta_impuesto: 10,
    estado: 'PENDIENTE',
    supera_5_uit: false
  }
})

const cargar = (props: BrechasMapaProps) => {
  const r = render(<BrechasMapa {...props} />)
  mapa().disparar('load', undefined, {})
  return r
}

beforeEach(() => {
  estado.mapa = null
})

describe('BrechasMapa', () => {
  it('marks the selected lotes by feature-state, without sending the lotes again', () => {
    const lotes = { type: 'FeatureCollection' as const, features: [lote('M1'), lote('M2')] }
    const props = base({ lotes, seleccion: ['M1'] })
    const r = cargar(props)
    const m = mapa()
    const setData = m.fuentes['brechas-lotes']!.setData
    expect(setData).toHaveBeenCalledTimes(1)
    expect(m.setFeatureState).toHaveBeenCalledWith({ source: 'brechas-lotes', id: 'M1' }, { elegido: true })
    m.setFeatureState.mockClear()
    r.rerender(<BrechasMapa {...props} seleccion={['M2']} />)
    expect(m.setFeatureState).toHaveBeenCalledWith({ source: 'brechas-lotes', id: 'M1' }, { elegido: false })
    expect(m.setFeatureState).toHaveBeenCalledWith({ source: 'brechas-lotes', id: 'M2' }, { elegido: true })
    // nor a colouring, a filter or an opacity send them again
    r.rerender(
      <BrechasMapa
        {...props}
        seleccion={['M2']}
        colorear="estado"
        filtro={['==', ['get', 'estado'], 'PENDIENTE']}
        wms={[{ id: 'a', url: 'http://gs.test/wms?layers=a', opacity: 0.4 }]}
      />
    )
    expect(setData).toHaveBeenCalledTimes(1)
    expect(m.setPaintProperty).toHaveBeenCalledWith('brechas-lotes-relleno', 'fill-color', expect.arrayContaining(['match', ['get', 'estado']]))
    for (const capa of ['brechas-lotes-relleno', 'brechas-lotes-borde', 'brechas-lotes-seleccion'])
      expect(m.setFilter).toHaveBeenCalledWith(capa, ['==', ['get', 'estado'], 'PENDIENTE'])
    // new lotes do
    r.rerender(<BrechasMapa {...props} lotes={{ ...lotes }} seleccion={['M2']} />)
    expect(setData).toHaveBeenCalledTimes(2)
  })

  it('frames the lotes once, and again for a new corte', () => {
    const lotes = { type: 'FeatureCollection' as const, features: [lote('M1')] }
    const r = cargar(base({ lotes }))
    const m = mapa()
    expect(m.fitBounds).toHaveBeenCalledTimes(1)
    r.rerender(<BrechasMapa {...base({ lotes: { ...lotes } })} />)
    expect(m.fitBounds).toHaveBeenCalledTimes(1)
    r.rerender(<BrechasMapa {...base({ corte: 'c2', lotes: { ...lotes } })} />)
    expect(m.fitBounds).toHaveBeenCalledTimes(2)
  })

  it('turns off maplibre box zoom, which Shift + drag would start', () => {
    cargar(base())
    expect(mapa().opciones.boxZoom).toBe(false)
  })

  it('selects the lote a click lands on, and adds it with Shift', () => {
    const onSeleccionar = vi.fn()
    cargar(base({ onSeleccionar }))
    const clic = (shiftKey: boolean) =>
      mapa().disparar('click', 'brechas-lotes-relleno', { lngLat: [0, 0], originalEvent: { shiftKey }, features: [{ properties: { codigo_municipal: 'M2' } }] })
    clic(false)
    expect(onSeleccionar).toHaveBeenLastCalledWith(['M2'], false)
    clic(true)
    expect(onSeleccionar).toHaveBeenLastCalledWith(['M2'], true)
  })

  it('adds every lote under a Shift + drag box to the selection', () => {
    const onSeleccionar = vi.fn()
    cargar(base({ onSeleccionar }))
    const m = mapa()
    m.queryRenderedFeatures.mockReturnValue([
      { properties: { codigo_municipal: 'M1' } },
      { properties: { codigo_municipal: 'M3' } },
      { properties: { codigo_municipal: 'M1' } },
      { properties: {} }
    ])
    m.contenedor.dispatchEvent(new MouseEvent('mousedown', { clientX: 10, clientY: 20, shiftKey: true, button: 0, bubbles: true }))
    expect(m.dragPan.disable).toHaveBeenCalledOnce()
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 60, clientY: 80 }))
    expect(m.contenedor.querySelector('div[aria-hidden]')).not.toBeNull()
    document.dispatchEvent(new MouseEvent('mouseup', { clientX: 60, clientY: 80 }))
    expect(m.queryRenderedFeatures).toHaveBeenCalledWith(
      [
        [10, 20],
        [60, 80]
      ],
      { layers: ['brechas-lotes-relleno'] }
    )
    expect(onSeleccionar).toHaveBeenCalledWith(['M1', 'M3'], true)
    expect(m.contenedor.querySelector('div[aria-hidden]')).toBeNull()
    expect(m.dragPan.enable).toHaveBeenCalledOnce()
  })

  it('leaves a Shift + click without a drag to the click', () => {
    cargar(base())
    const m = mapa()
    m.contenedor.dispatchEvent(new MouseEvent('mousedown', { clientX: 10, clientY: 20, shiftKey: true, button: 0, bubbles: true }))
    document.dispatchEvent(new MouseEvent('mouseup', { clientX: 11, clientY: 21 }))
    expect(m.queryRenderedFeatures).not.toHaveBeenCalled()
    expect(m.dragPan.enable).toHaveBeenCalledOnce()
  })

  it('lets a vía over the lote take the click while the vías are on', () => {
    const onSeleccionar = vi.fn()
    cargar(base({ onSeleccionar, mostrarVias: true }))
    const m = mapa()
    m.queryRenderedFeatures.mockReturnValue([{ properties: { cod_via_eje: '1' } }])
    m.disparar('click', 'brechas-lotes-relleno', {
      point: [0, 0],
      lngLat: [0, 0],
      originalEvent: { shiftKey: false },
      features: [{ properties: { codigo_municipal: 'M2' } }]
    })
    expect(onSeleccionar).not.toHaveBeenCalled()
  })

  it('ignores a drag without Shift', () => {
    const onSeleccionar = vi.fn()
    cargar(base({ onSeleccionar }))
    mapa().contenedor.dispatchEvent(new MouseEvent('mousedown', { clientX: 10, clientY: 20, button: 0, bubbles: true }))
    document.dispatchEvent(new MouseEvent('mouseup', { clientX: 60, clientY: 80 }))
    expect(mapa().queryRenderedFeatures).not.toHaveBeenCalled()
    expect(onSeleccionar).not.toHaveBeenCalled()
  })

  it('draws the WMS layers under the lotes, changes their opacity and takes them off', () => {
    const url = 'http://gs.test/geoserver/catastro/wms?layers=catastro:lotes'
    const r = cargar(base({ wms: [{ id: 'catastro:lotes', url, opacity: 0.5 }] }))
    const m = mapa()
    expect(m.fuentes['brechas-wms-catastro:lotes']!.tiles).toEqual([wmsTileUrl(url, 256)])
    expect(m.capas.find((c) => c.id === 'brechas-wms-catastro:lotes')!.antes).toBe('brechas-lotes-relleno')
    r.rerender(<BrechasMapa {...base({ wms: [{ id: 'catastro:lotes', url, opacity: 0.3 }] })} />)
    expect(m.setPaintProperty).toHaveBeenCalledWith('brechas-wms-catastro:lotes', 'raster-opacity', 0.3)
    r.rerender(<BrechasMapa {...base()} />)
    expect(m.capas.find((c) => c.id === 'brechas-wms-catastro:lotes')).toBeUndefined()
    expect(m.fuentes['brechas-wms-catastro:lotes']).toBeUndefined()
  })

  it('hands the vías to their source only while the layer is on', () => {
    const tramo = {
      type: 'Feature' as const,
      geometry: { type: 'LineString' as const, coordinates: [] },
      properties: {
        cod_via_eje: null,
        tip_via: null,
        nom_via: null,
        cuadra: null,
        lado: 'AMBOS' as const,
        id_aranc: null,
        asignacion: 'SIN_ARANCEL' as const,
        anio: 2026,
        valor_m2: null
      }
    }
    const vias = { type: 'FeatureCollection' as const, features: [tramo] }
    const r = cargar(base({ vias, mostrarVias: false }))
    const m = mapa()
    expect(m.fuentes['brechas-vias']!.setData).toHaveBeenLastCalledWith({ type: 'FeatureCollection', features: [] })
    r.rerender(<BrechasMapa {...base({ vias, mostrarVias: true })} />)
    expect(m.fuentes['brechas-vias']!.setData).toHaveBeenLastCalledWith(vias)
  })
})
