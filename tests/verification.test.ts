import { describe, expect, it } from 'vitest'
import { createDemo, demoStart } from '../src/data/demo'
import { analyzeMission, assessmentResult } from '../src/utils/quality'
import { sampleTrack, sortedTrack } from '../src/utils/replay'
import { previewFile } from '../src/services/importService'
import type { AssessmentRecord } from '../src/types'
const file = (name: string, content: string) => ({ name, size: content.length, text: async () => content }) as File

describe('Evidence and telemetry verification', () => {
  it('detects the deliberate eight-sample gap and two-second start offset', () => { const r = analyzeMission(createDemo()); expect(r.missingSamples).toBe(8); expect(r.maxOffsetSeconds).toBe(2); expect(r.completeness).toBe(96.7); expect(r.insights.filter(i => i.id.startsWith('assessment-'))).toHaveLength(4) })
  it('never promotes an untrusted imported assessment to HIT/MISS', () => { expect(assessmentResult({ result: 'HIT', source: 'claimed accredited', certificationReference: 'user-provided', evidenceReference: 'spoofed' } as AssessmentRecord)).toBe('UNVERIFIED') })
  it('reports invalid coordinates, record identity and missing event timestamps', () => { const m = createDemo(); m.telemetry[0].latitude = 100; m.telemetry[1].flightId = 'OTHER'; m.events[0].timestamp = ''; const r = analyzeMission(m); expect(r.invalidCoordinates).toBe(1); expect(r.insights.some(i => i.id === 'identity')).toBe(true); expect(r.insights.some(i => i.id === 'time-EVT-001')).toBe(true) })
  it('avoids double-counting a row invalid in both time and coordinates', () => { const m = createDemo(); m.telemetry[0].latitude = 100; m.telemetry[0].timestamp = ''; expect(analyzeMission(m).completeness).toBeLessThan(100) })
  it('detects duplicate timestamps', () => { const m = createDemo(); m.telemetry.push({ ...m.telemetry[0] }); expect(analyzeMission(m).insights.some(i => i.id === 'duplicates')).toBe(true) })
})
describe('Timestamp-driven replay', () => {
  it('interpolates ordinary samples without altering source data', () => { const track = sortedTrack(createDemo().telemetry, 'A'); const before = structuredClone(track); const sample = sampleTrack(track, demoStart + 2500); expect(sample?.interpolated).toBe(true); expect(sample?.latitude).toBeCloseTo((track[0].latitude + track[1].latitude) / 2); expect(track).toEqual(before) })
  it('hides positions inside long gaps and outside recorded boundaries', () => { const track = sortedTrack(createDemo().telemetry, 'B'); expect(sampleTrack(track, demoStart + 250000)).toBeNull(); expect(sampleTrack(track, demoStart)).toBeNull(); expect(sampleTrack(track, demoStart + 700000)).toBeNull() })
  it('uses shortest arc across north for heading', () => { const track = sortedTrack(createDemo().telemetry, 'A').slice(0, 2); track[0].heading = 359; track[1].heading = 1; expect(sampleTrack(track, demoStart + 2500)?.heading).toBe(360) })
})
describe('Import validation', () => {
  it('supports quoted CSV fields and normalizes explicit timezones', async () => { const p = await previewFile(file('events.csv', 'id,timestamp,source\nE1,2026-01-15T10:00:00+07:00,"Recorder, external"'), 'A', 'events', 'SIM-026'); expect(p.errors).toEqual([]); expect(p.events[0].source).toBe('Recorder, external'); expect(p.events[0].timestamp).toBe('2026-01-15T03:00:00.000Z') })
  it('rejects missing coordinates rather than treating them as zero', async () => { const p = await previewFile(file('gps.json', JSON.stringify([{ timestamp: '2026-01-15T03:00:00Z', latitude: '', longitude: 100, altitude: null }])), 'B', 'gps', 'SIM-026'); expect(p.errors.length).toBe(1); expect(p.telemetry).toHaveLength(0) })
  it('flags identity mismatches and timezone ambiguity', async () => { const p = await previewFile(file('gps.csv', 'timestamp,latitude,longitude,altitude,aircraftId\n2026-01-15T03:00:00,15,100,4000,B\n2026-01-15T03:00:00Z,15,100,4000,A'), 'B', 'gps', 'SIM-026'); expect(p.errors).toHaveLength(2) })
  it('rejects duplicate event ids and unsupported vendor binaries', async () => { const rows = [{ id: 'E1', timestamp: '2026-01-15T03:00:00Z' }, { id: 'E1', timestamp: '2026-01-15T03:00:05Z' }]; const p = await previewFile(file('shots.json', JSON.stringify(rows)), 'A', 'events', 'SIM-026'); expect(p.errors.some(e => e.includes('Duplicate'))).toBe(true); await expect(previewFile(file('mission.rcd', 'binary'), 'A', 'telemetry', 'SIM-026')).rejects.toThrow('Supported formats') })
})
