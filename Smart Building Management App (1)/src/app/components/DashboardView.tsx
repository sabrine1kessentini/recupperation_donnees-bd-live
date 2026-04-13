import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, Bell, Blinds, CalendarClock, Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, Droplets, Lightbulb, Lock, Snowflake, Square, Sun, Thermometer, Wind } from 'lucide-react';

type WeatherData = {
  temperature: number;
  humidity: number;
  weatherCode: number;
  windSpeed: number;
  locationLabel: string;
  observedAt: string;
};

export function DashboardView() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState(true);

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

        const response = await fetch(`${API_URL}/api/weather`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Weather API returned ${response.status}`);
        }

        const payload: WeatherData = await response.json();
        if (isMounted) {
          setWeather(payload);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        if (isMounted) {
          setWeatherError('Meteo indisponible');
        }
      } finally {
        if (isMounted) {
          setIsWeatherLoading(false);
        }
      }
    };

    fetchWeather();
    const intervalId = window.setInterval(fetchWeather, 60 * 1000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      controller?.abort();
    };
  }, []);

  const weatherIcon = useMemo(() => {
    if (!weather) {
      return <CloudRain className="w-20 h-20 text-[#6799ce]" />;
    }

    const code = weather.weatherCode;

    // Mapping based on Open-Meteo weather codes
    if (code === 0) {
      return <Sun className="w-20 h-20 text-[#f4b400]" />;
    }
    if (code === 1 || code === 2 || code === 3) {
      return <Cloud className="w-20 h-20 text-[#8da2b8]" />;
    }
    if (code === 45 || code === 48) {
      return <CloudFog className="w-20 h-20 text-[#9aa7b7]" />;
    }
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
      return <CloudRain className="w-20 h-20 text-[#6799ce]" />;
    }
    if (code >= 71 && code <= 77) {
      return <CloudSnow className="w-20 h-20 text-[#7fa3c7]" />;
    }
    if (code >= 95 && code <= 99) {
      return <CloudLightning className="w-20 h-20 text-[#f4b400]" />;
    }
    return <CloudRain className="w-20 h-20 text-[#6799ce]" />;
  }, [weather]);

  const weatherConditionLabel = useMemo(() => {
    if (!weather) {
      return 'Meteo';
    }

    const code = weather.weatherCode;
    if (code === 0) return 'Ensoleille';
    if (code === 1 || code === 2) return 'Partiellement nuageux';
    if (code === 3) return 'Nuageux';
    if (code === 45 || code === 48) return 'Brouillard';
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'Pluie';
    if (code >= 71 && code <= 77) return 'Neige';
    if (code >= 95 && code <= 99) return 'Orage';
    return 'Meteo variable';
  }, [weather]);

  const displayedDate = useMemo(() => {
    const dateSource = weather?.observedAt ? new Date(weather.observedAt) : new Date();
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(dateSource);
  }, [weather?.observedAt]);

  const displayedTime = useMemo(() => {
    const dateSource = weather?.observedAt ? new Date(weather.observedAt) : new Date();
    return new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(dateSource);
  }, [weather?.observedAt]);

  const temperatureLabel = isWeatherLoading
    ? '-- C'
    : weather
      ? `${Math.round(weather.temperature)} C`
      : '-- C';

  const humidityLabel = isWeatherLoading
    ? '--%'
    : weather
      ? `${Math.round(weather.humidity)}%`
      : '--%';

  return (
    <div className="min-h-full p-5 bg-[radial-gradient(circle_at_0%_0%,#f6f7f8_0,#e9ecef_45%,#e2e8ec_100%)]">
        <header className="flex items-center justify-between rounded-3xl bg-[#d6d1cb]/65 px-6 py-4 mb-6">
          <h1 className="text-2xl font-semibold text-zinc-700">Welcome, Albert</h1>
          <div className="flex items-center gap-3">
            <div className="w-72 rounded-full bg-white/70 px-4 py-2 text-sm text-zinc-500">
              Search any devices here
            </div>
            <button className="rounded-full bg-white/80 p-2 text-[#f4b400]">
              <Sun className="w-4 h-4" />
            </button>
            <button className="rounded-full bg-white/80 p-2 text-zinc-500">
              <Bell className="w-4 h-4" />
            </button>
          </div>
        </header>

        <section className="grid grid-cols-12 gap-4">
          <article className="col-span-4 rounded-3xl bg-[#efe1bc] p-5">
            <p className="text-sm text-zinc-600">{displayedDate}</p>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <p className="text-5xl font-semibold text-zinc-800">{displayedTime}</p>
                <p className="text-zinc-700 mt-2">{temperatureLabel}</p>
                <p className="text-sm text-zinc-600 mt-1">{weather?.locationLabel ?? 'Localisation batiment'}</p>
                {weatherError && <p className="text-xs text-red-600 mt-1">{weatherError}</p>}
              </div>
              {weatherIcon}
            </div>
            <div className="mt-4 rounded-2xl bg-white/55 px-3 py-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-zinc-700">{weatherConditionLabel}</p>
                <p className="text-xs text-zinc-600">Temps reel</p>
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs text-zinc-700">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-1">
                  <Droplets className="h-3.5 w-3.5 text-[#5f84ff]" />
                  {humidityLabel}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-1">
                  <Wind className="h-3.5 w-3.5 text-zinc-600" />
                  {weather ? `${Math.round(weather.windSpeed)} km/h` : '-- km/h'}
                </span>
              </div>
            </div>
          </article>

          <article className="col-span-3 rounded-3xl bg-white/75 p-5">
            <div className="flex items-center gap-2 text-zinc-700">
              <Droplets className="w-4 h-4 text-[#5f84ff]" />
              <h3 className="font-semibold">Humidity</h3>
            </div>
            <div className="mt-8 flex items-center gap-4">
              <div className="size-16 rounded-full border-[7px] border-[#7f97f9] border-r-[#e8ecff]" />
              <p className="text-4xl text-zinc-700 font-semibold">{humidityLabel}</p>
            </div>
          </article>

          <article className="col-span-5 rounded-3xl bg-white/75 p-5">
            <div className="flex items-center gap-3 text-zinc-700 mb-2">
              <CalendarClock className="w-5 h-5 text-[#f4b400]" />
              <h3 className="font-semibold">Prochaine reunion</h3>
            </div>
            <div className="mt-4 rounded-2xl bg-[#efe7d4] px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-500">Date</p>
                <p className="text-lg font-semibold text-zinc-700">12 Avril 2026</p>
              </div>
              <div className="w-px h-10 bg-zinc-300/70" />
              <div>
                <p className="text-sm text-zinc-500">Heure</p>
                <p className="text-lg font-semibold text-zinc-700">10:30</p>
              </div>
              <button className="px-3 py-2 rounded-xl bg-[#f4b400] text-white text-sm">Voir details</button>
            </div>
          </article>

          <article className="col-span-12 rounded-2xl bg-white/80 border border-white/90 px-5 py-3 shadow-sm">
            <p className="text-[13px] md:text-sm font-medium tracking-[0.01em] text-zinc-600">
              Mode automatique activé pour votre confort — ajustez librement si besoin
            </p>
          </article>

          <article className="col-span-2 rounded-3xl bg-[#efe7d4] p-4">
            <h4 className="font-semibold text-zinc-700">Smart Light</h4>
            <Lightbulb className="w-12 h-12 text-zinc-300 mt-4" />
          </article>
          <article className="col-span-2 rounded-3xl bg-[#efe7d4] p-4">
            <h4 className="font-semibold text-zinc-700">Air Conditioner</h4>
            <Snowflake className="w-12 h-12 text-zinc-300 mt-4" />
          </article>
          <article className="col-span-2 rounded-3xl bg-[#efe7d4] p-4">
            <h4 className="font-semibold text-zinc-700">Door Lock</h4>
            <Lock className="w-12 h-12 text-zinc-500 mt-4" />
          </article>
          <article className="col-span-2 rounded-3xl bg-[#efe7d4] p-4">
            <div className="flex items-center gap-2">
              <Blinds className="w-5 h-5 text-zinc-600" />
              <h4 className="font-semibold text-zinc-700">Volet Roulant</h4>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <button className="size-9 rounded-xl bg-white/80 border border-white text-zinc-600 hover:text-zinc-800">
                <ArrowUp className="w-4 h-4 mx-auto" />
              </button>
              <button className="size-9 rounded-xl bg-white/80 border border-white text-zinc-600 hover:text-zinc-800">
                <Square className="w-4 h-4 mx-auto" />
              </button>
              <button className="size-9 rounded-xl bg-white/80 border border-white text-zinc-600 hover:text-zinc-800">
                <ArrowDown className="w-4 h-4 mx-auto" />
              </button>
            </div>
          </article>
          <article className="col-span-2 rounded-3xl bg-[#efe7d4] p-4">
            <h4 className="font-semibold text-zinc-700">Ventilation</h4>
            <div className="mt-4 flex items-center justify-between">
              <Wind className="w-10 h-10 text-zinc-500" />
              <span className="px-3 py-1 rounded-full bg-[#f4b400] text-white text-xs">Auto</span>
            </div>
          </article>

          <article className="col-span-4 row-span-2 rounded-3xl bg-white/75 p-5">
            <h3 className="font-semibold text-zinc-700 mb-3">Smart Lighting</h3>
            <div className="flex gap-2 text-xs mb-6">
              <span className="px-3 py-1 rounded-full bg-zinc-100 text-zinc-600">13 watt</span>
              <span className="px-3 py-1 rounded-full bg-zinc-100 text-zinc-600">17 watt</span>
              <span className="px-3 py-1 rounded-full bg-[#f4b400] text-white">21 watt</span>
            </div>
            <div className="mx-auto size-40 rounded-full border-[12px] border-[#f4b400] border-l-[#e6eaee] border-b-[#e6eaee] grid place-items-center">
              <div className="text-center">
                <p className="text-4xl font-semibold text-zinc-700">80%</p>
                <p className="text-xs text-zinc-500">Intensity</p>
              </div>
            </div>
          </article>

          <article className="col-span-4 row-span-2 rounded-3xl bg-white/75 p-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-zinc-700">Thermostat</h3>
              <span className="text-3xl font-semibold text-zinc-700">25</span>
            </div>
            <div className="mx-auto size-40 rounded-full border-[12px] border-[#f4b400] border-l-[#e6eaee] border-b-[#e6eaee] grid place-items-center">
              <Thermometer className="w-9 h-9 text-zinc-500" />
            </div>
            <p className="mt-6 text-zinc-600">600 W</p>
          </article>

          <article className="col-span-4 row-span-2 rounded-3xl bg-white/75 p-5">
            <div className="flex items-center gap-2 mb-5">
              <AlertTriangle className="w-5 h-5 text-[#f4b400]" />
              <h3 className="font-semibold text-zinc-700">Signaler un probleme</h3>
            </div>

            <div className="space-y-3">
              <button className="w-full text-left px-4 py-3 rounded-2xl bg-[#efe7d4] hover:bg-[#e8ddc4] text-zinc-700 transition-colors">
                Climatisation en panne
              </button>
              <button className="w-full text-left px-4 py-3 rounded-2xl bg-[#efe7d4] hover:bg-[#e8ddc4] text-zinc-700 transition-colors">
                Eclairage defectueux
              </button>
              <button className="w-full text-left px-4 py-3 rounded-2xl bg-[#efe7d4] hover:bg-[#e8ddc4] text-zinc-700 transition-colors">
                Thermostat instable
              </button>
              <button className="w-full text-left px-4 py-3 rounded-2xl bg-[#efe7d4] hover:bg-[#e8ddc4] text-zinc-700 transition-colors">
                Ventilation bruyante
              </button>
            </div>

            <button className="mt-6 w-full py-3 rounded-2xl bg-[#f4b400] text-white hover:bg-[#e2a800] transition-colors">
              Envoyer un signalement
            </button>
          </article>
        </section>
    </div>
  );
}
