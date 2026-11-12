import type { AircraftTelemetry, AssessmentRecord, DataQualityReport, FlightMission, AIInsight } from '../types'
export const validTime = (s: string) => !!s && Number.isFinite(Date.parse(s))
export const validCoordinate = (t: AircraftTelemetry) => Number.isFinite(t.latitude) && Math.abs(t.latitude) <= 90 && Number.isFinite(t.longitude) && Math.abs(t.longitude) <= 180 && Number.isFinite(t.altitude)
export function median(values: number[]) { const a = [...values].sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : 0 }
export function interval(rows: AircraftTelemetry[]) { return median(rows.slice(1).map((t, i) => (Date.parse(t.timestamp) - Date.parse(rows[i].timestamp)) / 1000).filter(n => n > 0)) }
export function assessmentResult(record?: AssessmentRecord): 'UNVERIFIED' {
  // Client imports cannot establish simulator accreditation or verify evidence signatures.
  // Certified HIT/MISS must be supplied by a future trusted backend, never a user flag.
  void record
  return 'UNVERIFIED'
}
export function analyzeMission(m: FlightMission): DataQualityReport {
  const insights: AIInsight[] = [], metrics: DataQualityReport['metrics'] = []
  let missing = 0, expected = 0
  const invalid = m.telemetry.filter(t => !validCoordinate(t)).length
  const badTimes = m.telemetry.filter(t => !validTime(t.timestamp)).length
  const series = m.aircraft.map(a => ({ a, rows: m.telemetry.filter(t => t.aircraftId === a.id && validTime(t.timestamp) && validCoordinate(t)).sort((x, y) => Date.parse(x.timestamp) - Date.parse(y.timestamp)) }))
  for (const { a, rows } of series) {
    const step = interval(rows)
    const gaps = rows.slice(1).map((t, i) => ({ from: rows[i].timestamp, to: t.timestamp, seconds: (Date.parse(t.timestamp) - Date.parse(rows[i].timestamp)) / 1000 })).filter(g => step > 0 && g.seconds > step * 1.5)
    const lost = gaps.reduce((sum, g) => sum + Math.max(0, Math.round(g.seconds / step) - 1), 0)
    missing += lost; expected += rows.length + lost
    if (!rows.length) insights.push({ id: `empty-${a.id}`, severity: 'ERROR', title: `${a.callsign}: no telemetry`, reason: 'No valid position samples are available for replay.', evidence: `${a.id}: 0 valid samples` })
    gaps.forEach((g, i) => insights.push({ id: `gap-${a.id}-${i}`, severity: 'WARNING', title: `${a.callsign}: GPS gap`, reason: 'A sample interval exceeds 1.5× the median cadence. Position is hidden inside this gap.', evidence: `${g.from} → ${g.to} (${g.seconds}s; median ${step}s)` }))
    if (a.simulatorModel) insights.push({ id: `proxy-${a.id}`, severity: 'INFO', title: `${a.callsign}: simulator proxy`, reason: 'The simulator model differs from the configured aircraft. Demo behavior does not validate the target model.', evidence: `${a.model} / ${a.simulatorModel}` })
  }
  const starts = series.filter(s => s.rows.length).map(s => Date.parse(s.rows[0].timestamp))
  const offset = starts.length > 1 ? (Math.max(...starts) - Math.min(...starts)) / 1000 : 0
  if (offset) insights.push({ id: 'offset', severity: 'WARNING', title: 'Timestamp alignment needs review', reason: 'First sample timestamps differ. This is an observed start offset, not proof of clock drift; timestamps are preserved.', evidence: `${starts.map(t => new Date(t).toISOString()).join(' / ')}; Δ ${offset}s` })
  const mismatch = [...m.telemetry, ...m.events].filter(r => r.flightId !== m.id || !m.aircraft.some(a => a.id === r.aircraftId))
  if (mismatch.length) insights.push({ id: 'identity', severity: 'ERROR', title: 'Flight or aircraft identity mismatch', reason: 'Records do not match this mission or a configured aircraft.', evidence: `${mismatch.length} records; expected flightId ${m.id}` })
  for (const e of m.events) {
    if (!validTime(e.timestamp)) insights.push({ id: `time-${e.id}`, severity: 'ERROR', title: 'Shot event has no valid timestamp', reason: 'The event cannot be placed on the timeline.', evidence: `${e.id}: ${e.timestamp || '(missing)'}` })
    const track = series.find(s => s.a.id === e.aircraftId)?.rows || []
    if (validTime(e.timestamp) && (!track.length || Date.parse(e.timestamp) < Date.parse(track[0].timestamp) || Date.parse(e.timestamp) > Date.parse(track[track.length - 1].timestamp))) insights.push({ id: `bounds-${e.id}`, severity: 'WARNING', title: `${e.id}: no position coverage`, reason: 'The event is outside this aircraft’s recorded position interval. Replay cannot establish its location.', evidence: `${e.aircraftId} / ${e.timestamp}; track ${track[0]?.timestamp || 'empty'} → ${track[track.length - 1]?.timestamp || 'empty'}` })
    insights.push({ id: `assessment-${e.id}`, severity: 'WARNING', title: `${e.id}: assessment unverified`, reason: 'No authenticated assessment from an accredited simulator is available. A shot record alone does not establish an outcome.', evidence: `${e.source}; trusted assessment service not connected` })
  }
  if (invalid || badTimes) insights.push({ id: 'invalid', severity: 'ERROR', title: 'Invalid telemetry records', reason: 'Invalid coordinates or timestamps are excluded from replay.', evidence: `${invalid} coordinate errors; ${badTimes} timestamp errors` })
  const duplicates = series.reduce((sum, s) => sum + s.rows.length - new Set(s.rows.map(t => t.timestamp)).size, 0)
  if (duplicates) insights.push({ id: 'duplicates', severity: 'ERROR', title: 'Duplicate timestamps', reason: 'Multiple positions share a timestamp for the same aircraft.', evidence: `${duplicates} duplicate records` })
  const validCount = m.telemetry.filter(t => validCoordinate(t) && validTime(t.timestamp)).length
  const completeness = expected ? Math.round((validCount / (expected + m.telemetry.length - validCount)) * 1000) / 10 : 0
  metrics.push(
    { label: 'GPS completeness', value: `${completeness}%`, status: completeness >= 99 ? 'valid' : 'warning', detail: 'Estimated from each track’s median sample interval; outside track boundaries is unknown.' },
    { label: 'Timestamp synchronization', value: `${offset.toFixed(1)}s offset`, status: offset ? 'warning' : 'valid', detail: 'Difference between first valid samples. No automatic time correction.' },
    { label: 'Missing data', value: `${missing} samples`, status: missing ? 'warning' : 'valid', detail: 'Estimated interior missing samples. Long gaps are not interpolated.' },
    { label: 'Invalid coordinates', value: String(invalid), status: invalid ? 'invalid' : 'valid', detail: 'Latitude ±90°, longitude ±180°, finite altitude in meters.' },
    { label: 'Sampling rate', value: series.map(s => `${s.a.id}: ${interval(s.rows) ? (1 / interval(s.rows)).toFixed(2) : '—'} Hz`).join(' / '), status: series.every(s => s.rows.length > 1) ? 'valid' : 'warning', detail: 'Inverse of the median positive interval; cadence may vary.' },
    { label: 'Telemetry consistency', value: `${mismatch.length + duplicates + badTimes} issues`, status: mismatch.length + duplicates + badTimes ? 'invalid' : 'valid', detail: 'Flight IDs, aircraft IDs, timestamps and duplicate samples.' }
  )
  return { timestamp: new Date().toISOString(), source: 'Local deterministic validation rules v1', validationStatus: insights.some(i => i.severity === 'ERROR') ? 'invalid' : insights.some(i => i.severity === 'WARNING') ? 'warning' : 'valid', completeness, missingSamples: missing, invalidCoordinates: invalid, maxOffsetSeconds: offset, metrics, insights }
}
