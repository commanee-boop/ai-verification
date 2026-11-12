export type ValidationStatus = 'valid' | 'warning' | 'invalid' | 'unchecked'
export interface Provenance { source: string; timestamp: string; validationStatus: ValidationStatus }
export interface Aircraft extends Provenance { id: string; callsign: string; model: string; podInstalled: boolean; dataSource: string; color: string; telemetryMode: string; simulatorModel?: string }
export interface AircraftTelemetry extends Provenance { aircraftId: string; flightId: string; latitude: number; longitude: number; altitude: number; heading?: number; pitch?: number; roll?: number }
export interface ShotEvent extends Provenance { id: string; aircraftId: string; flightId: string; weaponProfile: string; description: string }
export interface AssessmentRecord extends Provenance { id: string; eventId: string; result: 'HIT' | 'MISS' | 'UNVERIFIED'; modelVersion?: string; evidenceReference?: string; certificationReference?: string }
export interface FlightMission { id: string; name: string; simulated: boolean; source: string; timestamp: string; validationStatus: ValidationStatus; aircraft: Aircraft[]; telemetry: AircraftTelemetry[]; events: ShotEvent[]; assessments: AssessmentRecord[] }
export interface QualityMetric { label: string; value: string; status: ValidationStatus; detail: string }
export interface DataQualityReport { timestamp: string; source: string; validationStatus: ValidationStatus; completeness: number; missingSamples: number; invalidCoordinates: number; maxOffsetSeconds: number; metrics: QualityMetric[]; insights: AIInsight[] }
export interface AIInsight { id: string; severity: 'INFO' | 'WARNING' | 'ERROR'; title: string; reason: string; evidence: string }
export type ImportKind = 'telemetry' | 'events' | 'gps'
export interface ImportPreview { filename: string; aircraftId: string; kind: ImportKind; telemetry: AircraftTelemetry[]; events: ShotEvent[]; errors: string[] }
