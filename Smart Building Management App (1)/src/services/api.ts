// src/services/api.ts
// URL du backend Spring Boot
const SPRING_URL = import.meta.env.VITE_SPRING_URL || 'http://localhost:8084';
const ENERGY_ROOMS_URL = 'http://localhost:8080/api/energy/rooms';
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

export type ReservationDto = {
  id: number;
  ifcGlobalId: string;
  roomName: string;
  roomLongName: string | null;
  storey: string | null;
  location: string | null;
  date: string;
  startTime: string;
  endTime: string;
  reservedSlot: string;
  reservedBy: string | null;
  email: string | null;
  phone: string | null;
};

export type ReservationRoomDto = {
  ifcGlobalId: string;
  name: string;
  longName: string | null;
  storey: string | null;
  location: string | null;
  areaM2: number | null;
  status: 'available' | 'reserved';
  reservedSlot: string | null;
  currentReservation: ReservationDto | null;
  reservations: ReservationDto[];
};

export type EnergyComparisonDto = {
  currentTotalKwh: number;
  previousTotalKwh: number;
  percentageChange: number;
  currentTotalRaw: number;
  previousTotalRaw: number;
  currentPeakValue: number;
  previousPeakValue: number;
  peakPercentageChange: number;
};

export type RoomEnergyConsumptionDto = {
  roomName: string;
  totalKwh: number;
};

export type EnergyRoomApiDto = {
  roomName: string;
  value: number;
};

export type ReservationRequest = {
  ifcGlobalId: string;
  firstName: string;
  lastName: string;
  country: string;
  phone: string;
  email: string;
  date: string;
  startTime: string;
  endTime: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${SPRING_URL}${path}`);
  if (!res.ok) throw new Error(`API error ${res.status} on ${path}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${SPRING_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const details = await res.json().catch(() => null);
    throw new Error(details?.message || `API error ${res.status} on ${path}`);
  }
  return res.json() as Promise<T>;
}

// ─── Endpoints ────────────────────────────────────────────────────────────────

/** Teste la session WaveOn (token, mode, etc.) */
export const getWaveonSession = (): Promise<WaveonSession> =>
  get('/api/waveon/test-session');

/** Données temps réel pour un capteur donné */
export const getRealtimeData = (sensorId: string): Promise<SensorMeasurement[]> =>
  get(`/api/realtime?sensorId=${encodeURIComponent(sensorId)}`);

export const getAllRealtimeData = (): Promise<SensorMeasurement[]> =>
  get('/api/realtime');

export const getSensorHistory = (
  sensorId: string,
  hours = 24,
  points = 24
): Promise<SensorHistorySeries[]> =>
  get(`/api/history?sensorId=${encodeURIComponent(sensorId)}&hours=${hours}&points=${points}`);

/** Hiérarchie complète du bâtiment (sites → buildings → floors → zones) */
export const getBuildingHierarchy = (): Promise<SiteHierarchyDto[]> =>
  get('/api/buildings/hierarchy');

/** Toutes les mesures récentes (tous capteurs) */
export const getAllRecentMeasurements = (): Promise<SensorMeasurement[]> =>
  get('/api/measurements/recent');

/** Résumé des capteurs par zone */
export const getSensorsByZone = (zoneId: number): Promise<SensorMeasurement[]> =>
  get(`/api/zones/${zoneId}/sensors`);

/** Espaces/salles issus du mapping WaveOn + IFC */
export const getSpaces = (): Promise<SpaceSensorDto[]> =>
  get('/api/spaces');

export const getReservationRooms = (): Promise<ReservationRoomDto[]> =>
  get('/api/reservations/rooms');

export const getEnergyComparison = (): Promise<EnergyComparisonDto> =>
  get('/api/measurements/energy-comparison');

export const getEnergyConsumptionByRoom = (): Promise<RoomEnergyConsumptionDto[]> =>
  get('/api/measurements/energy-by-room');

export const getEnergyRooms = async (): Promise<EnergyRoomApiDto[]> => {
  const res = await fetch(ENERGY_ROOMS_URL);
  if (!res.ok) throw new Error(`API error ${res.status} on ${ENERGY_ROOMS_URL}`);
  return res.json() as Promise<EnergyRoomApiDto[]>;
};

export const createReservation = (request: ReservationRequest): Promise<ReservationDto> =>
  post('/api/reservations', request);
