// src/services/api.ts
// URL du backend Spring Boot
const SPRING_URL = import.meta.env.VITE_SPRING_URL || 'http://localhost:8084';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SensorMeasurement = {
  sensorId: string;
  sensorType: string;
  label: string;
  timestamp: string;
  value: number;
  unit: string;
  status: string;
  ifcGlobalId: string;
  roomName: string;
};

export type TelemetryPoint = {
  timestamp: string;
  value: number | null;
};

export type SensorHistorySeries = {
  sensorId: string;
  sensorType: string;
  label: string;
  unit: string;
  ifcGlobalId: string;
  roomName: string;
  points: TelemetryPoint[];
};

export type WaveonSession = {
  status: string;
  idclient: number;
  iduser: number;
  token: string;
  mode: string;
};

export type ZoneDto = {
  id: number;
  name: string;
  type: string;
};

export type FloorDto = {
  id: number;
  name: string;
  levelIndex: number;
  zones: ZoneDto[];
};

export type BuildingDto = {
  id: number;
  name: string;
  code: string;
  floors: FloorDto[];
};

export type SiteHierarchyDto = {
  id: number;
  name: string;
  location: string;
  buildings: BuildingDto[];
};

export type SensorSummaryDto = {
  id: string;
  type: string;
  label: string;
  networkId: number | null;
  unicastAddress: number | null;
};

export type SpaceSensorDto = {
  zoneId: number | null;
  ifcGlobalId: string;
  ifcName: string;
  ifcLongName: string | null;
  storey: string | null;
  areaM2: number | null;
  mapped: boolean;
  networkId: number | null;
  sensors: SensorSummaryDto[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${SPRING_URL}${path}`);
  if (!res.ok) throw new Error(`API error ${res.status} on ${path}`);
  return res.json() as Promise<T>;
}

// ─── Endpoints ────────────────────────────────────────────────────────────────

/** Teste la session WaveOn (token, mode, etc.) */
export const getWaveonSession = (): Promise<WaveonSession> =>
  get('/api/waveon/test-session');

/** Données temps réel pour un capteur donné */
export const getRealtimeData = (sensorId: string): Promise<SensorMeasurement[]> =>
  get(`/api/realtime?sensorId=${encodeURIComponent(sensorId)}`);

/** Historique d'un capteur sur une fenetre glissante */
export const getSensorHistory = (
  sensorId: string,
  hours = 24,
  points = 24
): Promise<SensorHistorySeries[]> =>
  get(`/api/history?sensorId=${encodeURIComponent(sensorId)}&hours=${hours}&points=${points}`);

/** Hiérarchie complète du bâtiment (sites → buildings → floors → zones) */
export const getBuildingHierarchy = (): Promise<SiteHierarchyDto[]> =>
  get('/api/building/hierarchy');

/** Toutes les mesures récentes (tous capteurs) */
export const getAllRecentMeasurements = (): Promise<SensorMeasurement[]> =>
  get('/api/measurements/recent');

/** Résumé des capteurs par zone */
export const getSensorsByZone = (zoneId: number): Promise<SensorMeasurement[]> =>
  get(`/api/zones/${zoneId}/sensors`);

/** Espaces/salles issus du mapping WaveOn + IFC */
export const getSpaces = (): Promise<SpaceSensorDto[]> =>
  get('/api/spaces');
