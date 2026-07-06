/**
 * Väder-modul: kopplar partikelfältet till det verkliga vädret i Stockholm
 * (open-meteo, CORS-öppet och nyckelfritt) och skriver en väderrad i footerns
 * [data-weather]-slot. Kp-index från NOAA ger norrskensvarning. Allt failar tyst.
 */
import type { FeatureContext } from "../app/contracts";

const METEO_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=59.33&longitude=18.07&current=temperature_2m,precipitation,wind_speed_10m,wind_direction_10m,cloud_cover,weather_code&wind_speed_unit=ms";
const KP_URL = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json";
const CACHE_KEY = "pf-weather";
const CACHE_MS = 30 * 60 * 1000;

interface WeatherData {
  ws: number;
  wd: number;
  precip: number;
  tcc: number;
  temp: number;
  symbol: number;
}

interface CacheEntry {
  ts: number;
  weather: WeatherData;
  kp: number | null;
}

export function initWeather(ctx: FeatureContext): void {
  let current: { weather: WeatherData; kp: number | null } | null = null;

  const renderSlot = (): void => {
    if (!current) return;
    const slot = document.querySelector<HTMLElement>("[data-weather]");
    if (!slot) return;
    slot.textContent = describe(ctx, current.weather, current.kp);
  };

  // språkbyte bygger om DOM:en i main — fyll den nya sloten igen
  ctx.bus.on("lang", renderSlot);

  const apply = (weather: WeatherData, kp: number | null): void => {
    current = { weather, kp };
    // markera att riktigt väder styr fältet — december-egget backar då
    document.documentElement.dataset.weatherLive = "1";
    // wd anger varifrån vinden blåser — fältet ska driva dit den blåser
    const rad = ((weather.wd + 180) * Math.PI) / 180;
    const strength = Math.min(weather.ws, 15) / 15;
    const still = ctx.engine.reducedMotion;
    ctx.engine.setWeather({
      windX: still ? 0 : Math.sin(rad) * strength,
      windY: 0,
      drift: still || weather.precip <= 0 ? 0 : Math.min(1, weather.precip / 2),
      dim: (weather.tcc / 100) * 0.35,
    });
    renderSlot();
  };

  void (async () => {
    try {
      const cached = readCache();
      if (cached) {
        apply(cached.weather, cached.kp);
        return;
      }
      const [weather, kp] = await Promise.all([fetchWeather(), fetchKp()]);
      if (!weather) return;
      writeCache({ ts: Date.now(), weather, kp });
      apply(weather, kp);
    } catch {
      // tyst — sloten förblir tom
    }
  })();
}

// ---------- presentation ----------

function describe(ctx: FeatureContext, w: WeatherData, kp: number | null): string {
  const idx = Math.round((((w.wd % 360) + 360) % 360) / 45) % 8;
  const dirSv = ["N", "NO", "O", "SO", "S", "SV", "V", "NV"][idx];
  const dirEn = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][idx];
  const word = weatherWord(w.symbol);
  const ws = Math.round(w.ws);
  const temp = Math.round(w.temp);
  let text = ctx.t({
    sv: `Just nu i Stockholm: ${ws} m/s ${dirSv}, ${word.sv}, ${temp}°`,
    en: `Right now in Stockholm: ${ws} m/s ${dirEn}, ${word.en}, ${temp}°`,
  });
  if (kp !== null && kp >= 5) {
    const kpStr = String(Math.round(kp * 10) / 10);
    text += ctx.t({
      sv: ` · Kp ${kpStr} — norrsken möjligt`,
      en: ` · Kp ${kpStr} — aurora possible`,
    });
  }
  return text;
}

/** WMO weather code (open-meteo) → kort väderord. */
function weatherWord(code: number): { sv: string; en: string } {
  if (!Number.isFinite(code) || code < 0) return { sv: "väder", en: "weather" };
  if (code === 0) return { sv: "klart", en: "clear" };
  if (code <= 2) return { sv: "halvklart", en: "partly cloudy" };
  if (code === 3) return { sv: "molnigt", en: "cloudy" };
  if (code <= 48) return { sv: "dimma", en: "fog" };
  if (code <= 57) return { sv: "duggregn", en: "drizzle" };
  if (code <= 67) return { sv: "regn", en: "rain" };
  if (code <= 77) return { sv: "snö", en: "snow" };
  if (code <= 82) return { sv: "regnskurar", en: "showers" };
  if (code <= 86) return { sv: "snöbyar", en: "snow showers" };
  if (code <= 99) return { sv: "åska", en: "thunder" };
  return { sv: "väder", en: "weather" };
}

// ---------- hämtning ----------

interface MeteoResponse {
  current?: {
    temperature_2m?: number;
    precipitation?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
    cloud_cover?: number;
    weather_code?: number;
  };
}

async function fetchWeather(): Promise<WeatherData | null> {
  try {
    const res = await fetch(METEO_URL);
    if (!res.ok) return null;
    const data = (await res.json()) as MeteoResponse;
    const c = data.current;
    if (!c) return null;
    const num = (v: number | undefined): number | undefined =>
      typeof v === "number" && Number.isFinite(v) ? v : undefined;
    const ws = num(c.wind_speed_10m);
    const wd = num(c.wind_direction_10m);
    const temp = num(c.temperature_2m);
    if (ws === undefined || wd === undefined || temp === undefined) return null;
    return {
      ws,
      wd,
      precip: num(c.precipitation) ?? 0,
      tcc: num(c.cloud_cover) ?? 0, // procent 0–100
      temp,
      symbol: num(c.weather_code) ?? -1,
    };
  } catch {
    return null;
  }
}

async function fetchKp(): Promise<number | null> {
  try {
    const res = await fetch(KP_URL);
    if (!res.ok) return null;
    const rows = (await res.json()) as unknown[];
    if (!Array.isArray(rows) || rows.length < 2) return null;
    const last = rows[rows.length - 1];
    if (!Array.isArray(last)) return null;
    const kp = Number(last[1]);
    return Number.isFinite(kp) ? kp : null;
  } catch {
    return null;
  }
}

// ---------- cache ----------

function readCache(): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (typeof entry?.ts !== "number" || Date.now() - entry.ts > CACHE_MS) return null;
    const w = entry.weather;
    const nums = [w?.ws, w?.wd, w?.precip, w?.tcc, w?.temp, w?.symbol];
    if (nums.some((n) => typeof n !== "number" || !Number.isFinite(n))) return null;
    if (entry.kp !== null && typeof entry.kp !== "number") return null;
    return entry;
  } catch {
    return null;
  }
}

function writeCache(entry: CacheEntry): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // t.ex. privat läge — strunta i cachen
  }
}
