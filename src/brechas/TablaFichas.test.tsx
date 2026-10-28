import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@wasichai/testing'
import { TablaFichas } from './TablaFichas'

describe('TablaFichas', () => {
  it('keeps the sr-only header inside its own scroll, so it does not widen the page', () => {
    renderWithProviders(
      <TablaFichas
        pagina={{ content: [], page: 0, size: 25, totalElements: 0, totalPages: 0 }}
        seleccion={new Set()}
        onAlternar={vi.fn()}
        onElegirPagina={vi.fn()}
        page={0}
        size={25}
        onPage={vi.fn()}
        onSize={vi.fn()}
        onVer={vi.fn()}
      />
    )
    const tabla = screen.getByRole('table', { name: 'Fichas de la brecha' })
    expect(screen.getByRole('columnheader', { name: 'Detalle' })).toBeInTheDocument()
    // sr-only is absolute: its containing block is the nearest positioned ancestor, which has to be inside the scroll
    // that clips the table, not the document (jsdom has no layout, so the classes are what can be checked)
    const posicionado = screen.getByText('Detalle').parentElement!.closest('.relative')
    expect(posicionado).not.toBeNull()
    expect(tabla).toContainElement(posicionado as HTMLElement)
  })
})
