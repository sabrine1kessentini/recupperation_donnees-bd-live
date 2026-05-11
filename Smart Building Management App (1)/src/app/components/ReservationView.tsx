import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2, CircleAlert, Clock3, MapPin, Users } from 'lucide-react';
import { createReservation, getReservationRooms, type ReservationRoomDto } from '../../services/api';

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
  displayName: room.longName || room.name,
  code: room.name,
  floor: room.storey || 'Etage non renseigne',
  location: room.location || 'IFC',
  capacity: room.areaM2 ? `${room.areaM2.toFixed(1)} m2` : 'Surface non renseignee',
  status: room.status,
  reservedSlot: room.reservedSlot,
  reservations: room.reservations,
});

export function ReservationView() {
  const [rooms, setRooms] = useState<MeetingRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [country, setCountry] = useState('Tunisie'); // valeur par défaut
  const [phone, setPhone] = useState('+216');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const countryPrefixes: Record<string, string> = {
  Tunisie: '+216',
  France: '+33',
  Maroc: '+212',
  Algérie: '+213',
  USA: '+1',
};
  const [message, setMessage] = useState<string | null>(null);

  const loadRooms = async () => {
    setIsLoading(true);
    try {
      const data = await getReservationRooms();
      setRooms(data.map(toRoom));
      if (data.length === 0) {
        setMessage('Aucune salle IFC trouvee. Verifiez que le building-service (port 8084) fonctionne et que la base de donnees "buildingdb" contient les zones.');
      } else {
        setMessage(null);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Impossible de charger les salles IFC.';
      if (msg.includes('500')) {
        setMessage('Erreur serveur (500). Verifiez les logs du building-service - fichier IFC introuvable ou base de donnees non initialisee.');
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

  const getStatusUi = (status: RoomStatus) => {
    if (status === 'available') {
      return {
        label: 'Disponible',
        classes: 'bg-green-500/15 text-green-400 border-green-500/30',
        icon: <CheckCircle2 className="h-4 w-4" />,
      };
    }
    if (status === 'reserved') {
      return {
        label: 'Reservee',
        classes: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        icon: <Clock3 className="h-4 w-4" />,
      };
    }
    // Default fallback
    return {
      label: 'Inconnu',
      classes: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
      icon: <CircleAlert className="h-4 w-4" />,
    };
  };

  const handleReserve = async () => {
    if (!selectedRoom) {
      setMessage('Selectionnez une salle disponible.');
      return;
    }
    if (selectedRoom.status !== 'available') {
      setMessage('Cette salle n est pas disponible.');
      return;
    }
    if (!date || !startTime || !endTime) {
      setMessage('Choisissez la date et les heures de debut/fin.');
      return;
    }
    if (startTime >= endTime) {
      setMessage('L heure de fin doit etre apres l heure de debut.');
      return;
    }

    setIsSaving(true);
    try {
      await createReservation({
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
      await loadRooms();
      setMessage(`Reservation confirmee pour ${selectedRoom.displayName} le ${date} de ${startTime} a ${endTime}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Reservation impossible.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="soft-page p-8 space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">Reservation des salles</h2>
        <p className="text-zinc-400">Selectionnez une salle, date et heure pour reserver votre reunion</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          {isLoading && (
            <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/30 p-5 text-sm text-zinc-300">
              Chargement des salles IFC...
            </div>
          )}

          {!isLoading && rooms.length === 0 && (
            <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/30 p-5 text-sm text-zinc-300">
              Aucune salle IFC trouvee.
            </div>
          )}

          {rooms.map((room) => {
            const statusUi = getStatusUi(room.status);
            const isActive = selectedRoomId === room.id;
            const canReserve = room.status === 'available';

            return (
              <div
                key={room.id}
                className={`rounded-xl border p-5 backdrop-blur-xl transition-all ${
                  isActive
                    ? 'bg-zinc-900/40 border-blue-500/40'
                    : 'bg-zinc-900/30 border-zinc-800/50'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-white text-lg font-semibold">{room.displayName}</h3>
                    <p className="text-zinc-400 text-sm mt-1">{room.code} - {room.floor}</p>
                    <p className="text-zinc-500 text-xs mt-1">{room.location}</p>
                  </div>

                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${statusUi.classes}`}>
                    {statusUi.icon}
                    {statusUi.label}
                  </span>
                </div>

                <div className="mt-4 flex items-center gap-5 text-sm">
                  <span className="inline-flex items-center gap-2 text-zinc-300">
                    <Users className="h-4 w-4 text-zinc-400" />
                    {room.capacity}
                  </span>
                  <span className="inline-flex items-center gap-2 text-zinc-300">
                    <MapPin className="h-4 w-4 text-zinc-400" />
                    {room.floor}
                  </span>
                  {room.reservedSlot && (
                    <span className="inline-flex items-center gap-2 text-zinc-300">
                      <Clock3 className="h-4 w-4 text-zinc-400" />
                      {room.reservedSlot}
                    </span>
                  )}
                </div>

                <div className="mt-4">
                  <button
                    onClick={() => canReserve && setSelectedRoomId(room.id)}
                    disabled={!canReserve}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                      canReserve
                        ? 'bg-[#f4b400] text-white hover:bg-[#e1a600]'
                        : 'bg-zinc-700/60 text-zinc-400 cursor-not-allowed'
                    }`}
                    >
                    Reserver
                  </button>
                </div>

                {room.reservations.length > 0 && (
                  <div className="mt-4 rounded-lg border border-zinc-800/60 bg-zinc-950/30 p-3">
                    <p className="text-xs font-medium text-zinc-400">Reservations</p>
                    <div className="mt-2 space-y-1">
                      {room.reservations.slice(0, 3).map((reservation) => (
                        <p key={reservation.id} className="text-xs text-zinc-300">
                          {reservation.reservedSlot}
                          {reservation.reservedBy ? ` - ${reservation.reservedBy}` : ''}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="rounded-xl bg-zinc-900/30 backdrop-blur-xl border border-zinc-800/50 p-5 h-fit sticky top-6">
          <div className="flex items-center gap-2 text-white mb-4">
            <CalendarClock className="h-5 w-5 text-[#f4b400]" />
            <h3 className="font-semibold">Nouvelle reservation</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-zinc-400">Salle choisie</label>
              <div className="mt-1 rounded-lg border border-zinc-700/60 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-200">
                {selectedRoom ? `${selectedRoom.displayName} (${selectedRoom.code})` : 'Aucune salle selectionnee'}
              </div>
            </div>

<div className="grid grid-cols-2 gap-3">
  <div>
    <label className="text-xs text-zinc-400">Nom</label>
    <input
      type="text"
      placeholder="Entrer votre nom"
      value={lastName}
      onChange={(e) => setLastName(e.target.value)}
      className="mt-1 w-full rounded-lg border border-zinc-700/60 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#f4b400]"
    />
  </div>

  <div>
    <label className="text-xs text-zinc-400">Prénom</label>
    <input
      type="text"
      placeholder="Entrer votre prénom"
      value={firstName}
      onChange={(e) => setFirstName(e.target.value)}
      className="mt-1 w-full rounded-lg border border-zinc-700/60 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#f4b400]"
    />
  </div>
</div>
<div>
  <label className="text-xs text-zinc-400">Email</label>
  <input
    type="email"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    placeholder="exemple@domaine.com"
    className="mt-1 w-full rounded-lg border border-zinc-700/60 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#f4b400]"
  />
</div>
<div>
  <label className="text-xs text-zinc-400">Pays</label>
  <select
    value={country}
    onChange={(e) => {
      const selected = e.target.value;
      setCountry(selected);
      setPhone(countryPrefixes[selected] || ''); // met le préfixe automatiquement
    }}
    className="mt-1 w-full rounded-lg border border-zinc-700/60 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#f4b400]"
  >
    <option value="Tunisie">Tunisie</option>
    <option value="France">France</option>
    <option value="Maroc">Maroc</option>
    <option value="Algérie">Algérie</option>
    <option value="USA">USA</option>
  </select>
</div>

<div>
  <label className="text-xs text-zinc-400">Numéro de téléphone</label>
  <input
    type="tel"
    value={phone}
    onChange={(e) => setPhone(e.target.value)}
    placeholder={`${countryPrefixes[country]} XX XXX XXX`}
    className="mt-1 w-full rounded-lg border border-zinc-700/60 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#f4b400]"
  />
</div>
            <div>
              <label className="text-xs text-zinc-400">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-700/60 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#f4b400]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400">Debut</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-700/60 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#f4b400]"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400">Fin</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-700/60 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#f4b400]"
                />
              </div>
            </div>

            <button
              onClick={handleReserve}
              disabled={isSaving}
              className="w-full rounded-lg bg-[#f4b400] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#e1a600] disabled:cursor-not-allowed disabled:bg-zinc-700/60 disabled:text-zinc-400"
            >
              {isSaving ? 'Reservation...' : 'Confirmer reservation'}
            </button>

            {message && (
              <div className="rounded-lg border border-zinc-700/60 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-300 inline-flex items-start gap-2">
                <CircleAlert className="h-4 w-4 mt-0.5 text-[#f4b400]" />
                <span>{message}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
