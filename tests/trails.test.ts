import { describe, expect, it } from 'vitest'
import { createDemo, demoStart } from '../src/data/demo'
import { sortedTrack } from '../src/utils/replay'
import { trailSegments } from '../src/utils/trails'

describe('Timestamp-bound debrief trails', () => {
  it('clips both edges to the selected past window, without future samples', () => {
    const rows = sortedTrack(createDemo().telemetry, 'A'), before = structuredClone(rows)
    const segments = trailSegments(rows, demoStart + 2500, demoStart + 18250)
    expect(segments).toHaveLength(1)
    expect(segments[0][0].timestamp).toBe(new Date(demoStart + 2500).toISOString())
    expect(segments[0].at(-1)!.timestamp).toBe(new Date(demoStart + 18250).toISOString())
    expect(segments.flat().every(t => Date.parse(t.timestamp) <= demoStart + 18250)).toBe(true)
    expect(rows).toEqual(before)
  })
  it('breaks the trail at the deliberate GPS gap', () => {
    const rows = sortedTrack(createDemo().telemetry, 'B')
    const segments = trailSegments(rows, demoStart + 200000, demoStart + 310000)
    expect(segments).toHaveLength(2)
    for (const segment of segments) expect(segment.slice(1).every((p, i) => Date.parse(p.timestamp) - Date.parse(segment[i].timestamp) <= 7500)).toBe(true)
  })
  it('never extrapolates at the start, end, or inside a gap', () => {
    const rows = sortedTrack(createDemo().telemetry, 'B')
    expect(trailSegments(rows, demoStart - 10000, demoStart)).toEqual([])
    expect(trailSegments(rows, demoStart + 240000, demoStart + 260000)).toEqual([])
    expect(trailSegments(rows, demoStart + 700000, demoStart + 800000)).toEqual([])
  })
  it('updates correctly when scrubbing backward', () => {
    const rows = sortedTrack(createDemo().telemetry, 'A')
    trailSegments(rows, demoStart + 100000, demoStart + 200000)
    const rewound = trailSegments(rows, demoStart, demoStart + 50000)
    expect(rewound.flat().every(p => Date.parse(p.timestamp) <= demoStart + 50000)).toBe(true)
  })
})
