import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setToken } from '@wasichai/core'

// jsdom has no webgl: a fake maplibre Map that keeps the options it was built with
const estado = vi.hoisted(() => ({ opciones: null as null | Record<string, unknown> }))

vi.mock('maplibre-gl', () => {
  class Map {
    constructor(opciones: Record<string, unknown>) {
      estado.opciones = opciones
    }
    addControl() {}
    resize() {}
    remove() {}
  }
  class Control {}
  return { Map, NavigationControl: Control, ScaleControl: Control, setWorkerUrl: vi.fn() }
})

globalThis.ResizeObserver ??= class {
  observe() {}
  disconnect() {}
  unobserve() {}
} as unknown as typeof ResizeObserver

const { conToken, crearMapaBase } = await import('./mapa')

const origen = window.location.origin
const teselaWms = '/geoserver/catastro/wms?service=WMS&request=GetMap&layers=catastro:tramo_via__7c45fb26__geom&bbox={bbox-epsg-3857}'

describe('conToken', () => {
  beforeEach(() => setToken('el-token'))
  afterEach(() => setToken(null))

  it('adds the Bearer to a /geoserver/ url of this origin, relative or absolute', () => {
    expect(conToken(teselaWms)).toEqual({ url: teselaWms, headers: { Authorization: 'Bearer el-token' } })
    expect(conToken(`${origen}${teselaWms}`).headers).toEqual({ Authorization: 'Bearer el-token' })
    expect(conToken(`${origen}/geoserver/gwc/service/wms?request=GetMap`).headers).toEqual({ Authorization: 'Bearer el-token' })
  })

  it('sends it nowhere else: the OSM tiles, another origin, another path of this one', () => {
    for (const url of [
      'https://tile.openstreetmap.org/12/1234/2345.png',
      'http://geoserver:8080/geoserver/catastro/wms?request=GetMap',
      `https://otro.example${teselaWms}`,
      `${origen}/api/catastro/vias/aranceles`,
      `${origen}/geoservers/catastro/wms`,
      '/assets/sprite.png'
    ]) {
      expect(conToken(url), url).toEqual({ url })
    }
  })

  it('without a session the url goes as it is (nginx answers 401)', () => {
    setToken(null)
    expect(conToken(teselaWms)).toEqual({ url: teselaWms })
  })

  it('reads the token at each request, so a new sign-in is the one sent', () => {
    setToken('otro')
    expect(conToken(teselaWms).headers).toEqual({ Authorization: 'Bearer otro' })
  })
})

describe('crearMapaBase', () => {
  it('every map it builds (Aranceles, Brechas) asks its tiles through conToken', () => {
    crearMapaBase(document.createElement('div'), undefined, { boxZoom: false })
    expect(estado.opciones?.transformRequest).toBe(conToken)
    expect(estado.opciones?.boxZoom).toBe(false)
  })

  it('a page cannot drop it with its own options', () => {
    crearMapaBase(document.createElement('div'), undefined, { transformRequest: (url) => ({ url }) })
    expect(estado.opciones?.transformRequest).toBe(conToken)
  })
})
