import Papa from 'papaparse'
import type { ImportKind, ImportPreview, AircraftTelemetry, ShotEvent } from '../types'
import { validCoordinate, validTime } from '../utils/quality'
export async function previewFile(file: File, aircraftId: string, kind: ImportKind, flightId: string): Promise<ImportPreview> {
  const result: ImportPreview = { filename: file.name, aircraftId, kind, telemetry: [], events: [], errors: [] }
  if (file.size > 10 * 1024 * 1024) throw new Error('File exceeds the 10 MB limit.')
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!['csv', 'json', 'gpx'].includes(ext || '')) throw new Error('Supported formats: CSV, JSON, GPX. Vendor binary files are not supported.')
  const text = await file.text()
  let rows: Record<string, unknown>[]
  if (ext === 'json') {
    const parsed: unknown = JSON.parse(text)
    if (!Array.isArray(parsed)) throw new Error('JSON must contain an array of records.')
    rows = parsed as Record<string, unknown>[]
  } else if (ext === 'csv') {
    const parsed = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: 'greedy', transformHeader: h => h.trim().replace(/^\uFEFF/, '') })
    if (parsed.errors.length) throw new Error(parsed.errors[0].message)
    rows = parsed.data
  } else {
    if (kind === 'events') throw new Error('GPX contains positions. Use CSV or JSON for shot events.')
    const xml = new DOMParser().parseFromString(text, 'application/xml')
    if (xml.querySelector('parsererror')) throw new Error('Malformed GPX XML.')
    rows = Array.from(xml.getElementsByTagNameNS('*', 'trkpt')).map(p => ({ latitude: p.getAttribute('lat'), longitude: p.getAttribute('lon'), altitude: p.getElementsByTagNameNS('*', 'ele')[0]?.textContent, timestamp: p.getElementsByTagNameNS('*', 'time')[0]?.textContent }))
  }
  if (!rows.length) throw new Error('The file contains no records.')
  if (rows.length > 50000) throw new Error('Maximum 50,000 records per file.')
  const number = (v: unknown) => v === undefined || v === null || String(v).trim() === '' ? NaN : Number(v)
  for (const [i, r] of rows.entries()) {
    if (!r || typeof r !== 'object') { result.errors.push(`Row ${i + 1}: record must be an object.`); continue }
    const timestamp = String(r.timestamp ?? '')
    // Require explicit timezone to avoid device-local ambiguity.
    if (!validTime(timestamp) || !/(Z|[+-]\d{2}:\d{2})$/i.test(timestamp)) { result.errors.push(`Row ${i + 1}: timestamp must be ISO 8601 with Z or timezone offset.`); continue }
    if (r.aircraftId && r.aircraftId !== aircraftId) { result.errors.push(`Row ${i + 1}: aircraftId does not match selected aircraft ${aircraftId}.`); continue }
    if (r.flightId && r.flightId !== flightId) { result.errors.push(`Row ${i + 1}: flightId does not match ${flightId}.`); continue }
    const base = { aircraftId, flightId, timestamp: new Date(timestamp).toISOString(), source: String(r.source || file.name), validationStatus: 'valid' as const }
    if (kind === 'events') {
      if (!r.id) { result.errors.push(`Row ${i + 1}: event id is required.`); continue }
      result.events.push({ ...base, id: String(r.id), weaponProfile: String(r.weaponProfile || 'Unspecified'), description: String(r.description || 'Imported shot record') } satisfies ShotEvent)
    } else {
      const t: AircraftTelemetry = { ...base, latitude: number(r.latitude), longitude: number(r.longitude), altitude: number(r.altitude) }
      if (!validCoordinate(t)) { result.errors.push(`Row ${i + 1}: invalid latitude, longitude or altitude.`); continue }
      let attitudeValid = true
      for (const key of ['heading', 'pitch', 'roll'] as const) {
        if (r[key] !== undefined && r[key] !== null && r[key] !== '') {
          const n = number(r[key])
          if (!Number.isFinite(n) || (key === 'heading' ? n < 0 || n >= 360 : Math.abs(n) > (key === 'pitch' ? 90 : 180))) { result.errors.push(`Row ${i + 1}: invalid ${key}.`); attitudeValid = false } else t[key] = n
        }
      }
      if (attitudeValid) result.telemetry.push(t)
    }
  }
  const records = kind === 'events' ? result.events : result.telemetry
  const keys = records.map(r => kind === 'events' ? (r as ShotEvent).id : r.timestamp)
  if (new Set(keys).size !== keys.length) result.errors.push('Duplicate event IDs or aircraft timestamps are not allowed.')
  return result
}
