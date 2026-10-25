// the markup of the maps' popups, the same as gis' popup so it takes the theme's tokens. everything is escaped
export const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

// a bold title and one muted-key / value row per entry; an entry set to null is left out
export function popupDeFilas(titulo: string, filas: ([string, string] | null)[]): string {
  const fila = ([k, v]: [string, string]) =>
    `<div style="display:flex;gap:8px"><span style="color:var(--ink-muted)">${escapar(k)}</span><span>${escapar(v)}</span></div>`
  return (
    `<div data-theme="light" style="color:var(--ink);font:12px/1.5 ui-sans-serif,system-ui">` +
    `<div style="font-weight:600">${escapar(titulo)}</div>` +
    filas.flatMap((f) => (f ? [fila(f)] : [])).join('') +
    `</div>`
  )
}
