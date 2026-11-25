// Të gjitha thirrjet e Supabase për shpalljet e punës. Ekranet thërrasin vetëm këto funksione.
import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";

import { mesazhiIGabimit } from "@/lib/hyrja-offline";
import { PA_INTERNET_SHKURT } from "@/lib/mesazhet";
import { supabase } from "@/lib/supabase";

export type Puna = {
  id: string;
  titulli: string;
  kompania: string;
  qyteti: string;
  roli: "SWE" | "Asistent/PR" | "Tjetër";
  pershkrimi: string;
  aftesite: string[];
  // "portal" = e importuar nga KosovaJob / PortalPune nga Edge Function "portalet" (migrimi 20261114120000).
  burimi: "seed" | "perdoruesi" | "portal";
  krijuar_me: string; // ISO, për shiritin "E RE"
  pronari_id: string | null; // kush e postoi (null te "seed" dhe "portal"); e vendos serveri
  linku: string | null; // shpallja origjinale ("Hape në shfletues")
  portali: Portali | null; // vetëm te "portal"
  afati: string | null; // YYYY-MM-DD, afati i aplikimit
  aktive: boolean; // false = skadoi ose s'është më te portali
  kerkesat: Kerkesat | null; // nxjerrë nga AI-ja nga shpallja e portalit; null = s'u nxor (shih lexoKerkesat)
  // true = shtuar nga kërkuesi me "Sill linkun tënd": e sheh vetëm ai (RLS, migrimi 20261118100000).
  private: boolean;
};

/**
 * Çka e nxjerr AI-ja nga shpallja, me fjalët tona dhe në shqip (supabase/functions/portalet/kerkesat.ts).
 * Mungesa = null ose [], kurrë e sajuar. Ruhet te punet.kerkesat (jsonb, migrimi 20261115140000).
 */
export type Kerkesat = {
  permbledhja: string; // 1–2 fjali: çfarë pune është
  detyrat: string[];
  kerkesat: string[]; // të detyrueshmet
  perparesi: string[]; // të mirëseardhurat
  arsimi: string | null;
  pervoja: string | null;
  gjuhet: string[];
  orari: string | null;
  paga: string | null;
  perfitimet: string[];
  aplikimi: string | null;
};

const tekst = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const tekstet = (v: unknown, maks: number): string[] =>
  Array.isArray(v) ? v.flatMap((x) => (tekst(x) ? [tekst(x) as string] : [])).slice(0, maks) : [];

/**
 * jsonb nga serveri → Kerkesat, ose null. Shkruesi është Edge Function, por punëdhënësi mund të dërgojë kolonën te rreshti i vet,
 * prandaj çdo fushë kontrollohet: vetëm tekste, me kufij; çdo gjë tjetër hidhet. Pa përmbledhje = null (ekrani tregon "pershkrimi").
 */
export function lexoKerkesat(raw: unknown): Kerkesat | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const permbledhja = tekst(o.permbledhja);
  if (!permbledhja) return null;
  return {
    permbledhja,
    detyrat: tekstet(o.detyrat, 5),
    kerkesat: tekstet(o.kerkesat, 6),
    perparesi: tekstet(o.perparesi, 4),
    arsimi: tekst(o.arsimi),
    pervoja: tekst(o.pervoja),
    gjuhet: tekstet(o.gjuhet, 5),
    orari: tekst(o.orari),
    paga: tekst(o.paga),
    perfitimet: tekstet(o.perfitimet, 4),
    aplikimi: tekst(o.aplikimi),
  };
}

/** Rreshti nga Supabase → Puna (kerkesat kalon nga lexoKerkesat). Mysafiri s'e lexon pronari_id: null. */
function nePune(rreshti: unknown): Puna {
  const r = rreshti as Puna;
  return { ...r, pronari_id: r.pronari_id ?? null, kerkesat: lexoKerkesat(r.kerkesat), private: r.private === true };
}

export type Portali = "kosovajob" | "portalpune" | "ofertapune";

export const EMRI_I_PORTALIT: Record<Portali, string> = {
  kosovajob: "KosovaJob",
  portalpune: "PortalPune",
  ofertapune: "OfertaPune",
};

const FUSHAT =
  "id, titulli, kompania, qyteti, roli, pershkrimi, aftesite, burimi, krijuar_me, pronari_id, linku, portali, afati, aktive, kerkesat, private";

// Mysafiri (anon) lexon vetëm këto kolona: pa pronari_id (kush e postoi). Njëlloj si grant-i i kolonave për anon te
// migrimi 20261125120000_punet_mysafiri.sql; RLS-i i jep vetëm punët publike aktive.
const FUSHAT_PUBLIKE =
  "id, titulli, kompania, qyteti, roli, pershkrimi, aftesite, burimi, krijuar_me, linku, portali, afati, aktive, kerkesat, private";

const fushat = (mysafir: boolean) => (mysafir ? FUSHAT_PUBLIKE : FUSHAT);

// M1: lexon listën nga tabela "punet" (më të rejat lart). Vetëm punët aktive: shpalljet e skaduara
// të portaleve mbeten në tabelë (që ⭐ të mos humbasin), por s'dalin më në listë.
export async function listoPunet(mysafir = false): Promise<Puna[]> {
  const { data, error } = await supabase
    .from("punet")
    .select(fushat(mysafir))
    .eq("aktive", true)
    .order("krijuar_me", { ascending: false });
  if (error) throw new Error(mesazhiIGabimit(error));
  return data.map(nePune);
}

/**
 * Sa punë publike aktive për një rol kanë dalë pas një çasti (ISO). Vetëm numri (head: pa rreshta): për njoftimin
 * "punë të reja për rolin tënd" (src/lib/kujtesat.ts). Punët private (Sill linkun tënd) s'numërohen: i shtove vetë.
 */
export async function numroPunetERe(roli: Puna["roli"], pas: string): Promise<number> {
  const { count, error } = await supabase
    .from("punet")
    .select("id", { count: "exact", head: true })
    .eq("aktive", true)
    .eq("private", false)
    .eq("roli", roli)
    .gt("krijuar_me", pas);
  if (error) throw new Error(mesazhiIGabimit(error));
  return count ?? 0;
}

// Ekrani i detajeve: null nëse id-ja s'ekziston (roja e /pune/x99), ose (për mysafirin) s'është publike dhe aktive.
export async function gjePunen(id: string, mysafir = false): Promise<Puna | null> {
  const { data, error } = await supabase.from("punet").select(fushat(mysafir)).eq("id", id).maybeSingle();
  if (error) throw new Error(mesazhiIGabimit(error));
  return data ? nePune(data) : null;
}

export type PunaERe = Pick<Puna, "titulli" | "kompania" | "qyteti" | "roli" | "pershkrimi">;

// Puna që sapo u shtua nga telefoni: lista e lexon një herë, që ta shfaqë me animacion hyrjeje
// (orientim: "kjo është ajo që shtove"). Pastaj harrohet.
let idEPunesSeRe: string | null = null;
export function shenoPunenERe(id: string) {
  idEPunesSeRe = id;
}
export function merrPunenERe(): string | null {
  const id = idEPunesSeRe;
  idEPunesSeRe = null;
  return id;
}

// Puna që u ndryshua në një fletë (p.sh. teksti i shpalljes): detajet e rilexojnë një herë kur kthehen në fokus.
let idEPunesSeNdryshuar: string | null = null;
export function shenoPunenENdryshuar(id: string) {
  idEPunesSeNdryshuar = id;
}
export function uNdryshuaPuna(id: string): boolean {
  if (idEPunesSeNdryshuar !== id) return false;
  idEPunesSeNdryshuar = null;
  return true;
}

// Shton një shpallje. RLS-i (punet_shto) e lejon vetëm për punëdhënësin dhe qendrën, me burimi = "perdoruesi";
// pronari_id nuk dërgohet: serveri e vendos vetë (default auth.uid()).
// `id`: UUID që e krijon formulari një herë (RLS e pranon vetëm në formën e UUID-së). Pas një "s'mbaroi në kohë" prova e
// dytë dërgon të njëjtën id: nëse e para kishte mbërritur, 23505 = e shtuar tashmë, dhe kthejmë atë rresht, jo kopje.
export async function shtoPunen(puna: PunaERe, id?: string): Promise<Puna> {
  const { data, error } = await supabase
    .from("punet")
    .insert({ ...(id ? { id } : {}), ...puna, burimi: "perdoruesi" })
    .select(FUSHAT)
    .single();
  if (error) {
    if (error.code === "23505" && id) {
      const eShtuar = await gjePunen(id);
      if (eShtuar) return eShtuar;
    }
    throw new Error(mesazhiIGabimit(error));
  }
  return nePune(data);
}

// "Punët e mia" (punëdhënësi, qendra). Pa filtër në kod: RLS-i (punet_lexo) i kthen punëdhënësit
// vetëm punët e veta, kështu që dy punëdhënës s'ia shohin shpalljet njëri-tjetrit as përmes API-t.
export async function listoPunetEMia(): Promise<Puna[]> {
  const { data, error } = await supabase.from("punet").select(FUSHAT).order("krijuar_me", { ascending: false });
  if (error) throw new Error(mesazhiIGabimit(error));
  return data.map(nePune);
}

// Fshin një punë timen. Nëse s'është imja, RLS-i (punet_fshi) s'fshin asgjë: e tregojmë si gabim.
export async function fshiPunen(id: string): Promise<void> {
  const { data, error } = await supabase.from("punet").delete().eq("id", id).select("id");
  if (error) throw new Error(mesazhiIGabimit(error));
  if (!data || data.length === 0) throw new Error("Kjo punë s'mund të fshihet nga llogaria jote.");
}

/**
 * Teksti i shpalljes i një pune private (e ngjit vetë pronari, ≤ 4000 shkronja): "A jam gati?" e lexon kur s'ka kërkesat e AI-së.
 * RLS: punet_ndrysho (vetëm pronari) + grant update (pershkrimi) nga J6; check-u lejon 4000 vetëm te punët private.
 */
export async function ruajTekstinEShpalljes(id: string, teksti: string): Promise<Puna> {
  const pershkrimi = teksti.trim();
  if (pershkrimi.length > KUFIJTE_E_LINKUT.pershkrimi) {
    throw new Error("Teksti i shpalljes është shumë i gjatë (maksimumi 4000 shkronja).");
  }
  const { data, error } = await supabase
    .from("punet")
    .update({ pershkrimi })
    .eq("id", id)
    .eq("private", true)
    .select(FUSHAT)
    .maybeSingle();
  if (error) throw new Error(mesazhiIGabimit(error));
  if (!data) throw new Error("Ky tekst mund të ndryshohet vetëm te punët që i ke shtuar vetë me link.");
  return nePune(data);
}

// Punët e reja në kohë reale (Supabase Realtime): kur një punëdhënës poston, kërkuesi e merr menjëherë.
// Realtime-i zbaton të njëjtin RLS: vetëm llogaritë e kyçura i marrin ngjarjet. Kthen funksionin për t'u shkëputur.
// Vetëm burimi = "perdoruesi": importi i përditshëm nga portalet shton dhjetëra rreshta njëherësh,
// dhe secili do të jepte një njoftim dhe një dridhje. Ato dalin në listë me rifreskimin e radhës.
export function degjoPunetERe(emriIKanalit: string, kurVjen: (puna: Puna) => void): () => void {
  const kanali = supabase
    .channel(emriIKanalit)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "punet", filter: "burimi=eq.perdoruesi" }, (ngjarja) => {
      kurVjen(nePune(ngjarja.new));
    })
    .subscribe();
  return () => {
    supabase.removeChannel(kanali);
  };
}

// ---------- "Sill linkun tënd" (J7): kërkuesi shton një shpallje që e gjeti diku tjetër, si punë private ----------

/** Kufijtë e njëjtë me bazën (check constraints te punet + migrimi 20261118100000). */
export const KUFIJTE_E_LINKUT = { linku: 500, titulli: 120, kompania: 80, qyteti: 60, pershkrimi: 4000 } as const;

/** Kur përdoruesi s'e jep qytetin. Baza e kërkon (2–60 shkronja) dhe s'e sajojmë. */
export const PA_QYTET = "Pa qytet";

// Parametrat e gjurmimit s'e ndryshojnë shpalljen: hiqen, që i njëjti link të njihet si i njëjtë.
const GJURMIMI = /^(utm_[a-z]+|fbclid|gclid|dclid|msclkid|igshid|mc_cid|mc_eid|_ga|ref_src)$/i;
// Domene që s'janë faqe publike: rrjeti i brendshëm i kompjuterit, i shtëpisë apo i kompanisë.
const EMRAT_E_BRENDSHEM = /(^|\.)(localhost|local|internal|intranet|lan|home|corp|test|invalid|example)$/i;

export type LinkuIKontrolluar = { ok: true; linku: string } | { ok: false; gabimi: string };

/**
 * Teksti i ngjitur → linku në formën kanonike, ose arsyeja pse s'pranohet (në shqip).
 * Vetëm https, me emër domeni (jo IP, jo localhost), pa "user:pass@". Kanonike: domeni me shkronja të vogla,
 * pa portin 443, pa "#...", pa parametrat e gjurmimit, pa "/" në fund. Pa `new URL()`: në React Native s'është i plotë.
 */
export function kontrolloLinkun(teksti: string): LinkuIKontrolluar {
  let s = teksti.trim();
  if (!s) return { ok: false, gabimi: "Ngjit linkun e shpalljes." };
  if (/\s/.test(s)) return { ok: false, gabimi: "Linku s'duhet të ketë hapësira. Kopjoje përsëri nga shfletuesi." };
  if (/^http:\/\//i.test(s)) return { ok: false, gabimi: "Linku duhet të fillojë me https:// (lidhje e sigurt)." };
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = `https://${s}`; // "kosovajob.com/..." pa skemë
  const pjeset = /^https:\/\/([^/?#]+)([^?#]*)(\?[^#]*)?(#.*)?$/i.exec(s);
  if (!pjeset) return { ok: false, gabimi: "Ky s'duket si link i një faqeje (https://...)." };
  const [, autoriteti, rruga, pyetja] = pjeset;
  if (autoriteti.includes("@")) return { ok: false, gabimi: "Linku s'duhet të ketë emër përdoruesi apo fjalëkalim." };

  const hp = /^([^:]+)(?::(\d{1,5}))?$/.exec(autoriteti);
  if (!hp) return { ok: false, gabimi: "Adresa e faqes s'është e saktë." };
  const domeni = hp[1].toLowerCase().replace(/\.$/, "");
  const porti = hp[2] && hp[2] !== "443" ? `:${hp[2]}` : "";
  if (/^\d+(\.\d+){3}$/.test(domeni) || domeni.startsWith("[")) {
    return { ok: false, gabimi: "Përdor linkun me emrin e faqes, jo me adresë IP." };
  }
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*\.([a-z]{2,63}|xn--[a-z0-9-]{1,59})$/.test(domeni) || EMRAT_E_BRENDSHEM.test(domeni)) {
    return { ok: false, gabimi: "Ky s'duket si link i një faqeje publike." };
  }

  const rrugaPa = rruga.length > 1 ? rruga.replace(/\/+$/, "") : "";
  const parametrat = (pyetja ?? "")
    .slice(1)
    .split("&")
    .filter((p) => p && !GJURMIMI.test(p.split("=")[0]));
  const linku = `https://${domeni}${porti}${rrugaPa}${parametrat.length ? `?${parametrat.join("&")}` : ""}`;
  if (linku.length > KUFIJTE_E_LINKUT.linku) return { ok: false, gabimi: "Linku është shumë i gjatë (maksimumi 500 shkronja)." };
  return { ok: true, linku };
}

export type PunaNgaLinku = {
  linku: string;
  titulli: string;
  kompania: string;
  qyteti?: string;
  pershkrimi?: string;
  /** Nga lexoShpalljenNgaLinku, vetëm kur u lexua i njëjti link. */
  kerkesat?: Kerkesat | null;
  aftesite?: string[];
};

/** Çka nxori serveri nga faqja e shpalljes (Edge Function lexo-linkun). Mungesa = null / "" / [], kurrë e sajuar. */
export type ShpalljaELexuar = {
  linku: string; // forma kanonike, e njëjtë me kontrolloLinkun
  titulli: string | null;
  kompania: string | null;
  qyteti: string | null;
  pershkrimi: string; // përmbledhja me fjalët tona (≤ 1000); "" kur s'u nxorën kërkesat
  kerkesat: Kerkesat | null;
  aftesite: string[];
};

const tekstMeKufi = (v: unknown, min: number, maks: number): string | null => {
  const t = tekst(v);
  return t && t.length >= min && t.length <= maks ? t : null;
};

/**
 * "Sill linkun tënd": serveri e hap faqen e shpalljes një herë dhe kthen titullin, kompaninë, qytetin dhe kërkesat
 * (supabase/functions/lexo-linkun). Hedh Error me një fjali në shqip kur faqja s'lexohet (mur hyrjeje si LinkedIn,
 * bllokim, s'u përgjigj, s'ka shpallje): formulari mbetet për t'u plotësuar me dorë. 20 lexime në 24 orë.
 */
export async function lexoShpalljenNgaLinku(linku: string, roli?: Puna["roli"] | null): Promise<ShpalljaELexuar> {
  const kontrolli = kontrolloLinkun(linku);
  if (!kontrolli.ok) throw new Error(kontrolli.gabimi);
  const body: Record<string, string> = { linku: kontrolli.linku };
  if (roli === "SWE" || roli === "Asistent/PR") body.roli = roli;

  const { data, error } = await supabase.functions.invoke("lexo-linkun", { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const mesazhi = await (error.context as Response).json().then(
        (trupi: unknown) => (trupi && typeof trupi === "object" ? tekst((trupi as Record<string, unknown>).error) : null),
        () => null, // përgjigje pa JSON
      );
      if (mesazhi) throw new Error(mesazhi);
    }
    if (error instanceof FunctionsFetchError) throw new Error(PA_INTERNET_SHKURT);
    throw new Error("S'arritëm ta lexojmë këtë faqe.");
  }

  const d = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  if (d.linku !== kontrolli.linku) throw new Error("S'arritëm ta lexojmë këtë faqe.");
  const kerkesat = lexoKerkesat(d.kerkesat);
  return {
    linku: kontrolli.linku,
    titulli: tekstMeKufi(d.titulli, 3, KUFIJTE_E_LINKUT.titulli),
    kompania: tekstMeKufi(d.kompania, 2, KUFIJTE_E_LINKUT.kompania),
    qyteti: tekstMeKufi(d.qyteti, 2, KUFIJTE_E_LINKUT.qyteti),
    pershkrimi: tekstMeKufi(d.pershkrimi, 1, 1000) ?? "",
    kerkesat,
    aftesite: tekstet(d.aftesite, 10).filter((a) => a.length <= 60),
  };
}

/** Gabimet e shtimit: fjalia e bazës për rastet që i njohim, përndryshe mesazhiIGabimit (internet etj.). */
function gabimiIShtimit(gabimi: { code?: string; hint?: string | null; message?: string }): Error {
  if (gabimi.code === "P0001" && gabimi.hint === "kufiri_private" && gabimi.message) return new Error(gabimi.message);
  if (gabimi.code === "23514") return new Error("Disa fusha s'janë të sakta. Kontrollo linkun dhe titullin.");
  if (gabimi.code === "42501") return new Error("Vetëm llogaritë e kërkuesve mund të shtojnë punë me link.");
  return new Error(mesazhiIGabimit(gabimi));
}

/** Puna e dukshme për mua me këtë link (imja private, ose një shpallje publike, p.sh. nga portali), ose null. */
async function gjePunenMeLink(linku: string): Promise<Puna | null> {
  const { data, error } = await supabase.from("punet").select(FUSHAT).eq("linku", linku).limit(1).maybeSingle();
  if (error) throw new Error(mesazhiIGabimit(error));
  return data ? nePune(data) : null;
}

/**
 * "Sill linkun tënd": shton një punë private (e sheh vetëm kërkuesi që e shtoi; RLS punet_shto_private + punet_lexo).
 * Një link një herë: nëse e ke shtuar më parë, ose shpallja është tashmë në Karriera nga portali, kthehet ajo
 * (`ekzistonte: true`) në vend të një kopjeje. pronari_id s'dërgohet: e vendos serveri (default auth.uid()).
 * `pershkrimi` = teksti i shpalljes që e ngjit vetë përdoruesi (opsional); "A jam gati?" e lexon kur s'ka kërkesat e AI-së.
 */
export async function shtoPunenNgaLinku(
  hyrja: PunaNgaLinku,
  roli: Puna["roli"] = "Tjetër",
): Promise<{ puna: Puna; ekzistonte: boolean }> {
  const kontrolli = kontrolloLinkun(hyrja.linku);
  if (!kontrolli.ok) throw new Error(kontrolli.gabimi);
  const titulli = hyrja.titulli.trim();
  const kompania = hyrja.kompania.trim();
  const qyteti = hyrja.qyteti?.trim() || PA_QYTET;
  const pershkrimi = hyrja.pershkrimi?.trim() ?? "";
  if (titulli.length < 3 || titulli.length > KUFIJTE_E_LINKUT.titulli) throw new Error("Titulli duhet të ketë 3 deri në 120 shkronja.");
  if (kompania.length < 2 || kompania.length > KUFIJTE_E_LINKUT.kompania) {
    throw new Error("Kompania duhet të ketë 2 deri në 80 shkronja.");
  }
  if (qyteti.length < 2 || qyteti.length > KUFIJTE_E_LINKUT.qyteti) throw new Error("Qyteti duhet të ketë 2 deri në 60 shkronja.");
  if (pershkrimi.length > KUFIJTE_E_LINKUT.pershkrimi) {
    throw new Error("Teksti i shpalljes është shumë i gjatë (maksimumi 4000 shkronja).");
  }

  const ekziston = await gjePunenMeLink(kontrolli.linku);
  if (ekziston) return { puna: ekziston, ekzistonte: true };

  const rreshti = { titulli, kompania, qyteti, roli, pershkrimi, linku: kontrolli.linku, burimi: "perdoruesi", private: true };
  const aftesite = (hyrja.aftesite ?? []).slice(0, 10);
  const shto = (meKerkesat: boolean) =>
    supabase
      .from("punet")
      .insert({ ...rreshti, ...(aftesite.length ? { aftesite } : {}), ...(meKerkesat && hyrja.kerkesat ? { kerkesat: hyrja.kerkesat } : {}) })
      .select(FUSHAT)
      .single();
  let { data, error } = await shto(true);
  // Para migrimit 20261125100000 baza s'e pranon "kerkesat" te punët private (23514): shtohet pa to. Përmbledhja
  // (pershkrimi) dhe aftësitë mbeten, kështu që "A jam gati?" ka prapë çka të krahasojë.
  if (error?.code === "23514" && hyrja.kerkesat) ({ data, error } = await shto(false));
  if (error) {
    // Dy prekje njëra pas tjetrës (ose dy telefona): indeksi unik e ndalon kopjen; kthejmë atë që u shtua.
    if (error.code === "23505") {
      const ePara = await gjePunenMeLink(kontrolli.linku);
      if (ePara) return { puna: ePara, ekzistonte: true };
    }
    throw gabimiIShtimit(error);
  }
  return { puna: nePune(data), ekzistonte: false };
}
