import { ArcGisMapServerImageryProvider, ArcGISTiledElevationTerrainProvider, OpenStreetMapImageryProvider, TileMapServiceImageryProvider, buildModuleUrl, createWorldTerrainAsync, Ion } from 'cesium'
import { DarkCanvasImageryProvider } from './darkCanvasImagery'

export type MapStyle = 'dark' | 'satellite' | 'street' | 'offline'
export type TerrainMode = 'world' | 'regional'
export const worldTerrainOptions = { requestWaterMask: true, requestVertexNormals: true } as const
const ionToken = import.meta.env.VITE_CESIUM_ION_TOKEN?.trim() || ''
export const worldTerrainConfigured = Boolean(ionToken)
export const mapSources = {
  satellite: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
  terrain: 'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer',
  street: 'https://tile.openstreetmap.org/',
} as const
export const mapLabels: Record<MapStyle, string> = { dark: 'OSM · Dark Canvas', satellite: 'Esri satellite', street: 'OpenStreetMap', offline: 'Natural Earth · offline' }

export async function mapRequest<T>(operation: Promise<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try { return await Promise.race([operation, new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('Map service timed out')), 20000) })]) }
  finally { clearTimeout(timeout) }
}

export async function createMapImagery(style: MapStyle) {
  if (style === 'dark') return new DarkCanvasImageryProvider(mapSources.street)
  if (style === 'satellite') return mapRequest(ArcGisMapServerImageryProvider.fromUrl(mapSources.satellite, { enablePickFeatures: false }))
  if (style === 'street') return new OpenStreetMapImageryProvider({ url: mapSources.street, maximumLevel: 19 })
  return mapRequest(TileMapServiceImageryProvider.fromUrl(buildModuleUrl('Assets/Textures/NaturalEarthII')))
}
export function createRegionalTerrain() { return mapRequest(ArcGISTiledElevationTerrainProvider.fromUrl(mapSources.terrain)) }

export async function createTerrainSource(mode: TerrainMode) {
  let fallbackReason = ''
  if (mode === 'world') {
    if (worldTerrainConfigured) {
      try {
        Ion.defaultAccessToken = ionToken
        const provider = await mapRequest(createWorldTerrainAsync(worldTerrainOptions))
        return { provider, source: 'world' as const, label: 'Cesium World Terrain', fallbackReason, waterMask: provider.hasWaterMask, vertexNormals: provider.hasVertexNormals }
      } catch { fallbackReason = 'World Terrain unavailable' }
    } else fallbackReason = 'World Terrain requires an ion token'
  }
  const provider = await createRegionalTerrain()
  return { provider, source: 'regional' as const, label: 'Esri 3D terrain', fallbackReason, waterMask: provider.hasWaterMask, vertexNormals: provider.hasVertexNormals }
}

/** Unavailable terrain remains unknown; never replace telemetry altitude with it. */
export function groundReferenceHeight(terrainActive: boolean, height?: number): number | undefined {
  return terrainActive ? Number.isFinite(height) ? height : undefined : 0
}
