// the contract of GET /api/catastro/vias/aranceles?anio= (catastro-backend): one feature per tramo_via, EPSG:4326
export type Lado = 'AMBOS' | 'IZQUIERDO' | 'DERECHO'
export type Asignacion = 'NOMBRE_UNICO' | 'CERCANIA' | 'SIN_ARANCEL'

export interface TramoProps {
  cod_via_eje: string
  tip_via: string
  nom_via: string
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
