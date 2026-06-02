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
  if (s < 0)  return { grad: 'from-zinc-800/60 to-zinc-900/60', border: 'border-zinc-700/30', text: 'text-zinc-500', ring: '#3f3f46', pulse: false };
  if (s >= 80) return { grad: 'from-emerald-950/70 to-green-950/60',  border: 'border-emerald-500/25', text: 'text-emerald-400', ring: '#10b981', pulse: false };
  if (s >= 60) return { grad: 'from-amber-950/70 to-yellow-950/60',   border: 'border-amber-500/25',   text: 'text-amber-400',   ring: '#f59e0b', pulse: false };
  if (s >= 40) return { grad: 'from-orange-950/70 to-red-950/50',     border: 'border-orange-500/25',  text: 'text-orange-400',  ring: '#f97316', pulse: false };
  return               { grad: 'from-red-950/80 to-rose-950/70',      border: 'border-red-500/35',     text: 'text-red-400',     ring: '#ef4444', pulse: true  };
}

function alertStyle(level: string) {
  if (level === 'critical') return { dot: 'bg-red-500',   badge: 'bg-red-500/10 border-red-500/30',   text: 'text-red-300',   label: 'text-red-400' };
  if (level === 'warning')  return { dot: 'bg-amber-400', badge: 'bg-amber-500/10 border-amber-500/30', text: 'text-amber-300', label: 'text-amber-400' };
  return                           { dot: 'bg-blue-400',  badge: 'bg-blue-500/10 border-blue-500/30',  text: 'text-blue-300',  label: 'text-blue-400' };
}

function dimBarColor(val: number) {
  if (val >= 80) return 'bg-emerald-500';
  if (val >= 60) return 'bg-amber-500';
  if (val >= 40) return 'bg-orange-500';
  return 'bg-red-500';
}

function dimTextColor(val: number) {
  if (val >= 80) return 'text-emerald-400';
  if (val >= 60) return 'text-amber-400';
  if (val >= 40) return 'text-orange-400';
  return 'text-red-400';
}

// ── LLM Source Badge ──────────────────────────────────────────────────────────

function LlmBadge({ source, confidence, modelUsed }: { source?: string; confidence?: number; modelUsed?: string }) {
  const isLlm = source === 'llm_mistral';
  if (!source) return null;
  const label = isLlm ? (modelUsed ?? 'Mistral AI') : 'Règles';
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-[9px] font-semibold ${
      isLlm
        ? 'bg-violet-500/10 border-violet-500/30 text-violet-300'
        : 'bg-zinc-700/40 border-zinc-600/30 text-zinc-500'
    }`}>
      {isLlm ? <Sparkles className="w-2.5 h-2.5" /> : <Shield className="w-2.5 h-2.5" />}
      {label}
      {isLlm && confidence != null && (
        <span className="ml-0.5 text-violet-400">{Math.round(confidence * 100)}%</span>
      )}
    </div>
  );
}

// ── ScoreRing ──────────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 72 }: { score: number | null; size?: number }) {
  const r   = (size - 12) / 2;
  const c   = 2 * Math.PI * r;
  const pct = score !== null ? (score / 100) * c : 0;
  const col = scoreStyle(score).ring;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={7} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={col} strokeWidth={7} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - pct}
          style={{ transition: 'stroke-dashoffset 1.3s cubic-bezier(.4,0,.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base font-bold text-white leading-none">
          {score !== null ? score : '—'}
        </span>
        <span className="text-[9px] text-zinc-500">/100</span>
      </div>
    </div>
  );
}

// ── HvacIcon ──────────────────────────────────────────────────────────────────

function HvacModeIcon({ mode }: { mode: string }) {
  if (mode.startsWith('cool'))   return <Snowflake className="w-3.5 h-3.5 text-sky-400" />;
  if (mode.startsWith('heat'))   return <Flame     className="w-3.5 h-3.5 text-orange-400" />;
  if (mode === 'ventilation')    return <Fan       className="w-3.5 h-3.5 text-blue-400 animate-spin" style={{ animationDuration: '4s' }} />;
  return                                <Wind      className="w-3.5 h-3.5 text-zinc-600" />;
}

// ── RoomCard ──────────────────────────────────────────────────────────────────

function RoomCard({
  state, isSelected, onClick,
}: { state: RoomComfortState; isSelected: boolean; onClick: () => void }) {
  const score        = state.comfort?.overall;
  const st           = scoreStyle(score);
  const hvac         = state.hvac;
  const occupied     = hvac?.occupied;
  const alertCount   = state.alerts?.length ?? 0;
  const critCount    = state.alerts?.filter(a => a.level === 'critical').length ?? 0;
  const isLlm        = hvac?.decision_source === 'llm_mistral';

  return (
    <button
      onClick={onClick}
      className={[
        'relative w-full rounded-2xl p-4 text-left overflow-hidden',
        `bg-gradient-to-br ${st.grad}`,
        `border ${isSelected ? 'border-white/30 ring-1 ring-white/15' : st.border}`,
        'backdrop-blur-xl hover:scale-[1.025] hover:border-white/20 transition-all duration-300',
        critCount > 0 ? 'shadow-lg shadow-red-500/10' : '',
      ].join(' ')}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${st.grad} opacity-40 blur-sm pointer-events-none`} />

      {/* Alert badge */}
      {alertCount > 0 && (
        <span className={`absolute top-2 right-2 z-10 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${critCount > 0 ? 'bg-red-500 text-white animate-pulse' : 'bg-amber-500 text-white'}`}>
          {alertCount}
        </span>
      )}

      {/* LLM sparkle */}
      {isLlm && (
        <span className="absolute top-2 left-2 z-10">
          <Sparkles className="w-2.5 h-2.5 text-violet-400" />
        </span>
      )}

      <div className="relative flex items-center gap-3">
        <ScoreRing score={score} size={60} />

        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm truncate">{state.room}</p>
          <p className={`text-xs font-medium ${st.text} truncate`}>{state.comfort?.label ?? 'N/A'}</p>

          <div className="flex items-center gap-1.5 mt-1.5">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${occupied ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
            <span className="text-[10px] text-zinc-500 truncate">
              {occupied ? 'Occupé' : state.reservation?.is_preheating ? '🔥 Préchauffe' : 'Vide'}
            </span>
          </div>

          {hvac?.hvac?.mode && hvac.hvac.mode !== 'off' && (
            <div className="flex items-center gap-1 mt-1">
              <HvacModeIcon mode={hvac.hvac.mode} />
              <span className="text-[10px] text-zinc-400">{hvac.total_kw?.toFixed(1)} kW est.</span>
            </div>
          )}
        </div>
      </div>

      {state.sensors?.temperature != null && (
        <div className="relative mt-2.5 pt-2 border-t border-white/5 flex items-center gap-2 flex-wrap">
          <Thermometer className="w-3 h-3 text-zinc-600 flex-shrink-0" />
          <span className="text-[10px] text-zinc-400">{state.sensors.temperature.toFixed(1)}°C</span>
          {state.sensors.co2 != null && (
            <>
              <span className="text-zinc-700">·</span>
              <Wind className="w-3 h-3 text-zinc-600 flex-shrink-0" />
              <span className="text-[10px] text-zinc-400">{state.sensors.co2.toFixed(0)} ppm</span>
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
    { key: 'temperature', label: 'Température', unit: '°C',  icon: Thermometer, color: 'text-orange-400', digits: 1 },
    { key: 'humidity',    label: 'Humidité',    unit: '%',   icon: Droplets,    color: 'text-blue-400',   digits: 0 },
    { key: 'co2',         label: 'CO₂',         unit: ' ppm',icon: Wind,        color: 'text-green-400',  digits: 0 },
    { key: 'luminosity',  label: 'Luminosité',  unit: ' lux',icon: Sun,         color: 'text-yellow-400', digits: 0 },
    { key: 'occupancy',   label: 'Occupancy',   unit: '',    icon: Users,       color: 'text-purple-400', digits: 0 },
  ] as const;

  const DIMS = [
    { key: 'temperature', label: 'Température', icon: Thermometer },
    { key: 'humidity',    label: 'Humidité',    icon: Droplets    },
    { key: 'co2',         label: 'CO₂',         icon: Wind        },
    { key: 'luminosity',  label: 'Luminosité',  icon: Sun         },
  ] as const;

  const isLlm = hvac?.decision_source === 'llm_mistral';

  return (
    <div className={`rounded-3xl p-6 bg-gradient-to-br from-zinc-900/95 to-zinc-950/95 border ${st.border} backdrop-blur-2xl shadow-2xl`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <ScoreRing score={score} size={76} />
          <div>
            <h3 className="text-xl font-bold text-white">{state.room}</h3>
            <p className={`text-sm font-medium ${st.text}`}>{state.comfort?.label ?? 'Données insuffisantes'}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {state.profile?.type && (
                <span className="text-[10px] text-zinc-400 bg-zinc-800/60 px-2 py-0.5 rounded-full border border-zinc-700/30 capitalize">
                  {state.profile.type.replace(/_/g, ' ')}
                </span>
              )}
              {state.profile?.priority === 'high' && (
                <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                  Priorité haute
                </span>
              )}
              <span className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                hvac?.occupied
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                  : hvac?.is_preheating
                  ? 'text-orange-400 bg-orange-500/10 border-orange-500/20'
                  : 'text-zinc-500 bg-zinc-800/40 border-zinc-700/20'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${hvac?.occupied ? 'bg-emerald-400 animate-pulse' : hvac?.is_preheating ? 'bg-orange-400' : 'bg-zinc-600'}`} />
                {hvac?.occupied ? 'Occupé' : hvac?.is_preheating ? 'Préchauffage' : 'Vide'}
              </span>
              <LlmBadge source={hvac?.decision_source} confidence={hvac?.confidence} modelUsed={hvac?.model_used} />
            </div>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-xl text-zinc-500 hover:text-white hover:bg-zinc-800/60 transition-all">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Capteurs */}
        <div className="space-y-2">
          <h4 className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-medium mb-3 flex items-center gap-1.5">
            <Activity className="w-3 h-3" /> Capteurs
          </h4>
          {SENSORS.map(({ key, label, unit, icon: Icon, color, digits }) => {
            const val = state.sensors?.[key as keyof typeof state.sensors];
            return (
              <div key={key} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-zinc-800/40 border border-zinc-700/20">
                <div className="flex items-center gap-2">
                  <Icon className={`w-3.5 h-3.5 ${val != null ? color : 'text-zinc-700'}`} />
                  <span className="text-xs text-zinc-400">{label}</span>
                </div>
                <span className={`text-sm font-semibold ${val != null ? 'text-white' : 'text-zinc-700'}`}>
                  {val != null ? `${Number(val).toFixed(digits)}${unit}` : '—'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Dimensions + HVAC */}
        <div className="space-y-2.5">
          <h4 className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-medium mb-3 flex items-center gap-1.5">
            <Gauge className="w-3 h-3" /> Dimensions de Confort
          </h4>
          {DIMS.map(({ key, label, icon: Icon }) => {
            const val = dims[key as keyof typeof dims];
            if (val === undefined) return null;
            return (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    <Icon className="w-3 h-3" />
                    {label}
                  </div>
                  <span className={`font-semibold ${dimTextColor(val)}`}>{val}</span>
                </div>
                <div className="h-1.5 bg-zinc-800/70 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-1000 ${dimBarColor(val)}`} style={{ width: `${val}%` }} />
                </div>
              </div>
            );
          })}

          {/* HVAC state */}
          <div className="mt-4 p-3.5 rounded-xl bg-zinc-800/40 border border-zinc-700/20 space-y-2">
            <h5 className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-1.5">
              <Zap className="w-2.5 h-2.5" /> Préconisation HVAC
              <span className="ml-auto text-[8px] px-1.5 py-0.5 rounded bg-zinc-700/60 text-zinc-500 normal-case tracking-normal">Simulation</span>
            </h5>
            <div className="flex items-center gap-2">
              {hvac?.hvac && <HvacModeIcon mode={hvac.hvac.mode} />}
              <span className="text-sm text-white capitalize">{hvac?.hvac?.mode ?? 'off'}</span>
              {(hvac?.hvac?.power_kw ?? 0) > 0 && (
                <span className="text-xs text-zinc-400 ml-auto">{hvac.hvac.power_kw.toFixed(2)} kW est.</span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {hvac?.ventilation?.is_on && (
                <span className={`text-[9px] px-2 py-0.5 rounded-full border ${hvac.ventilation.boost ? 'bg-blue-500/15 border-blue-500/30 text-blue-400' : 'bg-zinc-800/50 border-zinc-700/25 text-zinc-400'}`}>
                  💨 {hvac.ventilation.boost ? 'Ventil. boostée' : 'Ventil. recommandée'}
                </span>
              )}
              {hvac?.lighting?.is_on && (
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/25 text-yellow-400">
                  💡 Éclairage
                </span>
              )}
              {hvac?.projector?.is_on && (
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-indigo-400">
                  📽 Projecteur
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500">
              Consommation estimée : <span className="text-zinc-300 font-medium">{hvac?.total_kw?.toFixed(2) ?? '0.00'} kW</span>
            </p>
          </div>
        </div>

        {/* IA explanation + alerts */}
        <div className="space-y-3">
          <h4 className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-medium mb-3 flex items-center gap-1.5">
            <Brain className="w-3 h-3" /> Décision IA
          </h4>

          {/* LLM explanation box */}
          <div className={`p-3.5 rounded-xl border space-y-2.5 ${
            isLlm
              ? 'bg-gradient-to-br from-violet-950/40 to-purple-950/30 border-violet-500/20'
              : 'bg-gradient-to-br from-zinc-800/40 to-zinc-900/40 border-zinc-700/20'
          }`}>
            <div className="flex items-center gap-2">
              {isLlm
                ? <Sparkles className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
                : <Shield className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
              }
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${isLlm ? 'text-violet-400' : 'text-zinc-500'}`}>
                {isLlm ? (hvac?.model_used ?? 'Mistral AI') : 'Règles déterministes'}
              </span>
              {isLlm && hvac?.confidence != null && (
                <span className="ml-auto text-[10px] text-violet-300 font-medium">
                  Confiance : {Math.round(hvac.confidence * 100)}%
                </span>
              )}
            </div>
            {isLlm && hvac?.confidence != null && (
              <div className="h-1 bg-zinc-800/70 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-400 transition-all duration-1000"
                  style={{ width: `${Math.round((hvac.confidence ?? 0) * 100)}%` }}
                />
              </div>
            )}
            <p className="text-xs text-zinc-300 leading-relaxed">
              {hvac?.explanation ?? 'Aucune explication disponible.'}
            </p>
          </div>

          {/* Room alerts */}
          {state.alerts && state.alerts.length > 0 ? (
            <div className="space-y-1.5">
              <h5 className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 flex items-center gap-1">
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
                    {alert.action && <p className="text-[10px] text-zinc-600 mt-0.5 italic">{alert.action}</p>}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/8 border border-emerald-500/15">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span className="text-xs text-emerald-400">Aucune alerte pour cette salle</span>
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
    <div className="rounded-3xl bg-gradient-to-br from-zinc-900/90 to-zinc-950/90 border border-white/8 backdrop-blur-2xl shadow-xl flex flex-col" style={{ height: '400px' }}>
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/6">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Interface Opérateur</p>
          <p className="text-[10px] text-violet-400 flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5" />
            Mistral Large 2 — Langage naturel
            {selectedRoom && <span className="text-zinc-500 ml-1">· Salle {selectedRoom}</span>}
          </p>
        </div>
        <span className="ml-auto flex items-center gap-1.5 text-[9px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> En ligne
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-violet-400" />
            </div>
            <div>
              <p className="text-zinc-400 text-sm font-medium">Posez une question</p>
              <p className="text-zinc-600 text-xs mt-1">L'agent répond en français sur l'état du bâtiment</p>
            </div>
            <div className="flex flex-col gap-1.5 w-full">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-left text-xs text-zinc-400 bg-zinc-800/40 hover:bg-zinc-700/40 border border-zinc-700/30 px-3 py-2 rounded-xl transition-all"
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
              <div className="w-6 h-6 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
                <Sparkles className="w-3 h-3 text-violet-400" />
              </div>
            )}
            <div className={`max-w-[82%] px-3 py-2.5 rounded-2xl text-xs leading-relaxed ${
              msg.role === 'user'
                ? 'bg-violet-500/20 border border-violet-500/25 text-white rounded-br-sm'
                : 'bg-zinc-800/50 border border-zinc-700/25 text-zinc-200 rounded-bl-sm'
            }`}>
              {msg.text}
              <p className="text-[9px] text-zinc-600 mt-1.5 text-right">
                {msg.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="w-6 h-6 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
              <Sparkles className="w-3 h-3 text-violet-400 animate-pulse" />
            </div>
            <div className="bg-zinc-800/50 border border-zinc-700/25 rounded-2xl rounded-bl-sm px-3 py-2.5 flex items-center gap-1.5">
              {[0, 1, 2].map(i => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-white/6">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
            placeholder="Posez une question au Mistral Large 2…"
            disabled={isLoading}
            className="flex-1 bg-zinc-800/50 border border-zinc-700/30 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 focus:bg-zinc-800/70 transition-all disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0 disabled:opacity-40 hover:brightness-110 transition-all shadow-lg shadow-violet-500/20"
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
    <div className="soft-page min-h-full p-8 space-y-6 relative overflow-hidden">
      {/* Ambient glows */}
      <div className="absolute top-0 right-0 w-[650px] h-[650px] bg-gradient-to-br from-teal-500/5 via-cyan-500/4 to-blue-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-20 w-[400px] h-[400px] bg-gradient-to-tr from-violet-500/4 to-purple-500/3 rounded-full blur-3xl pointer-events-none" />

      <div className="soft-page p-8 space-y-6 relative">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-teal-500/30 flex-shrink-0">
                <Gauge className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-white">Agent de Confort</h2>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-300 text-xs font-medium">
                <Sparkles className="w-3 h-3" /> Mistral Large 2
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 mt-1 pl-14">
              <span className="text-zinc-400 text-sm">IAQ · HVAC intelligent · RAG Qdrant</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-500/15 border border-teal-500/30 text-teal-400 text-xs">
                <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-pulse" />
                Refresh 60 s
              </span>
              {lastUpdate && (
                <span className="text-zinc-500 text-xs">
                  MAJ : {lastUpdate.toLocaleTimeString('fr-FR')}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Chat toggle */}
            <button
              onClick={() => setShowChat(v => !v)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm border transition-all ${
                showChat
                  ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                  : 'bg-zinc-800/60 hover:bg-zinc-700/60 text-white border-zinc-700/30'
              }`}
            >
              <Bot className="w-4 h-4" />
              Chat IA
            </button>
            <button
              onClick={() => { setIsLoading(true); fetchData(); }}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800/60 hover:bg-zinc-700/60 text-white rounded-xl text-sm disabled:opacity-50 border border-zinc-700/30 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Rafraîchir
            </button>
          </div>
        </div>

        {/* ── Error banner ─────────────────────────────────────────── */}
        {error && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-start gap-3 text-sm">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
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
              grad:   'from-teal-400 via-cyan-500 to-blue-600',
              bgGrad: 'from-teal-500/15 via-cyan-500/12 to-blue-600/15',
            },
            {
              label:  'Salles Occupées',
              value:  summary?.occupied_rooms != null ? `${summary.occupied_rooms}` : '—',
              unit:   `/ ${summary?.total_rooms ?? '—'}`,
              icon:   Building2,
              grad:   'from-violet-400 via-purple-500 to-fuchsia-600',
              bgGrad: 'from-violet-500/15 via-purple-500/12 to-fuchsia-600/15',
            },
            {
              label:  'Alertes Critiques',
              value:  summary?.critical_alerts != null ? `${summary.critical_alerts}` : '—',
              unit:   'actives',
              icon:   AlertTriangle,
              grad:   'from-red-400 via-rose-500 to-pink-600',
              bgGrad: 'from-red-500/15 via-rose-500/12 to-pink-600/15',
            },
            {
              label:  'HVAC Recommandés',
              value:  isLoading ? '…' : `${hvacOnCount}`,
              unit:   'salles',
              icon:   Wind,
              grad:   'from-sky-400 via-blue-500 to-indigo-600',
              bgGrad: 'from-sky-500/15 via-blue-500/12 to-indigo-600/15',
            },
            {
              label:  'Décisions Mistral',
              value:  isLoading ? '…' : `${llmCount}`,
              unit:   `/ ${summary?.total_rooms ?? '—'} salles`,
              icon:   Sparkles,
              grad:   'from-violet-400 via-purple-500 to-indigo-500',
              bgGrad: 'from-violet-500/15 via-purple-500/12 to-indigo-500/15',
            },
          ].map((m, i) => {
            const Icon = m.icon;
            return (
              <div key={i} className={`relative overflow-hidden rounded-3xl p-5 bg-gradient-to-br ${m.bgGrad} border border-white/8 backdrop-blur-2xl hover:scale-[1.03] transition-all duration-300`}>
                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${m.grad} opacity-15 rounded-full blur-2xl pointer-events-none`} />
                <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${m.grad} flex items-center justify-center mb-3 shadow-lg`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <p className="text-zinc-400 text-xs mb-1">{m.label}</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-white">{isLoading ? '…' : m.value}</span>
                  <span className="text-zinc-500 text-xs">{m.unit}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Main area ───────────────────────────────────────────── */}
        <div className={`grid gap-5 ${showChat ? 'grid-cols-12' : 'grid-cols-12'}`}>

          {/* Room heatmap */}
          <div className={`${showChat ? 'col-span-5' : 'col-span-8'} rounded-3xl p-6 bg-gradient-to-br from-zinc-900/85 to-zinc-950/85 border border-white/8 backdrop-blur-2xl shadow-xl`}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-semibold text-white">Carte de Confort — Bâtiment</h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Cliquez pour le détail · <Sparkles className="w-2.5 h-2.5 inline text-violet-400" /> = décision Mistral
                </p>
              </div>
              <div className="flex items-center gap-3">
                {[
                  { color: 'bg-emerald-500', label: '≥ 80' },
                  { color: 'bg-amber-500',   label: '60–79' },
                  { color: 'bg-orange-500',  label: '40–59' },
                  { color: 'bg-red-500',     label: '< 40' },
                ].map(({ color, label }) => (
                  <span key={label} className="flex items-center gap-1.5 text-zinc-400 text-xs">
                    <span className={`w-2 h-2 rounded-full ${color}`} />
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {isLoading && !data ? (
              <div className={`grid ${showChat ? 'grid-cols-3' : 'grid-cols-4'} gap-3`}>
                {Array.from({ length: 13 }).map((_, i) => (
                  <div key={i} className="h-28 rounded-2xl bg-zinc-800/40 animate-pulse" />
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
          <div className={`${showChat ? 'col-span-3' : 'col-span-4'} rounded-3xl p-5 bg-gradient-to-br from-zinc-900/85 to-zinc-950/85 border border-white/8 backdrop-blur-2xl shadow-xl flex flex-col`}>
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-white">Alertes Actives</h3>
              {allAlerts.length > 0 && (
                <span className={`ml-auto text-xs font-bold text-white px-2 py-0.5 rounded-full ${
                  allAlerts.some(a => a.level === 'critical') ? 'bg-red-500 animate-pulse' : 'bg-amber-500'
                }`}>
                  {allAlerts.length}
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-0.5" style={{ maxHeight: '420px' }}>
              {allAlerts.length === 0 && !isLoading ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-10 gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <Activity className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-emerald-400 font-medium text-sm">Tout est nominal</p>
                    <p className="text-zinc-600 text-xs mt-1">Aucune alerte active</p>
                  </div>
                </div>
              ) : (
                allAlerts.map((alert, i) => {
                  const as_ = alertStyle(alert.level);
                  return (
                    <div
                      key={i}
                      className={`rounded-2xl p-3 border ${as_.badge} cursor-pointer hover:brightness-110 transition-all`}
                      onClick={() => setSelectedRoom(alert.room)}
                    >
                      <div className="flex items-start gap-2">
                        <span className={`w-2 h-2 mt-0.5 rounded-full flex-shrink-0 ${as_.dot} ${alert.level === 'critical' ? 'animate-pulse' : ''}`} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                            <span className={`text-[9px] uppercase tracking-widest font-bold ${as_.label}`}>{alert.level}</span>
                            <span className="text-[10px] text-zinc-400 font-semibold">{alert.room}</span>
                          </div>
                          <p className={`text-xs ${as_.text} leading-snug`}>{alert.message}</p>
                          {alert.action && (
                            <p className="text-[10px] text-zinc-600 mt-0.5 italic truncate">{alert.action}</p>
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
    </div>
  );
}
