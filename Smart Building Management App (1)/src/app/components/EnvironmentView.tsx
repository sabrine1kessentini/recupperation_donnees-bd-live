import { Thermometer, Droplets, Wind, Gauge } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const zones = [
  { id: 1, name: 'Ground Floor - Lobby', temp: 22.5, humidity: 45, airQuality: 92, co2: 420 },
  { id: 2, name: 'Floor 1 - Office West', temp: 23.1, humidity: 48, airQuality: 88, co2: 580 },
  { id: 3, name: 'Floor 1 - Office East', temp: 21.8, humidity: 42, airQuality: 95, co2: 410 },
  { id: 4, name: 'Floor 2 - Meeting Rooms', temp: 22.9, humidity: 46, airQuality: 90, co2: 520 },
  { id: 5, name: 'Floor 3 - Executive', temp: 22.3, humidity: 44, airQuality: 94, co2: 380 },
  { id: 6, name: 'Basement - Parking', temp: 20.2, humidity: 55, airQuality: 78, co2: 650 },
];

const historyData = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i}:00`,
  temp: 20 + Math.random() * 4,
  humidity: 40 + Math.random() * 15,
  co2: 350 + Math.random() * 300,
}));

export function EnvironmentView() {
  return (
    <div className="soft-page p-8 space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">Environmental Monitoring</h2>
        <p className="text-zinc-400">Track temperature, humidity, and air quality across all zones</p>
      </div>

      {/* Zone Cards */}
      <div className="grid grid-cols-3 gap-4">
        {zones.map((zone) => (
          <div key={zone.id} className="bg-zinc-900/30 backdrop-blur-xl border border-zinc-800/50 rounded-xl p-5 hover:border-zinc-700/50 transition-all">
            <h3 className="text-white font-medium mb-4">{zone.name}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Thermometer className="w-4 h-4 text-orange-400" />
                  <span className="text-xs text-zinc-400">Temperature</span>
                </div>
                <p className="text-xl font-bold text-white">{zone.temp}°C</p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Droplets className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs text-zinc-400">Humidity</span>
                </div>
                <p className="text-xl font-bold text-white">{zone.humidity}%</p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Wind className="w-4 h-4 text-green-400" />
                  <span className="text-xs text-zinc-400">Air Quality</span>
                </div>
                <p className="text-xl font-bold text-white">{zone.airQuality}</p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Gauge className="w-4 h-4 text-purple-400" />
                  <span className="text-xs text-zinc-400">CO₂</span>
                </div>
                <p className="text-xl font-bold text-white">{zone.co2} ppm</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-zinc-800/50">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">Status</span>
                <span className={`font-medium ${
                  zone.airQuality > 90 ? 'text-green-400' : zone.airQuality > 80 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {zone.airQuality > 90 ? 'Optimal' : zone.airQuality > 80 ? 'Good' : 'Needs Attention'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Historical Charts */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-zinc-900/30 backdrop-blur-xl border border-zinc-800/50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Temperature Trend (24h)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={historyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="hour" stroke="#71717a" interval={2} />
              <YAxis stroke="#71717a" domain={[18, 26]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '8px',
                }}
              />
              <Line type="monotone" dataKey="temp" stroke="#f97316" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-zinc-900/30 backdrop-blur-xl border border-zinc-800/50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Humidity Trend (24h)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={historyData}>
              <defs>
                <linearGradient id="humidity" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="hour" stroke="#71717a" interval={2} />
              <YAxis stroke="#71717a" domain={[30, 60]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '8px',
                }}
              />
              <Area type="monotone" dataKey="humidity" stroke="#06b6d4" fill="url(#humidity)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* HVAC Control */}
      <div className="bg-zinc-900/30 backdrop-blur-xl border border-zinc-800/50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">HVAC System Status</h3>
        <div className="grid grid-cols-4 gap-4">
          {[
            { zone: 'Zone 1-2', status: 'Active', mode: 'Cooling', power: '75%' },
            { zone: 'Zone 3-4', status: 'Active', mode: 'Heating', power: '60%' },
            { zone: 'Zone 5-6', status: 'Standby', mode: 'Auto', power: '15%' },
            { zone: 'Basement', status: 'Active', mode: 'Ventilation', power: '40%' },
          ].map((hvac, index) => (
            <div key={index} className="p-4 bg-zinc-800/30 rounded-lg border border-zinc-800/50">
              <div className="flex items-center justify-between mb-3">
                <span className="text-white font-medium">{hvac.zone}</span>
                <div className={`w-2 h-2 rounded-full ${hvac.status === 'Active' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Status</span>
                  <span className="text-white">{hvac.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Mode</span>
                  <span className="text-white">{hvac.mode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Power</span>
                  <span className="text-white">{hvac.power}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
