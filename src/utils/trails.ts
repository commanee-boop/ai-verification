import type { AircraftTelemetry } from '../types'
import { interval } from './quality'
import { sampleTrack } from './replay'

/** Recorded/interpolated positions only; never bridges a telemetry gap. */
export function trailSegments(rows: AircraftTelemetry[], from: number, to: number, cadence = interval(rows)): AircraftTelemetry[][] {
  if (!rows.length || from > to) return []
  const lowerBound = (time: number) => { let l = 0, r = rows.length; while (l < r) { const mid = (l + r) >>> 1; if (Date.parse(rows[mid].timestamp) < time) l = mid + 1; else r = mid } return l }
  const start = lowerBound(from), end = lowerBound(to)
  const points: AircraftTelemetry[] = []
  const first = sampleTrack(rows, from, cadence)
  if (first) points.push(first)
  for (let i = start; i < end; i++) if (!points.length || points[points.length - 1].timestamp !== rows[i].timestamp) points.push(rows[i])
  const last = sampleTrack(rows, to, cadence)
  if (last && (!points.length || points[points.length - 1].timestamp !== last.timestamp)) points.push(last)
  const segments: AircraftTelemetry[][] = []
  for (const point of points) {
    const previous = segments.at(-1)?.at(-1)
    if (!previous || Date.parse(point.timestamp) - Date.parse(previous.timestamp) > cadence * 1500) segments.push([point])
    else segments[segments.length - 1].push(point)
  }
  return segments.filter(s => s.length >= 2)
}
