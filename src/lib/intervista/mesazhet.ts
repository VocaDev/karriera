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
