import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Thermometer, Droplets, Wind, Sun, Users,
  AlertTriangle, RefreshCw, X, Activity,
  Brain, Flame, Snowflake, Fan, Building2,
  Shield, Gauge, Zap, MessageSquare, Send,
  Sparkles, Bot, CheckCircle2,
} from 'lucide-react';
import {
  getAllComfort,
  chatWithAgent,
  type AllComfortState,
  type RoomComfortState,
  type ComfortAlert,
  type ChatMessage,
} from '../../services/api';

const REFRESH_MS = 60_000;

// ── Color helpers ──────────────────────────────────────────────────────────────

function scoreStyle(score: number | null | undefined) {
  const s = score ?? -1;
  if (s < 0)  return { bg: 'bg-slate-50',   border: 'border-slate-200',  accent: 'border-l-slate-300',  text: 'text-slate-400',   ring: '#94a3b8', tag: 'bg-slate-100 text-slate-500',   pulse: false };
  if (s >= 80) return { bg: 'bg-emerald-50', border: 'border-emerald-100',accent: 'border-l-emerald-400',text: 'text-emerald-600',  ring: '#10b981', tag: 'bg-emerald-100 text-emerald-700',pulse: false };
  if (s >= 60) return { bg: 'bg-amber-50',   border: 'border-amber-100',  accent: 'border-l-amber-400',  text: 'text-amber-600',   ring: '#f59e0b', tag: 'bg-amber-100 text-amber-700',   pulse: false };
  if (s >= 40) return { bg: 'bg-orange-50',  border: 'border-orange-100', accent: 'border-l-orange-400', text: 'text-orange-600',  ring: '#f97316', tag: 'bg-orange-100 text-orange-700',  pulse: false };
  return               { bg: 'bg-red-50',    border: 'border-red-100',    accent: 'border-l-red-400',    text: 'text-red-600',     ring: '#ef4444', tag: 'bg-red-100 text-red-700',        pulse: true  };
}

function alertStyle(level: string) {
  if (level === 'critical') return { dot: 'bg-red-500',    badge: 'bg-red-50 border-red-200',    text: 'text-red-700',    label: 'text-red-500'   };
  if (level === 'warning')  return { dot: 'bg-amber-400',  badge: 'bg-amber-50 border-amber-200',text: 'text-amber-700',  label: 'text-amber-500' };
  return                           { dot: 'bg-blue-400',   badge: 'bg-blue-50 border-blue-200',  text: 'text-blue-700',   label: 'text-blue-500'  };
}

function dimBarColor(val: number) {
  if (val >= 80) return 'bg-emerald-400';
  if (val >= 60) return 'bg-amber-400';
  if (val >= 40) return 'bg-orange-400';
  return 'bg-red-400';
}

function dimTextColor(val: number) {
  if (val >= 80) return 'text-emerald-600';
  if (val >= 60) return 'text-amber-600';
  if (val >= 40) return 'text-orange-600';
  return 'text-red-600';
}

// ── LLM Source Badge ──────────────────────────────────────────────────────────

function LlmBadge({ source, confidence, modelUsed }: { source?: string; confidence?: number; modelUsed?: string }) {
  const isLlm = source === 'llm_mistral';
  if (!source) return null;
  const label = isLlm ? (modelUsed ?? 'Mistral AI') : 'Règles';
  return (
    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-semibold ${
      isLlm
        ? 'bg-violet-50 border-violet-200 text-violet-600'
        : 'bg-slate-100 border-slate-200 text-slate-500'
    }`}>
      {isLlm ? <Sparkles className="w-2.5 h-2.5" /> : <Shield className="w-2.5 h-2.5" />}
      {label}
      {isLlm && confidence != null && (
        <span className="ml-0.5 text-violet-500 font-bold">{Math.round(confidence * 100)}%</span>
      )}
    </div>
  );
}

// ── ScoreRing ──────────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 72 }: { score: number | null; size?: number }) {
  const r   = (size - 10) / 2;
  const c   = 2 * Math.PI * r;
  const pct = score !== null ? (score / 100) * c : 0;
  const col = scoreStyle(score).ring;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={6} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={col} strokeWidth={6} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - pct}
          style={{ transition: 'stroke-dashoffset 1.3s cubic-bezier(.4,0,.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold text-slate-800 leading-none">
          {score !== null ? score : '—'}
        </span>
        <span className="text-[8px] text-slate-400">/100</span>
      </div>
    </div>
  );
}

// ── HvacIcon ──────────────────────────────────────────────────────────────────

function HvacModeIcon({ mode }: { mode: string }) {
  if (mode.startsWith('cool'))   return <Snowflake className="w-3.5 h-3.5 text-sky-500" />;
  if (mode.startsWith('heat'))   return <Flame     className="w-3.5 h-3.5 text-orange-500" />;
  if (mode === 'ventilation')    return <Fan       className="w-3.5 h-3.5 text-blue-500 animate-spin" style={{ animationDuration: '4s' }} />;
  return                                <Wind      className="w-3.5 h-3.5 text-slate-400" />;
}

// ── RoomCard ──────────────────────────────────────────────────────────────────

function RoomCard({
  state, isSelected, onClick,
}: { state: RoomComfortState; isSelected: boolean; onClick: () => void }) {
  const score      = state.comfort?.overall;
  const st         = scoreStyle(score);
  const hvac       = state.hvac;
  const occupied   = hvac?.occupied;
  const alertCount = state.alerts?.length ?? 0;
  const critCount  = state.alerts?.filter(a => a.level === 'critical').length ?? 0;
  const isLlm      = hvac?.decision_source === 'llm_mistral';
  const noData     = state.data_missing || state.comfort?.overall === null;
  const isStale    = state.data_stale && !state.data_missing;

  return (
    <button
      onClick={onClick}
      className={[
        'relative w-full rounded-2xl p-4 text-left border-l-4 border border-slate-100 bg-white',
        st.accent,
        isSelected ? 'ring-2 ring-offset-1 ring-violet-300 shadow-md' : 'shadow-sm hover:shadow-md',
        'transition-all duration-200 hover:-translate-y-0.5',
        critCount > 0 ? 'border-red-200' : '',
      ].join(' ')}
    >
      {/* Alert badge */}
      {alertCount > 0 && (
        <span className={`absolute top-2.5 right-2.5 z-10 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${critCount > 0 ? 'bg-red-500 text-white animate-pulse' : 'bg-amber-400 text-white'}`}>
          {alertCount}
        </span>
      )}

      {/* LLM sparkle */}
      {isLlm && (
        <span className="absolute top-2.5 left-1.5 z-10">
          <Sparkles className="w-2.5 h-2.5 text-violet-400" />
        </span>
      )}

      <div className="flex items-center gap-3">
        <ScoreRing score={noData ? null : score} size={56} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-slate-800 font-semibold text-sm truncate">{state.room}</p>
            {isStale && (
              <span className="flex-shrink-0 text-[8px] px-1 py-0.5 rounded bg-orange-100 text-orange-600 font-semibold">
                {state.data_age_minutes && state.data_age_minutes > 60
                  ? `${Math.round((state.data_age_minutes ?? 0) / 60)}h`
                  : `${Math.round(state.data_age_minutes ?? 0)}min`}
              </span>
            )}
          </div>
          {noData ? (
            <p className="text-xs font-medium text-slate-400 truncate italic">Aucune donnée</p>
          ) : isStale ? (
            <p className="text-xs font-medium text-orange-500 truncate">Données périmées · {state.comfort?.label}</p>
          ) : (
            <p className={`text-xs font-medium ${st.text} truncate`}>{state.comfort?.label ?? 'N/A'}</p>
          )}

          <div className="flex items-center gap-1.5 mt-1">
            {(() => {
              const isOccupied = occupied || state.reservation?.is_reserved;
              return (
                <>
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isOccupied ? 'bg-emerald-400 animate-pulse' : 'bg-slate-300'}`} />
                  <span className="text-[10px] text-slate-500 truncate">
                    {isOccupied ? 'Occupé' : state.reservation?.is_preheating ? '🔥 Préchauffe' : 'Vide'}
                  </span>
                </>
              );
            })()}
          </div>

          {hvac?.hvac?.mode && hvac.hvac.mode !== 'off' && (
            <div className="flex items-center gap-1 mt-1">
              <HvacModeIcon mode={hvac.hvac.mode} />
              <span className="text-[10px] text-slate-500">{hvac.total_kw?.toFixed(1)} kW</span>
            </div>
          )}
        </div>
      </div>

      {state.sensors?.temperature != null && (
        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-2 flex-wrap">
          <Thermometer className="w-3 h-3 text-slate-400 flex-shrink-0" />
          <span className="text-[10px] text-slate-500">{state.sensors.temperature.toFixed(1)}°C</span>
          {state.sensors.co2 != null && (
            <>
              <span className="text-slate-300">·</span>
              <Wind className="w-3 h-3 text-slate-400 flex-shrink-0" />
              <span className="text-[10px] text-slate-500">{state.sensors.co2.toFixed(0)} ppm</span>
            </>
          )}
        </div>
      )}
    </button>
  );
}

// ── RoomDetailPanel ───────────────────────────────────────────────────────────

function RoomDetailPanel({
  state, onClose,
}: { state: RoomComfortState; onClose: () => void }) {
  const score  = state.comfort?.overall;
  const st     = scoreStyle(score);
  const hvac   = state.hvac;
  const dims   = state.comfort?.dimensions ?? {};

  const SENSORS = [
    { key: 'temperature', label: 'Température', unit: '°C',   icon: Thermometer, color: 'text-orange-500', digits: 1 },
    { key: 'humidity',    label: 'Humidité',    unit: '%',    icon: Droplets,    color: 'text-blue-500',   digits: 0 },
    { key: 'co2',         label: 'CO₂',         unit: ' ppm', icon: Wind,        color: 'text-green-600',  digits: 0 },
    { key: 'luminosity',  label: 'Luminosité',  unit: ' lux', icon: Sun,         color: 'text-yellow-500', digits: 0 },
    { key: 'occupancy',   label: 'Occupancy',   unit: '',     icon: Users,       color: 'text-purple-500', digits: 0 },
  ] as const;

  const DIMS = [
    { key: 'temperature', label: 'Température', icon: Thermometer },
    { key: 'humidity',    label: 'Humidité',    icon: Droplets    },
    { key: 'co2',         label: 'CO₂',         icon: Wind        },
    { key: 'luminosity',  label: 'Luminosité',  icon: Sun         },
  ] as const;

  const isLlm  = hvac?.decision_source === 'llm_mistral';
  const noData   = state.data_missing || score === null;
  const isStaleP = state.data_stale && !state.data_missing;

  const ageLabel = () => {
    const m = state.data_age_minutes ?? 0;
    if (m < 60) return `${Math.round(m)} min`;
    return `${Math.round(m / 60)} h`;
  };

  return (
    <div className={`rounded-3xl p-6 bg-white border ${st.border} shadow-lg border-l-4 ${st.accent}`}>
      {/* Stale data warning */}
      {isStaleP && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-orange-50 border border-orange-200 px-3 py-2.5 text-xs text-orange-700">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
          Dernière mesure il y a <strong className="ml-1">{ageLabel()}</strong> — données périmées, les capteurs n'envoient plus de données récentes.
        </div>
      )}
      {/* No-data warning */}
      {noData && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-slate-100 border border-slate-200 px-3 py-2.5 text-xs text-slate-500">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0" />
          Aucune mesure capteur disponible — score indisponible.
        </div>
      )}
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <ScoreRing score={noData ? null : score} size={72} />
          <div>
            <h3 className="text-xl font-bold text-slate-900">{state.room}</h3>
            <p className={`text-sm font-semibold ${st.text}`}>{state.comfort?.label ?? 'Données insuffisantes'}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {state.profile?.type && (
                <span className="text-[10px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 capitalize">
                  {state.profile.type.replace(/_/g, ' ')}
                </span>
              )}
              {state.profile?.priority === 'high' && (
                <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                  Priorité haute
                </span>
              )}
              {(() => {
                const isOccupied = hvac?.occupied || state.reservation?.is_reserved;
                return (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 border font-medium ${
                    isOccupied
                      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                      : hvac?.is_preheating
                      ? 'text-orange-700 bg-orange-50 border-orange-200'
                      : 'text-slate-500 bg-slate-50 border-slate-200'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isOccupied ? 'bg-emerald-400 animate-pulse' : hvac?.is_preheating ? 'bg-orange-400' : 'bg-slate-300'}`} />
                    {isOccupied ? 'Occupé' : hvac?.is_preheating ? 'Préchauffage' : 'Vide'}
                  </span>
                );
              })()}
              <LlmBadge source={hvac?.decision_source} confidence={hvac?.confidence} modelUsed={hvac?.model_used} />
            </div>
          </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Capteurs */}
        <div className="space-y-2">
          <h4 className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-semibold mb-3 flex items-center gap-1.5">
            <Activity className="w-3 h-3" /> Capteurs
          </h4>
          {SENSORS.map(({ key, label, unit, icon: Icon, color, digits }) => {
            let val = state.sensors?.[key as keyof typeof state.sensors];
            // Salle réservée → occupancy affichée à 1 même si capteur dit 0/null
            if (key === 'occupancy' && (val == null || val === 0) && state.reservation?.is_reserved) {
              val = 1;
            }
            return (
              <div key={key} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2">
                  <Icon className={`w-3.5 h-3.5 ${val != null ? color : 'text-slate-300'}`} />
                  <span className="text-xs text-slate-600">{label}</span>
                </div>
                <span className={`text-sm font-semibold ${val != null ? 'text-slate-800' : 'text-slate-300'}`}>
                  {val != null ? `${Number(val).toFixed(digits)}${unit}` : '—'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Dimensions + HVAC */}
        <div className="space-y-2.5">
          <h4 className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-semibold mb-3 flex items-center gap-1.5">
            <Gauge className="w-3 h-3" /> Dimensions de Confort
          </h4>
          {DIMS.map(({ key, label, icon: Icon }) => {
            const val = dims[key as keyof typeof dims];
            if (val === undefined) return null;
            return (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Icon className="w-3 h-3" />
                    {label}
                  </div>
                  <span className={`font-semibold ${dimTextColor(val)}`}>{val}</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-1000 ${dimBarColor(val)}`} style={{ width: `${val}%` }} />
                </div>
              </div>
            );
          })}

          {/* HVAC state */}
          <div className="mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
            <h5 className="text-[10px] uppercase tracking-[0.15em] text-slate-400 font-semibold flex items-center gap-1.5">
              <Zap className="w-2.5 h-2.5" /> Préconisation HVAC
              <span className="ml-auto text-[8px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-500 normal-case tracking-normal font-medium">Simulation</span>
            </h5>
            <div className="flex items-center gap-2">
              {hvac?.hvac && <HvacModeIcon mode={hvac.hvac.mode} />}
              <span className="text-sm text-slate-800 font-medium capitalize">{hvac?.hvac?.mode ?? 'off'}</span>
              {(hvac?.hvac?.power_kw ?? 0) > 0 && (
                <span className="text-xs text-slate-500 ml-auto">{hvac.hvac.power_kw.toFixed(2)} kW est.</span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {hvac?.ventilation?.is_on && (
                <span className={`text-[9px] px-2 py-0.5 rounded-full border font-medium ${hvac.ventilation.boost ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                  💨 {hvac.ventilation.boost ? 'Ventil. boostée' : 'Ventil. recommandée'}
                  {(hvac.ventilation.power_kw ?? 0) > 0 && (
                    <span className="ml-1 opacity-70">{hvac.ventilation.power_kw.toFixed(2)} kW</span>
                  )}
                </span>
              )}
              {hvac?.lighting?.is_on && (
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-yellow-50 border border-yellow-200 text-yellow-700 font-medium">
                  💡 Éclairage · {(hvac.lighting.power_kw ?? 0.8).toFixed(2)} kW
                </span>
              )}
              {hvac?.projector?.is_on && (
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-medium">
                  📽 Projecteur · {(hvac.projector.power_kw ?? 0.5).toFixed(2)} kW
                </span>
              )}
            </div>
            {/* Energy breakdown */}
            <div className="space-y-1 pt-1">
              {(hvac?.hvac?.power_kw ?? 0) > 0 && (
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>HVAC ({hvac?.hvac?.mode})</span>
                  <span>{hvac!.hvac.power_kw.toFixed(2)} kW</span>
                </div>
              )}
              {hvac?.ventilation?.is_on && (hvac?.ventilation?.power_kw ?? 0) > 0 && (
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Ventilation</span>
                  <span>{hvac!.ventilation.power_kw.toFixed(2)} kW</span>
                </div>
              )}
              {hvac?.lighting?.is_on && (
                <div className="flex justify-between text-[10px] text-yellow-600">
                  <span>💡 Éclairage</span>
                  <span>{(hvac.lighting.power_kw ?? 0.8).toFixed(2)} kW</span>
                </div>
              )}
              {hvac?.projector?.is_on && (
                <div className="flex justify-between text-[10px] text-indigo-600">
                  <span>📽 Projecteur</span>
                  <span>{(hvac.projector.power_kw ?? 0.5).toFixed(2)} kW</span>
                </div>
              )}
              <div className="flex justify-between text-xs text-slate-500 border-t border-slate-200 pt-1 mt-1">
                <span className="font-medium">Consommation estimée</span>
                <span className="text-slate-800 font-bold">{hvac?.total_kw?.toFixed(2) ?? '0.00'} kW</span>
              </div>
            </div>
          </div>
        </div>

        {/* IA explanation + alerts */}
        <div className="space-y-3">
          <h4 className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-semibold mb-3 flex items-center gap-1.5">
            <Brain className="w-3 h-3" /> Décision IA
          </h4>

          <div className={`p-3.5 rounded-xl border space-y-2.5 ${
            isLlm
              ? 'bg-violet-50 border-violet-200'
              : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center gap-2">
              {isLlm
                ? <Sparkles className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
                : <Shield className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              }
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isLlm ? 'text-violet-600' : 'text-slate-500'}`}>
                {isLlm ? (hvac?.model_used ?? 'Mistral AI') : 'Règles déterministes'}
              </span>
              {isLlm && hvac?.confidence != null && (
                <span className="ml-auto text-[10px] text-violet-600 font-semibold">
                  {Math.round(hvac.confidence * 100)}%
                </span>
              )}
            </div>
            {isLlm && hvac?.confidence != null && (
              <div className="h-1.5 bg-violet-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-400 transition-all duration-1000"
                  style={{ width: `${Math.round((hvac.confidence ?? 0) * 100)}%` }}
                />
              </div>
            )}
            <p className="text-xs text-slate-600 leading-relaxed">
              {hvac?.explanation ?? 'Aucune explication disponible.'}
            </p>
          </div>

          {state.alerts && state.alerts.length > 0 ? (
            <div className="space-y-1.5">
              <h5 className="text-[10px] uppercase tracking-[0.15em] text-slate-400 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-2.5 h-2.5" /> Alertes de la salle
              </h5>
              {state.alerts.map((alert, i) => {
                const as_ = alertStyle(alert.level);
                return (
                  <div key={i} className={`p-2.5 rounded-xl border ${as_.badge}`}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${as_.dot} ${alert.level === 'critical' ? 'animate-pulse' : ''}`} />
                      <span className={`text-[9px] uppercase tracking-widest font-bold ${as_.label}`}>{alert.level}</span>
                    </div>
                    <p className={`text-[11px] ${as_.text} leading-snug`}>{alert.message}</p>
                    {alert.action && <p className="text-[10px] text-slate-400 mt-0.5 italic">{alert.action}</p>}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span className="text-xs text-emerald-700 font-medium">Aucune alerte pour cette salle</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Chat Panel ────────────────────────────────────────────────────────────────

function ChatPanel({ selectedRoom }: { selectedRoom: string | null }) {
  const [messages,   setMessages]   = useState<ChatMessage[]>([]);
  const [input,      setInput]      = useState('');
  const [isLoading,  setIsLoading]  = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const SUGGESTIONS = [
    'Quelle salle a le meilleur confort ?',
    'Y a-t-il des alertes critiques ?',
    'Combien de salles sont occupées ?',
  ];

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: ChatMessage = { role: 'user', text: text.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    try {
      const result = await chatWithAgent(text.trim(), selectedRoom ?? undefined);
      setMessages(prev => [...prev, { role: 'agent', text: result.answer, timestamp: new Date() }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'agent',
        text: "Serveur inaccessible sur le port 8001.\n\nLancez :\nvenv_confort\\Scripts\\python.exe -m uvicorn main:app --port 8001",
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, selectedRoom]);

  return (
    <div className="rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col" style={{ height: '400px' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-sm shadow-violet-200">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">Interface Opérateur</p>
          <p className="text-[10px] text-violet-500 flex items-center gap-1 font-medium">
            <Sparkles className="w-2.5 h-2.5" />
            Mistral Large 2 — Langage naturel
            {selectedRoom && <span className="text-slate-400 ml-1">· Salle {selectedRoom}</span>}
          </p>
        </div>
        <span className="ml-auto flex items-center gap-1.5 text-[9px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> En ligne
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-violet-50 border border-violet-200 flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-violet-400" />
            </div>
            <div>
              <p className="text-slate-600 text-sm font-medium">Posez une question</p>
              <p className="text-slate-400 text-xs mt-1">L'agent répond en français sur l'état du bâtiment</p>
            </div>
            <div className="flex flex-col gap-1.5 w-full">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-left text-xs text-slate-600 bg-slate-50 hover:bg-violet-50 hover:text-violet-700 border border-slate-200 hover:border-violet-200 px-3 py-2 rounded-xl transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'agent' && (
              <div className="w-6 h-6 rounded-lg bg-violet-100 border border-violet-200 flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
                <Sparkles className="w-3 h-3 text-violet-500" />
              </div>
            )}
            <div className={`max-w-[82%] px-3 py-2.5 rounded-2xl text-xs leading-relaxed ${
              msg.role === 'user'
                ? 'bg-violet-500 text-white rounded-br-sm shadow-sm shadow-violet-200'
                : 'bg-slate-100 border border-slate-200 text-slate-700 rounded-bl-sm'
            }`}>
              {msg.text}
              <p className={`text-[9px] mt-1.5 text-right ${msg.role === 'user' ? 'text-violet-200' : 'text-slate-400'}`}>
                {msg.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="w-6 h-6 rounded-lg bg-violet-100 border border-violet-200 flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
              <Sparkles className="w-3 h-3 text-violet-500 animate-pulse" />
            </div>
            <div className="bg-slate-100 border border-slate-200 rounded-2xl rounded-bl-sm px-3 py-2.5 flex items-center gap-1.5">
              {[0, 1, 2].map(i => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-slate-100">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
            placeholder="Posez une question à Mistral Large 2…"
            disabled={isLoading}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100 transition-all disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0 disabled:opacity-40 hover:brightness-110 transition-all shadow-sm shadow-violet-200"
          >
            <Send className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ComfortView (main) ────────────────────────────────────────────────────────

export function ComfortView() {
  const [data,         setData]         = useState<AllComfortState | null>(null);
  const [isLoading,    setIsLoading]    = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [lastUpdate,   setLastUpdate]   = useState<Date | null>(null);
  const [showChat,     setShowChat]     = useState(false);
  const timerRef = useRef<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const result = await getAllComfort();
      setData(result);
      setLastUpdate(new Date());
    } catch {
      setError("Agent Confort inaccessible (port 8001). Lancez : uvicorn main:app --port 8001");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    timerRef.current = window.setInterval(fetchData, REFRESH_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchData]);

  const selectedState = data?.rooms.find(r => r.room === selectedRoom) ?? null;
  const summary       = data?.summary;

  const allAlerts: (ComfortAlert & { room: string })[] = (data?.rooms ?? []).flatMap(r =>
    (r.alerts ?? []).map(a => ({ ...a, room: r.room }))
  ).sort((a, b) => {
    const o: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    return (o[a.level] ?? 9) - (o[b.level] ?? 9);
  });

  const hvacOnCount = data?.rooms.filter(r => r.hvac?.hvac?.is_on).length ?? 0;
  const llmCount    = data?.rooms.filter(r => r.hvac?.decision_source === 'llm_mistral').length ?? 0;

  return (
    <div className="min-h-full bg-slate-50 p-8 space-y-6">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-md shadow-teal-200 flex-shrink-0">
              <Gauge className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Agent de Confort</h2>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-50 border border-violet-200 text-violet-600 text-xs font-semibold">
              <Sparkles className="w-3 h-3" /> Mistral Large 2
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1 pl-[52px]">
            <span className="text-slate-500 text-sm">IAQ · HVAC intelligent · RAG Qdrant</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-600 text-xs font-medium">
              <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-pulse" />
              Refresh 60 s
            </span>
            {lastUpdate && (
              <span className="text-slate-400 text-xs">
                MAJ : {lastUpdate.toLocaleTimeString('fr-FR')}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowChat(v => !v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm border font-medium transition-all ${
              showChat
                ? 'bg-violet-500 border-violet-500 text-white shadow-sm shadow-violet-200'
                : 'bg-white hover:bg-violet-50 text-slate-700 border-slate-200 hover:border-violet-200 hover:text-violet-600'
            }`}
          >
            <Bot className="w-4 h-4" />
            Chat IA
          </button>
          <button
            onClick={() => { setIsLoading(true); fetchData(); }}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-medium disabled:opacity-50 border border-slate-200 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Rafraîchir
          </button>
        </div>
      </div>

      {/* ── Error banner ─────────────────────────────────────────── */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-3 text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
          <div>
            <span className="font-semibold">Connexion échouée — </span>
            {error}
          </div>
        </div>
      )}

      {/* ── KPI Cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-4">
        {[
          {
            label:  'Score Bâtiment',
            value:  summary?.avg_comfort_score != null ? `${summary.avg_comfort_score}` : '—',
            unit:   '/ 100',
            icon:   Gauge,
            iconBg: 'bg-gradient-to-br from-teal-400 to-cyan-500',
            iconShadow: 'shadow-teal-100',
            highlight: 'text-teal-600',
          },
          {
            label:  'Salles Occupées',
            value:  summary?.occupied_rooms != null ? `${summary.occupied_rooms}` : '—',
            unit:   `/ ${summary?.total_rooms ?? '—'}`,
            icon:   Building2,
            iconBg: 'bg-gradient-to-br from-violet-400 to-purple-500',
            iconShadow: 'shadow-violet-100',
            highlight: 'text-violet-600',
          },
          {
            label:  'Alertes Critiques',
            value:  summary?.critical_alerts != null ? `${summary.critical_alerts}` : '—',
            unit:   'actives',
            icon:   AlertTriangle,
            iconBg: 'bg-gradient-to-br from-red-400 to-rose-500',
            iconShadow: 'shadow-red-100',
            highlight: 'text-red-600',
          },
          {
            label:  'HVAC Recommandés',
            value:  isLoading ? '…' : `${hvacOnCount}`,
            unit:   'salles',
            icon:   Wind,
            iconBg: 'bg-gradient-to-br from-sky-400 to-blue-500',
            iconShadow: 'shadow-sky-100',
            highlight: 'text-sky-600',
          },
          {
            label:  'Décisions Mistral',
            value:  isLoading ? '…' : `${llmCount}`,
            unit:   `/ ${summary?.total_rooms ?? '—'} salles`,
            icon:   Sparkles,
            iconBg: 'bg-gradient-to-br from-violet-400 to-indigo-500',
            iconShadow: 'shadow-violet-100',
            highlight: 'text-violet-600',
          },
        ].map((m, i) => {
          const Icon = m.icon;
          return (
            <div key={i} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200">
              <div className={`w-10 h-10 rounded-xl ${m.iconBg} flex items-center justify-center mb-3 shadow-sm ${m.iconShadow}`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-slate-500 text-xs mb-1 font-medium">{m.label}</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-slate-900">{isLoading ? '…' : m.value}</span>
                <span className="text-slate-400 text-xs">{m.unit}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Main area ───────────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-5">

        {/* Room heatmap */}
        <div className={`${showChat ? 'col-span-5' : 'col-span-8'} rounded-3xl p-6 bg-white border border-slate-200 shadow-sm`}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-semibold text-slate-800">Carte de Confort — Bâtiment</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Cliquez pour le détail · <Sparkles className="w-2.5 h-2.5 inline text-violet-400" /> = décision Mistral
              </p>
            </div>
            <div className="flex items-center gap-3">
              {[
                { color: 'bg-emerald-400', label: '≥ 80' },
                { color: 'bg-amber-400',   label: '60–79' },
                { color: 'bg-orange-400',  label: '40–59' },
                { color: 'bg-red-400',     label: '< 40' },
              ].map(({ color, label }) => (
                <span key={label} className="flex items-center gap-1.5 text-slate-500 text-xs">
                  <span className={`w-2 h-2 rounded-full ${color}`} />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {isLoading && !data ? (
            <div className={`grid ${showChat ? 'grid-cols-3' : 'grid-cols-4'} gap-3`}>
              {Array.from({ length: 13 }).map((_, i) => (
                <div key={i} className="h-28 rounded-2xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className={`grid ${showChat ? 'grid-cols-3' : 'grid-cols-4'} gap-3`}>
              {(data?.rooms ?? []).map(room => (
                <RoomCard
                  key={room.room}
                  state={room}
                  isSelected={selectedRoom === room.room}
                  onClick={() => setSelectedRoom(prev => prev === room.room ? null : room.room)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Alert feed */}
        <div className={`${showChat ? 'col-span-3' : 'col-span-4'} rounded-3xl p-5 bg-white border border-slate-200 shadow-sm flex flex-col`}>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-800">Alertes Actives</h3>
            {allAlerts.length > 0 && (
              <span className={`ml-auto text-xs font-bold text-white px-2 py-0.5 rounded-full ${
                allAlerts.some(a => a.level === 'critical') ? 'bg-red-500 animate-pulse' : 'bg-amber-400'
              }`}>
                {allAlerts.length}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-0.5" style={{ maxHeight: '420px' }}>
            {allAlerts.length === 0 && !isLoading ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-10 gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                  <Activity className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                  <p className="text-emerald-700 font-semibold text-sm">Tout est nominal</p>
                  <p className="text-slate-400 text-xs mt-1">Aucune alerte active</p>
                </div>
              </div>
            ) : (
              allAlerts.map((alert, i) => {
                const as_ = alertStyle(alert.level);
                return (
                  <div
                    key={i}
                    className={`rounded-2xl p-3 border ${as_.badge} cursor-pointer hover:brightness-95 transition-all`}
                    onClick={() => setSelectedRoom(alert.room)}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`w-2 h-2 mt-0.5 rounded-full flex-shrink-0 ${as_.dot} ${alert.level === 'critical' ? 'animate-pulse' : ''}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                          <span className={`text-[9px] uppercase tracking-widest font-bold ${as_.label}`}>{alert.level}</span>
                          <span className="text-[10px] text-slate-600 font-semibold">{alert.room}</span>
                        </div>
                        <p className={`text-xs ${as_.text} leading-snug`}>{alert.message}</p>
                        {alert.action && (
                          <p className="text-[10px] text-slate-400 mt-0.5 italic truncate">{alert.action}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Chat panel */}
        {showChat && (
          <div className="col-span-4">
            <ChatPanel selectedRoom={selectedRoom} />
          </div>
        )}
      </div>

      {/* ── Selected room detail ─────────────────────────────────── */}
      {selectedState && (
        <RoomDetailPanel state={selectedState} onClose={() => setSelectedRoom(null)} />
      )}

    </div>
  );
}
