// Protokolli App ↔ WebView i avatarit (faqja: avatari-faqja.ts). Faqja vetëm flet; mikrofoni është i app-it.
//
//   app → faqe:  nis (intervistuesi + ngjyrat e temës) · fol (fjalitë me zë) · ndalo · degjon · mendon
//   faqe → app:  ngarkuar · gati · foli_filloi · foli_mbaroi · prek (iPhone kërkon një prekje për zërin) · gabim
//
// Rrjedha me makinën e gjendjeve (gjendja.ts, paraqitja "avatar"): pas çdo pyetjeje faza mbetet "pyet";
// app-i i dërgon faqes "fol"; faqja kthen "foli_mbaroi" → uPyet() → "pret_pergjigjen" (radha e kandidatit).
// Çdo mesazh nga faqja kontrollohet me lexoMesazhinNgaFaqja: lloji i panjohur injorohet. Asnjëherë eval / HTML nga mesazhet.
import type { Intervistuesi, Shprehja } from "./tipet";

export type FjaliaMeZe = { teksti: string; audio_base64: string; mime: string };

// ---------- App → faqe ----------
export type MesazhPerFaqen =
  | {
      lloji: "nis";
      intervistuesi: Intervistuesi;
      emri: string;
      ngjyrat: { sfondi: string; teksti: string; unaza: string };
    }
  /** shto: radhitet pas asaj që po thuhet (pjesa e dytë e kthesës); përndryshe ndalon gjithçka dhe fillon këtë. */
  | { lloji: "fol"; id: string; fjalite: FjaliaMeZe[]; shprehja: Shprehja; pershendetje: boolean; shto: boolean }
  /** Zëri në rrjedhë (24.11): fillon, copa PCM 16 bit mono (base64) sapo vijnë, mbaron. Faqja i luan pa pritur fundin. */
  | { lloji: "rrjedhe_fillo"; id: string; shprehja: Shprehja; pershendetje: boolean }
  | { lloji: "rrjedhe_pcm"; id: string; b: string; s: number }
  | { lloji: "rrjedhe_mbaroi"; id: string }
  /** Kamera e kandidatit brenda faqes (getUserMedia + MediaPipe): ndizet dhe fiket nga app-i, pasi leja u dha. */
  | { lloji: "kamera"; po: boolean }
  | { lloji: "ndalo" }
  | { lloji: "degjon"; po: boolean }
  | { lloji: "mendon" };

// ---------- Faqe → app ----------
export type MesazhNgaFaqja =
  | { lloji: "ngarkuar" }
  | { lloji: "gati"; avatari: boolean }
  | { lloji: "foli_filloi"; id: string }
  | { lloji: "foli_mbaroi"; id: string }
  | { lloji: "prek" }
  /** Kamera u ndez në faqe; `analiza` = MediaPipe u ngarkua (pa të, kandidati sheh veten por s'ka matje). */
  | { lloji: "kamera_gati"; analiza: boolean }
  /** getUserMedia s'funksionoi në këtë WebView: app-i kalon te kamera native (vetëm pamja, pa analizë). */
  | { lloji: "kamera_gabim"; mesazhi: string }
  /** DELTA e numrave nga kornizat e vërteta gjatë përgjigjeve të kandidatit (jo gjatë të folurit të intervistuesit); app-i i shton te totalet. */
  | { lloji: "kamera_statistika"; kornizat: number; fytyra: number; sy: number }
  /** Mbikëqyrja e kamerës në faqe: po rilidhet, u rikuperua, ose s'u rikuperua dot. */
  | { lloji: "kamera_gjendje"; gjendja: "po_rilidhet" | "ne_rregull" | "u_shkeput" }
  | { lloji: "gabim"; kodi: "faqja" | "zeri"; mesazhi: string };

const objekt = (v: unknown): Record<string, unknown> | null =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

/** Kontrollon një mesazh nga WebView (`event.nativeEvent.data`, tekst JSON). null = i panjohur ose i dëmtuar. */
export function lexoMesazhinNgaFaqja(teksti: string): MesazhNgaFaqja | null {
  if (teksti.length > 4000) return null;
  let v: unknown;
  try {
    v = JSON.parse(teksti);
  } catch {
    return null;
  }
  const o = objekt(v);
  if (!o) return null;
  switch (o.lloji) {
    case "ngarkuar":
    case "prek":
      return { lloji: o.lloji };
    case "gati":
      return { lloji: "gati", avatari: o.avatari === true };
    case "foli_filloi":
    case "foli_mbaroi":
      return typeof o.id === "string" ? { lloji: o.lloji, id: o.id } : null;
    case "kamera_gjendje":
      return o.gjendja === "po_rilidhet" || o.gjendja === "ne_rregull" || o.gjendja === "u_shkeput"
        ? { lloji: "kamera_gjendje", gjendja: o.gjendja }
        : null;
    case "kamera_gati":
      return { lloji: "kamera_gati", analiza: o.analiza === true };
    case "kamera_gabim":
      return { lloji: "kamera_gabim", mesazhi: typeof o.mesazhi === "string" ? o.mesazhi.slice(0, 200) : "" };
    case "kamera_statistika": {
      const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 1e7 ? Math.floor(v) : null);
      const kornizat = n(o.kornizat);
      const fytyra = n(o.fytyra);
      const sy = n(o.sy);
      // Numrat duhet të kenë kuptim: sy ≤ fytyra ≤ kornizat.
      if (kornizat === null || fytyra === null || sy === null || fytyra > kornizat || sy > fytyra) return null;
      return { lloji: "kamera_statistika", kornizat, fytyra, sy };
    }
    case "gabim":
      if (o.kodi !== "faqja" && o.kodi !== "zeri") return null;
      return { lloji: "gabim", kodi: o.kodi, mesazhi: typeof o.mesazhi === "string" ? o.mesazhi.slice(0, 200) : "" };
    default:
      return null;
  }
}

/** Për `webviewRef.current.postMessage(...)`. */
export function koduoPerFaqen(m: MesazhPerFaqen): string {
  return JSON.stringify(m);
}
