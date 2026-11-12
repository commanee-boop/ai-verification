import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { createDemo } from '../data/demo'
import { analyzeMission, interval, validTime } from '../utils/quality'
import { sampleTrack, sortedTrack } from '../utils/replay'
import { mockMissionService } from '../services/missionService'
import type { FlightMission, ImportPreview } from '../types'
import type { MapStyle, TerrainMode } from '../services/mapService'

export const useMissionStore = defineStore('mission', () => {
  const mission = ref<FlightMission>(createDemo()), currentTime = ref(Date.parse(mission.value.timestamp)), playing = ref(false), speed = ref(1), loading = ref(false)
  const tab = ref('quality'), search = ref(''), eventFilter = ref('all'), selectedEventId = ref('EVT-001'), importCount = ref(0), cameraMode = ref('thailand'), showPaths = ref(true), showLabels = ref(true), settingsOpen = ref(false)
  const cameraRevision = ref(0)
  const selectedAircraftId = ref('A'), showGroundGrid = ref(false), showAltitudeLines = ref(true), showRecordedRoute = ref(true), showBasemap = ref(true), trailSeconds = ref(120)
  const mapStyle = ref<MapStyle>('satellite'), showTerrain = ref(true), terrainMode = ref<TerrainMode>('regional'), gisEffects = ref(false), daylightPreview = ref(false)
  function resetCamera() { cameraMode.value = 'overview'; cameraRevision.value++ }
  const notifications = ref<{ id: number; message: string; error: boolean }[]>([])
  const report = computed(() => analyzeMission(mission.value))
  const times = computed(() => mission.value.telemetry.filter(t => validTime(t.timestamp)).map(t => Date.parse(t.timestamp)))
  const start = computed(() => times.value.length ? Math.min(...times.value) : Date.parse(mission.value.timestamp))
  const end = computed(() => times.value.length ? Math.max(...times.value) : start.value)
  const duration = computed(() => (end.value - start.value) / 1000)
  const tracks = computed(() => mission.value.aircraft.map(aircraft => { const rows = sortedTrack(mission.value.telemetry, aircraft.id); return { aircraft, rows, cadence: interval(rows) } }))
  const aircraftStates = computed(() => tracks.value.map(t => ({ aircraft: t.aircraft, sample: sampleTrack(t.rows, currentTime.value, t.cadence) })))
  const selectedEvent = computed(() => mission.value.events.find(e => e.id === selectedEventId.value))
  const filteredEvents = computed(() => mission.value.events.filter(e => (eventFilter.value === 'all' || e.aircraftId === eventFilter.value) && `${e.id} ${e.aircraftId} ${e.source} ${e.description}`.toLowerCase().includes(search.value.toLowerCase())))
  let noticeId = 0
  function notify(message: string, error = false) { const id = ++noticeId; notifications.value.push({ id, message, error }); setTimeout(() => notifications.value = notifications.value.filter(n => n.id !== id), 6000) }
  async function loadDemo() { loading.value = true; playing.value = false; try { mission.value = await mockMissionService.loadDemo(); currentTime.value = start.value; importCount.value = 0; selectedEventId.value = mission.value.events[0]?.id || ''; notify('Loaded simulated mission · 2 aircraft / 4 events') } catch (e) { notify(String(e), true) } finally { loading.value = false } }
  function reset() { playing.value = false; const fresh = createDemo(); mission.value = { ...fresh, name: 'New verification mission', simulated: false, source: 'User import', telemetry: [], events: [], assessments: [] }; currentTime.value = Date.parse(fresh.timestamp); importCount.value = 0; selectedEventId.value = ''; notify('Configuration reset. Import flight records to begin.') }
  function seek(time: number) { currentTime.value = Math.min(end.value, Math.max(start.value, time)) }
  function selectEvent(id: string) { selectedEventId.value = id; const event = selectedEvent.value; if (event && validTime(event.timestamp)) { const time = Date.parse(event.timestamp); if (time < start.value || time > end.value) { notify('Event is outside the recorded replay interval; timestamp was not changed.', true); return } seek(time) } }
  function applyImport(preview: ImportPreview) {
    if (preview.errors.length) throw new Error('Resolve validation errors before importing.')
    if (preview.kind === 'events') {
      const other = mission.value.events.filter(e => e.aircraftId !== preview.aircraftId)
      if (preview.events.some(e => other.some(o => o.id === e.id))) throw new Error('An event ID already exists on another aircraft.')
      mission.value.events = [...other, ...preview.events]
      selectedEventId.value = mission.value.events[0]?.id || ''
    } else mission.value.telemetry = [...mission.value.telemetry.filter(t => t.aircraftId !== preview.aircraftId), ...preview.telemetry]
    // Imported data may coexist with synthetic tracks; retain the mission simulated flag.
    mission.value.source = mission.value.simulated ? 'Mixed: simulated demo + user imports' : 'User imports'
    mission.value.assessments = []; playing.value = false; currentTime.value = start.value; importCount.value++; notify(`Imported ${preview.filename}; replaced ${preview.kind} for aircraft ${preview.aircraftId}`)
  }
  function validate() { const r = report.value; notify(`Validation complete · ${r.completeness}% coverage · ${r.insights.filter(i => i.severity !== 'INFO').length} findings`); tab.value = 'quality' }
  function exportReport() { const payload = { missionId: mission.value.id, missionSource: mission.value.source, simulated: mission.value.simulated, report: report.value, events: mission.value.events.map(e => ({ ...e, assessment: 'UNVERIFIED' })), limitations: ['Local deterministic rules, no external AI service.', 'No accredited simulator assessment service connected.', 'Interpolation is visual only. Long gaps are hidden.'] }; const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = `${mission.value.id}-quality-report.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); notify('Data quality report exported as JSON') }
  return { mission, currentTime, playing, speed, loading, tab, search, eventFilter, selectedEventId, importCount, cameraMode, cameraRevision, resetCamera, selectedAircraftId, showGroundGrid, showAltitudeLines, showRecordedRoute, showBasemap, mapStyle, terrainMode, gisEffects, daylightPreview, showTerrain, trailSeconds, showPaths, showLabels, settingsOpen, notifications, report, start, end, duration, aircraftStates, selectedEvent, filteredEvents, loadDemo, reset, seek, selectEvent, applyImport, validate, exportReport, notify }
})
