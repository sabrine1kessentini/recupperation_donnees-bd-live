// src/services/api.ts
import { getToken } from '../utils/auth';

// URLs for different backend services
const SPRING_URL = import.meta.env.VITE_SPRING_URL || 'http://localhost:8084';
const ALERT_SERVICE_URL = import.meta.env.VITE_ALERT_SERVICE_URL || 'http://localhost:8085';
const ENERGY_ROOMS_URL = 'http://localhost:8080/api/energy/rooms';
const AUTH_URL = import.meta.env.VITE_AUTH_URL || 'http://localhost:8080';
const PRICING_API_URL = 'http://localhost:8085';

// ─── Helpers HTTP ─────────────────────────────────────────────────────────────

async function get<T>(path: string, baseUrl: string = SPRING_URL): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${baseUrl}${path}`, { headers });
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
  const token = getToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status} on ${path}`);
  return res.json() as Promise<T>;
}
export type PricingEstimateDto = {
  room_name: string;
  start_datetime: string;
  end_datetime: string;
  duration_hours: number;
  predicted_kwh: number;
  rental_cost_dt: number;
  energy_cost_dt: number;
  total_price_dt: number;
  available: boolean;
  conflicts: number;
};

export async function estimateReservationPrice(
  payload: {
    roomName: string;
    startDatetime: string;
    endDatetime: string;
  },
  signal?: AbortSignal
): Promise<PricingEstimateDto> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${PRICING_API_URL}/api/pricing/estimate`, {
    method: 'POST',
    headers,
    signal,
    body: JSON.stringify({
      room_name: payload.roomName,
      start_datetime: payload.startDatetime,
      end_datetime: payload.endDatetime,
    }),
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json();
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

export const acknowledgeAlert = async (id: number): Promise<AlertDto> => {
  const token = getToken();
  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${ALERT_SERVICE_URL}/api/alerts/${id}/acknowledge`, { method: 'PUT', headers });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json() as Promise<AlertDto>;
};

export const resolveAlert = async (id: number): Promise<AlertDto> => {
  const token = getToken();
  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${ALERT_SERVICE_URL}/api/alerts/${id}/resolve`, { method: 'PUT', headers });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json() as Promise<AlertDto>;
};

// ─── Comfort Agent Types & API ───────────────────────────────────────────────

const COMFORT_AGENT_URL = import.meta.env.VITE_COMFORT_AGENT_URL || 'http://localhost:8001';

export type ComfortAlertLevel = 'critical' | 'warning' | 'info';

export type ComfortAlertItem = {
  room: string;
  level: ComfortAlertLevel;
  type: string;
  message: string;
  action: string;
};

export type ComfortAlertsResponse = {
  timestamp: string;
  total: number;
  critical: ComfortAlertItem[];
  warnings: ComfortAlertItem[];
  infos: ComfortAlertItem[];
};

export const getComfortAlerts = (): Promise<ComfortAlertsResponse> =>
  get('/api/comfort/alerts', COMFORT_AGENT_URL);

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
  const token = getToken();
  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const params = new URLSearchParams({ sensorId, hours: hours.toString(), points: points.toString() });
  return fetch(`${SPRING_URL}/api/history?${params}`, { headers }).then(r => {
    if (!r.ok) throw new Error(`API error ${r.status}`);
    return r.json() as Promise<SensorHistoryDto[]>;
  });
};

export const getSpaces = (): Promise<SpaceSensorDto[]> =>
  get('/api/spaces');

export const getWaveonSession = (): Promise<WaveonSession> =>
  get('/waveon/test-session');

export const getEnergyRooms = async (): Promise<EnergyRoomApiDto[]> => {
  const token = getToken();
  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(ENERGY_ROOMS_URL, { headers });
  if (!res.ok) throw new Error(`API error ${res.status} on ${ENERGY_ROOMS_URL}`);
  return res.json() as Promise<EnergyRoomApiDto[]>;
};

export const createReservation = (request: ReservationRequest): Promise<ReservationDto> =>
  post('/api/reservations', request);

export const getConsumptionByUsage = (): Promise<ConsumptionByUsageDto> =>
  get('/api/measurements/consumption-by-usage');

// ─── Comfort Agent API (port 8001) ────────────────────────────────────────────

const COMFORT_API_URL = 'http://localhost:8001';

export type ComfortDimensions = {
  temperature?: number;
  humidity?: number;
  co2?: number;
  luminosity?: number;
};

export type ComfortScore = {
  overall: number | null;
  dimensions: ComfortDimensions;
  label: string;
};

export type ComfortAlert = {
  room?: string;
  level: 'critical' | 'warning' | 'info';
  type: string;
  message: string;
  action: string;
};

export type RoomComfortState = {
  room: string;
  timestamp: string;
  sensors: {
    temperature: number | null;
    humidity: number | null;
    co2: number | null;
    luminosity: number | null;
    occupancy: number | null;
  };
  comfort: ComfortScore;
  alerts: ComfortAlert[];
  reservation: {
    is_reserved: boolean;
    is_preheating: boolean;
    mins_to_next: number | null;
  };
  hvac: {
    occupied: boolean;
    is_preheating: boolean;
    decision_source: string;
    confidence?: number;
    model_used?: string;
    hvac: { mode: string; is_on: boolean; power_kw: number };
    ventilation: { is_on: boolean; boost: boolean; rate: string; power_kw: number };
    lighting: { is_on: boolean; power_kw: number };
    projector: { is_on: boolean; power_kw: number };
    total_kw: number;
    explanation: string;
  };
  profile: { type: string; capacity: number; priority: string };
  error?: string;
};

export type AllComfortState = {
  timestamp: string;
  summary: {
    total_rooms: number;
    occupied_rooms: number;
    avg_comfort_score: number | null;
    critical_alerts: number;
    warning_alerts: number;
  };
  rooms: RoomComfortState[];
};

export async function getAllComfort(): Promise<AllComfortState> {
  const res = await fetch(`${COMFORT_API_URL}/api/comfort/all`);
  if (!res.ok) throw new Error(`Comfort API error ${res.status}`);
  return res.json() as Promise<AllComfortState>;
}

export async function getRoomComfortState(room: string): Promise<RoomComfortState> {
  const res = await fetch(`${COMFORT_API_URL}/api/comfort/state/${room}`);
  if (!res.ok) throw new Error(`Comfort API error ${res.status}`);
  return res.json() as Promise<RoomComfortState>;
}

export type ChatMessage = {
  role: 'user' | 'agent';
  text: string;
  timestamp: Date;
};

export async function chatWithAgent(question: string, room?: string): Promise<{ answer: string; llm_available: boolean }> {
  const res = await fetch(`${COMFORT_API_URL}/api/comfort/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, room: room ?? null }),
  });
  if (!res.ok) throw new Error(`Chat API error ${res.status}`);
  return res.json() as Promise<{ answer: string; llm_available: boolean }>;
}

// ─── Auth API ───────────────────────────────────────────────────────────────────

export interface LoginResponse {
  token: string;
  roles?: string[];
}

export const login = async (email: string, password: string): Promise<LoginResponse> => {
  const res = await fetch(`${AUTH_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: email, password }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Login failed');
  }
  const data = await res.json();
  const token = data.token || data.accessToken || data.access_token;
  if (!token) {
    throw new Error('No token received from server');
  }
  return { token, roles: data.roles };
};