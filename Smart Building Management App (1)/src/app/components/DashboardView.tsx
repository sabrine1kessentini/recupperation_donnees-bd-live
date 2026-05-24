import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowDown, ArrowUp, Bell, Blinds, CalendarClock,
  Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, Droplets,
  Lightbulb, Lock, Snowflake, Square, Sun, Thermometer, Wind, Zap, RefreshCw
} from 'lucide-react';
import { getWaveonSession, getAllRecentMeasurements, getReservationRooms, getEnergyComparison, getAllAlerts, type SensorMeasurement, type WaveonSession, type ReservationDto, type ReservationRoomDto, type EnergyComparisonDto, type AlertDto } from '../../services/api';

type WeatherData = {
  temperature: number;
  humidity: number;
  weatherCode: number;
  windSpeed: number;
  locationLabel: string;
  observedAt: string;
};

type DashboardViewProps = {
  onOpenRoom?: (roomName: string) => void;
};

export function DashboardView({ onOpenRoom }: DashboardViewProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState(true);

  // Données Spring Boot
  const [session, setSession] = useState<WaveonSession | null>(null);
  const [measurements, setMeasurements] = useState<SensorMeasurement[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const [weeklyReservations, setWeeklyReservations] = useState<ReservationDto[]>([]);
  const [isReservationsLoading, setIsReservationsLoading] = useState(true);
  const [reservationsError, setReservationsError] = useState<string | null>(null);

  const [energyComparison, setEnergyComparison] = useState<EnergyComparisonDto | null>(null);
  const [isEnergyLoading, setIsEnergyLoading] = useState(true);
  const [energyError, setEnergyError] = useState<string | null>(null);

  const [weeklyAlerts, setWeeklyAlerts] = useState<AlertDto[]>([]);
  const [isAlertsLoading, setIsAlertsLoading] = useState(true);
  const [alertsError, setAlertsError] = useState<string | null>(null);

  const [reservationHistory, setReservationHistory] = useState<ReservationDto[]>([]);

  type ReservationNotification = {
    id: string;
    roomName: string;
    date: string;
    startTime: string;
    endTime: string;
    reservedBy: string | null;
    email: string | null;
    phone: string | null;
    createdAt: string;
    read: boolean;
  };

  const [reservationNotifications, setReservationNotifications] = useState<ReservationNotification[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationsButtonRef = useRef<HTMLButtonElement | null>(null);
  const notificationsPanelRef = useRef<HTMLDivElement | null>(null);
  const RESERVATION_NOTIFICATION_STORAGE_KEY = 'directionReservationNotifications';

  const unreadNotifications = reservationNotifications.filter((notification) => !notification.read);

  const loadReservationNotifications = () => {
    try {
      const saved = localStorage.getItem(RESERVATION_NOTIFICATION_STORAGE_KEY);
      if (!saved) {
        setReservationNotifications([]);
        return;
      }
      const parsed = JSON.parse(saved) as Array<Partial<ReservationNotification>>;
      const normalized = parsed.map((item) => ({
        id: item.id || `notif-${Date.now()}`,
        roomName: item.roomName || 'Salle inconnue',
        date: item.date || '',
        startTime: item.startTime || '',
        endTime: item.endTime || '',
        reservedBy: item.reservedBy ?? null,
        email: item.email ?? null,
        phone: item.phone ?? null,
        createdAt: item.createdAt || new Date().toISOString(),
        read: item.read ?? false,
      }));
      setReservationNotifications(normalized);
    } catch {
      setReservationNotifications([]);
    }
  };

// Fetch météo (Node.js backend)
   useEffect(() => {
     let isMounted = true;
     let controller: AbortController | null = null;

     const fetchWeather = async () => {
       try {
         setIsWeatherLoading(true);
         setWeatherError(null);
         controller?.abort();
         controller = new AbortController();
         const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
         const response = await fetch(`${API_URL}/api/weather`, { signal: controller.signal });
         if (!response.ok) throw new Error(`Weather API returned ${response.status}`);
         const payload: WeatherData = await response.json();
         if (isMounted) setWeather(payload);
       } catch (error) {
         if (error instanceof DOMException && error.name === 'AbortError') return;
         if (isMounted) setWeatherError('Meteo indisponible');
       } finally {
         if (isMounted) setIsWeatherLoading(false);
       }
     };

     fetchWeather();
     const intervalId = window.setInterval(fetchWeather, 5 * 60 * 1000);
     return () => { isMounted = false; window.clearInterval(intervalId); controller?.abort(); };
   }, []);

// Fetch données capteurs Spring Boot
   const fetchSensorData = async () => {
     setIsDataLoading(true);
     setDataError(null);
     try {
       const [sessionData, measureData] = await Promise.all([
         getWaveonSession(),
         getAllRecentMeasurements(),
       ]);
       setSession(sessionData);
       setMeasurements(measureData);
       setLastRefresh(new Date());
     } catch (err) {
     } finally {
       setIsDataLoading(false);
     }
   };

   useEffect(() => {
     fetchSensorData();
     const id = window.setInterval(fetchSensorData, 5000);
     return () => window.clearInterval(id);
   }, []);

  useEffect(() => {
    loadReservationNotifications();

    const handleNotificationEvent = () => loadReservationNotifications();
    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key === RESERVATION_NOTIFICATION_STORAGE_KEY) {
        loadReservationNotifications();
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (
        isNotificationsOpen &&
        notificationsPanelRef.current &&
        !notificationsPanelRef.current.contains(event.target as Node) &&
        notificationsButtonRef.current &&
        !notificationsButtonRef.current.contains(event.target as Node)
      ) {
        setIsNotificationsOpen(false);
      }
    };

    window.addEventListener('directionReservationNotification', handleNotificationEvent);
    window.addEventListener('storage', handleStorageEvent);
    window.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('directionReservationNotification', handleNotificationEvent);
      window.removeEventListener('storage', handleStorageEvent);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNotificationsOpen]);

  const getWeekRange = () => {
    const now = new Date();
    const mondayOffset = (now.getDay() + 6) % 7;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - mondayOffset);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    weekEnd.setHours(0, 0, 0, 0);
    return { weekStart, weekEnd };
  };

  const loadWeeklyReservations = async () => {
    setIsReservationsLoading(true);
    setReservationsError(null);
    try {
      const rooms = await getReservationRooms();
      const now = new Date();
      const { weekStart, weekEnd } = getWeekRange();
      const reservations: ReservationDto[] = [];
      const seenReservationIds = new Set<number>();

      const allReservations: ReservationDto[] = [];

      rooms.forEach((room) => {
        if (room.currentReservation) {
          const id = room.currentReservation.id;
          if (!seenReservationIds.has(id)) {
            reservations.push(room.currentReservation);
            seenReservationIds.add(id);
          }
          allReservations.push(room.currentReservation);
        }
        if (room.reservations && room.reservations.length > 0) {
          room.reservations.forEach((reservation) => {
            allReservations.push(reservation);
            if (!seenReservationIds.has(reservation.id)) {
              reservations.push(reservation);
              seenReservationIds.add(reservation.id);
            }
          });
        }
      });

      const filtered = reservations
        .filter((reservation) => {
          const startDate = new Date(`${reservation.date}T${reservation.startTime}`);
          const endDate = new Date(`${reservation.date}T${reservation.endTime}`);
          return startDate >= weekStart && startDate < weekEnd && endDate > now;
        })
        .sort((a, b) => {
          const startA = new Date(`${a.date}T${a.startTime}`);
          const startB = new Date(`${b.date}T${b.startTime}`);
          return startA.getTime() - startB.getTime();
        });

      setWeeklyReservations(filtered);
      const history = allReservations
        .sort((a, b) => {
          const dateA = new Date(`${a.date}T${a.startTime}`);
          const dateB = new Date(`${b.date}T${b.startTime}`);
          return dateA.getTime() - dateB.getTime();
        });
      setReservationHistory(history);
    } catch (err) {
      setReservationsError('Impossible de charger les réservations de la semaine.');
      setWeeklyReservations([]);
      setReservationHistory([]);
    } finally {
      setIsReservationsLoading(false);
    }
  };

  useEffect(() => {
    loadWeeklyReservations();
    const reservationInterval = window.setInterval(loadWeeklyReservations, 30000);
    return () => window.clearInterval(reservationInterval);
  }, []);

  const loadWeeklyEnergy = async () => {
    setIsEnergyLoading(true);
    setEnergyError(null);
    try {
      const energyData = await getEnergyComparison();
      setEnergyComparison(energyData);
    } catch (err) {
      setEnergyError('Impossible de charger l\'énergie de la semaine.');
      setEnergyComparison(null);
    } finally {
      setIsEnergyLoading(false);
    }
  };

  useEffect(() => {
    loadWeeklyEnergy();
    const energyInterval = window.setInterval(loadWeeklyEnergy, 30000);
    return () => window.clearInterval(energyInterval);
  }, []);

  const loadWeeklyAlerts = async () => {
    setIsAlertsLoading(true);
    setAlertsError(null);
    try {
      const alerts = await getAllAlerts();
      const { weekStart, weekEnd } = getWeekRange();
      
      const filtered = alerts.filter((alert) => {
        const triggeredDate = new Date(alert.triggeredAt);
        return triggeredDate >= weekStart && triggeredDate < weekEnd;
      });
      
      setWeeklyAlerts(filtered);
    } catch (err) {
      setAlertsError('Impossible de charger les alertes de la semaine.');
      setWeeklyAlerts([]);
    } finally {
      setIsAlertsLoading(false);
    }
  };

  useEffect(() => {
    loadWeeklyAlerts();
    const alertsInterval = window.setInterval(loadWeeklyAlerts, 30000);
    return () => window.clearInterval(alertsInterval);
  }, []);

  // Stats calculées depuis les vraies mesures
  const tempMeasurements = measurements.filter(m => m.sensorType === 'temperature');
  const humMeasurements = measurements.filter(m => m.sensorType === 'humidity');

  const avgTemp = tempMeasurements.length > 0
    ? (tempMeasurements.reduce((s, m) => s + m.value, 0) / tempMeasurements.length).toFixed(1)
    : '--';
  const avgHum = humMeasurements.length > 0
    ? Math.round(humMeasurements.reduce((s, m) => s + m.value, 0) / humMeasurements.length)
    : '--';
  const totalEnergy = energyComparison ? (energyComparison.currentTotalKwh / 1000).toFixed(0) : '--';

  // Météo icons

  const displayedDate = useMemo(() => {
    const d = weather?.observedAt ? new Date(weather.observedAt) : new Date();
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(d);
  }, [weather?.observedAt]);

  const displayedTime = useMemo(() => {
    const d = weather?.observedAt ? new Date(weather.observedAt) : new Date();
    return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  }, [weather?.observedAt]);

  const temperatureLabel = isWeatherLoading ? '-- C' : weather ? `${Math.round(weather.temperature)} C` : '-- C';
  const humidityLabel = isWeatherLoading ? '--%' : weather ? `${Math.round(weather.humidity)}%` : '--%';

  return (
    <div className="min-h-full p-5 bg-[radial-gradient(circle_at_0%_0%,#f6f7f8_0,#e9ecef_45%,#e2e8ec_100%)]">
      <header className="flex items-center justify-between rounded-3xl bg-[#d6d1cb]/65 px-6 py-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-700">Smart Building Dashboard</h1>
          {session && (
            <p className="text-xs text-zinc-500 mt-0.5">
              Session WaveOn — Mode: {session.mode} · Client #{session.idclient}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="w-72 rounded-full bg-white/70 px-4 py-2 text-sm text-zinc-500">
            Search any devices here
          </div>
          <button
            onClick={fetchSensorData}
            className="rounded-full bg-white/80 p-2 text-zinc-500 hover:text-zinc-700"
            title="Rafraîchir les données"
          >
            <RefreshCw className={`w-4 h-4 ${isDataLoading ? 'animate-spin' : ''}`} />
          </button>
          <button className="rounded-full bg-white/80 p-2 text-[#f4b400]">
            <Sun className="w-4 h-4" />
          </button>
          <div className="relative">
            <button
              ref={notificationsButtonRef}
              onClick={() => setIsNotificationsOpen((open) => !open)}
              className="relative rounded-full bg-white/80 p-2 text-zinc-500 hover:text-zinc-700"
              title="Notifications"
              type="button"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifications.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[1rem] h-4 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center px-1">
                  {unreadNotifications.length}
                </span>
              )}
            </button>

            {isNotificationsOpen && (
              <div
                ref={notificationsPanelRef}
                className="absolute right-0 z-50 mt-2 w-[360px] rounded-3xl border border-slate-200 bg-white p-4 shadow-xl"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">Notifications de réservation</p>
                    <p className="text-xs text-zinc-500">Toutes les réservations récentes</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsNotificationsOpen(false)}
                    className="text-xs text-zinc-500 hover:text-zinc-700"
                  >
                    Fermer
                  </button>
                </div>

                {reservationNotifications.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">Aucune notification de réservation pour le moment.</div>
                ) : (
                  <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
                    <div className="space-y-2">
                      <p className="text-xs text-slate-500 uppercase tracking-[0.18em]">Notifications</p>
                      {reservationNotifications.map((notification) => (
                        <div key={notification.id} className={`rounded-2xl border border-slate-200 p-3 ${notification.read ? 'bg-slate-50' : 'bg-white'}`}>
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-zinc-900">{notification.roomName}</p>
                            {notification.read ? (
                              <span className="rounded-full bg-slate-200 px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-slate-600">Lu</span>
                            ) : (
                              <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-amber-700">Non lu</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">{notification.date} · {notification.startTime.substring(0, 5)} - {notification.endTime.substring(0, 5)}</p>
                          {notification.reservedBy && <p className="text-xs text-slate-500">Par {notification.reservedBy}</p>}
                          {notification.email && <p className="text-xs text-slate-500">Email: {notification.email}</p>}
                          {notification.phone && <p className="text-xs text-slate-500">Téléphone: {notification.phone}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-4 border-t border-slate-200 pt-3">
                  <p className="text-xs text-slate-500 uppercase tracking-[0.18em]">Historique des réservations</p>
                  {reservationHistory.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-600">Aucun historique disponible</p>
                  ) : (
                    <div className="mt-2 space-y-2 max-h-[200px] overflow-y-auto pr-1">
                      {reservationHistory.map((reservation) => (
                        <div key={`${reservation.id}-${reservation.date}-${reservation.startTime}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <p className="text-sm font-semibold text-zinc-900">{reservation.roomName}</p>
                          <p className="text-xs text-slate-500">{reservation.date} · {reservation.startTime.substring(0, 5)} - {reservation.endTime.substring(0, 5)}</p>
                          {reservation.email && <p className="text-xs text-slate-500">Email: {reservation.email}</p>}
                          {reservation.phone && <p className="text-xs text-slate-500">Téléphone: {reservation.phone}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Erreur Spring Boot */}
      {dataError && !isDataLoading && measurements.length === 0 && !session && (
        <div className="mb-4 p-3 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {dataError} — Vérifiez que <code className="bg-red-100 px-1 rounded">mvn spring-boot:run</code> tourne sur le port 8084.
        </div>
      )}

      <section className="grid grid-cols-12 gap-4">
        <article className="col-span-4 rounded-3xl bg-white/75 p-5">
          <div className="flex items-center gap-2 text-zinc-700 mb-3">
            <Zap className="w-4 h-4 text-amber-500" />
            <h3 className="font-semibold">Énergie totale (semaine)</h3>
          </div>
          <p className="text-4xl font-bold text-zinc-800">
            {isEnergyLoading ? '...' : `${totalEnergy} MWh`}
          </p>
          {energyComparison && (
            <>
              <p className="text-xs text-zinc-500 mt-1">{(energyComparison.currentTotalRaw / 1000000).toFixed(1)} GJ consommés</p>
              <div className="mt-3 flex items-center gap-2">
                {energyComparison.percentageChange >= 0 ? (
                  <>
                    <ArrowUp className="w-3 h-3 text-red-500" />
                    <span className="text-xs text-red-600">+{energyComparison.percentageChange.toFixed(1)}% vs semaine passée</span>
                  </>
                ) : (
                  <>
                    <ArrowDown className="w-3 h-3 text-green-500" />
                    <span className="text-xs text-green-600">{energyComparison.percentageChange.toFixed(1)}% vs semaine passée</span>
                  </>
                )}
              </div>
            </>
          )}
          {energyError && <p className="text-xs text-red-600 mt-2">{energyError}</p>}
        </article>
        {/* KPIs capteurs réels */}
<article className="col-span-4 rounded-3xl bg-white/75 p-5">
  <div className="flex items-center gap-2 text-zinc-700 mb-3">
    <Thermometer className="w-4 h-4 text-orange-400" />
    <h3 className="font-semibold">Cout Energetique (semaine)</h3>
  </div>

  <p className="text-4xl font-bold text-zinc-800">
    {isEnergyLoading
      ? '...'
      : energyComparison
      ? `${(
          parseFloat(totalEnergy as string) * 0.18
        ).toFixed(0)} DT`
      : '--'}
  </p>

  {energyComparison && (
    <p className="text-xs text-zinc-500 mt-1">
      Basé sur {totalEnergy} kWh @ 0.18 DT/kWh
    </p>
  )}
</article>

        <article className="col-span-4 rounded-3xl bg-white/75 p-5">
          <div className="flex items-center gap-2 text-zinc-700 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <h3 className="font-semibold">Alertes capteurs (semaine)</h3>
          </div>
          <p className="text-4xl font-bold text-zinc-800">
            {isAlertsLoading ? '...' : weeklyAlerts.length}
          </p>
          <p className="text-xs text-zinc-500 mt-1">alertes detéctées</p>
          {weeklyAlerts.slice(0, 3).map(a => (
            <div key={a.id} className="mt-2 text-xs text-red-600 flex justify-between">
              <span>{a.metricType}</span>
              <span className="font-medium">{a.severity}</span>
            </div>
          ))}
          {alertsError && <p className="text-xs text-red-600 mt-2">{alertsError}</p>}
        </article>

        {unreadNotifications.length > 0 && (
          <article className="col-span-12 rounded-3xl bg-[#fff7d8]/90 p-5 border border-amber-200">
            <div className="flex items-center gap-2 text-zinc-700 mb-3">
              <Bell className="w-4 h-4 text-amber-500" />
              <h3 className="font-semibold">Notifications direction</h3>
            </div>
            <div className="space-y-3">
              {unreadNotifications.map((notification) => (
                <div key={notification.id} className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                  <p className="text-sm font-semibold text-zinc-800">Nouvelle réservation&nbsp;: {notification.roomName}</p>
                  <p className="text-xs text-slate-500">{notification.date} · {notification.startTime.substring(0, 5)} - {notification.endTime.substring(0, 5)}</p>
                  {notification.reservedBy && <p className="text-xs text-slate-500">Réservé par {notification.reservedBy}</p>}
                  {notification.email && <p className="text-xs text-slate-500">Email: {notification.email}</p>}
                  {notification.phone && <p className="text-xs text-slate-500">Téléphone: {notification.phone}</p>}
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  const updated = reservationNotifications.map((notification) => ({ ...notification, read: true }));
                  localStorage.setItem(RESERVATION_NOTIFICATION_STORAGE_KEY, JSON.stringify(updated));
                  setReservationNotifications(updated);
                }}
                className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
              >
                Marquer comme lu
              </button>
            </div>
          </article>
        )}

                {/* Réservations de la semaine */}
        <article className="col-span-5 rounded-3xl bg-white/75 p-5">
          <div className="flex items-center gap-3 text-zinc-700 mb-2">
            <CalendarClock className="w-5 h-5 text-[#f4b400]" />
            <h3 className="font-semibold">Les réservations de cette semaine</h3>
          </div>
          {reservationsError && (
            <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {reservationsError}
            </div>
          )}
          {isReservationsLoading ? (
            <div className="mt-4 rounded-2xl bg-[#efe7d4] px-4 py-3 text-center text-zinc-500">
              Chargement des réservations...
            </div>
          ) : weeklyReservations.length === 0 ? (
            <div className="mt-4 rounded-2xl bg-[#efe7d4] px-4 py-3 text-center text-zinc-600">
              Aucune réservation active cette semaine.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {weeklyReservations.slice(0, 4).map((reservation) => (
                <div key={`${reservation.id}-${reservation.date}-${reservation.startTime}`} className="rounded-2xl bg-[#f8f4e6] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-zinc-500">Salle</p>
                      <p className="font-semibold text-zinc-700">{reservation.roomName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Date</p>
                      <p className="font-semibold text-zinc-700">{new Date(`${reservation.date}T00:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Heure</p>
                      <p className="font-semibold text-zinc-700">{reservation.startTime.substring(0, 5)} - {reservation.endTime.substring(0, 5)}</p>
                    </div>
                  </div>
                  {reservation.reservedBy && (
                    <p className="mt-2 text-xs text-zinc-500">Réservé par {reservation.reservedBy}</p>
                  )}
                </div>
              ))}
              {weeklyReservations.length > 4 && (
                <div className="rounded-2xl bg-[#faf7ef] px-4 py-3 text-sm text-zinc-600">
                  + {weeklyReservations.length - 4} autres réservations cette semaine
                </div>
              )}
            </div>
          )}
        </article>
                <article className="col-span-5 rounded-3xl bg-white/75 p-5">
          <div className="flex items-center gap-3 text-zinc-700 mb-2">
            <CalendarClock className="w-5 h-5 text-[#f4b400]" />
            <h3 className="font-semibold">Résumé du jour</h3>
          </div>
        </article>
      </section>
    </div>
  );
}
