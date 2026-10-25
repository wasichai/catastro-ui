// the contract of GET /api/catastro/vias/aranceles?anio= (catastro-backend): one feature per tramo_via, EPSG:4326
export type Lado = 'AMBOS' | 'IZQUIERDO' | 'DERECHO'
export type Asignacion = 'NOMBRE_UNICO' | 'CERCANIA' | 'LOTES' | 'SIN_ARANCEL'

// the backend sends null when the data is missing, and maplibre's tile encoding drops nulls: they arrive as undefined
export interface TramoProps {
  cod_via_eje: string | null
  tip_via: string | null
  nom_via: string | null
  cuadra: string | null
  lado: Lado
  id_aranc: string | null
  asignacion: Asignacion
  anio: number
  valor_m2: number | null
}

export interface TramoFeature {
  type: 'Feature'
  id?: string | number
  geometry: { type: 'LineString' | 'MultiLineString'; coordinates: unknown }
  properties: TramoProps
}

export interface TramosCollection {
  type: 'FeatureCollection'
  features: TramoFeature[]
}
