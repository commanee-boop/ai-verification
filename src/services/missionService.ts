import type { FlightMission, DataQualityReport } from '../types'
import { createDemo } from '../data/demo'
export interface MissionService { loadDemo(): Promise<FlightMission>; saveReport?(missionId: string, report: DataQualityReport): Promise<void> }
export const mockMissionService: MissionService = { async loadDemo() { return createDemo() } }
// Reserved REST adapter: no backend is deployed or connected in this prototype.
export function createRestMissionService(baseUrl: string): MissionService {
  return { async loadDemo() { const response = await fetch(`${baseUrl}/missions/demo`); if (!response.ok) throw new Error(`Mission service: HTTP ${response.status}`); return response.json() as Promise<FlightMission> }, async saveReport(id, report) { const response = await fetch(`${baseUrl}/missions/${encodeURIComponent(id)}/quality-reports`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report) }); if (!response.ok) throw new Error(`Report service: HTTP ${response.status}`) } }
}
