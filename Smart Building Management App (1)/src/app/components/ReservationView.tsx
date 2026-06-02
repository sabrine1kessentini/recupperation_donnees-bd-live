import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight, CalendarClock, CheckCircle2, ChevronDown,
  CircleAlert, Clock3, MapPin, Maximize2, Ruler, Users, X, Zap,
} from 'lucide-react';
import {
  createReservation, estimateReservationPrice, getReservationRooms,
  type PricingEstimateDto, type ReservationDto, type ReservationRoomDto,
} from '../../services/api';
import { RoomPreviewIFC } from './RoomPreviewIFC';

const ALLOWED_ROOMS = new Set([
  'B109', 'B152', 'B135', 'B119', 'B111', 'B123',
  'B125', 'B129', 'B148', 'B137', 'B113', 'B150', 'B139',
]);

const ROOM_DISPLAY_NAMES: Record<string, string> = {
  B125: 'CONFERENCE ROOM 1',
  B129: 'CONFERENCE ROOM 2',
  B150: 'MEETING ROOM 1',
  B152: 'MEETING ROOM 2',
  B111: 'CONFERENCE ROOM 5',
  B123: 'MEETING ROOM 3',
  B148: 'CONFERENCE ROOM 6',
  B119: 'MEETING ROOM 4',
};

const ROOM_GRADIENTS = [
  { from: 'from-violet-500', to: 'to-purple-700'  },
  { from: 'from-blue-500',   to: 'to-indigo-700'  },
  { from: 'from-teal-500',   to: 'to-cyan-700'    },
  { from: 'from-emerald-500',to: 'to-green-700'   },
  { from: 'from-rose-500',   to: 'to-pink-700'    },
  { from: 'from-amber-500',  to: 'to-orange-600'  },
];

type RoomStatus = 'available' | 'reserved';

type MeetingRoom = {
  id: string;
  name: string;
  displayName: string;
  code: string;
  floor: string;
  location: string;
  capacity: string;
  areaM2: number | null;
  status: RoomStatus;
  reservedSlot?: string | null;
  reservations: ReservationRoomDto['reservations'];
};

const toRoom = (room: ReservationRoomDto): MeetingRoom => ({
  id: room.ifcGlobalId,
  name: room.name,
  displayName: ROOM_DISPLAY_NAMES[room.name] || room.longName || room.name,
  code: room.name,
  floor: room.storey || 'Étage non renseigné',
  location: room.location || 'IFC',
  capacity: room.areaM2 ? `${room.areaM2.toFixed(1)} m²` : 'Surface non renseignée',
  areaM2: room.areaM2 ?? null,
  status: room.status,
  reservedSlot: room.reservedSlot,
  reservations: room.reservations,
});

/**
 * Tarif horaire basé sur la superficie de la salle :
 *   100–300 m²  →  100 DT/h   |   300–700 m²   →  200 DT/h
 *   700–1500 m² →  300 DT/h   |   > 1500 m²    →  500 DT/h
 * Heure de pointe (8h–18h jours ouvrables) = base + 50 DT/h
 */
const getHourlyRange = (areaM2: number | null) => {
  const a = areaM2 ?? 0;
  let base: number;
  if (a >= 1500)      base = 500;
  else if (a >= 700)  base = 300;
  else if (a >= 300)  base = 200;
  else                base = 100;
  return { offPeak: base, peak: base + 50 };
};

const ENERGY_RATE_DT    = 0.18;   // DT/kWh
const MIN_KWH_PER_M2_H = 0.025;  // 25 W/m² — charge minimale (éclairage seul)
const MAX_KWH_PER_M2_H = 0.10;   // 100 W/m² — charge maximale (CVC + équipements)

const getEnergyRange = (areaM2: number | null) => {
  const a       = areaM2 ?? 20;
  const minKwh  = +(a * MIN_KWH_PER_M2_H).toFixed(1);
  const maxKwh  = +(a * MAX_KWH_PER_M2_H).toFixed(1);
  const minCost = +(minKwh * ENERGY_RATE_DT).toFixed(2);
  const maxCost = +(maxKwh * ENERGY_RATE_DT).toFixed(2);
  return { minKwh, maxKwh, minCost, maxCost };
};

const getMaxOccupancy = (areaM2: number | null) =>
  Math.max(4, Math.floor((areaM2 ?? 20) / 12.5));

const getRoomType = (displayName: string) =>
  displayName.toLowerCase().includes('conference') ? 'Salle de conférence' : 'Salle de réunion';

const timeToMinutes = (time: string) => {
  const [h = '0', m = '0'] = time.split(':');
  return Number(h) * 60 + Number(m);
};

const getOverlappingReservation = (room: MeetingRoom, date: string, start: string, end: string) =>
  room.reservations.find((r) => {
    if (r.date !== date) return false;
    return timeToMinutes(start) < timeToMinutes(r.endTime) && timeToMinutes(end) > timeToMinutes(r.startTime);
  });

const overlapsReservation = (room: MeetingRoom, date: string, start: string, end: string) =>
  Boolean(getOverlappingReservation(room, date, start, end));

const formatDate = (value: string) => {
  const [y, m, d] = value.split('-');
  return d && m && y ? `${d}/${m}/${y}` : value;
};

type ReservationNotification = {
  id: string; roomName: string; date: string; startTime: string; endTime: string;
  reservedBy: string | null; email: string | null; phone: string | null;
  createdAt: string; read: boolean;
};

const RESERVATION_NOTIFICATION_STORAGE_KEY = 'directionReservationNotifications';

const pushDirectionReservationNotification = (notif: ReservationNotification) => {
  try {
    const existing = localStorage.getItem(RESERVATION_NOTIFICATION_STORAGE_KEY);
    const list: ReservationNotification[] = existing ? JSON.parse(existing) : [];
    localStorage.setItem(RESERVATION_NOTIFICATION_STORAGE_KEY, JSON.stringify([notif, ...list].slice(0, 5)));
    window.dispatchEvent(new Event('directionReservationNotification'));
  } catch {}
};

const isReservationActive = (r: ReservationDto) =>
  new Date(`${r.date}T${r.endTime}`).getTime() > Date.now();

// ─────────────────────────────────────────────────────────────────────────────

export function ReservationView() {
  const [rooms,            setRooms]            = useState<MeetingRoom[]>([]);
  const [selectedRoomId,   setSelectedRoomId]   = useState<string | null>(null);
  const [showAll,          setShowAll]          = useState(false);
  const [date,             setDate]             = useState('');
  const [startTime,        setStartTime]        = useState('');
  const [endTime,          setEndTime]          = useState('');
  const [firstName,        setFirstName]        = useState('');
  const [lastName,         setLastName]         = useState('');
  const [country,          setCountry]          = useState('Tunisie');
  const [phone,            setPhone]            = useState('+216');
  const [email,            setEmail]            = useState('');
  const [isLoading,        setIsLoading]        = useState(true);
  const [isSaving,         setIsSaving]         = useState(false);
  const [message,          setMessage]          = useState<string | null>(null);
  const [pricingEstimate,  setPricingEstimate]  = useState<PricingEstimateDto | null>(null);
  const [isPricingLoading, setIsPricingLoading] = useState(false);
  const [pricingError,     setPricingError]     = useState<string | null>(null);

  const latestPricingReqRef = useRef<number>(0);

  const countryPrefixes: Record<string, string> = {
    Tunisie: '+216', France: '+33', Maroc: '+212', Algerie: '+213', USA: '+1',
  };

  const loadRooms = async () => {
    setIsLoading(true);
    try {
      const data = await getReservationRooms();
      setRooms(
        data
          .filter((r) => ALLOWED_ROOMS.has(r.name))
          .filter((r, i, self) => i === self.findIndex((s) => s.ifcGlobalId === r.ifcGlobalId))
          .map(toRoom)
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Impossible de charger les salles.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadRooms(); }, []);

  const selectedRoom = useMemo(
    () => rooms.find((r) => r.id === selectedRoomId) ?? null,
    [rooms, selectedRoomId]
  );

  const closeModal = () => {
    setSelectedRoomId(null);
    setMessage(null);
    setPricingEstimate(null);
    setPricingError(null);
  };

  // Dynamic pricing — triggered whenever slot changes
  useEffect(() => {
    setPricingEstimate(null);
    setPricingError(null);
    if (!selectedRoom || !date || !startTime || !endTime || startTime >= endTime) {
      setIsPricingLoading(false);
      return;
    }
    const reqId = ++latestPricingReqRef.current;
    setIsPricingLoading(true);
    const t = window.setTimeout(async () => {
      try {
        const est = await estimateReservationPrice({
          roomName: selectedRoom.code,
          startDatetime: `${date}T${startTime}`,
          endDatetime: `${date}T${endTime}`,
        });
        if (reqId === latestPricingReqRef.current) { setPricingEstimate(est); setPricingError(null); }
      } catch {
        if (reqId === latestPricingReqRef.current) { setPricingError('Prix indisponible pour ce créneau.'); setPricingEstimate(null); }
      } finally {
        if (reqId === latestPricingReqRef.current) setIsPricingLoading(false);
      }
    }, 350);
    return () => window.clearTimeout(t);
  }, [selectedRoom, date, startTime, endTime]);

  const handleReserve = async () => {
    if (!selectedRoom) return;
    if (!date || !startTime || !endTime) { setMessage('Choisissez la date et les heures.'); return; }
    if (startTime >= endTime) { setMessage("L'heure de fin doit être après le début."); return; }
    if (overlapsReservation(selectedRoom, date, startTime, endTime)) {
      setMessage('Ce créneau est déjà réservé. Choisissez une autre heure.');
      return;
    }
    if (pricingEstimate && !pricingEstimate.available) {
      setMessage('Ce créneau est déjà réservé.');
      return;
    }
    setIsSaving(true);
    try {
      const res = await createReservation({
        ifcGlobalId: selectedRoom.id, firstName, lastName, country, phone, email, date, startTime, endTime,
      });
      pushDirectionReservationNotification({
        id: `${res.id}-${Date.now()}`, roomName: selectedRoom.displayName, date, startTime, endTime,
        reservedBy: res.reservedBy || `${firstName} ${lastName}`.trim() || null,
        email: email || null, phone: phone || null,
        createdAt: new Date().toISOString(), read: false,
      });
      await loadRooms();
      setMessage(`✓ Réservation confirmée pour ${selectedRoom.displayName}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Réservation impossible.';
      setMessage(msg.includes('409') ? 'Ce créneau est déjà réservé.' : msg);
    } finally {
      setIsSaving(false);
    }
  };

  const availableCount = rooms.filter((r) => r.status === 'available').length;
  const visibleRooms   = showAll ? rooms : rooms.slice(0, 3);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_0%_0%,#f6f7f8_0,#e9ecef_45%,#e2e8ec_100%)] p-6">

      {/* ── Header ── */}
      <header className="flex items-center justify-between rounded-3xl bg-white/70 px-6 py-5 mb-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-800">Réservation des salles</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Explorez en 3D et réservez votre créneau en quelques secondes
          </p>
        </div>
        <div className="flex items-center gap-6">
          {[
            { val: isLoading ? '—' : String(rooms.length),              label: 'Salles',      dot: 'bg-zinc-400'    },
            { val: isLoading ? '—' : String(availableCount),            label: 'Disponibles', dot: 'bg-emerald-400' },
            { val: isLoading ? '—' : String(rooms.length - availableCount), label: 'Réservées',   dot: 'bg-amber-400'   },
          ].map(({ val, label, dot }) => (
            <div key={label} className="text-center">
              <p className="text-2xl font-bold text-zinc-800">{val}</p>
              <div className="flex items-center justify-center gap-1.5 mt-1">
                <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                <p className="text-xs text-zinc-500">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </header>

      {/* ── Room grid ── */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center h-56 gap-3">
          <div className="w-9 h-9 border-2 border-[#f4b400] border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-500 text-sm">Chargement des salles…</p>
        </div>
      )}

      {!isLoading && rooms.length === 0 && (
        <div className="rounded-2xl bg-white/70 p-6 text-center text-zinc-500 text-sm shadow-sm">
          Aucune salle trouvée. Vérifiez le building-service (port 8084).
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {visibleRooms.map((room, idx) => {
          const g      = ROOM_GRADIENTS[idx % ROOM_GRADIENTS.length];
          const range  = getHourlyRange(room.areaM2);
          const energy = getEnergyRange(room.areaM2);
          const occ    = getMaxOccupancy(room.areaM2);
          const type  = getRoomType(room.displayName);
          const avail = room.status === 'available';

          return (
            <div
              key={room.id}
              onClick={() => setSelectedRoomId(room.id)}
              className="group rounded-2xl bg-white shadow-sm border border-slate-200/80 overflow-hidden cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
            >
              {/* Gradient top */}
              <div className={`relative h-40 bg-gradient-to-br ${g.from} ${g.to} overflow-hidden`}>
                <div className="absolute inset-0 bg-black/15" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_75%_25%,rgba(255,255,255,0.18),transparent_55%)]" />

                {/* Status badge */}
                <div className="absolute top-3 right-3">
                  <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold backdrop-blur-sm ${
                    avail
                      ? 'bg-white/25 border border-white/30 text-white'
                      : 'bg-black/25 border border-white/20 text-white/80'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${avail ? 'bg-white animate-pulse' : 'bg-white/60'}`} />
                    {avail ? 'Disponible' : 'Réservée'}
                  </span>
                </div>

                {/* 3D badge */}
                <div className="absolute top-3 left-3 flex items-center gap-1 rounded-full bg-black/20 backdrop-blur-sm px-2.5 py-1 border border-white/20">
                  <Maximize2 className="w-2.5 h-2.5 text-white/80" />
                  <span className="text-[9px] text-white/80 font-medium">3D IFC</span>
                </div>

                {/* Room name */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/35 to-transparent px-4 pt-6 pb-3">
                  <p className="text-[9px] text-white/65 uppercase tracking-widest mb-0.5">{type}</p>
                  <h3 className="text-lg font-bold text-white leading-tight">{room.displayName}</h3>
                </div>
              </div>

              {/* Card body */}
              <div className="p-4">
                {/* Stats */}
                <div className="flex items-center gap-4 mb-3 flex-wrap">
                  <span className="flex items-center gap-1.5 text-zinc-500 text-xs">
                    <Ruler className="w-3.5 h-3.5 text-zinc-400" /> {room.capacity}
                  </span>
                  <span className="flex items-center gap-1.5 text-zinc-500 text-xs">
                    <Users className="w-3.5 h-3.5 text-zinc-400" /> max {occ} pers.
                  </span>
                  <span className="flex items-center gap-1.5 text-zinc-500 text-xs">
                    <MapPin className="w-3.5 h-3.5 text-zinc-400" /> {room.floor}
                  </span>
                </div>

                {/* Hourly price range */}
                <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5 mb-3 space-y-1.5">
                  <p className="text-[9px] text-amber-600 uppercase tracking-widest">Estimation / heure</p>

                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-500">Location</span>
                    <span className="text-[11px] font-semibold text-amber-700">
                      {range.offPeak} – {range.peak} DT
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-400">
                      Énergie (~{energy.minKwh}–{energy.maxKwh} kWh)
                    </span>
                    <span className="text-[11px] font-semibold text-zinc-600">
                      ~{energy.minCost} – ~{energy.maxCost} DT
                    </span>
                  </div>

                  <div className="border-t border-amber-200 pt-1.5 flex items-center justify-between">
                    <span className="text-[10px] text-zinc-600 font-medium">Total estimé</span>
                    <span className="text-sm font-bold text-amber-700">
                      ~{(range.offPeak + energy.minCost).toFixed(0)} – ~{(range.peak + energy.maxCost).toFixed(0)} DT/h
                    </span>
                  </div>

                  <p className="text-[9px] text-amber-500">Hors-pointe / Pointe (+50 DT/h)</p>
                </div>

                <button className="w-full flex items-center justify-center gap-2 rounded-xl bg-zinc-50 border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:border-zinc-300 transition-all group-hover:border-[#f4b400]/40 group-hover:bg-amber-50/50">
                  Explorer & Réserver
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Voir plus */}
      {rooms.length > 3 && (
        <div className="mt-5 text-center">
          <button
            onClick={() => setShowAll((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-2 text-sm text-zinc-600 hover:bg-slate-50 hover:border-slate-400 transition-all shadow-sm"
          >
            {showAll ? 'Réduire' : `Voir toutes les salles · ${rooms.length - 3} de plus`}
            <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${showAll ? 'rotate-180' : ''}`} />
          </button>
        </div>
      )}

      {/* ── Room detail modal ── */}
      {selectedRoom && (() => {
        const range     = getHourlyRange(selectedRoom.areaM2);
        const energy    = getEnergyRange(selectedRoom.areaM2);
        const occ       = getMaxOccupancy(selectedRoom.areaM2);
        const type      = getRoomType(selectedRoom.displayName);
        const activeRes = selectedRoom.reservations.filter(isReservationActive);

        return (
          <div className="fixed inset-0 z-50 flex bg-black/40 backdrop-blur-sm">
            <div className="flex w-full h-full overflow-hidden m-4 rounded-3xl shadow-2xl border border-slate-200">

              {/* ── Left: 3D + info ── */}
              <div className="flex-1 flex flex-col bg-white overflow-y-auto">

                {/* Modal header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
                  <div>
                    <p className="text-[10px] text-zinc-400 uppercase tracking-widest">{type} · {selectedRoom.code}</p>
                    <h2 className="text-xl font-bold text-zinc-900 mt-0.5">{selectedRoom.displayName}</h2>
                  </div>
                  <button
                    onClick={closeModal}
                    className="rounded-full bg-slate-100 p-2 text-zinc-500 hover:text-zinc-900 hover:bg-slate-200 transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* 3D viewer */}
                <div className="relative bg-slate-50 flex-shrink-0 border-b border-slate-100" style={{ height: '350px' }}>
                  <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 rounded-full bg-white/90 border border-slate-200 px-3 py-1.5 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-[#f4b400]" />
                    <span className="text-[10px] text-zinc-600 font-medium">Vue 3D IFC — {selectedRoom.displayName}</span>
                  </div>
                  <RoomPreviewIFC roomName={selectedRoom.code} />
                </div>

                {/* Details */}
                <div className="p-6 space-y-5">

                  {/* Key metrics */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { icon: Ruler,  label: 'Surface',      value: selectedRoom.capacity },
                      { icon: Users,  label: 'Capacité max', value: `${occ} personnes`   },
                      { icon: MapPin, label: 'Emplacement',  value: selectedRoom.floor    },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                        <Icon className="w-4 h-4 text-[#f4b400] mb-2" />
                        <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-1">{label}</p>
                        <p className="text-sm font-semibold text-zinc-800">{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Hourly price range detail */}
                  <div className="rounded-2xl bg-amber-50 border border-amber-100 p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <span className="text-sm font-semibold text-zinc-800">Estimation de prix / heure</span>
                    </div>

                    {/* Location row */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-xl bg-white border border-amber-100 p-3">
                        <p className="text-[10px] text-zinc-400 mb-1">Location · Hors-pointe</p>
                        <p className="text-2xl font-bold text-amber-600">
                          {range.offPeak} <span className="text-sm font-normal text-zinc-400">DT/h</span>
                        </p>
                      </div>
                      <div className="rounded-xl bg-white border border-amber-100 p-3">
                        <p className="text-[10px] text-zinc-400 mb-1">Location · Pointe (+50 DT/h)</p>
                        <p className="text-2xl font-bold text-amber-600">
                          {range.peak} <span className="text-sm font-normal text-zinc-400">DT/h</span>
                        </p>
                      </div>
                    </div>

                    {/* Energy row */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-xl bg-white border border-slate-100 p-3">
                        <p className="text-[10px] text-zinc-400 mb-1">Énergie min (~{energy.minKwh} kWh)</p>
                        <p className="text-2xl font-bold text-zinc-600">
                          ~{energy.minCost} <span className="text-sm font-normal text-zinc-400">DT/h</span>
                        </p>
                      </div>
                      <div className="rounded-xl bg-white border border-slate-100 p-3">
                        <p className="text-[10px] text-zinc-400 mb-1">Énergie max (~{energy.maxKwh} kWh)</p>
                        <p className="text-2xl font-bold text-zinc-600">
                          ~{energy.maxCost} <span className="text-sm font-normal text-zinc-400">DT/h</span>
                        </p>
                      </div>
                    </div>

                    {/* Total row */}
                    <div className="rounded-xl bg-amber-100/60 border border-amber-200 px-4 py-3 flex items-center justify-between">
                      <span className="text-sm font-semibold text-zinc-700">Total estimé / heure</span>
                      <span className="text-xl font-bold text-amber-700">
                        ~{(range.offPeak + energy.minCost).toFixed(0)}
                        <span className="text-zinc-400 font-normal text-sm mx-1.5">–</span>
                        ~{(range.peak + energy.maxCost).toFixed(0)}
                        <span className="text-sm font-normal text-zinc-400 ml-1">DT/h</span>
                      </span>
                    </div>

                    {/* Price breakdown explanation */}
                    <div className="border-t border-amber-200 pt-3 space-y-2">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Comment est calculé le prix ?</p>
                      <div className="space-y-1.5 text-xs text-zinc-600">
                        <div className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                          <span>
                            <strong className="text-zinc-700">Location :</strong> tarif basé sur la superficie —
                            100–300 m² = 100 DT/h · 300–700 m² = 200 DT/h · 700–1500 m² = 300 DT/h · +1500 m² = 500 DT/h.
                            Pointe (8h–18h jours ouvrables) : +50 DT/h.
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                          <span>
                            <strong className="text-zinc-700">Énergie :</strong> entre {energy.minKwh} kWh/h (charge minimale)
                            et {energy.maxKwh} kWh/h (pleine charge CVC) × 0,18 DT/kWh
                            = ~{energy.minCost} – ~{energy.maxCost} DT/h.
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 mt-1.5 flex-shrink-0" />
                          <span className="text-zinc-400 italic">
                            Le prix exact (énergie prédite par ML) apparaît dans le formulaire dès que vous choisissez une date et des heures.
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Equipments */}
                  <div>
                    <p className="text-xs text-zinc-400 uppercase tracking-widest mb-3">Équipements inclus</p>
                    <div className="flex flex-wrap gap-2">
                      {['Climatisation', 'Projecteur', 'Wi-Fi haut débit', 'Tableau blanc', 'Visioconférence', 'Prise secteur'].map((f) => (
                        <span key={f} className="rounded-lg bg-slate-100 border border-slate-200 px-3 py-1.5 text-xs text-zinc-600">{f}</span>
                      ))}
                    </div>
                  </div>

                  {/* Upcoming reservations */}
                  {activeRes.length > 0 && (
                    <div>
                      <p className="text-xs text-zinc-400 uppercase tracking-widest mb-3">Créneaux déjà réservés</p>
                      <div className="space-y-2">
                        {activeRes.slice(0, 4).map((r) => (
                          <div key={r.id} className="flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-100 px-4 py-2.5">
                            <Clock3 className="w-4 h-4 text-amber-500 flex-shrink-0" />
                            <div>
                              <p className="text-xs font-medium text-zinc-800">
                                {formatDate(r.date)} · {r.startTime.slice(0, 5)} – {r.endTime.slice(0, 5)}
                              </p>
                              {r.reservedBy && <p className="text-[10px] text-zinc-400 mt-0.5">{r.reservedBy}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Right: form ── */}
              <div className="w-[390px] flex-shrink-0 bg-slate-50 border-l border-slate-200 overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-6">
                    <CalendarClock className="w-5 h-5 text-[#f4b400]" />
                    <h3 className="font-bold text-zinc-900">Nouvelle réservation</h3>
                  </div>

                  <div className="space-y-4">

                    {/* User info */}
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Nom',    val: lastName,  set: setLastName,  ph: 'Dupont' },
                        { label: 'Prénom', val: firstName, set: setFirstName, ph: 'Jean'   },
                      ].map(({ label, val, set, ph }) => (
                        <div key={label}>
                          <label className="text-xs text-zinc-500">{label}</label>
                          <input
                            type="text" placeholder={ph} value={val}
                            onChange={(e) => set(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-[#f4b400] transition-all placeholder-zinc-300"
                          />
                        </div>
                      ))}
                    </div>

                    <div>
                      <label className="text-xs text-zinc-500">Email</label>
                      <input
                        type="email" placeholder="exemple@domaine.com" value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-[#f4b400] transition-all placeholder-zinc-300"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-zinc-500">Pays</label>
                        <select
                          value={country}
                          onChange={(e) => { setCountry(e.target.value); setPhone(countryPrefixes[e.target.value] || ''); }}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-[#f4b400] transition-all"
                        >
                          {Object.keys(countryPrefixes).map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-zinc-500">Téléphone</label>
                        <input
                          type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-[#f4b400] transition-all"
                        />
                      </div>
                    </div>

                    {/* Date & time */}
                    <div className="border-t border-slate-200 pt-4">
                      <label className="text-xs text-zinc-500">Date</label>
                      <input
                        type="date" value={date} onChange={(e) => setDate(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-[#f4b400] transition-all"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Début', val: startTime, set: setStartTime },
                        { label: 'Fin',   val: endTime,   set: setEndTime   },
                      ].map(({ label, val, set }) => (
                        <div key={label}>
                          <label className="text-xs text-zinc-500">{label}</label>
                          <input
                            type="time" value={val} onChange={(e) => set(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-[#f4b400] transition-all"
                          />
                        </div>
                      ))}
                    </div>

                    {/* Dynamic pricing — shown as soon as date+times are valid */}
                    {date && startTime && endTime && startTime < endTime && (
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        {isPricingLoading && (
                          <div className="flex items-center gap-2">
                            <div className="w-3.5 h-3.5 border border-[#f4b400] border-t-transparent rounded-full animate-spin" />
                            <p className="text-xs text-zinc-500">Calcul du prix…</p>
                          </div>
                        )}
                        {!isPricingLoading && pricingError && (
                          <p className="text-xs text-amber-600">{pricingError}</p>
                        )}
                        {!isPricingLoading && pricingEstimate && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-zinc-500">Durée</span>
                              <span className="font-medium text-zinc-900">{pricingEstimate.duration_hours} h</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-zinc-500">Consommation prédite</span>
                              <span className="font-medium text-zinc-900">{pricingEstimate.predicted_kwh} kWh</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-zinc-500">Location</span>
                              <span className="font-medium text-zinc-900">{pricingEstimate.rental_cost_dt} DT</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-zinc-500">Énergie</span>
                              <span className="font-medium text-zinc-900">{pricingEstimate.energy_cost_dt} DT</span>
                            </div>
                            <div className="border-t border-slate-100 pt-2 flex items-center justify-between">
                              <span className="text-sm font-semibold text-zinc-900">Prix estimé</span>
                              <span className="text-xl font-bold text-[#f4b400]">
                                {pricingEstimate.total_price_dt}
                                <span className="text-sm font-normal text-zinc-400"> DT</span>
                              </span>
                            </div>
                            {!pricingEstimate.available && (
                              <p className="text-xs text-amber-600">⚠ Ce créneau est déjà réservé.</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Hint when slot not yet filled */}
                    {(!date || !startTime || !endTime || startTime >= endTime) && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-zinc-400 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-zinc-300 flex-shrink-0" />
                        Remplissez la date et les heures pour voir le prix exact
                      </div>
                    )}

                    {/* Submit */}
                    <button
                      onClick={handleReserve}
                      disabled={isSaving}
                      className="w-full rounded-xl bg-[#f4b400] px-4 py-3 text-sm font-bold text-white hover:bg-[#e1a600] active:scale-[0.98] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-all"
                    >
                      {isSaving ? 'Réservation en cours…' : 'Confirmer la réservation'}
                    </button>

                    {message && (
                      <div className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs ${
                        message.startsWith('✓')
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-amber-50 border-amber-200 text-amber-800'
                      }`}>
                        <CircleAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>{message}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>
        );
      })()}
    </div>
  );
}
