// Kamera e intervistës me zë (CLAUDE.md §5: avatar, kamerë, gjuha e trupit; bordi 13, 38, 39).
//
// Dy rrugë, vendos koha e ekzekutimit (useKamera.ts):
//   1. brenda faqes së avatarit (WebView): getUserMedia + MediaPipe FaceLandmarker → pamja e kandidatit dhe MATJE të vërteta;
//   2. rezervë: kamera native (expo-camera) vetëm si pasqyrë, PA analizë: kur WebView-i s'e lejon getUserMedia.
//
// Çka matet (vetëm nga kornizat e vërteta, vetëm gjatë përgjigjeve të kandidatit): sa kornizave u pa fytyrë dhe sa prej tyre
// shikonin përafërsisht kamerën (shikimi nga blendshape-et e syve të MediaPipe). Videoja s'ruhet kurrë: ruhen vetëm këto tre
// numra, në këtë telefon (AsyncStorage). Pa numra të mjaftueshëm s'tregohet asgjë: asnjë sinjal i shpikur, asnjë "integritet".
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Camera } from "expo-camera";

export type LejaKameres = "lejuar" | "pa_pyetur" | "bllokuar";

/** Leja e kamerës pa e pyetur përdoruesin. */
export async function lexoLejenKameres(): Promise<LejaKameres> {
  const r = await Camera.getCameraPermissionsAsync();
  if (r.granted) return "lejuar";
  return r.canAskAgain ? "pa_pyetur" : "bllokuar";
}

/** Dritarja e sistemit; thirret vetëm pasi ekrani e ka shpjeguar pse. */
export async function kerkoLejenKameres(): Promise<boolean> {
  const r = await Camera.requestCameraPermissionsAsync();
  return r.granted;
}

export type StatistikaKameres = {
  /** Kornizat e analizuara gjatë përgjigjeve të kandidatit. */
  kornizat: number;
  /** Prej tyre, ato ku u pa fytyrë. */
  fytyra: number;
  /** Prej këtyre, ato ku shikimi ishte përafërsisht drejt kamerës. */
  sy: number;
};

/** Poshtë kësaj s'ka matje të mjaftueshme (≈ 10 s përgjigje në ~8 kornizë/s): s'tregohet asgjë. */
export const MIN_KORNIZA_ME_FYTYRE = 80;

const celesi = (intervistaId: string) => `karriera.kamera.${intervistaId}`;

// Shkrimet radhiten një nga një: dy raporte në të njëjtën kohë s'duhet të lexojnë të njëjtin total të vjetër.
let radhaEShkrimeve: Promise<void> = Promise.resolve();

/**
 * SHTON një delta (kornizat e reja nga faqja) te totalet e ruajtura të kësaj interviste. Faqja raporton vetëm shtesat, ndaj
 * një rinisje e WebView-it (rihapje e intervistës, ringarkim) s'i fshin matjet e mëparshme.
 */
export function shtoStatistiken(intervistaId: string, delta: StatistikaKameres): Promise<void> {
  radhaEShkrimeve = radhaEShkrimeve.then(async () => {
    try {
      const e = (await lexoStatistiken(intervistaId)) ?? { kornizat: 0, fytyra: 0, sy: 0 };
      const total = { kornizat: e.kornizat + delta.kornizat, fytyra: e.fytyra + delta.fytyra, sy: e.sy + delta.sy };
      // Rendi kornizat ≥ fytyra ≥ sy ruhet nga shtesat; nëse diçka s'përputhet, s'shkruhet asgjë.
      if (!(total.kornizat >= total.fytyra && total.fytyra >= total.sy && total.sy >= 0)) return;
      await AsyncStorage.setItem(celesi(intervistaId), JSON.stringify(total));
    } catch {
      // matja është shtesë: s'ka çka të ndalojë intervistën
    }
  });
  return radhaEShkrimeve;
}

export async function lexoStatistiken(intervistaId: string): Promise<StatistikaKameres | null> {
  try {
    const v = await AsyncStorage.getItem(celesi(intervistaId));
    if (!v) return null;
    const o: unknown = JSON.parse(v);
    if (typeof o !== "object" || o === null) return null;
    const { kornizat, fytyra, sy } = o as Record<string, unknown>;
    if (typeof kornizat !== "number" || typeof fytyra !== "number" || typeof sy !== "number") return null;
    if (!(kornizat >= fytyra && fytyra >= sy && sy >= 0)) return null;
    return { kornizat, fytyra, sy };
  } catch {
    return null;
  }
}

/** Vëmendja te kamera (vlerësim i përafërt) për shiritin gjatë intervistës: % e kornizave me fytyrë ku shikimi ishte te
 * kamera. null derisa të ketë matje të mjaftueshme (disa sekonda përgjigje). */
export function perqindjaEVemendjes(s: StatistikaKameres | null, minimumi = MIN_KORNIZA_PER_SHIRITIN): number | null {
  return s && s.fytyra >= minimumi ? Math.round((s.sy / s.fytyra) * 100) : null;
}
export const MIN_KORNIZA_PER_SHIRITIN = 12;

export type VleresimiIKameres = {
  /** Sa e kohës fytyra ishte e dukshme gjatë përgjigjeve (0–100). */
  fytyra: number;
  /** Sa e kohës me fytyrë të dukshme shikimi ishte drejt kamerës (0–100). */
  sy: number;
  /** Këshilla që vijnë vetëm nga këto dy numra. */
  keshilla: string[];
};

/** null kur s'ka matje të mjaftueshme (kamera ishte e fikur, ose fytyra s'u pa). */
export function vleresoKameren(s: StatistikaKameres | null): VleresimiIKameres | null {
  if (!s || s.fytyra < MIN_KORNIZA_ME_FYTYRE) return null;
  const fytyra = Math.round((s.fytyra / s.kornizat) * 100);
  const sy = Math.round((s.sy / s.fytyra) * 100);
  const keshilla: string[] = [];
  if (fytyra < 80) {
    keshilla.push("Fytyra s'dukej gjatë një pjese të përgjigjeve. Vendose telefonin në nivelin e syve dhe kontrollo dritën.");
  }
  if (sy >= 70) {
    keshilla.push("Kontakti me sy ishte i mirë: shikoje kamerën, jo ekranin, kur mbyll një ide.");
  } else if (sy >= 40) {
    keshilla.push("Herë pas here largoje shikimin, normale kur mendon. Provo ta kthesh te kamera kur e nis dhe kur e mbyll përgjigjen.");
  } else {
    keshilla.push("Shumicën e kohës shikimi s'ishte drejt kamerës. Në intervistë, shikimi drejt kamerës (ose pikës së ekranit ku është ajo) jep ndjesinë e kontaktit me sy.");
  }
  return { fytyra, sy, keshilla };
}
