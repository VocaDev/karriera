// "A jam gati?" (WP3): sa gati jam për një punë konkrete. Ekrani thërret vetëm funksionet e këtij fajlli.
//
// Ku jetojnë të dhënat (supabase/migrations/20261115110000_gatishmeria.sql):
//   gatishmeria   një rresht për çdo llogaritje; i shkruajnë vetëm Edge Functions:
//                 `gati` (burimi "cv") dhe intervista (burimi "intervista", WP4). App-i vetëm lexon.
//   AI-ja         Edge Function `gati` (çelësi i AI-së s'del kurrë në telefon), 10 herë në 24 orë.
//   Kufiri        gati_thirrjet s'lexohet nga telefoni (pa grant): numrin dhe kohën e rivendosjes i jep vetë funksioni,
//                 me { veprimi: "kufiri" } (pa AI) dhe në çdo përgjigje të `gati`.
// Pa filtër për përdoruesin në kod: RLS-i kthen vetëm rreshtat e mi.
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";

import { mesazhiIGabimit } from "@/lib/hyrja-offline";
import { supabase } from "@/lib/supabase";

// ---------- Tipet (kontrata me WP4) ----------

export type AftesiaQeKe = { aftesia: string; deshmia: string };
export type AftesiaQeMungon = { aftesia: string; pse: string; si: string };

export type Gatishmeria = {
  id: string;
  puna_id: string;
  cv_id: string | null; // null nëse CV-ja është fshirë pas llogaritjes
  burimi: "cv" | "intervista";
  intervista_id: string | null;
  perqindja: number; // 0–100, vlerësim i AI-së, jo garanci punësimi
  ke: AftesiaQeKe[];
  mungon: AftesiaQeMungon[];
  hapat: string[]; // 1–3 hapa konkretë
  arsyeja: string; // pse ky numër
  modeli: string;
  krijuar_me: string; // ISO
};

/** CV-ja më e re e përdoruesit (vetëm sa i duhet ekranit), ose null nëse s'ka. */
export type CvEFundit = { id: string; versioni: number; krijuar_me: string };

export const KUFIRI_DITOR_GATI = 10; // i njëjti si KUFIRI_DITOR te supabase/functions/gati

/** Kufiri ditor i `gati`: sa thirrje në 24 orët e fundit, dhe kur lirohet vendi i parë (ISO, ose null nëse s'ka asnjë). */
export type Kufiri = { perdorur: number; maks: number; rivendoset: string | null };

/** Një kontroll i së kaluarës (pa tekstet): për historinë e punës dhe bllokun te Sot. */
export type Prova = { id: string; perqindja: number; burimi: "cv" | "intervista"; krijuar_me: string };

/** Gabimi kur s'ka CV: ekrani tregon gjendjen bosh me lidhjen te /cv. */
export class GabimPaCV extends Error {
  constructor(mesazhi = "Së pari ngarko ose ndërto CV-në tënde.") {
    super(mesazhi);
    this.name = "GabimPaCV";
  }
}

/** Kufiri i arritur (429): ekrani tregon kur rivendoset, jo një gabim të përgjithshëm. */
export class GabimKufiri extends Error {
  readonly kufiri: Kufiri | null;
  constructor(mesazhi: string, kufiri: Kufiri | null) {
    super(mesazhi);
    this.name = "GabimKufiri";
    this.kufiri = kufiri;
  }
}

// ---------- Kontrolli i përgjigjeve (JSON-i nga serveri dhe AI-ja s'merren të mirëqena) ----------

const eshteTekst = (v: unknown): v is string => typeof v === "string";
const eshteObjekt = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const listeMe = (v: unknown, kontrollo: (x: unknown) => boolean) => Array.isArray(v) && v.every(kontrollo);
const tekstOseNull = (v: unknown) => v === null || eshteTekst(v);

export function eshteGatishmeri(v: unknown): v is Gatishmeria {
  if (!eshteObjekt(v)) return false;
  return (
    eshteTekst(v.id) &&
    eshteTekst(v.puna_id) &&
    tekstOseNull(v.cv_id) &&
    (v.burimi === "cv" || v.burimi === "intervista") &&
    tekstOseNull(v.intervista_id) &&
    typeof v.perqindja === "number" &&
    Number.isInteger(v.perqindja) &&
    v.perqindja >= 0 &&
    v.perqindja <= 100 &&
    listeMe(v.ke, (k) => eshteObjekt(k) && eshteTekst(k.aftesia) && eshteTekst(k.deshmia)) &&
    listeMe(v.mungon, (m) => eshteObjekt(m) && eshteTekst(m.aftesia) && eshteTekst(m.pse) && eshteTekst(m.si)) &&
    listeMe(v.hapat, eshteTekst) &&
    eshteTekst(v.arsyeja) &&
    eshteTekst(v.modeli) &&
    eshteTekst(v.krijuar_me)
  );
}

function eshteKufi(v: unknown): v is Kufiri {
  return (
    eshteObjekt(v) &&
    typeof v.perdorur === "number" &&
    typeof v.maks === "number" &&
    (v.rivendoset === null || (eshteTekst(v.rivendoset) && !Number.isNaN(new Date(v.rivendoset).getTime())))
  );
}

// ---------- Thirrja e Edge Function-it ----------

type TrupiIGabimit = { mesazhi: string; paCV: boolean; kufiriIArritur: boolean; kufiri: Kufiri | null };

async function lexoGabimin(gabimi: unknown): Promise<TrupiIGabimit> {
  const rezerva: TrupiIGabimit = {
    mesazhi: "Llogaritja dështoi. Provo përsëri.",
    paCV: false,
    kufiriIArritur: false,
    kufiri: null,
  };
  if (gabimi instanceof FunctionsHttpError) {
    try {
      const trupi: unknown = await (gabimi.context as Response).json();
      if (eshteObjekt(trupi) && eshteTekst(trupi.error)) {
        return {
          mesazhi: trupi.error,
          paCV: trupi.kodi === "pa_cv",
          kufiriIArritur: trupi.kodi === "kufiri",
          kufiri: eshteKufi(trupi.kufiri) ? trupi.kufiri : null,
        };
      }
    } catch {
      // përgjigje pa JSON
    }
    return rezerva;
  }
  if (gabimi instanceof FunctionsFetchError || gabimi instanceof FunctionsRelayError) {
    return { ...rezerva, mesazhi: "Pa internet ose serveri s'u përgjigj. Provo përsëri." };
  }
  return rezerva;
}

function eshte401(gabimi: unknown): boolean {
  return gabimi instanceof FunctionsHttpError && (gabimi.context as Response).status === 401;
}

async function thirrGati<T>(body: Record<string, string>, lexo: (data: unknown) => T): Promise<T> {
  let { data, error } = await supabase.functions.invoke("gati", { body });

  // 401 = serveri s'e njeh më sesionin: një rifreskim; nëse dështon, dalim nga llogaria (roja hap hyrjen).
  if (error && eshte401(error)) {
    const { error: gabimiRifreskimit } = await supabase.auth.refreshSession();
    if (gabimiRifreskimit) {
      await supabase.auth.signOut({ scope: "local" });
      throw new Error("Sesioni ka skaduar. Hyr përsëri.");
    }
    ({ data, error } = await supabase.functions.invoke("gati", { body }));
  }

  if (error) {
    const { mesazhi, paCV, kufiriIArritur, kufiri } = await lexoGabimin(error);
    if (kufiriIArritur) throw new GabimKufiri(mesazhi, kufiri);
    throw paCV ? new GabimPaCV(mesazhi) : new Error(mesazhi);
  }
  return lexo(data);
}

/**
 * Thërret `gati`: AI-ja krahason CV-në e fundit me punën dhe e ruan rezultatin. Zgjat 10–40 sekonda dhe
 * numërohet te kufiri ditor. Hedh `GabimPaCV` kur s'ka CV, `GabimKufiri` kur kufiri është arritur,
 * përndryshe Error me mesazh në shqip. `kufiri` është null para deploy-t të ri të funksionit.
 */
export async function llogaritGatishmerine(punaId: string): Promise<{ rezultati: Gatishmeria; kufiri: Kufiri | null }> {
  return thirrGati({ puna_id: punaId }, (data) => {
    const rreshti: unknown = eshteObjekt(data) ? data.gatishmeria : null;
    if (!eshteGatishmeri(rreshti)) throw new Error("AI-ja ktheu një përgjigje të paplotë. Provo përsëri.");
    return { rezultati: rreshti, kufiri: eshteObjekt(data) && eshteKufi(data.kufiri) ? data.kufiri : null };
  });
}

/**
 * Sa thirrje janë përdorur në 24 orët e fundit (pa AI, s'e shton thirrjen). Null nëse s'dihet: funksioni s'është
 * deploy-uar ende me këtë veprim, ose s'ka internet. Atëherë ekrani tregon vetëm kufirin e përgjithshëm.
 */
export async function lexoKufirin(): Promise<Kufiri | null> {
  try {
    return await thirrGati({ veprimi: "kufiri" }, (data) =>
      eshteObjekt(data) && eshteKufi(data.kufiri) ? data.kufiri : null,
    );
  } catch {
    return null;
  }
}

// ---------- Leximi (pa AI) ----------

const FUSHAT = "id, puna_id, cv_id, burimi, intervista_id, perqindja, ke, mungon, hapat, arsyeja, modeli, krijuar_me";

/** Gatishmëria më e re për këtë punë (nga CV-ja ose nga intervista), ose null nëse s'është llogaritur ende. */
export async function gatishmeriaEFundit(punaId: string): Promise<Gatishmeria | null> {
  const { data, error } = await supabase
    .from("gatishmeria")
    .select(FUSHAT)
    .eq("puna_id", punaId)
    .order("krijuar_me", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(mesazhiIGabimit(error));
  if (!data) return null;
  return eshteGatishmeri(data) ? data : null;
}

function eshteProve(v: unknown): v is Prova {
  return (
    eshteObjekt(v) &&
    eshteTekst(v.id) &&
    typeof v.perqindja === "number" &&
    (v.burimi === "cv" || v.burimi === "intervista") &&
    eshteTekst(v.krijuar_me)
  );
}

/** Kontrollet e kësaj pune, më i riu i pari (deri në `sa`): nga këtu vjen "+12 nga herë e kaluar" dhe rreshti i së kaluarës. */
export async function historiaEPunes(punaId: string, sa = 8): Promise<Prova[]> {
  const { data, error } = await supabase
    .from("gatishmeria")
    .select("id, perqindja, burimi, krijuar_me")
    .eq("puna_id", punaId)
    .order("krijuar_me", { ascending: false })
    .limit(sa);
  if (error) throw new Error(mesazhiIGabimit(error));
  return (data ?? []).filter(eshteProve);
}

/** Ndryshimi kundrejt kontrollit të mëparshëm (pikë përqindjeje), ose null nëse s'ka të mëparshëm. */
export function ndryshimiKundrejtParaprakut(historia: Prova[], aktuali: { id: string; perqindja: number }): number | null {
  const i = historia.findIndex((p) => p.id === aktuali.id);
  // Nëse i riu s'është ende te lista (sapo u llogarit), i mëparshmi është më i riu i listës.
  const paraprak = i === -1 ? historia[0] : historia[i + 1];
  return paraprak ? aktuali.perqindja - paraprak.perqindja : null;
}

export type KontrollEFundit = {
  puna_id: string;
  titulli: string;
  kompania: string;
  perqindja: number;
  delta: number | null; // kundrejt kontrollit të mëparshëm të së njëjtës punë
  krijuar_me: string;
};

/** Një rresht për punë (kontrolli më i ri), `sa` punët e fundit: blloku "Gatishmëria jote" te Sot. */
export async function kontrolletEFundit(sa = 3): Promise<KontrollEFundit[]> {
  const { data, error } = await supabase
    .from("gatishmeria")
    .select("id, puna_id, perqindja, burimi, krijuar_me")
    .order("krijuar_me", { ascending: false })
    .limit(60);
  if (error) throw new Error(mesazhiIGabimit(error));

  type Rresht = Prova & { puna_id: string };
  const rreshtat = (data ?? []).filter((r): r is Rresht => eshteProve(r) && eshteTekst((r as { puna_id?: unknown }).puna_id));
  const sipasPunes = new Map<string, Rresht[]>();
  for (const r of rreshtat) sipasPunes.set(r.puna_id, [...(sipasPunes.get(r.puna_id) ?? []), r]);

  const idt = [...sipasPunes.keys()].slice(0, sa);
  if (idt.length === 0) return [];
  const { data: punet, error: gabimiPuneve } = await supabase.from("punet").select("id, titulli, kompania").in("id", idt);
  if (gabimiPuneve) throw new Error(mesazhiIGabimit(gabimiPuneve));
  const tePunet = new Map((punet ?? []).map((p: { id: string; titulli: string; kompania: string }) => [p.id, p]));

  return idt.flatMap((id) => {
    const puna = tePunet.get(id);
    const [iRi, iMeparshmi] = sipasPunes.get(id) ?? [];
    if (!puna || !iRi) return [];
    return [
      {
        puna_id: id,
        titulli: puna.titulli,
        kompania: puna.kompania,
        perqindja: iRi.perqindja,
        delta: iMeparshmi ? iRi.perqindja - iMeparshmi.perqindja : null,
        krijuar_me: iRi.krijuar_me,
      },
    ];
  });
}

/** CV-ja më e re e përdoruesit, ose null nëse s'ka asnjë (gjendja bosh e ekranit). */
export async function cvEFundit(): Promise<CvEFundit | null> {
  const { data, error } = await supabase
    .from("cvs")
    .select("id, versioni, krijuar_me")
    .order("versioni", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(mesazhiIGabimit(error));
  return (data as CvEFundit | null) ?? null;
}

// ---------- Të pastra (pa rrjet): fjalia sipas përqindjes, veprimi i hapit, koha e rivendosjes ----------

/** Një fjali sipas shkallës: <40 larg, 40–69 afër, ≥70 gati. Vlerësim i AI-së, jo premtim. */
export function gjykimiIPerqindjes(perqindja: number): string {
  if (perqindja < 40) return "Ende larg, por ke nga ku të nisësh";
  if (perqindja < 70) return "Afër: disa gjëra të mungojnë";
  return "Je gati të aplikosh";
}

export type VeprimiIHapit = "intervista" | "cv" | "apliko";

const pa_theksa = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const SHABLLONET: Record<VeprimiIHapit, RegExp> = {
  intervista: /intervist|interview|vorstellungsgespr/,
  cv: /\bcv\b|lebenslauf|curriculum/,
  apliko: /\bapliko|\baplikim|\bapply|\bbewirb/,
};

/**
 * Cili veprim i vërtetë i përshtatet hapit? Hapi është tekst i lirë nga AI-ja, prandaj vendos fjala që del e para
 * ("Apliko me CV-në e re" është aplikim, "Përmirëso CV-në para intervistës" është CV). Pa përputhje: null, hapi mbetet tekst.
 */
export function veprimiIHapit(hapi: string): VeprimiIHapit | null {
  const tekst = pa_theksa(hapi);
  let zgjedhur: VeprimiIHapit | null = null;
  let vendi = Number.POSITIVE_INFINITY;
  for (const [veprimi, shablloni] of Object.entries(SHABLLONET) as [VeprimiIHapit, RegExp][]) {
    const m = shablloni.exec(tekst);
    if (m && m.index < vendi) {
      vendi = m.index;
      zgjedhur = veprimi;
    }
  }
  return zgjedhur;
}

/** "sot në 14:20", "nesër në 08:05" ose data; null nëse s'dihet. */
export function kohaERivendosjes(iso: string | null, tani: Date = new Date()): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const dy = (n: number) => String(n).padStart(2, "0");
  const ora = `${dy(d.getHours())}:${dy(d.getMinutes())}`;
  const fillimi = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const ditet = Math.round((fillimi(d) - fillimi(tani)) / 86_400_000);
  if (ditet <= 0) return `sot në ${ora}`;
  if (ditet === 1) return `nesër në ${ora}`;
  return `${dy(d.getDate())}.${dy(d.getMonth() + 1)} në ${ora}`;
}
