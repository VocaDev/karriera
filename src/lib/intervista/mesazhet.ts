// Protokolli App ↔ WebView i avatarit (plani teknik §5), gati për 09.12. Sot intervista është me tekst dhe
// asgjë s'e përdor këtë fajll në ekran; react-native-webview NUK është shtuar ende.
//
// Si lidhet më vonë, pa ndryshuar makinën e gjendjeve (gjendja.ts):
//   - useIntervista(id, "avatar") → pas çdo pyetjeje faza mbetet "pyet";
//   - app-i i dërgon faqes { lloji: "fol", ... } me tekstin e kthesës (reagimi + pyetja) dhe shprehjen;
//   - faqja kthen "foli_mbaroi" → app-i thërret uPyet() → "pret_pergjigjen";
//   - "pergjigja" e faqes (audio) → STT në server → del si tekst te dergo(), si sot.
// Çdo mesazh nga faqja kontrollohet me lexoMesazhinNgaFaqja: lloji i panjohur injorohet. Asnjëherë eval / HTML nga mesazhet.
import type { Gjuha, Kthesa, Shprehja } from "./tipet";

// ---------- App → faqe ----------
export type MesazhPerFaqen =
  | { lloji: "nis"; gjuha: Gjuha; avatari: "f" | "m" }
  | {
      lloji: "fol";
      teksti: string; // titrat; me TTS në server vjen edhe audio
      shprehja: Shprehja;
      audio_base64?: string;
      fjalet?: string[];
      kohet_ms?: number[];
      kohezgjatjet_ms?: number[];
    }
  | { lloji: "degjo" } // fillon regjistrimi
  | { lloji: "ndalo" } // ndalon regjistrimin → faqja kthen "pergjigja"
  | { lloji: "mbyll" }; // ndal kamerën dhe mikrofonin

// ---------- Faqe → app ----------
export type MetrikatEPergjigjes = {
  kontakti: number | null; // 0–1, sa kohë shikoi kamerën
  vargu_max_ms: number;
  pa_fytyre_ms: number;
  dy_fytyra_ms: number;
  buzeqeshje: number | null;
  matur_ms: number;
};

export type MesazhNgaFaqja =
  | { lloji: "gati" }
  | { lloji: "foli_mbaroi" }
  | { lloji: "pergjigja"; audio_base64: string; mime: string; kohezgjatja_ms: number; metrikat: MetrikatEPergjigjes | null }
  | { lloji: "sinjal"; tipi: "pa_fytyre" | "dy_fytyra" }
  | { lloji: "gabim"; kodi: "kamera" | "mikrofoni" | "avatari" | "mediapipe"; mesazhi: string };

/** Mesazhi që i thotë faqes ta bëjë pyetjen (teksti sot është i njëjti që shfaqet në chat). */
export function mesazhiFol(kthesa: Kthesa): MesazhPerFaqen {
  return {
    lloji: "fol",
    teksti: [kthesa.reagimi, kthesa.pyetja].filter(Boolean).join(" "),
    shprehja: kthesa.shprehja,
  };
}

const MAKS_AUDIO = 25 * 1024 * 1024; // base64, si kufiri i prototipit

const numer = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const objekt = (v: unknown): Record<string, unknown> | null =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

function lexoMetrikat(v: unknown): MetrikatEPergjigjes | null {
  const o = objekt(v);
  if (!o) return null;
  const k = numer(o.kontakti);
  return {
    kontakti: k === null ? null : Math.max(0, Math.min(1, k)),
    vargu_max_ms: Math.max(0, numer(o.vargu_max_ms) ?? 0),
    pa_fytyre_ms: Math.max(0, numer(o.pa_fytyre_ms) ?? 0),
    dy_fytyra_ms: Math.max(0, numer(o.dy_fytyra_ms) ?? 0),
    buzeqeshje: numer(o.buzeqeshje),
    matur_ms: Math.max(0, numer(o.matur_ms) ?? 0),
  };
}

/** Kontrollon një mesazh nga WebView (`event.nativeEvent.data`, tekst JSON). null = i panjohur ose i dëmtuar. */
export function lexoMesazhinNgaFaqja(teksti: string): MesazhNgaFaqja | null {
  let v: unknown;
  try {
    v = JSON.parse(teksti);
  } catch {
    return null;
  }
  const o = objekt(v);
  if (!o) return null;
  switch (o.lloji) {
    case "gati":
    case "foli_mbaroi":
      return { lloji: o.lloji };
    case "pergjigja": {
      const kohezgjatja = numer(o.kohezgjatja_ms);
      if (typeof o.audio_base64 !== "string" || o.audio_base64.length > MAKS_AUDIO) return null;
      if (typeof o.mime !== "string" || kohezgjatja === null) return null;
      return {
        lloji: "pergjigja",
        audio_base64: o.audio_base64,
        mime: o.mime,
        kohezgjatja_ms: Math.max(0, kohezgjatja),
        metrikat: lexoMetrikat(o.metrikat),
      };
    }
    case "sinjal":
      return o.tipi === "pa_fytyre" || o.tipi === "dy_fytyra" ? { lloji: "sinjal", tipi: o.tipi } : null;
    case "gabim":
      if (o.kodi !== "kamera" && o.kodi !== "mikrofoni" && o.kodi !== "avatari" && o.kodi !== "mediapipe") return null;
      return { lloji: "gabim", kodi: o.kodi, mesazhi: typeof o.mesazhi === "string" ? o.mesazhi.slice(0, 300) : "" };
    default:
      return null;
  }
}

/** Për `webviewRef.current.postMessage(...)`. */
export function koduoPerFaqen(m: MesazhPerFaqen): string {
  return JSON.stringify(m);
}
