// "Kandidatët" e punëdhënësit dhe pëlqimi i kërkuesit për t'u parë anonimisht. Ekranet thërrasin vetëm këto funksione.
//
// Ku jetojnë të dhënat (supabase/migrations/20261125110000_kandidatet_anonim.sql):
//   dukshmeria            pëlqimi i kërkuesit (i fikur si parazgjedhje). Lexohet vetëm rreshti im; ndryshohet vetëm
//                         me vendos_dukshmerine() (vetëm kërkuesi).
//   kandidatet_anonim()   vetëm punëdhënësi, vetëm për punët e veta: kandidatë që kanë dhënë pëlqimin, ≥ 60% gati,
//                         nga 90 ditët e fundit. Pa emër, email, CV apo dëshmi: etiketë ("Kandidati #K27"), etiketa të shkurtra
//                         aftësish, koha vetëm si kovë. Kodi/etiketa janë PËR PUNË: i njëjti person s'lidhet dot mes pozitave.
//   numrat_e_pozitave()   vetëm totale për secilën punë timen; ⭐ dhe kontrollet nën 5 vijnë null ("më pak se 5").
// Privatësia zbatohet në bazë; këtu vetëm kontrollojmë formën e përgjigjes.
import { mesazhiIGabimit } from "@/lib/hyrja-offline";
import { supabase } from "@/lib/supabase";

/** Pragu dhe dritarja që zbaton serveri (vetëm për tekstet në ekran; vendimi është te funksioni SQL). */
export const PRAGU_GATI = 60;
export const DITET_E_DUKSHME = 90;
/** k-anonimiteti i totaleve (numrat_e_pozitave): nën këtë numër serveri kthen null. */
export const K_MIN = 5;
export const MAS_PAK_SE_K = `më pak se ${K_MIN}`;

/** Kur u llogarit gatishmëria: serveri jep vetëm kovën, jo datën. */
export type KovaEKohes = "kete_jave" | "kete_muaj" | "me_heret";
export const EMRAT_E_KOVAVE: Record<KovaEKohes, string> = {
  kete_jave: "këtë javë",
  kete_muaj: "këtë muaj",
  me_heret: `në ${DITET_E_DUKSHME} ditët e fundit`,
};

export type Kandidati = {
  puna_id: string;
  kodi: string; // çelësi i kandidatit vetëm për këtë punëdhënës dhe këtë punë (16 hex)
  etiketa: string; // "Kandidati #K27" (po ashtu për punë)
  perqindja: number;
  ke: string[];
  mungon: string[];
  burimi: "cv" | "intervista";
  llogaritur_kur: KovaEKohes;
  intervista_nota: number | null;
  intervista_nr: number;
};

/** `ruajtur` dhe `kontrolluan` përfshijnë edhe kërkues pa pëlqim: null = më pak se 5 (s'del numri i saktë). */
export type NumratEPozites = { puna_id: string; gati: number; ruajtur: number | null; kontrolluan: number | null };

/** Migrimi s'është aplikuar ende në server: ekrani e thotë hapur, pa sajuar të dhëna. */
export class GabimPaAktivizim extends Error {
  constructor() {
    super("Kjo pjesë s'është aktivizuar ende në server.");
    this.name = "GabimPaAktivizim";
  }
}

type GabimIPostgrest = { code?: string; message?: string };

// PGRST202 = funksioni s'ekziston, PGRST205 / 42P01 = tabela s'ekziston, 42883 = funksioni s'ekziston (Postgres).
function eshtePaAktivizim(g: GabimIPostgrest): boolean {
  return g.code === "PGRST202" || g.code === "PGRST205" || g.code === "42P01" || g.code === "42883";
}

function hidhGabimin(error: GabimIPostgrest): never {
  if (eshtePaAktivizim(error)) throw new GabimPaAktivizim();
  throw new Error(mesazhiIGabimit(error));
}

// ---------- Kontrolli i përgjigjeve ----------

const eshteObjekt = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const eshteTekst = (v: unknown): v is string => typeof v === "string";
const listeTekstesh = (v: unknown): v is string[] => Array.isArray(v) && v.every(eshteTekst);
const numerOseNull = (v: unknown) => v === null || typeof v === "number";

function eshteKandidat(v: unknown): v is Kandidati {
  return (
    eshteObjekt(v) &&
    eshteTekst(v.puna_id) &&
    eshteTekst(v.kodi) &&
    eshteTekst(v.etiketa) &&
    typeof v.perqindja === "number" &&
    listeTekstesh(v.ke) &&
    listeTekstesh(v.mungon) &&
    (v.burimi === "cv" || v.burimi === "intervista") &&
    (v.llogaritur_kur === "kete_jave" || v.llogaritur_kur === "kete_muaj" || v.llogaritur_kur === "me_heret") &&
    numerOseNull(v.intervista_nota) &&
    typeof v.intervista_nr === "number"
  );
}

// ---------- Punëdhënësi ----------

/** Kandidatët anonimë për një punë timen, ose për të gjitha (pa `punaId`), të renditur nga më i gatshmi. */
export async function merrKandidatet(punaId?: string): Promise<Kandidati[]> {
  const { data, error } = await supabase.rpc("kandidatet_anonim", punaId ? { p_puna_id: punaId } : {});
  if (error) hidhGabimin(error);
  const lista: unknown[] = Array.isArray(data) ? data : [];
  return lista.filter(eshteKandidat);
}

/** Totale për secilën punë timen: kandidatë gati, ⭐ dhe kontrolle "A jam gati?". */
export async function merrNumratEPozitave(): Promise<Map<string, NumratEPozites>> {
  const { data, error } = await supabase.rpc("numrat_e_pozitave");
  if (error) hidhGabimin(error);
  const harta = new Map<string, NumratEPozites>();
  for (const r of Array.isArray(data) ? (data as unknown[]) : []) {
    if (!eshteObjekt(r) || !eshteTekst(r.puna_id)) continue;
    harta.set(r.puna_id, {
      puna_id: r.puna_id,
      gati: Number(r.gati) || 0,
      ruajtur: r.ruajtur === null || r.ruajtur === undefined ? null : Number(r.ruajtur),
      kontrolluan: r.kontrolluan === null || r.kontrolluan === undefined ? null : Number(r.kontrolluan),
    });
  }
  return harta;
}

/**
 * Aftësitë që përsëriten më shpesh te kandidaturat (një kandidaturë = një kandidat për një pozitë; i njëjti person
 * te dy pozita numërohet dy herë, sepse serveri s'i lidh, me qëllim).
 */
export function aftesiteMeTeShpeshta(lista: Kandidati[], fusha: "ke" | "mungon", sa = 3): { aftesia: string; numri: number }[] {
  const numri = new Map<string, { aftesia: string; kandidatet: Set<string> }>();
  for (const k of lista) {
    for (const a of k[fusha]) {
      const celesi = a.trim().toLowerCase();
      if (!celesi) continue;
      const r = numri.get(celesi) ?? { aftesia: a.trim(), kandidatet: new Set<string>() };
      r.kandidatet.add(k.kodi);
      numri.set(celesi, r);
    }
  }
  return [...numri.values()]
    .map((r) => ({ aftesia: r.aftesia, numri: r.kandidatet.size }))
    .sort((a, b) => b.numri - a.numri || a.aftesia.localeCompare(b.aftesia, "sq"))
    .slice(0, sa);
}

// ---------- Kërkuesi ----------

/** A e ka ndezur kërkuesi pëlqimin? Pa rresht = jo (parazgjedhja). RLS-i kthen vetëm rreshtin tim. */
export async function merrDukshmerine(): Promise<boolean> {
  const { data, error } = await supabase.from("dukshmeria").select("anonim").maybeSingle();
  if (error) hidhGabimin(error);
  return eshteObjekt(data) && data.anonim === true;
}

/** Ndez ose fik pëlqimin. Serveri lejon vetëm kërkuesin dhe vetëm për veten. Kthen vlerën e ruajtur. */
export async function vendosDukshmerine(anonim: boolean): Promise<boolean> {
  const { data, error } = await supabase.rpc("vendos_dukshmerine", { p_anonim: anonim });
  if (error) hidhGabimin(error);
  return data === true;
}
