import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toAttributes, toFormValues, type FieldMeta } from '@wasichai/core'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { AdminApp, CONFIG, nombreApp } from './AdminApp'

// jsdom has no webgl: a map that never loads is enough (vite.config.ts inlines @wasichai/gis so it gets this mock)
vi.mock('maplibre-gl', () => {
  class Map {
    addControl() {}
    on() {}
    remove() {}
  }
  class Control {}
  return { Map, NavigationControl: Control, ScaleControl: Control, Popup: Control, RasterTileSource: Control, setWorkerUrl: () => {} }
})

const admin = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Admin', organizationId: 'o1', roles: ['ADMIN'] }

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  window.history.pushState({}, '', '/')
})
afterEach(() => fetch?.restore())

// the routes of a sign-in, with the organization the core answers (or how it fails)
function signIn(organization: { status?: number; body?: unknown }) {
  return mockFetch([
    { method: 'POST', path: '/auth/login', body: { token: 't', expiresAt: '2026-12-31T00:00:00Z', user: admin } },
    { path: '/auth/me/permissions', body: { admin: true, objects: {} } },
    { path: '/organizations/current', ...organization },
    { path: '/objects', body: [] }
  ])
}

async function login() {
  const email = await screen.findByLabelText('Correo')
  await userEvent.clear(email)
  await userEvent.type(email, 'admin@wasichai.local')
  await userEvent.type(screen.getByLabelText('Contraseña'), 'admin')
  await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
  expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
}

describe('nombreApp', () => {
  it('names the app after the municipalidad, without its kind', () => {
    expect(nombreApp('Municipalidad Provincial de Ica')).toBe('Catastro Ica')
    expect(nombreApp('Municipalidad Distrital de Perené')).toBe('Catastro Perené')
    expect(nombreApp('MUNICIPALIDAD METROPOLITANA DE LIMA')).toBe('Catastro LIMA')
    expect(nombreApp('  Municipalidad de Chanchamayo ')).toBe('Catastro Chanchamayo')
  })

  it('keeps a name that is not a municipalidad, and is plain «Catastro» without one', () => {
    expect(nombreApp('Demo')).toBe('Catastro Demo')
    expect(nombreApp('')).toBe('Catastro')
    expect(nombreApp('   ')).toBe('Catastro')
    expect(nombreApp(null)).toBe('Catastro')
    expect(nombreApp(undefined)).toBe('Catastro')
  })
})

describe('admin', () => {
  it('signs in under the catastro prefix, with the gis, views and catastro screens only', async () => {
    fetch = signIn({ body: { id: 'o1', name: 'Municipalidad Distrital de Perené' } })
    render(<AdminApp workerUrl="/maplibre-gl-worker.js" />)
    await login()
    expect(await screen.findByText('Catastro Perené')).toBeInTheDocument()
    expect(localStorage.getItem('catastro.token')).toBe('t')
    for (const label of ['Vistas', 'Mapas', 'Capas', 'Aranceles por vía', 'Brechas']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    }
    for (const label of ['Workflows', 'Páginas', 'Formularios', 'Documentos']) {
      expect(screen.queryByRole('link', { name: label })).not.toBeInTheDocument()
    }
  })

  it('is «Catastro» before signing in, and the institution of the organization after', async () => {
    fetch = signIn({ body: { id: 'o1', name: 'Municipalidad Provincial de Ica' } })
    render(<AdminApp workerUrl="/maplibre-gl-worker.js" />)
    await screen.findByLabelText('Correo')
    expect(screen.getByText('Catastro')).toBeInTheDocument()
    expect(document.title).toBe('Catastro')
    expect(fetch.calls.some((call) => call.path.endsWith('/organizations/current'))).toBe(false)
    await login()
    expect(await screen.findByText('Catastro Ica')).toBeInTheDocument()
    expect(screen.queryByText('Catastro Perené')).not.toBeInTheDocument()
    expect(document.title).toBe('Catastro Ica')
  })

  it('stays «Catastro» when the organization cannot be read', async () => {
    fetch = signIn({ status: 500, body: { status: 500, message: 'boom' } })
    render(<AdminApp workerUrl="/maplibre-gl-worker.js" />)
    await login()
    await waitFor(() => expect(fetch?.calls.some((call) => call.path.endsWith('/organizations/current'))).toBe(true))
    expect(screen.getByText('Catastro')).toBeInTheDocument()
    expect(document.title).toBe('Catastro')
  })
})

describe('config', () => {
  const campo = { name: 'decidido_en', type: 'DATETIME', editable: true } as FieldMeta

  it('says the model lives in the repository', () => {
    expect(CONFIG.modelInRepository).toBe(true)
  })

  it('reads and writes the DATETIME fields as Lima wall time, whatever the zone of the browser', () => {
    expect(CONFIG.timeZone).toBe('America/Lima')
    const opciones = { timeZone: CONFIG.timeZone }
    // 22:00 in Lima is 03:00 UTC of the next day
    expect(toAttributes([campo], { decidido_en: '2026-10-19T22:00' }, opciones)).toEqual({ decidido_en: '2026-10-20T03:00:00.000Z' })
    expect(toFormValues([campo], { decidido_en: '2026-10-20T03:00:00Z' }, opciones)).toEqual({ decidido_en: '2026-10-19T22:00' })
  })
})
