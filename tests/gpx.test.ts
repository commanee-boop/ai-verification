// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { previewFile } from '../src/services/importService'
const file = (text: string) => ({ name: 'track.gpx', size: text.length, text: async () => text }) as File
describe('GPX import', () => {
  it('parses namespace-qualified track points and preserves altitude and time', async () => { const p = await previewFile(file('<gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg><trkpt lat="15.1" lon="100.2"><ele>4200</ele><time>2026-01-15T03:00:00Z</time></trkpt></trkseg></trk></gpx>'), 'B', 'gps', 'SIM-026'); expect(p.errors).toEqual([]); expect(p.telemetry[0]).toMatchObject({ aircraftId: 'B', latitude: 15.1, longitude: 100.2, altitude: 4200, timestamp: '2026-01-15T03:00:00.000Z' }) })
  it('rejects missing elevations and malformed XML', async () => { const p = await previewFile(file('<gpx><trkpt lat="15" lon="100"><time>2026-01-15T03:00:00Z</time></trkpt></gpx>'), 'B', 'gps', 'SIM-026'); expect(p.errors).toHaveLength(1); await expect(previewFile(file('<gpx><broken>'), 'B', 'gps', 'SIM-026')).rejects.toThrow('Malformed') })
  it('does not interpret a GPS file as a shot event log', async () => { await expect(previewFile(file('<gpx/>'), 'B', 'events', 'SIM-026')).rejects.toThrow('positions') })
})
