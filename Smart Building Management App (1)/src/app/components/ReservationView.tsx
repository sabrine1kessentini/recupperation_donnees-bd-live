import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarClock, CheckCircle2, CircleAlert, Clock3, MapPin, Ruler } from 'lucide-react';
import { createReservation, estimateReservationPrice, getReservationRooms, type PricingEstimateDto, type ReservationDto, type ReservationRoomDto } from '../../services/api';
import { RoomPreviewIFC } from './RoomPreviewIFC';

const ALLOWED_ROOMS = new Set(['B109', 'B152', 'B135', 'B119', 'B111', 'B123', 'B125', 'B129', 'B148', 'B137', 'B113', 'B150', 'B139']);

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

type RoomStatus = 'available' | 'reserved';

type MeetingRoom = {
  id: string;
  name: string;
  displayName: string;
  code: string;
  floor: string;
  location: string;
  capacity: string;
  status: RoomStatus;
  reservedSlot?: string | null;
  reservations: ReservationRoomDto['reservations'];
};

const toRoom = (room: ReservationRoomDto): MeetingRoom => ({
  id: room.ifcGlobalId,
  name: room.name,
  displayName: ROOM_DISPLAY_NAMES[room.name] || room.longName || room.name,
  code: room.name,
  floor: room.storey || 'Etage non renseigne',
  location: room.location || 'IFC',
  capacity: room.areaM2 ? `${room.areaM2.toFixed(1)} m2` : 'Surface non renseignee',
  status: room.status,
  reservedSlot: room.reservedSlot,
  reservations: room.reservations,
});

const timeToMinutes = (time: string) => {
  const [hours = '0', minutes = '0'] = time.split(':');
  return Number(hours) * 60 + Number(minutes);
};

const getOverlappingReservation = (room: MeetingRoom, date: string, startTime: string, endTime: string) =>
  room.reservations.find((reservation) => {
    if (reservation.date !== date) return false;
    return timeToMinutes(startTime) < timeToMinutes(reservation.endTime)
      && timeToMinutes(endTime) > timeToMinutes(reservation.startTime);
  });

const overlapsReservation = (room: MeetingRoom, date: string, startTime: string, endTime: string) =>
  Boolean(getOverlappingReservation(room, date, startTime, endTime));

const formatDate = (value: string) => {
  const [year, month, day] = value.split('-');
  return day && month && year ? `${day}/${month}/${year}` : value;
};

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

const RESERVATION_NOTIFICATION_STORAGE_KEY = 'directionReservationNotifications';

const pushDirectionReservationNotification = (notification: ReservationNotification) => {
  try {
    const existing = localStorage.getItem(RESERVATION_NOTIFICATION_STORAGE_KEY);
    const list: ReservationNotification[] = existing ? JSON.parse(existing) : [];
    const next = [notification, ...list].slice(0, 5);
    localStorage.setItem(RESERVATION_NOTIFICATION_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event('directionReservationNotification'));
  } catch {
    // Ignore storage errors
  }
};

const isReservationActive = (reservation: ReservationDto) => {
  const now = new Date();
  const reservationEnd = new Date(`${reservation.date}T${reservation.endTime}`);
  return reservationEnd.getTime() > now.getTime();
};

export function ReservationView() {
  const [rooms, setRooms] = useState<MeetingRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [country, setCountry] = useState('Tunisie');
  const [phone, setPhone] = useState('+216');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pricingEstimate, setPricingEstimate] = useState<PricingEstimateDto | null>(null);
  const [isPricingLoading, setIsPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);

  // Use a ref to track the latest request so stale responses are ignored
  const latestPricingRequestRef = useRef<number>(0);

  const countryPrefixes: Record<string, string> = {
    Tunisie: '+216',
    France: '+33',
    Maroc: '+212',
    Algerie: '+213',
    USA: '+1',
  };

  const loadRooms = async () => {
    setIsLoading(true);
    try {
      const data = await getReservationRooms();
      const filtered = data
        .filter((room) => ALLOWED_ROOMS.has(room.name))
        .filter((room, index, self) => index === self.findIndex((r) => r.ifcGlobalId === room.ifcGlobalId))
        .map(toRoom);

      setRooms(filtered);
      setMessage(
        filtered.length === 0
          ? 'Aucune salle IFC trouvee. Verifiez que le building-service (port 8084) fonctionne.'
          : null
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Impossible de charger les salles IFC.';
      if (msg.includes('500')) {
        setMessage('Erreur serveur (500). Verifiez les logs du building-service.');
      } else if (msg.includes('404') || msg.includes('Failed to fetch')) {
        setMessage('Building-service inaccessible. Verifiez que le backend est demarre sur le port 8084.');
      } else {
        setMessage(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId) ?? null,
    [rooms, selectedRoomId]
  );

  useEffect(() => {
    // Reset pricing state whenever inputs change
    setPricingEstimate(null);
    setPricingError(null);

    if (!selectedRoom || !date || !startTime || !endTime || startTime >= endTime) {
      setIsPricingLoading(false);
      return;
    }

    // Increment request counter — used to ignore stale responses
    const requestId = ++latestPricingRequestRef.current;

    setIsPricingLoading(true);

    const timer = window.setTimeout(async () => {
      try {
        const estimate = await estimateReservationPrice({
          roomName: selectedRoom.code,
          startDatetime: `${date}T${startTime}`,
          endDatetime: `${date}T${endTime}`,
        });

        // Only update state if this is still the latest request
        if (requestId === latestPricingRequestRef.current) {
          setPricingEstimate(estimate);
          setPricingError(null);
        }
      } catch (error) {
        if (requestId === latestPricingRequestRef.current) {
          setPricingError('Prix indisponible pour ce creneau.');
          setPricingEstimate(null);
        }
      } finally {
        if (requestId === latestPricingRequestRef.current) {
          setIsPricingLoading(false);
        }
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      // Do NOT abort here — let any in-flight request finish,
      // the requestId check above will discard stale results.
    };
  }, [selectedRoom, date, startTime, endTime]);

  const getStatusUi = (isReservedForSelectedSlot: boolean) => {
    if (!isReservedForSelectedSlot) {
      return {
        label: 'Disponible',
        classes: 'bg-green-50 text-green-700 border-green-200',
        icon: <CheckCircle2 className="h-4 w-4" />,
      };
    }
    return {
      label: 'Reservee',
      classes: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: <Clock3 className="h-4 w-4" />,
    };
  };

  const handleReserve = async () => {
    if (!selectedRoom) { setMessage('Selectionnez une salle.'); return; }
    if (!date || !startTime || !endTime) { setMessage('Choisissez la date et les heures de debut/fin.'); return; }
    if (startTime >= endTime) { setMessage("L'heure de fin doit etre apres l'heure de debut."); return; }
    if (overlapsReservation(selectedRoom, date, startTime, endTime)) {
      setMessage('Ce creneau est deja reserve pour cette salle. Choisissez une autre heure.');
      return;
    }
    if (pricingEstimate && !pricingEstimate.available) {
      setMessage('Ce creneau est deja reserve pour cette salle. Choisissez une autre heure.');
      return;
    }

    setIsSaving(true);
    try {
      const reservation = await createReservation({
        ifcGlobalId: selectedRoom.id,
        firstName,
        lastName,
        country,
        phone,
        email,
        date,
        startTime,
        endTime,
      });

      const reservedByName = reservation.reservedBy || `${firstName} ${lastName}`.trim() || null;
      pushDirectionReservationNotification({
        id: `${reservation.id}-${Date.now()}`,
        roomName: selectedRoom.displayName,
        date,
        startTime,
        endTime,
        reservedBy: reservedByName,
        email: email || null,
        phone: phone || null,
        createdAt: new Date().toISOString(),
        read: false,
      });

      await loadRooms();
      setMessage(`Reservation confirmee pour ${selectedRoom.displayName} le ${date} de ${startTime} a ${endTime}.`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Reservation impossible.';
      setMessage(msg.includes('409') ? 'Ce creneau est deja reserve pour cette salle. Choisissez une autre heure.' : msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-slate-950 mb-2">Reservation des salles</h2>
        <p className="text-slate-600">Selectionnez une salle, date et heure pour reserver votre reunion</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          {isLoading && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
              Chargement des salles IFC...
            </div>
          )}
          {!isLoading && rooms.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
              Aucune salle IFC trouvee.
            </div>
          )}
          {rooms.map((room) => {
            const overlappingReservation = date && startTime && endTime
              ? getOverlappingReservation(room, date, startTime, endTime)
              : null;
            const statusUi = getStatusUi(Boolean(overlappingReservation));
            const isActive = selectedRoomId === room.id;

            return (
              <div
                key={room.id}
                className={`rounded-xl border bg-white p-5 shadow-sm transition-all ${
                  isActive ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-950">{room.displayName}</h3>
                    <p className="text-sm text-slate-600 mt-1">{room.code} - {room.floor}</p>
                    <p className="text-xs text-slate-500 mt-1">{room.location}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${statusUi.classes}`}>
                    {statusUi.icon}
                    {statusUi.label}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-5 text-sm">
                  <span className="inline-flex items-center gap-2 text-slate-700">
                    <Ruler className="h-4 w-4 text-slate-500" />
                    Surface: {room.capacity}
                  </span>
                  <span className="inline-flex items-center gap-2 text-slate-700">
                    <MapPin className="h-4 w-4 text-slate-500" />
                    {room.floor}
                  </span>
                  {overlappingReservation && (
                    <span className="inline-flex items-center gap-2 text-slate-700">
                      <Clock3 className="h-4 w-4 text-slate-500" />
                      Reservee de {overlappingReservation.startTime} a {overlappingReservation.endTime}
                    </span>
                  )}
                </div>

                <div className="mt-4">
                  <button
                    onClick={() => setSelectedRoomId(room.id)}
                    className="rounded-lg bg-[#f4b400] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-[#e1a600]"
                  >
                    Reserver
                  </button>
                </div>

                {room.reservations.filter(isReservationActive).length > 0 && (
                  <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-medium text-slate-600">Reservations</p>
                    <div className="mt-2 space-y-2">
                      {room.reservations.filter(isReservationActive).slice(0, 3).map((reservation) => (
                        <div key={reservation.id} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                          <p className="font-medium text-slate-900">{formatDate(reservation.date)}</p>
                          <p className="mt-1">Debut: {reservation.startTime} - Fin: {reservation.endTime}</p>
                          {reservation.reservedBy && <p className="mt-1 text-slate-500">{reservation.reservedBy}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="h-fit sticky top-6 space-y-4">
          {selectedRoom && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-slate-50">
                <h3 className="font-semibold text-slate-950 text-sm">Apercu 3D - {selectedRoom.displayName}</h3>
              </div>
              <div className="w-full h-80">
                <RoomPreviewIFC roomName={selectedRoom.code} />
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-slate-950">
              <CalendarClock className="h-5 w-5 text-[#f4b400]" />
              <h3 className="font-semibold">Nouvelle reservation</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-600">Salle choisie</label>
                <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
                  {selectedRoom ? `${selectedRoom.displayName} (${selectedRoom.code})` : 'Aucune salle selectionnee'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-600">Nom</label>
                  <input
                    type="text"
                    placeholder="Entrer votre nom"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#f4b400]"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600">Prenom</label>
                  <input
                    type="text"
                    placeholder="Entrer votre prenom"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#f4b400]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-600">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemple@domaine.com"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#f4b400]"
                />
              </div>

              <div>
                <label className="text-xs text-slate-600">Pays</label>
                <select
                  value={country}
                  onChange={(e) => {
                    const selected = e.target.value;
                    setCountry(selected);
                    setPhone(countryPrefixes[selected] || '');
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#f4b400]"
                >
                  <option value="Tunisie">Tunisie</option>
                  <option value="France">France</option>
                  <option value="Maroc">Maroc</option>
                  <option value="Algerie">Algerie</option>
                  <option value="USA">USA</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-600">Numero de telephone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={`${countryPrefixes[country]} XX XXX XXX`}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#f4b400]"
                />
              </div>

              <div>
                <label className="text-xs text-slate-600">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#f4b400]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-600">Debut</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#f4b400]"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600">Fin</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#f4b400]"
                  />
                </div>
              </div>

              {selectedRoom && date && startTime && endTime && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                  {isPricingLoading && (
                    <p className="text-slate-600">Calcul du prix...</p>
                  )}
                  {!isPricingLoading && pricingError && (
                    <p className="text-amber-700">{pricingError}</p>
                  )}
                  {!isPricingLoading && pricingEstimate && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Duree</span>
                        <span className="font-medium">{pricingEstimate.duration_hours} h</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Consommation predite</span>
                        <span className="font-medium">{pricingEstimate.predicted_kwh} kWh</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Location</span>
                        <span className="font-medium">{pricingEstimate.rental_cost_dt} DT</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Energie</span>
                        <span className="font-medium">{pricingEstimate.energy_cost_dt} DT</span>
                      </div>
                      <div className="border-t border-slate-200 pt-2 flex items-center justify-between text-base">
                        <span className="font-semibold text-slate-950">Prix estime</span>
                        <span className="font-bold text-[#f4b400]">{pricingEstimate.total_price_dt} DT</span>
                      </div>
                      {!pricingEstimate.available && (
                        <p className="text-xs text-amber-700">Ce creneau est deja reserve.</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={handleReserve}
                disabled={isSaving}
                className="w-full rounded-lg bg-[#f4b400] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#e1a600] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
              >
                {isSaving ? 'Reservation...' : 'Confirmer reservation'}
              </button>

              {message && (
                <div className="inline-flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <CircleAlert className="h-4 w-4 mt-0.5 text-[#f4b400]" />
                  <span>{message}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}