import type { AircraftTelemetry, FlightMission } from '../types'
export const demoStart = Date.parse('2026-01-15T03:00:00Z')
export function createDemo(): FlightMission {
  const telemetry: AircraftTelemetry[] = []
  for (let i = 0; i <= 120; i++) {
    for (const id of ['A', 'B']) {
      if (id === 'B' && i >= 47 && i <= 54) continue
      const b = id === 'B', angle = i / 120 * Math.PI * 1.8
      telemetry.push({ aircraftId: id, flightId: 'SIM-026', timestamp: new Date(demoStart + i * 5000 + (b ? 2000 : 0)).toISOString(), latitude: 15.12 + Math.sin(angle) * 0.09 + (b ? 0.025 : 0), longitude: 100.08 + Math.cos(angle) * 0.15 + (b ? 0.025 : 0), altitude: 4200 + Math.sin(angle * 1.4) * 850 + (b ? -550 : 0), ...(b ? {} : { heading: (360 - angle * 180 / Math.PI) % 360, pitch: Math.cos(angle * 1.4) * 7, roll: Math.sin(angle) * 24 }), source: b ? 'SIMULATED GPS recorder' : 'SIMULATED DCS telemetry', validationStatus: 'valid' })
    }
  }
  return {
    id: 'SIM-026', name: 'Operation Blue Horizon', simulated: true, source: 'Local synthetic demo', timestamp: new Date(demoStart).toISOString(), validationStatus: 'warning',
    aircraft: [
      { id: 'A', callsign: 'VIPER 01', model: 'F-16A Block 15 OCU', podInstalled: true, dataSource: 'DCS World', color: '#38bdf8', telemetryMode: 'Full telemetry', simulatorModel: 'DCS F-16C (proxy)', source: 'Demo configuration', timestamp: new Date(demoStart).toISOString(), validationStatus: 'warning' },
      { id: 'B', callsign: 'VIPER 02', model: 'F-16B Block 15 OCU', podInstalled: false, dataSource: 'GPS + Shot Event', color: '#fb923c', telemetryMode: 'GPS + Shot Event', simulatorModel: 'DCS F-16C (proxy)', source: 'Demo configuration', timestamp: new Date(demoStart).toISOString(), validationStatus: 'warning' }
    ], telemetry,
    events: [75, 185, 330, 480].map((sec, i) => ({ id: `EVT-${String(i + 1).padStart(3, '0')}`, aircraftId: i % 2 ? 'B' : 'A', flightId: 'SIM-026', timestamp: new Date(demoStart + sec * 1000).toISOString(), source: 'SIMULATED shot event log', validationStatus: 'valid', weaponProfile: 'AIM-120 AMRAAM', description: 'Training shot recorded' })), assessments: []
  }
}
