import { Zap, TrendingDown, TrendingUp, Battery, Sun, Sparkles, Lightbulb } from 'lucide-react';
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const hourlyData = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i}:00`,
  consumption: Math.floor(Math.random() * 200) + 250,
  solar: Math.floor(Math.random() * 150) + 50,
  grid: Math.floor(Math.random() * 100) + 100,
}));

const sourceData = [
  { name: 'Solar', value: 35, color: '#f59e0b' },
  { name: 'Grid', value: 45, color: '#3b82f6' },
  { name: 'Battery', value: 20, color: '#10b981' },
];

export function EnergyView() {
  return (
    <div className="soft-page min-h-full p-8 space-y-8 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute top-0 right-0 w-[700px] h-[700px] bg-gradient-to-br from-amber-500/5 via-orange-500/5 to-yellow-500/5 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-blue-500/5 via-cyan-500/5 to-teal-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />

      <div className="relative">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl mb-3 bg-gradient-to-r from-white via-amber-100 to-orange-200 bg-clip-text text-transparent">
            Energy Management
          </h1>
          <p className="text-zinc-400 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            Monitor and optimize building energy consumption in real-time
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          {[
            {
              label: 'Total Consumption',
              value: '8,245',
              unit: 'kWh',
              icon: Zap,
              change: -5.2,
              gradient: 'from-blue-400 via-cyan-500 to-teal-600',
              bgGradient: 'from-blue-500/20 via-cyan-500/20 to-teal-600/20',
              shadowColor: 'shadow-blue-500/20'
            },
            {
              label: 'Solar Generation',
              value: '2,890',
              unit: 'kWh',
              icon: Sun,
              change: 12.4,
              gradient: 'from-amber-400 via-orange-500 to-yellow-600',
              bgGradient: 'from-amber-500/20 via-orange-500/20 to-yellow-600/20',
              shadowColor: 'shadow-amber-500/20'
            },
            {
              label: 'Grid Import',
              value: '3,720',
              unit: 'kWh',
              icon: TrendingDown,
              change: -8.1,
              gradient: 'from-purple-400 via-pink-500 to-fuchsia-600',
              bgGradient: 'from-purple-500/20 via-pink-500/20 to-fuchsia-600/20',
              shadowColor: 'shadow-purple-500/20'
            },
            {
              label: 'Battery Storage',
              value: '1,635',
              unit: 'kWh',
              icon: Battery,
              change: 3.2,
              gradient: 'from-green-400 via-emerald-500 to-teal-600',
              bgGradient: 'from-green-500/20 via-emerald-500/20 to-teal-600/20',
              shadowColor: 'shadow-green-500/20'
            },
          ].map((metric, index) => {
            const Icon = metric.icon;
            return (
              <div
                key={index}
                className={`
                  group relative overflow-hidden rounded-3xl p-6
                  bg-gradient-to-br ${metric.bgGradient}
                  border border-white/10 backdrop-blur-2xl
                  hover:scale-105 hover:shadow-2xl ${metric.shadowColor}
                  transition-all duration-500 cursor-pointer
                `}
              >
                <div className={`absolute top-0 right-0 w-40 h-40 bg-gradient-to-br ${metric.gradient} opacity-20 rounded-full blur-3xl group-hover:opacity-30 transition-opacity`} />

                <div className="relative">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${metric.gradient} flex items-center justify-center mb-5 shadow-xl ${metric.shadowColor}`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>

                  <p className="text-zinc-400 text-sm mb-2">{metric.label}</p>
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-3xl text-white">{metric.value}</span>
                    <span className="text-zinc-400">{metric.unit}</span>
                  </div>

                  <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${
                    metric.change > 0 ? 'bg-green-500/20 border border-green-500/30' : 'bg-green-500/20 border border-green-500/30'
                  }`}>
                    {metric.change < 0 ? <TrendingDown className="w-3 h-3 text-green-400" /> : <TrendingUp className="w-3 h-3 text-orange-400" />}
                    <span className={`text-xs ${metric.change < 0 ? 'text-green-400' : 'text-orange-400'}`}>
                      {metric.change > 0 ? '+' : ''}{metric.change}% vs last week
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          {/* 24h Consumption */}
          <div className="col-span-2 rounded-3xl p-7 bg-gradient-to-br from-zinc-900/90 via-zinc-900/70 to-zinc-950/90 border border-white/10 backdrop-blur-2xl shadow-2xl shadow-black/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-full blur-3xl" />

            <div className="relative">
              <div className="mb-6">
                <h3 className="text-xl text-white mb-1.5">24-Hour Energy Profile</h3>
                <p className="text-sm text-zinc-400">Consumption vs Solar Generation</p>
              </div>

              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={hourlyData}>
                  <defs>
                    <linearGradient id="consumptionGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.5}/>
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="solarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.5}/>
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="hour" stroke="#71717a" interval={2} style={{ fontSize: '11px' }} />
                  <YAxis stroke="#71717a" style={{ fontSize: '11px' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(24, 24, 27, 0.95)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '16px',
                      backdropFilter: 'blur(10px)',
                      padding: '12px'
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Area type="monotone" dataKey="consumption" stroke="#3b82f6" strokeWidth={3} fill="url(#consumptionGrad)" name="Consumption (kWh)" />
                  <Area type="monotone" dataKey="solar" stroke="#f59e0b" strokeWidth={3} fill="url(#solarGrad)" name="Solar (kWh)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Energy Sources */}
          <div className="rounded-3xl p-7 bg-gradient-to-br from-zinc-900/90 via-zinc-900/70 to-zinc-950/90 border border-white/10 backdrop-blur-2xl shadow-2xl shadow-black/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-full blur-3xl" />

            <div className="relative">
              <h3 className="text-xl text-white mb-6">Energy Sources</h3>

              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={sourceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={105}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {sourceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(24, 24, 27, 0.95)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '16px',
                      backdropFilter: 'blur(10px)',
                      padding: '12px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              <div className="space-y-3 mt-6">
                {sourceData.map((source, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/30 border border-zinc-700/30 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-lg" style={{ backgroundColor: source.color }}></div>
                      <span className="text-sm text-zinc-300">{source.name}</span>
                    </div>
                    <span className="text-white">{source.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Recommendations */}
        <div className="rounded-3xl p-7 bg-gradient-to-br from-zinc-900/90 via-zinc-900/70 to-zinc-950/90 border border-white/10 backdrop-blur-2xl shadow-2xl shadow-black/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-green-500/5 to-emerald-500/5 rounded-full blur-3xl" />

          <div className="relative">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-500 shadow-lg shadow-green-500/20">
                <Lightbulb className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl text-white">Energy Optimization Recommendations</h3>
                <p className="text-sm text-zinc-400">AI-powered suggestions to reduce costs</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              {[
                {
                  title: 'Peak Demand Shift',
                  description: 'Move 15% of consumption to off-peak hours',
                  savings: '€340/month',
                  gradient: 'from-cyan-400 to-blue-500',
                  bgGradient: 'from-cyan-500/10 to-blue-500/10',
                  borderColor: 'border-cyan-500/30'
                },
                {
                  title: 'Solar Expansion',
                  description: 'Install 50 kW additional capacity',
                  savings: '€520/month',
                  gradient: 'from-amber-400 to-orange-500',
                  bgGradient: 'from-amber-500/10 to-orange-500/10',
                  borderColor: 'border-amber-500/30'
                },
                {
                  title: 'HVAC Optimization',
                  description: 'Implement zone-based temperature control',
                  savings: '€280/month',
                  gradient: 'from-green-400 to-emerald-500',
                  bgGradient: 'from-green-500/10 to-emerald-500/10',
                  borderColor: 'border-green-500/30'
                },
              ].map((rec, index) => (
                <div
                  key={index}
                  className={`group p-6 rounded-2xl bg-gradient-to-br ${rec.bgGradient} border ${rec.borderColor} backdrop-blur-xl hover:shadow-xl transition-all duration-300 cursor-pointer`}
                >
                  <h4 className="text-white mb-3">{rec.title}</h4>
                  <p className="text-zinc-400 text-sm mb-4 leading-relaxed">{rec.description}</p>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-500/20 border border-green-500/30 w-fit">
                    <TrendingDown className="w-4 h-4 text-green-400" />
                    <span className="text-green-400 font-medium">{rec.savings}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
