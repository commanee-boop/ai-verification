import { describe, expect, it } from 'vitest'
import { sceneTimestamp } from '../src/services/gisScene'
describe('Lighting time and telemetry independence', () => {
  it('uses the exact replay timestamp for sunlight by default', () => { const source = Date.parse('2026-01-15T18:12:36Z'); expect(sceneTimestamp(source, false).getTime()).toBe(source) })
  it('uses explicitly labeled daylight preview without mutating the source timestamp', () => { const source = Date.parse('2026-01-15T18:12:36Z'); expect(sceneTimestamp(source, true).toISOString()).toBe('2026-01-15T03:00:00.000Z'); expect(source).toBe(Date.parse('2026-01-15T18:12:36Z')) })
})
