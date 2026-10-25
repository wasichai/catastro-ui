import type { ExpressionSpecification } from 'maplibre-gl'

// what is particular to the vías; the palette and the quantiles are in ../comun/colores

// the frentes are drawn beside the eje: izquierdo to the left of the line's direction, derecho to the right
export const DESPLAZAMIENTO_PX = 4
export const DESPLAZAMIENTO: ExpressionSpecification = ['match', ['get', 'lado'], 'IZQUIERDO', -DESPLAZAMIENTO_PX, 'DERECHO', DESPLAZAMIENTO_PX, 0]

const SIN_ASIGNAR: ExpressionSpecification = ['==', ['get', 'asignacion'], 'SIN_ARANCEL']
const CON_VALOR: ExpressionSpecification = ['==', ['typeof', ['get', 'valor_m2']], 'number']

// the three kinds of line, one filter each
export const FILTRO_CON_VALOR: ExpressionSpecification = ['all', ['!', SIN_ASIGNAR], CON_VALOR]
export const FILTRO_SIN_ARANCEL_ANIO: ExpressionSpecification = ['all', ['!', SIN_ASIGNAR], ['!', CON_VALOR]]
export const FILTRO_SIN_ASIGNAR: ExpressionSpecification = SIN_ASIGNAR
