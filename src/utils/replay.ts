import type { AircraftTelemetry } from '../types'
import { interval, validCoordinate, validTime } from './quality'
export function sortedTrack(rows: AircraftTelemetry[], id: string) { return rows.filter(t => t.aircraftId === id && validCoordinate(t) && validTime(t.timestamp)).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)) }
export function sampleTrack(rows: AircraftTelemetry[], time: number, cadence = interval(rows)): (AircraftTelemetry & { interpolated: boolean }) | null {
  if (!rows.length || time < Date.parse(rows[0].timestamp) || time > Date.parse(rows[rows.length - 1].timestamp)) return null
  let low = 0, high = rows.length - 1
  while (low < high) { const middle = Math.floor((low + high) / 2); if (Date.parse(rows[middle].timestamp) < time) low = middle + 1; else high = middle }
  const next = low
  const b = rows[next]
  if (Date.parse(b.timestamp) === time || next === 0) return { ...b, interpolated: false }
  const a = rows[next - 1], gap = Date.parse(b.timestamp) - Date.parse(a.timestamp)
  if (gap > cadence * 1500) return null
  const k = (time - Date.parse(a.timestamp)) / gap
  const lerp = (x: number, y: number) => x + (y - x) * k
  const angle = (x?: number, y?: number) => x === undefined || y === undefined ? undefined : x + (((y - x + 540) % 360) - 180) * k
  return { ...a, timestamp: new Date(time).toISOString(), latitude: lerp(a.latitude, b.latitude), longitude: angle(a.longitude, b.longitude)!, altitude: lerp(a.altitude, b.altitude), heading: angle(a.heading, b.heading), pitch: angle(a.pitch, b.pitch), roll: angle(a.roll, b.roll), interpolated: true }
}
export function durationLabel(seconds: number) { const s = Math.max(0, Math.floor(seconds)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` }
