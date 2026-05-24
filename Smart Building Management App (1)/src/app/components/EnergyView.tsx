import { useEffect, useState, useRef } from 'react';
import { Zap, TrendingDown, TrendingUp, Battery, Sun, Sparkles, Lightbulb, RefreshCw, AlertTriangle, Wifi, WifiOff } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getAllRecentMeasurements, getAllRealtimeData, getEnergyComparison, getEnergyConsumptionByRoom, getActiveRoomsCount, getActiveSensorsCount, getConsumptionByUsage, type SensorMeasurement, type EnergyComparisonDto, type RoomEnergyConsumptionDto, type ConsumptionByUsageDto } from '../../services/api';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

export function EnergyView() {
   const [measurements, setMeasurements] = useState<SensorMeasurement[]>([]);
   const [isLoading, setIsLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
   const [energyComparison, setEnergyComparison] = useState<EnergyComparisonDto | null>(null);
   const [roomConsumptions, setRoomConsumptions] = useState<RoomEnergyConsumptionDto[]>([]);
    const [activeRoomsCount, setActiveRoomsCount] = useState<number>(0);
    const [activeSensorsCount, setActiveSensorsCount] = useState<number>(0);
    const [consumptionByUsage, setConsumptionByUsage] = useState<ConsumptionByUsageDto | null>(null);
    const [displayMode, setDisplayMode] = useState<'kwh' | 'eur'>('kwh');
    const [isRealtime, setIsRealtime] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const stompClient = useRef<any>(null);
    const pollingRef = useRef<number | null>(null);

    const PRICE_PER_KWH = 0.20; // €/kWh – à ajuster selon le tarif réel

  const SPRING_URL = import.meta.env.VITE_SPRING_URL || 'http://localhost:8084';
  const WS_URL = SPRING_URL; // SockJS expects HTTP URL, handles WebSocket upgrade internally

  const updateMeasurements = (newMeasurements: SensorMeasurement[]) => {
    setMeasurements(prev => {
      const energyM = newMeasurements.filter(m => m.sensorType === 'energy');
      const merged = [...energyM];
      prev.forEach(m => {
        if (m.sensorType !== 'energy' && !merged.some(nm => nm.sensorId === m.sensorId)) {
          merged.push(m);
        }
      });
      return merged;
    });
    setLastUpdate(new Date());
  };

   const startRealtimeUpdates = () => {
     if (stompClient.current?.connected) return;

     stompClient.current = new Client({
       webSocketFactory: () => {
         return new SockJS(`${WS_URL}/ws`);
       },
       debug: (str: string) => {
         console.log('STOMP:', str);
       },
       onConnect: () => {
         setIsRealtime(true);
         setError(null);
         stompClient.current.subscribe('/topic/sensor-data', (message: any) => {
           try {
             const data = JSON.parse(message.body);
             updateMeasurements([data]);
             setLastUpdate(new Date());
           } catch (e) {
             console.error('Failed to parse STOMP message:', e);
           }
         });
       },
       onStompError: (frame: any) => {
         console.error('STOMP error:', frame);
         setError('Erreur de connexion au service temps réel');
       },
       onWebSocketError: (err: any) => {
         console.error('WebSocket error:', err);
         setError('Erreur de connexion temps réel');
       },
       reconnectDelay: 5000,
       heartbeatIncoming: 4000,
       heartbeatOutgoing: 4000,
     });
     stompClient.current.activate();
   };

    const startPolling = () => {
      if (pollingRef.current) return;
      pollingRef.current = window.setInterval(() => {
        getAllRealtimeData()
          .then(updateMeasurements)
          .catch(console.error);
        getEnergyComparison()
          .then(setEnergyComparison)
          .catch(console.error);
        getEnergyConsumptionByRoom()
          .then(setRoomConsumptions)
          .catch(console.error);
        getActiveRoomsCount()
          .then(setActiveRoomsCount)
          .catch(console.error);
        getActiveSensorsCount()
          .then(setActiveSensorsCount)
          .catch(console.error);
        getConsumptionByUsage()
          .then(setConsumptionByUsage)
          .catch(console.error);
      }, 2000);
      setIsRealtime(false);
    };

  const stopRealtime = () => {
    if (stompClient.current) {
      stompClient.current.deactivate();
      stompClient.current = null;
    }
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setIsRealtime(false);
  };

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const measurementsData = await getAllRecentMeasurements();
        const energyData = await getEnergyComparison();
        const roomData = await getEnergyConsumptionByRoom();
        const activeRooms = await getActiveRoomsCount();
        const activeSensors = await getActiveSensorsCount();
        const usageData = await getConsumptionByUsage();
        setMeasurements(measurementsData);
        setEnergyComparison(energyData);
        setRoomConsumptions(roomData);
        setActiveRoomsCount(activeRooms);
        setActiveSensorsCount(activeSensors);
        setConsumptionByUsage(usageData);
        setLastUpdate(new Date());
      } catch (err) {
        setError('Impossible de charger les données énergie (Spring Boot port 8084)');
      } finally {
        setIsLoading(false);
      }
    };

  const toggleRealtime = () => {
    if (isRealtime) {
      stopRealtime();
      startPolling();
    } else {
      startRealtimeUpdates();
    }
  };

  useEffect(() => {
    fetchData();
    startRealtimeUpdates();
    return () => {
      stopRealtime();
    };
  }, []);

   const energyMeasurements = measurements.filter(m => m.sensorType === 'energy');

   const chartData = energyMeasurements
     .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
     .slice(-24)
     .map(m => ({
       hour: new Date(m.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
       consumption: Math.round(m.value / 1000),
       room: m.roomName,
     }));

    const totalMwh = energyComparison ? (energyComparison.currentTotalKwh / 1000).toFixed(0) : '0';

    const top5 = roomConsumptions.slice(0, 5);

    // Données pour le graphique "Consommation par usage"
    const usageChartData = consumptionByUsage ? (displayMode === 'eur' ? [
      { name: 'CVC', value: consumptionByUsage.cvcKwh * PRICE_PER_KWH, color: '#3b82f6' },
      { name: 'Éclairage', value: consumptionByUsage.lightingKwh * PRICE_PER_KWH, color: '#f59e0b' },
      { name: 'Équipements', value: consumptionByUsage.equipmentKwh * PRICE_PER_KWH, color: '#10b981' },
      { name: 'Autres', value: consumptionByUsage.otherKwh * PRICE_PER_KWH, color: '#8b5cf6' },
    ] : [
      { name: 'CVC', value: consumptionByUsage.cvcKwh, color: '#3b82f6' },
      { name: 'Éclairage', value: consumptionByUsage.lightingKwh, color: '#f59e0b' },
      { name: 'Équipements', value: consumptionByUsage.equipmentKwh, color: '#10b981' },
      { name: 'Autres', value: consumptionByUsage.otherKwh, color: '#8b5cf6' },
    ]) : [];

  return (
    <div className="soft-page min-h-full p-8 space-y-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[700px] h-[700px] bg-gradient-to-br from-amber-500/5 via-orange-500/5 to-yellow-500/5 rounded-full blur-3xl animate-pulse" />

      <div className="soft-page p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">Energy Environment</h2>
            <div className="flex items-center gap-2">
              <span className="text-zinc-400">Données réelles capteurs IFC — WaveOn IoT</span>
              {isRealtime && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs border border-green-500/30">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                  Temps réel
                </span>
              )}
              {lastUpdate && (
                <span className="text-zinc-500 text-xs">
                  Dernière MAJ: {lastUpdate.toLocaleTimeString('fr-FR')}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleRealtime}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${
                isRealtime
                  ? 'bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30'
                  : 'bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:bg-blue-500/30'
              }`}
            >
              {isRealtime ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              {isRealtime ? 'Live' : 'Polling'}
            </button>
            <button
              onClick={fetchData}
              disabled={isRealtime}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800/50 hover:bg-zinc-700/50 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Rafraîchir
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          {[
            {
              label: 'Consommation totale',
              value: isLoading ? '...' : `${totalMwh}`,
              unit: 'MWh',
              icon: Zap,
              change: energyComparison?.percentageChange ?? -5.2,
              gradient: 'from-blue-400 via-cyan-500 to-teal-600',
              bgGradient: 'from-blue-500/20 via-cyan-500/20 to-teal-600/20',
              shadowColor: 'shadow-blue-500/20'
            },
            {
              label: 'Capteurs énergie actifs',
              value: isLoading ? '...' : `${activeSensorsCount}`,
              unit: 'pts',
              icon: Sun,
              change: 0,
              gradient: 'from-amber-400 via-orange-500 to-yellow-600',
              bgGradient: 'from-amber-500/20 via-orange-500/20 to-yellow-600/20',
              shadowColor: 'shadow-amber-500/20'
            },
            {
              label: 'Salles surveillées',
              value: isLoading ? '...' : `${activeRoomsCount}`,
              unit: 'salles',
              icon: TrendingDown,
              change: 0,
              gradient: 'from-purple-400 via-pink-500 to-fuchsia-600',
              bgGradient: 'from-purple-500/20 via-pink-500/20 to-fuchsia-600/20',
              shadowColor: 'shadow-purple-500/20'
            },
            {
              label: 'Pic max',
              value: isLoading ? '...' : energyComparison ? `${(energyComparison.currentPeakValue / 1000).toFixed(1)}` : '0',
              unit: 'MWh',
              icon: Battery,
              change: energyComparison?.peakPercentageChange ?? 3.2,
              gradient: 'from-green-400 via-emerald-500 to-teal-600',
              bgGradient: 'from-green-500/20 via-emerald-500/20 to-teal-600/20',
              shadowColor: 'shadow-green-500/20'
            },
          ].map((metric, index) => {
            const Icon = metric.icon;
            return (
              <div
                key={index}
                className={`group relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br ${metric.bgGradient} border border-white/10 backdrop-blur-2xl hover:scale-105 hover:shadow-2xl ${metric.shadowColor} transition-all duration-500`}
              >
                <div className={`absolute top-0 right-0 w-40 h-40 bg-gradient-to-br ${metric.gradient} opacity-20 rounded-full blur-3xl`} />
                <div className="relative">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${metric.gradient} flex items-center justify-center mb-5 shadow-xl`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <p className="text-zinc-400 text-sm mb-2">{metric.label}</p>
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-3xl text-white">{metric.value}</span>
                    <span className="text-zinc-400">{metric.unit}</span>
                  </div>
                  {metric.change !== 0 && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-500/20 border border-green-500/30">
                      {metric.change < 0
                        ? <TrendingDown className="w-3 h-3 text-green-400" />
                        : <TrendingUp className="w-3 h-3 text-orange-400" />}
                      <span className={`text-xs ${metric.change < 0 ? 'text-green-400' : 'text-orange-400'}`}>
                        {metric.change > 0 ? '+' : ''}{metric.change}% vs semaine dernière
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          {/* Courbe consommation */}
          <div className="col-span-2 rounded-3xl p-7 bg-gradient-to-br from-zinc-900/90 via-zinc-900/70 to-zinc-950/90 border border-white/10 backdrop-blur-2xl shadow-2xl">
            <h3 className="text-xl text-white mb-1.5">Profil de consommation</h3>
            <p className="text-sm text-zinc-400 mb-6">Données réelles capteurs (kWh)</p>
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="consumptionGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="hour" stroke="#71717a" interval={4} style={{ fontSize: '11px' }} />
                <YAxis stroke="#71717a" style={{ fontSize: '11px' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(24,24,27,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }}
                  formatter={(v: number) => [`${v} kWh`, 'Consommation']}
                />
                <Area type="monotone" dataKey="consumption" stroke="#3b82f6" strokeWidth={3} fill="url(#consumptionGrad)" name="kWh" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Top consommateurs */}
          <div className="rounded-3xl p-7 bg-gradient-to-br from-zinc-900/80 via-zinc-900/70 to-zinc-950/80 border border-white/10 backdrop-blur-2xl shadow-2xl">
          <h3 className="text-xl text-white mb-1.5">Top consommateurs</h3>
          <p className="text-sm text-zinc-400 mb-6">Top 5 des salles les plus consommatrices</p>
            <div className="space-y-4">
              {top5.map((m, index) => (
                <div key={index} className="rounded-3xl p-5 bg-zinc-800/60 border border-zinc-600/30 shadow-inner">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">#{index + 1}</p>
                      <p className="text-lg text-white font-semibold truncate">{m.roomName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl text-white font-bold">{(m.totalKwh / 1000).toFixed(2)}</p>
                      <p className="text-xs text-zinc-300">MWh</p>
                    </div>
                  </div>
                </div>
              ))}
              {top5.length === 0 && !isLoading && (
                <div className="rounded-3xl p-6 bg-zinc-800/50 border border-zinc-700/30 text-zinc-400 text-center">
                  Aucune salle disponible pour le moment
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
