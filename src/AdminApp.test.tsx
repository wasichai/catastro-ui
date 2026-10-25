import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { AdminApp } from './AdminApp'

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

describe('admin', () => {
  it('signs in under the catastro prefix, with the gis, views and catastro screens only', async () => {
    fetch = mockFetch([
      { method: 'POST', path: '/auth/login', body: { token: 't', expiresAt: '2026-12-31T00:00:00Z', user: admin } },
      { path: '/auth/me/permissions', body: { admin: true, objects: {} } },
      { path: '/objects', body: [] }
    ])
    render(<AdminApp workerUrl="/maplibre-gl-worker.js" />)
    const email = await screen.findByLabelText('Correo')
    await userEvent.clear(email)
    await userEvent.type(email, 'admin@wasichai.local')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'admin')
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
    expect(screen.getAllByText('Catastro Perené').length).toBeGreaterThan(0)
    expect(localStorage.getItem('catastro.token')).toBe('t')
    for (const label of ['Vistas', 'Mapas', 'Capas', 'Aranceles por vía', 'Brechas']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    }
    for (const label of ['Workflows', 'Páginas', 'Formularios', 'Documentos']) {
      expect(screen.queryByRole('link', { name: label })).not.toBeInTheDocument()
    }
  })
})
