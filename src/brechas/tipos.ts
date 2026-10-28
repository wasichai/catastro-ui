// the contract of /api/catastro/brechas (catastro-backend): the cortes loaded from srtm's analytic snapshot, their
// fichas, the lotes of those fichas and the decisions taken on them
export const CATEGORIAS = ['OMISO', 'SIN_CATASTRO', 'SIN_VALOR', 'SUBVALUADO', 'SOBREVALUADO', 'COINCIDE', 'SIN_LEVANTAR'] as const
export const CONFIANZAS = ['CONFIABLE', 'DUDOSO', 'SIN_LEVANTAR'] as const
export const ESTADOS = ['PENDIENTE', 'A_INSPECCIONAR', 'INSPECCIONADO', 'A_FISCALIZAR', 'DESCARTADO'] as const
// how srtm matched a piso: in both, in only one, or it could not tell
export const ESTADOS_NIVEL = ['PAR', 'SOLO_RENTAS', 'SOLO_CATASTRO', 'AMBIGUO'] as const

export type Categoria = (typeof CATEGORIAS)[number]
export type Confianza = (typeof CONFIANZAS)[number]
export type Estado = (typeof ESTADOS)[number]
export type EstadoNivel = (typeof ESTADOS_NIVEL)[number]

// a DECIMAL may come as a number or as its text
export type Decimal = number | string | null

export interface Corte {
  clave: string
  fecha: string
  anio: number
  corrida: string
  total_fichas: number
  delta_impuesto: Decimal
  cargado_en: string | null
}

export interface Cuenta<K extends string | null = string> {
  clave: K
  fichas: number
  delta_impuesto?: Decimal
}

export interface Panel {
  corte: Pick<Corte, 'clave' | 'fecha' | 'anio' | 'corrida'>
  kpis: {
    fichas: number
    delta_impuesto: Decimal
    delta_impuesto_confiable: Decimal
    omisos_estimado: number
    supera_5_uit: number
    pendientes: number
    con_geometria: number
    // fichas without codigo_municipal: they cannot be decided, so pendientes and por_estado leave them out
    sin_ficha: number
  }
  por_categoria: Cuenta<Categoria>[]
  // clave null: fichas without confianza (cortes before srtm#204)
  por_confianza: Cuenta<Confianza | null>[]
  por_estado: Cuenta<Estado>[]
  top_sectores: { sector: string | null; fichas: number; delta_impuesto: Decimal }[]
}

export interface Ficha {
  id: string
  codigo_catastro: string | null
  codigo_municipal: string | null
  codigo_predio: string | null
  categoria: Categoria
  confianza: Confianza | null
  confianza_motivo: string | null
  sector: string | null
  manzana: string | null
  lote: string | null
  uso: string | null
  autoavaluo_declarado: Decimal
  autoavaluo_catastro: Decimal
  delta_autoavaluo: Decimal
  impuesto_declarado: Decimal
  impuesto_catastro: Decimal
  delta_impuesto: Decimal
  delta_arbitrios: Decimal
  estimado: boolean | null
  motivo: string | null
  // null: the corte had no UIT
  supera_5_uit: boolean | null
  estado: Estado
  responsable: string | null
  nota: string | null
  decidido_en: string | null
  con_geometria: boolean
}

// a piso of a ficha (brecha_nivel_ficha): the declared area, the surveyed one and delta = catastro − rentas when it
// has both
export interface Nivel {
  piso: number | null
  area_rentas: Decimal
  area_catastro: Decimal
  estado: EstadoNivel
  delta: Decimal
}

// GET /fichas/{id}: the row of /fichas and its niveles, by piso. empty for a role that may not read them, or a corte
// without them
export interface DetalleFicha extends Ficha {
  niveles: Nivel[]
}

export interface Pagina<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

// maplibre's tile encoding drops nulls: they arrive as undefined
export interface LoteProps {
  codigo_municipal: string
  codigo_catastro: string | null
  categoria: Categoria
  confianza: Confianza | null
  delta_impuesto: number | null
  estado: Estado
  supera_5_uit: boolean | null
  // how many fichas share the codigo_municipal, when the API says it: the map draws one, the one with the largest Δ
  fichas?: number
}

export interface LoteFeature {
  type: 'Feature'
  id?: string | number
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown }
  properties: LoteProps
}

export interface LotesCollection {
  type: 'FeatureCollection'
  features: LoteFeature[]
}

export interface Filtros {
  categoria: Categoria[]
  confianza: Confianza[]
  estado: Estado[]
  sector: string
  // '' = both
  supera_5_uit: '' | 'true' | 'false'
  min_delta: string
}

export type Orden = 'delta_desc' | 'delta_asc' | 'codigo'

export interface Decision {
  codigos: string[]
  anio: number
  estado: Exclude<Estado, 'PENDIENTE'>
  // left out keeps the note there was; null clears it
  nota?: string | null
  motivo_descarte?: string
}

export interface ResultadoDecision {
  actualizadas: number
  creadas: number
  errores: { codigo: string; error: string }[]
}

// what the published GeoServer layers look like to the dashboard (@wasichai/gis /gis/services and /gis/layers)
export interface ServiciosGeoServer {
  enabled: boolean
  wms: string
}

export interface CapaGis {
  objectName: string
  geometryName: string
  label: string
  layerName: string
  published: boolean
  wms: string
}

export interface CapaWms {
  id: string
  url: string
  opacity: number
}
