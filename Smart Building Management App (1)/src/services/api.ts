// src/services/api.ts
// URLs for different backend services
const SPRING_URL = import.meta.env.VITE_SPRING_URL || 'http://localhost:8084';
const ALERT_SERVICE_URL = import.meta.env.VITE_ALERT_SERVICE_URL || 'http://localhost:8085';
const ENERGY_ROOMS_URL = 'http://localhost:8080/api/energy/rooms';

// ─── Helpers HTTP ─────────────────────────────────────────────────────────────

async function get<T>(path: string, baseUrl: string = SPRING_URL): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`);
  if (!res.ok) {
    let errorMsg = `API error ${res.status} on ${path}`;
    try {
      const errorData = await res.json();
      if (errorData.error) {
        errorMsg = `${errorData.error}: ${errorData.path || path}`;
      }
    } catch {
      // Ignore JSON parse errors in error response
    }
    throw new Error(errorMsg);
  }
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown, baseUrl: string = SPRING_URL): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status} on ${path}`);
  return res.json() as Promise<T>;
}

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

export type SensorReading = SensorMeasurement; // Same shape for realtime

export type TelemetryPoint = {
  timestamp: string;
  value: number | null;
};

export type SensorHistoryDto = {
  sensorId: string;
  sensorType: string;
  label: string;
  unit: string;
  ifcGlobalId: string;
  roomName: string;
  points: TelemetryPoint[];
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

// Alias pour compatibilité avec l'API existante
export type WaveonSessionInfo = WaveonSession;

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

export type ConsumptionByUsageDto = {
  cvcKwh: number;
  lightingKwh: number;
  equipmentKwh: number;
  otherKwh: number;
};

// ─── Alert Types ────────────────────────────────────────────────────────────────

export type AlertSeverity = 'CRITICAL' | 'MAJOR' | 'MINOR';
export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';

export type AlertDto = {
  id: number;
  equipmentId: string;
  metricType: string;
  value: number;
  severity: AlertSeverity;
  status: AlertStatus;
  message: string;
  triggeredAt: string;
  resolvedAt: string | null;
};

// ─── Alert API Functions ────────────────────────────────────────────────────────────

export const getAllAlerts = (): Promise<AlertDto[]> =>
  get('/api/alerts', ALERT_SERVICE_URL);

export const acknowledgeAlert = (id: number): Promise<AlertDto> =>
  fetch(`${ALERT_SERVICE_URL}/api/alerts/${id}/acknowledge`, { method: 'PUT' }).then(r => {
    if (!r.ok) throw new Error(`API error ${r.status}`);
    return r.json() as Promise<AlertDto>;
  });

export const resolveAlert = (id: number): Promise<AlertDto> =>
  fetch(`${ALERT_SERVICE_URL}/api/alerts/${id}/resolve`, { method: 'PUT' }).then(r => {
    if (!r.ok) throw new Error(`API error ${r.status}`);
    return r.json() as Promise<AlertDto>;
  });

// ─── API Functions ────────────────────────────────────────────────────────────

export const getEnergyComparison = (): Promise<EnergyComparisonDto> =>
  get('/api/measurements/energy-comparison');

export const getEnergyConsumptionByRoom = (): Promise<RoomEnergyConsumptionDto[]> =>
  get('/api/measurements/energy-by-room');

export const getActiveRoomsCount = (): Promise<number> =>
  get('/api/measurements/active-rooms-count');

export const getActiveSensorsCount = (): Promise<number> =>
  get('/api/measurements/active-sensors-count');

export const getReservationRooms = (): Promise<ReservationRoomDto[]> =>
  get('/api/reservations/rooms');

export const getAllRecentMeasurements = (): Promise<SensorMeasurement[]> =>
  get('/api/measurements/recent');

export const getAllRealtimeData = (): Promise<SensorMeasurement[]> =>
  get('/api/measurements/recent');

export const getSensorHistory = (sensorId: string, hours: number, points: number): Promise<SensorHistoryDto[]> => {
  const params = new URLSearchParams({ sensorId, hours: hours.toString(), points: points.toString() });
  return fetch(`${SPRING_URL}/api/history?${params}`).then(r => {
    if (!r.ok) throw new Error(`API error ${r.status}`);
    return r.json() as Promise<SensorHistoryDto[]>;
  });
};

export const getSpaces = (): Promise<SpaceSensorDto[]> =>
  get('/api/spaces');

export const getWaveonSession = (): Promise<WaveonSession> =>
  get('/waveon/test-session');

export const getEnergyRooms = async (): Promise<EnergyRoomApiDto[]> => {
  const res = await fetch(ENERGY_ROOMS_URL);
  if (!res.ok) throw new Error(`API error ${res.status} on ${ENERGY_ROOMS_URL}`);
  return res.json() as Promise<EnergyRoomApiDto[]>;
};

export const createReservation = (request: ReservationRequest): Promise<ReservationDto> =>
  post('/api/reservations', request);

export const getConsumptionByUsage = (): Promise<ConsumptionByUsageDto> =>
  get('/api/measurements/consumption-by-usage');