import { afterEach, describe, expect, it, vi } from 'vitest'
import { Ion } from 'cesium'
const mocks = vi.hoisted(() => ({ world: vi.fn(), regional: vi.fn() }))
vi.mock('cesium', async importOriginal => {
  const original = await importOriginal<typeof import('cesium')>()
  return { ...original, Ion: { defaultAccessToken: '' }, createWorldTerrainAsync: mocks.world, ArcGISTiledElevationTerrainProvider: { fromUrl: mocks.regional } }
})
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); vi.clearAllMocks() })
describe('World Terrain access and capability reporting', () => {
  it('uses the authorized regional fallback without attempting ion when no token exists', async () => {
    vi.stubEnv('VITE_CESIUM_ION_TOKEN', '')
    mocks.regional.mockResolvedValue({ hasWaterMask: false, hasVertexNormals: false })
    const { createTerrainSource } = await import('../src/services/mapService')
    const result = await createTerrainSource('world')
    expect(mocks.world).not.toHaveBeenCalled()
    expect(result.source).toBe('regional')
    expect(result.waterMask).toBe(false)
    expect(result.fallbackReason).toContain('ion token')
  })
  it('requests both water masks and vertex normals for World Terrain', async () => {
    vi.stubEnv('VITE_CESIUM_ION_TOKEN', 'test-fixture-placeholder')
    mocks.world.mockResolvedValue({ hasWaterMask: true, hasVertexNormals: true })
    const { createTerrainSource } = await import('../src/services/mapService')
    const result = await createTerrainSource('world')
    expect(mocks.world).toHaveBeenCalledWith({ requestWaterMask: true, requestVertexNormals: true })
    expect(Ion.defaultAccessToken).toBe('test-fixture-placeholder')
    expect(result.source).toBe('world')
    expect(result.waterMask).toBe(true)
    expect(mocks.regional).not.toHaveBeenCalled()
  })
  it('reports the actual fallback if World Terrain access fails', async () => {
    vi.stubEnv('VITE_CESIUM_ION_TOKEN', 'test-fixture-placeholder')
    mocks.world.mockRejectedValue(new Error('Access denied'))
    mocks.regional.mockResolvedValue({ hasWaterMask: false, hasVertexNormals: false })
    const { createTerrainSource } = await import('../src/services/mapService')
    const result = await createTerrainSource('world')
    expect(result.source).toBe('regional')
    expect(result.fallbackReason).toBe('World Terrain unavailable')
    expect(result.vertexNormals).toBe(false)
  })
})
