import { AlertTriangle, Info, CheckCircle, XCircle, Clock, Filter } from 'lucide-react';
import { useState } from 'react';

type AlertType = 'critical' | 'warning' | 'info' | 'resolved';

interface Alert {
  id: number;
  type: AlertType;
  title: string;
  description: string;
  location: string;
  timestamp: string;
  status: 'active' | 'acknowledged' | 'resolved';
}

const alerts: Alert[] = [
  {
    id: 1,
    type: 'critical',
    title: 'HVAC System Failure',
    description: 'Air conditioning unit in Floor 2 East has stopped responding',
    location: 'Floor 2 - Office East',
    timestamp: '2 minutes ago',
    status: 'active',
  },
  {
    id: 2,
    type: 'warning',
    title: 'High Energy Consumption',
    description: 'Energy usage 25% above normal levels',
    location: 'Floor 2 - West Wing',
    timestamp: '15 minutes ago',
    status: 'acknowledged',
  },
  {
    id: 3,
    type: 'warning',
    title: 'Temperature Threshold Exceeded',
    description: 'Temperature reached 26.5°C, exceeding comfort zone',
    location: 'Floor 1 - Meeting Room B',
    timestamp: '1 hour ago',
    status: 'active',
  },
  {
    id: 4,
    type: 'info',
    title: 'Scheduled Maintenance',
    description: 'Elevator maintenance scheduled for tomorrow',
    location: 'Building Wide',
    timestamp: '3 hours ago',
    status: 'acknowledged',
  },
  {
    id: 5,
    type: 'resolved',
    title: 'CO₂ Level Alert',
    description: 'CO₂ levels normalized after ventilation adjustment',
    location: 'Floor 3 - Conference Room',
    timestamp: '5 hours ago',
    status: 'resolved',
  },
  {
    id: 6,
    type: 'warning',
    title: 'Water Leak Detected',
    description: 'Moisture sensor triggered in bathroom area',
    location: 'Ground Floor - Restroom',
    timestamp: '6 hours ago',
    status: 'active',
  },
];

export function AlertsView() {
  const [filter, setFilter] = useState<AlertType | 'all'>('all');

  const filteredAlerts = filter === 'all' ? alerts : alerts.filter(a => a.type === filter);

  const getAlertIcon = (type: AlertType) => {
    switch (type) {
      case 'critical': return <XCircle className="w-5 h-5" />;
      case 'warning': return <AlertTriangle className="w-5 h-5" />;
      case 'info': return <Info className="w-5 h-5" />;
      case 'resolved': return <CheckCircle className="w-5 h-5" />;
    }
  };

  const getAlertColor = (type: AlertType) => {
    switch (type) {
      case 'critical': return 'border-red-500/50 bg-red-500/10 text-red-400';
      case 'warning': return 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400';
      case 'info': return 'border-blue-500/50 bg-blue-500/10 text-blue-400';
      case 'resolved': return 'border-green-500/50 bg-green-500/10 text-green-400';
    }
  };

  const alertCounts = {
    all: alerts.length,
    critical: alerts.filter(a => a.type === 'critical').length,
    warning: alerts.filter(a => a.type === 'warning').length,
    info: alerts.filter(a => a.type === 'info').length,
    resolved: alerts.filter(a => a.type === 'resolved').length,
  };

  return (
    <div className="soft-page p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Alerts & Incidents</h2>
          <p className="text-zinc-400">Monitor and manage building alerts</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/50 rounded-lg px-4 py-2">
            <Clock className="w-4 h-4 text-zinc-400" />
            <span className="text-sm text-zinc-400">Last updated: 30s ago</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'All Alerts', count: alertCounts.all, color: 'from-zinc-600 to-zinc-700', type: 'all' },
          { label: 'Critical', count: alertCounts.critical, color: 'from-red-500 to-red-600', type: 'critical' },
          { label: 'Warnings', count: alertCounts.warning, color: 'from-yellow-500 to-yellow-600', type: 'warning' },
          { label: 'Info', count: alertCounts.info, color: 'from-blue-500 to-blue-600', type: 'info' },
          { label: 'Resolved', count: alertCounts.resolved, color: 'from-green-500 to-green-600', type: 'resolved' },
        ].map((stat) => (
          <button
            key={stat.type}
            onClick={() => setFilter(stat.type as AlertType | 'all')}
            className={`bg-zinc-900/30 backdrop-blur-xl border rounded-xl p-4 text-left transition-all ${
              filter === stat.type ? 'border-zinc-600' : 'border-zinc-800/50 hover:border-zinc-700/50'
            }`}
          >
            <p className="text-zinc-400 text-sm mb-1">{stat.label}</p>
            <p className="text-3xl font-bold text-white">{stat.count}</p>
            <div className={`mt-2 h-1 rounded-full bg-gradient-to-r ${stat.color}`} />
          </button>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-zinc-400" />
          <span className="text-sm text-zinc-400">
            Showing {filteredAlerts.length} {filter === 'all' ? 'alerts' : filter + ' alerts'}
          </span>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-zinc-800/50 hover:bg-zinc-700/50 text-white rounded-lg text-sm transition-all">
            Export
          </button>
          <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-all">
            Acknowledge All
          </button>
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {filteredAlerts.map((alert) => (
          <div
            key={alert.id}
            className={`bg-zinc-900/30 backdrop-blur-xl border rounded-xl p-5 ${getAlertColor(alert.type)}`}
          >
            <div className="flex items-start gap-4">
              <div className="mt-1">{getAlertIcon(alert.type)}</div>
              <div className="flex-1">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-white font-semibold mb-1">{alert.title}</h3>
                    <p className="text-zinc-300 text-sm">{alert.description}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    alert.status === 'active' ? 'bg-red-500/20 text-red-400' :
                    alert.status === 'acknowledged' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-green-500/20 text-green-400'
                  }`}>
                    {alert.status.charAt(0).toUpperCase() + alert.status.slice(1)}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-zinc-400 mb-3">
                  <span>📍 {alert.location}</span>
                  <span>• {alert.timestamp}</span>
                </div>
                <div className="flex gap-2">
                  {alert.status !== 'resolved' && (
                    <>
                      <button className="px-3 py-1.5 bg-zinc-800/50 hover:bg-zinc-700/50 text-white rounded-lg text-sm transition-all">
                        Acknowledge
                      </button>
                      <button className="px-3 py-1.5 bg-zinc-800/50 hover:bg-zinc-700/50 text-white rounded-lg text-sm transition-all">
                        Assign
                      </button>
                      <button className="px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-sm transition-all">
                        Resolve
                      </button>
                    </>
                  )}
                  <button className="px-3 py-1.5 bg-zinc-800/50 hover:bg-zinc-700/50 text-white rounded-lg text-sm transition-all">
                    View Details
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
