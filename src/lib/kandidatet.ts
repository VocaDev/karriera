// "Kandidatët" e punëdhënësit dhe pëlqimi i kërkuesit për t'u parë anonimisht. Ekranet thërrasin vetëm këto funksione.
//
// Ku jetojnë të dhënat (supabase/migrations/20261125100000_kandidatet_anonim.sql):
//   dukshmeria            pëlqimi i kërkuesit (i fikur si parazgjedhje). Lexohet vetëm rreshti im; ndryshohet vetëm
//                         me vendos_dukshmerine() (vetëm kërkuesi).
//   kandidatet_anonim()   vetëm punëdhënësi, vetëm për punët e veta: kandidatë që kanë dhënë pëlqimin, ≥ 60% gati,
//                         nga 90 ditët e fundit. Pa emër, email, CV apo dëshmi: etiketë ("Kandidati #K27") dhe emrat e aftësive.
//   numrat_e_pozitave()   vetëm totale për secilën punë timen.
// Privatësia zbatohet në bazë; këtu vetëm kontrollojmë formën e përgjigjes.
import { mesazhiIGabimit } from "@/lib/hyrja-offline";
import { supabase } from "@/lib/supabase";

/** Pragu dhe dritarja që zbaton serveri (vetëm për tekstet në ekran; vendimi është te funksioni SQL). */
export const PRAGU_GATI = 60;
export const DITET_E_DUKSHME = 90;

export type Kandidati = {
  puna_id: string;
  kodi: string; // çelësi i kandidatit vetëm për këtë punëdhënës (16 hex)
  etiketa: string; // "Kandidati #K27"
  perqindja: number;
  ke: string[];
  mungon: string[];
  burimi: "cv" | "intervista";
  llogaritur_me: string; // YYYY-MM-DD
  intervista_nota: number | null;
  intervista_nr: number;
};

export type NumratEPozites = { puna_id: string; gati: number; ruajtur: number; kontrolluan: number };

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
    eshteTekst(v.llogaritur_me) &&
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
      ruajtur: Number(r.ruajtur) || 0,
      kontrolluan: Number(r.kontrolluan) || 0,
    });
  }
  return harta;
}

/** Një kandidat me përputhjen më të mirë te punët e mia, dhe sa punë të tjera i kalon pragun. */
export type KandidatiMeIMire = { kandidati: Kandidati; punetTjera: number };

/** Një rresht për kandidat (lista vjen e renditur, kështu që i pari për çdo kod është më i miri). */
export function meTeMiretSipasKandidatit(lista: Kandidati[]): KandidatiMeIMire[] {
  const harta = new Map<string, KandidatiMeIMire>();
  for (const k of lista) {
    const ekziston = harta.get(k.kodi);
    if (!ekziston) harta.set(k.kodi, { kandidati: k, punetTjera: 0 });
    else if (k.perqindja > ekziston.kandidati.perqindja) harta.set(k.kodi, { kandidati: k, punetTjera: ekziston.punetTjera + 1 });
    else ekziston.punetTjera += 1;
  }
  return [...harta.values()].sort((a, b) => b.kandidati.perqindja - a.kandidati.perqindja);
}

/** Aftësitë që përsëriten më shpesh te kandidatët (secili kandidat numërohet një herë për aftësi). */
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

/** "2026-11-25" → "25.11.2026" (pa varësi nga ora e telefonit). */
export function dataShqip(iso: string): string {
  const [v, m, d] = iso.slice(0, 10).split("-");
  return v && m && d ? `${d}.${m}.${v}` : iso;
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
