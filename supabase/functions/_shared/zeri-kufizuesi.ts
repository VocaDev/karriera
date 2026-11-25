// Kufizuesi i përbashkët i kërkesave TTS (25.11): dritare rrëshqitëse 60 s për çdo model (RPM), kufi ditor (RPD, që
// Google-i e rinis në mesnatë sipas orës së Paqësorit) dhe bllokim i modelit pas një 429. Para çdo kërkese te Gemini
// rezervohet një vend; funksioni zgjedh modelin e parë me vend të lirë.
//
// Dy zbatime me të njëjtat rregulla: te databaza (zeri_tts_rezervo, migrimi 20261125123000: e përbashkët mes të gjitha
// instancave të funksionit) dhe në kujtesë (për testet, dhe si rezervë kur migrimi mungon ose DB-ja dështon: atëherë
// kufiri vlen vetëm brenda një instance dhe 429-të e Google-it e mbrojnë pjesën tjetër).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";

export type KufiriIModelit = { modeli: string; rpm: number; rpd: number | null };
/** `modeli` null = asnjë vend tani; `pritjaMs` = pas sa lirohet vendi i parë. */
export type Rezervimi = { modeli: string | null; pritjaMs: number };

export interface Kufizuesi {
  /**
   * Rezervon një vend te modeli i parë i lirë i listës. `lerTeLira`: rezervo vetëm nëse pas tij mbeten të paktën aq vende
   * të lira mes modeleve (për punë me përparësi të ulët, që s'duhet t'i hajë vendet e pyetjeve).
   */
  rezervo(modelet: KufiriIModelit[], lerTeLira: number): Promise<Rezervimi>;
  /** Modeli s'përdoret për `ms` (429 nga Google, ose model që s'e pranon kërkesën). */
  blloko(modeli: string, ms: number): Promise<void>;
}

export const DRITARJA_MS = 60_000;
const PA_ZGJIDHJE_MS = 60_000;

const PACIFIKU = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function oraNePacifik(t: number) {
  const p = Object.fromEntries(PACIFIKU.formatToParts(new Date(t)).map((x) => [x.type, Number(x.value)]));
  const muri = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return { dita: Date.UTC(p.year, p.month - 1, p.day), zhvendosja: muri - Math.floor(t / 1000) * 1000 };
}

/** Çasti (ms) kur filloi dita e sotme sipas orës së Paqësorit, edhe në ditët kur ndërron ora. */
export function fillimiIDitesPacifike(t: number): number {
  const { dita, zhvendosja } = oraNePacifik(t);
  return dita - oraNePacifik(dita - zhvendosja).zhvendosja;
}

/** Mesnata tjetër e Paqësorit: kur Google-i i rinis kufijtë ditorë. */
export const mesnataTjeterPacifike = (t: number) => fillimiIDitesPacifike(fillimiIDitesPacifike(t) + 30 * 60 * 60 * 1000);

export function kufizuesiNeKujtese(tani: () => number = Date.now): Kufizuesi {
  const kerkesat = new Map<string, number[]>(); // koha e çdo kërkese (dy ditët e fundit), sipas modelit
  const bllokimet = new Map<string, number>();
  return {
    rezervo(modelet, lerTeLira) {
      const t = tani();
      const dita = fillimiIDitesPacifike(t);
      let zgjedhur: string | null = null;
      let lira = 0;
      let minPritja: number | null = null;
      for (const { modeli, rpm, rpd } of modelet) {
        if (rpm <= 0) continue;
        const te = (kerkesat.get(modeli) ?? []).filter((k) => k > t - 2 * 24 * 60 * 60 * 1000);
        kerkesat.set(modeli, te);
        let pritja = Math.max(0, (bllokimet.get(modeli) ?? 0) - t);
        const dritarja = te.filter((k) => k > t - DRITARJA_MS).sort((a, b) => a - b);
        if (dritarja.length >= rpm) pritja = Math.max(pritja, dritarja[dritarja.length - rpm] + DRITARJA_MS - t);
        let liraEModelit = rpm - dritarja.length;
        if (rpd !== null) {
          const sot = te.filter((k) => k >= dita).length;
          if (sot >= rpd) pritja = Math.max(pritja, mesnataTjeterPacifike(t) - t);
          liraEModelit = Math.min(liraEModelit, rpd - sot);
        }
        if (pritja === 0) {
          lira += Math.max(0, liraEModelit);
          zgjedhur ??= modeli;
        } else {
          minPritja = Math.min(minPritja ?? pritja, pritja);
        }
      }
      if (zgjedhur !== null && lira > Math.max(0, lerTeLira)) {
        kerkesat.get(zgjedhur)!.push(t);
        return Promise.resolve({ modeli: zgjedhur, pritjaMs: 0 });
      }
      return Promise.resolve({ modeli: null, pritjaMs: minPritja ?? PA_ZGJIDHJE_MS });
    },
    blloko(modeli, ms) {
      bllokimet.set(modeli, Math.max(bllokimet.get(modeli) ?? 0, tani() + Math.max(0, ms)));
      return Promise.resolve();
    },
  };
}

let uShkrua = false;
function shkruajNjeHere() {
  if (uShkrua) return;
  uShkrua = true;
  console.error("[zeri-kufizuesi] Numëruesi te DB s'u përdor (a është aplikuar migrimi zeri_tts_kufijte?). Po numërohet në kujtesë.");
}

/** Kufizuesi i përbashkët te databaza (çelësi sekret); kur s'punon, bie te `rezerva` (në kujtesë). */
export function kufizuesiNeDB(admin: SupabaseClient, rezerva: Kufizuesi): Kufizuesi {
  return {
    async rezervo(modelet, lerTeLira) {
      const { data, error } = await admin.rpc("zeri_tts_rezervo", { p_modelet: modelet, p_ler_te_lira: lerTeLira });
      const d = data as { modeli?: unknown; pritja_ms?: unknown } | null;
      if (error || !d || typeof d.pritja_ms !== "number") {
        shkruajNjeHere();
        return rezerva.rezervo(modelet, lerTeLira);
      }
      return { modeli: typeof d.modeli === "string" ? d.modeli : null, pritjaMs: d.pritja_ms };
    },
    async blloko(modeli, ms) {
      await rezerva.blloko(modeli, ms);
      const { error } = await admin.rpc("zeri_tts_blloko", { p_modeli: modeli, p_ms: Math.round(ms) });
      if (error) shkruajNjeHere();
    },
  };
}
