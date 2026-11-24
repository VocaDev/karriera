// Klienti i intervistës: ekranet thërrasin VETËM këto funksione.
//
//   intervista-nis      nis (ose vazhdon) intervistën për një punë → pyetja e parë
//   intervista-kthesa   dërgon përgjigjen → pyetja tjetër ose fundi
//   intervista-raporti  raporti përfundimtar + gatishmëria e re (idempotent)
//   intervista-zeri     përgjigjja me zë (STT → e njëjta kthesë → TTS) dhe zëri i pyetjes aktuale
//   tabelat             intervistat dhe intervista_kthesat lexohen me RLS (vetëm të miat); app-i s'shkruan aty
//
// Çelësi i AI-së s'del kurrë në telefon. Pyetjet dhe përgjigjet s'shkruhen në log.
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";
import { File } from "expo-file-system";
import { fetch as fetchMeRrjedhe } from "expo/fetch";

import { mesazhiIGabimit } from "@/lib/hyrja-offline";
import { HYR_PERSERI, PA_INTERNET_SHKURT, VONON } from "@/lib/mesazhet";
import { KOHA_E_AI, meKohe } from "@/lib/rrjeti";
import { supabase } from "@/lib/supabase";

import { lexoIntervistuesinPer, ruajIntervistuesinPer } from "./intervistuesi";
import type { FjaliaMeZe } from "./mesazhet";
import {
  eshteGjuhe,
  eshteIntervistues,
  eshteObjekt,
  eshteRaport,
  INTERVISTUESI_FILLESTAR,
  lexoInfon,
  lexoKthesen,
  type Gjatesia,
  type Gjuha,
  type IntervistaInfo,
  type Intervistuesi,
  type Kthesa,
  type Raporti,
  type RreshtiIBisedes,
} from "./tipet";

export type KodiIGabimit =
  | "kufiri" // 3 intervista në 24 orë
  | "ai" // AI-ja dështoi: riprovo
  | "jashte_radhe" // pyetja s'është më aktuale: rilexo gjendjen
  | "po_perpunohet" // dërgim i dyfishtë, ose raporti po shkruhet
  | "mbaroi" // intervista s'është më aktive
  | "aktive" // raporti u kërkua para fundit
  | "zeri" // dëgjimi ose zëri dështoi: riprovo ose shkruaj
  | "zeri_pa_konfigurim" // zëri s'është gati në server: vetëm me shkrim
  | "kufiri_zerit" // minutat e zërit për sot mbaruan
  | "rrjeti"
  | "vonese" // s'u përgjigj në kohë (VONON)
  | "sesioni"
  | "tjeter";

/** Gabim me mesazh në shqip (nga serveri ose nga ky fajll) dhe një kod që ekrani e përdor për të vendosur çka bën. */
export class GabimIIntervistes extends Error {
  readonly kodi: KodiIGabimit;
  readonly status: number | null;
  /** Kur serveri thotë "jashte_radhe", kthen edhe pyetjen aktuale. */
  readonly kthesa: Kthesa | null;
  /** Përgjigjja me zë u dëgjua, por kthesa dështoi: transkripti s'humbet (riprovohet si tekst). */
  readonly transkripti: string | null;

  constructor(
    mesazhi: string,
    kodi: KodiIGabimit,
    status: number | null = null,
    kthesa: Kthesa | null = null,
    transkripti: string | null = null,
  ) {
    super(mesazhi);
    this.name = "GabimIIntervistes";
    this.kodi = kodi;
    this.status = status;
    this.kthesa = kthesa;
    this.transkripti = transkripti;
  }

  /** A ka kuptim butoni "Provo përsëri" me të njëjtën kërkesë. */
  get riprovohet(): boolean {
    return (
      this.kodi === "ai" ||
      this.kodi === "rrjeti" ||
      this.kodi === "vonese" ||
      this.kodi === "tjeter" ||
      this.kodi === "po_perpunohet" ||
      this.kodi === "zeri"
    );
  }
}

const KODET: readonly string[] = [
  "kufiri",
  "ai",
  "jashte_radhe",
  "po_perpunohet",
  "mbaroi",
  "aktive",
  "zeri",
  "zeri_pa_konfigurim",
  "kufiri_zerit",
];

async function perktheGabimin(gabimi: unknown, rezerva: string): Promise<GabimIIntervistes> {
  if (gabimi instanceof FunctionsHttpError) {
    const pergjigjja = gabimi.context as Response;
    const status = pergjigjja.status;
    try {
      const trupi: unknown = await pergjigjja.json();
      if (eshteObjekt(trupi) && typeof trupi.error === "string") {
        const kodi: KodiIGabimit =
          typeof trupi.kodi === "string" && KODET.includes(trupi.kodi)
            ? (trupi.kodi as KodiIGabimit)
            : status === 401
              ? "sesioni"
              : "tjeter";
        const transkripti = typeof trupi.transkripti === "string" && trupi.transkripti.trim() ? trupi.transkripti : null;
        return new GabimIIntervistes(trupi.error, kodi, status, lexoKthesen(trupi.kthesa), transkripti);
      }
    } catch {
      // përgjigje pa JSON
    }
    return new GabimIIntervistes(rezerva, status === 401 ? "sesioni" : "tjeter", status);
  }
  if (gabimi instanceof FunctionsFetchError) {
    return new GabimIIntervistes(PA_INTERNET_SHKURT, "rrjeti");
  }
  if (gabimi instanceof FunctionsRelayError) return new GabimIIntervistes(VONON.pergjithshme, "vonese");
  return new GabimIIntervistes(rezerva, "tjeter");
}

function eshte401(gabimi: unknown): boolean {
  return gabimi instanceof FunctionsHttpError && (gabimi.context as Response).status === 401;
}

type Funksioni = "intervista-nis" | "intervista-kthesa" | "intervista-raporti" | "intervista-zeri";

const VONESA: Record<Funksioni, string> = {
  "intervista-nis": VONON.nisja,
  "intervista-kthesa": VONON.intervista,
  "intervista-raporti": VONON.rezultatet,
  "intervista-zeri": VONON.intervista,
};

// Si te lib/cv.ts: 401 = serveri s'e njeh më sesionin → një rifreskim; nëse s'mjafton, dalim nga llogaria.
async function thirr(emri: Funksioni, body: object | FormData, rezerva: string, ms = KOHA_E_AI): Promise<unknown> {
  // Ruajtësi i kohës: një lidhje që varet bëhet gabim "rrjeti" (me "Provo përsëri"), jo pritje pa fund.
  // Serveri e njeh përgjigjen e dyfishtë (409), prandaj riprovimi pas kësaj është i sigurt.
  const thirrja = () =>
    meKohe(
      supabase.functions.invoke(emri, { body }),
      ms,
      () => new GabimIIntervistes(VONESA[emri], "vonese"),
    );
  let { data, error } = await thirrja();
  if (error && eshte401(error)) {
    const { error: gabimiRifreskimit } = await supabase.auth.refreshSession();
    if (gabimiRifreskimit) {
      await supabase.auth.signOut({ scope: "local" });
      throw new GabimIIntervistes(HYR_PERSERI.cfare, "sesioni", 401); // roja çon te hyrja, ku del karta "Hyr përsëri"
    }
    ({ data, error } = await thirrja());
  }
  if (error) throw await perktheGabimin(error, rezerva);
  return data;
}

const PERGJIGJE_E_PAPLOTE = "Përgjigjja erdhi e paplotë. Provo përsëri.";

// ---------- Funksionet ----------

export type Nisja = { intervista: IntervistaInfo; kthesa: Kthesa; rifilluar: boolean };

/** Nis një intervistë për punën; nëse ka një të nisur (24 orët e fundit, e njëjta gjuhë e gjatësi), e vazhdon atë. */
export async function nisIntervisten(opts: {
  punaId: string;
  gjuha: Gjuha;
  gjatesia: Gjatesia;
  intervistuesi: Intervistuesi;
}): Promise<Nisja> {
  const data = await thirr(
    "intervista-nis",
    { puna_id: opts.punaId, gjuha: opts.gjuha, gjatesia: opts.gjatesia, intervistuesi: opts.intervistuesi },
    "Intervista s'u nis. Provo përsëri.",
  );
  const intervista = eshteObjekt(data) ? lexoInfon(data.intervista) : null;
  const kthesa = eshteObjekt(data) ? lexoKthesen(data.kthesa) : null;
  if (!intervista || !kthesa) throw new GabimIIntervistes(PERGJIGJE_E_PAPLOTE, "tjeter");
  // Chat-i lexon emrin nga këtu (kolona konteksti s'është e lexueshme nga app-i).
  await ruajIntervistuesinPer(intervista.id, intervista.intervistuesi);
  return { intervista, kthesa, rifilluar: eshteObjekt(data) && data.rifilluar === true };
}

export type PasPergjigjes =
  | { fund: false; kthesa: Kthesa; nr_pyetjeve: number }
  | { fund: true; reagimi: string | null; nr_pyetjeve: number };

function lexoPasPergjigjes(data: unknown): PasPergjigjes {
  if (!eshteObjekt(data) || typeof data.nr_pyetjeve !== "number") {
    throw new GabimIIntervistes(PERGJIGJE_E_PAPLOTE, "tjeter");
  }
  if (data.fund === true) {
    return { fund: true, reagimi: typeof data.reagimi === "string" ? data.reagimi : null, nr_pyetjeve: data.nr_pyetjeve };
  }
  const kthesa = lexoKthesen(data.kthesa);
  if (!kthesa) throw new GabimIIntervistes(PERGJIGJE_E_PAPLOTE, "tjeter");
  return { fund: false, kthesa, nr_pyetjeve: data.nr_pyetjeve };
}

/** Dërgon përgjigjen për pyetjen `nr`. Serveri refuzon dërgimin e dyfishtë dhe pyetjet jashtë radhe (409). */
export async function dergoPergjigjen(intervistaId: string, nr: number, pergjigja: string): Promise<PasPergjigjes> {
  const data = await thirr(
    "intervista-kthesa",
    { intervista_id: intervistaId, nr, pergjigja },
    "Përgjigjja s'u dërgua. Provo përsëri.",
  );
  return lexoPasPergjigjes(data);
}

/** Kandidati e mbyll vetë intervistën (duhet të paktën një përgjigje). */
export async function perfundoIntervisten(intervistaId: string, nr: number): Promise<PasPergjigjes> {
  const data = await thirr(
    "intervista-kthesa",
    { intervista_id: intervistaId, nr, perfundo: true },
    "Intervista s'u mbyll. Provo përsëri.",
  );
  return lexoPasPergjigjes(data);
}

// ---------- Zëri ----------

function lexoFjalite(v: unknown): FjaliaMeZe[] | null {
  if (!eshteObjekt(v) || !Array.isArray(v.fjalite)) return null;
  const fjalite: FjaliaMeZe[] = [];
  for (const f of v.fjalite) {
    if (!eshteObjekt(f) || typeof f.teksti !== "string" || typeof f.audio_base64 !== "string") return null;
    fjalite.push({ teksti: f.teksti, audio_base64: f.audio_base64, mime: typeof f.mime === "string" ? f.mime : "audio/wav" });
  }
  return fjalite;
}

export type PasZerit =
  | { degjuar: false }
  | {
      degjuar: true;
      transkripti: string;
      pas: PasPergjigjes;
      /** null kur zëri i intervistuesit s'u krijua: pyetja shfaqet si tekst. */
      fjalite: FjaliaMeZe[] | null;
      gabimiZerit: string | null;
    };

/**
 * Dërgon përgjigjen me zë (WAV nga AudioStream) për pyetjen `nr`. Serveri e kthen në tekst dhe e përpunon si një
 * përgjigje të shkruar. `degjuar: false` = s'u dëgjua asnjë fjalë (pyetja mbetet e njëjta).
 */
export async function dergoZerin(intervistaId: string, nr: number, uri: string): Promise<PasZerit> {
  const forma = new FormData();
  forma.append("intervista_id", intervistaId);
  forma.append("nr", String(nr));
  // React Native e ngarkon skedarin nga `uri` (s'lexohet në JS).
  forma.append("audio", { uri, name: "pergjigja.wav", type: "audio/wav" } as unknown as Blob);
  const data = await thirr("intervista-zeri", forma, "Përgjigjja me zë s'u dërgua. Provo përsëri.");
  if (!eshteObjekt(data)) throw new GabimIIntervistes(PERGJIGJE_E_PAPLOTE, "tjeter");
  if (data.degjuar !== true) return { degjuar: false };
  const transkripti = typeof data.transkripti === "string" ? data.transkripti : "";
  return {
    degjuar: true,
    transkripti,
    pas: lexoPasPergjigjes(data),
    fjalite: lexoFjalite(data.zeri),
    gabimiZerit: typeof data.gabimi_zerit === "string" ? data.gabimi_zerit : null,
  };
}

/** Zëri i pyetjes aktuale (pyetja e parë, ose kur intervista rihapet në Fol). Teksti merret nga serveri. */
export type PjesaEZerit = "reagimi" | "pyetja" | "mbushesi";

/** Një audio zëri zgjat ~2–6 s te ofruesi; pas kaq pritjeje pyetja mbetet si tekst dhe intervista vazhdon. */
const KOHA_E_ZERIT = 25_000;

/**
 * Zëri i pyetjes aktuale `nr`. Me `pjesa`, vetëm reagimi ose vetëm pyetja (app-i i kërkon paralelisht, që reagimi
 * i shkurtër të nisë më shpejt), ose "mbushesi" (pranimi i shkurtër që luhet sa pret kthesën). Teksti vjen nga serveri.
 * Lista bosh = s'ka çka të thuhet (p.sh. pyetja e parë pa reagim).
 */
export async function zeriIPyetjes(intervistaId: string, nr: number, pjesa?: PjesaEZerit): Promise<FjaliaMeZe[]> {
  const data = await thirr(
    "intervista-zeri",
    { veprimi: "fol", intervista_id: intervistaId, nr, ...(pjesa ? { pjesa } : {}) },
    "Zëri i pyetjes s'u krijua.",
    KOHA_E_ZERIT,
  );
  const fjalite = eshteObjekt(data) ? lexoFjalite(data.zeri) : null;
  if (!fjalite) throw new GabimIIntervistes(PERGJIGJE_E_PAPLOTE, "zeri");
  return fjalite;
}

// ---------- Zëri me rrjedhë (24.11) ----------
// Të njëjtat dy veprime të intervista-zeri, por përgjigjja është NDJSON: transkripti, teksti i pyetjes dhe zëri (PCM) vijnë
// sapo janë gati. `supabase.functions.invoke` nuk e lexon trupin pjesë-pjesë, ndaj këtu përdoret `expo/fetch` (streaming,
// SDK 58). Kontrata e ngjarjeve është te koka e supabase/functions/intervista-zeri/index.ts.

export type PerRrjedhen = {
  /** Transkripti i përgjigjes (para se të vijë pyetja e re). */
  onDegjuar?: (transkripti: string) => void;
  /** Teksti i pyetjes së re (ose fundi) erdhi. Thirret para copës së parë të zërit. */
  onKthesa?: (pas: PasPergjigjes) => void;
  /** Një copë zëri: PCM 16 bit mono, base64, me shkallën e mostrimit. */
  onPcm: (b: string, shkalla: number) => void;
  /** Zëri dështoi ose u ndërpre pasi teksti erdhi: pyetja është në ekran, intervista vazhdon. */
  onGabimZerit: (mesazhi: string) => void;
};

const kodiIGabimit = (v: unknown): KodiIGabimit =>
  typeof v === "string" && KODET.includes(v) ? (v as KodiIGabimit) : "tjeter";

/** POST te intervista-zeri me rrjedhë; 401 → një rifreskim sesioni (si te `thirr`). Gabimet HTTP bëhen GabimIIntervistes. */
async function hapRrjedhen(trupi: string | Uint8Array<ArrayBuffer>, tipi: string, rezerva: string): Promise<Response> {
  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/intervista-zeri`;
  const celesi = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
  const provo = async (): Promise<Response> => {
    const { data } = await supabase.auth.getSession();
    const kontrolli = new AbortController();
    const ora = setTimeout(() => kontrolli.abort(), KOHA_E_AI);
    try {
      return await fetchMeRrjedhe(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}`, apikey: celesi, "Content-Type": tipi },
        body: trupi,
        signal: kontrolli.signal,
      });
    } catch {
      if (kontrolli.signal.aborted) throw new GabimIIntervistes(VONON.intervista, "vonese");
      throw new GabimIIntervistes(PA_INTERNET_SHKURT, "rrjeti");
    } finally {
      clearTimeout(ora); // koha vlen deri te përgjigjja e parë; rrjedha vazhdon pa të
    }
  };
  let r = await provo();
  if (r.status === 401) {
    const { error } = await supabase.auth.refreshSession();
    if (error) {
      await supabase.auth.signOut({ scope: "local" });
      throw new GabimIIntervistes(HYR_PERSERI.cfare, "sesioni", 401);
    }
    r = await provo();
  }
  if (r.ok) return r;
  let trupiIGabimit: unknown = null;
  try {
    trupiIGabimit = await r.json();
  } catch {
    // pa JSON
  }
  if (eshteObjekt(trupiIGabimit) && typeof trupiIGabimit.error === "string") {
    const transkripti =
      typeof trupiIGabimit.transkripti === "string" && trupiIGabimit.transkripti.trim() ? trupiIGabimit.transkripti : null;
    throw new GabimIIntervistes(
      trupiIGabimit.error,
      r.status === 401 ? "sesioni" : kodiIGabimit(trupiIGabimit.kodi),
      r.status,
      lexoKthesen(trupiIGabimit.kthesa),
      transkripti,
    );
  }
  throw new GabimIIntervistes(rezerva, r.status === 401 ? "sesioni" : "tjeter", r.status);
}

/** Lexon rreshtat JSON të përgjigjes ndërsa vijnë. Rreshti i dëmtuar kapërcehet; `ng` mund të hedhë (gabim i kthesës). */
async function lexoNdjson(r: Response, ng: (n: Record<string, unknown>) => void): Promise<void> {
  const lexuesi = r.body?.getReader();
  if (!lexuesi) throw new GabimIIntervistes(PERGJIGJE_E_PAPLOTE, "zeri");
  const dekoduesi = new TextDecoder();
  let tampon = "";
  const trajto = (rreshti: string) => {
    let v: unknown;
    try {
      v = JSON.parse(rreshti);
    } catch {
      return;
    }
    if (eshteObjekt(v)) ng(v);
  };
  for (;;) {
    const { value, done } = await lexuesi.read();
    if (done) break;
    tampon += dekoduesi.decode(value, { stream: true });
    let i = tampon.indexOf("\n");
    while (i >= 0) {
      const rreshti = tampon.slice(0, i).trim();
      tampon = tampon.slice(i + 1);
      if (rreshti) trajto(rreshti);
      i = tampon.indexOf("\n");
    }
  }
  if (tampon.trim()) trajto(tampon.trim());
}

/** Trupi multipart me dorë: `expo/fetch` s'e pranon `{ uri }` të React Native, por pranon bajte. */
function multipart(fushat: Record<string, string>, audio: Uint8Array): { trupi: Uint8Array<ArrayBuffer>; tipi: string } {
  const kufiri = `----karriera${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const kodues = new TextEncoder();
  const pjeset: Uint8Array[] = [];
  for (const [k, v] of Object.entries(fushat)) {
    pjeset.push(kodues.encode(`--${kufiri}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  }
  pjeset.push(
    kodues.encode(
      `--${kufiri}\r\nContent-Disposition: form-data; name="audio"; filename="pergjigja.wav"\r\nContent-Type: audio/wav\r\n\r\n`,
    ),
    audio,
    kodues.encode(`\r\n--${kufiri}--\r\n`),
  );
  const gjatesia = pjeset.reduce((s, p) => s + p.length, 0);
  const trupi = new Uint8Array(new ArrayBuffer(gjatesia));
  let nga = 0;
  for (const p of pjeset) {
    trupi.set(p, nga);
    nga += p.length;
  }
  return { trupi, tipi: `multipart/form-data; boundary=${kufiri}` };
}

/**
 * Përgjigjja me zë, me rrjedhë. `{ degjuar: false }` = s'u dëgjua asnjë fjalë. Gabimet para pyetjes së re hidhen si
 * GabimIIntervistes (me transkriptin kur u dëgjua); pas saj, zëri që dështon thërret vetëm `onGabimZerit`.
 */
export async function dergoZerinMeRrjedhe(
  intervistaId: string,
  nr: number,
  uri: string,
  ng: PerRrjedhen,
): Promise<{ degjuar: boolean }> {
  const audio = new Uint8Array(await new File(uri).arrayBuffer());
  const { trupi, tipi } = multipart({ intervista_id: intervistaId, nr: String(nr), rrjedhe: "1" }, audio);
  const r = await hapRrjedhen(trupi, tipi, "Përgjigjja me zë s'u dërgua. Provo përsëri.");
  if ((r.headers.get("content-type") ?? "").includes("application/json")) {
    // S'u dëgjua asnjë fjalë: përgjigje e zakonshme JSON, pa rrjedhë.
    const data: unknown = await r.json().catch(() => null);
    if (eshteObjekt(data) && data.degjuar === false) return { degjuar: false };
    throw new GabimIIntervistes(PERGJIGJE_E_PAPLOTE, "tjeter");
  }
  let transkripti = "";
  let kthesaErdhi = false;
  let mbaroi = false;
  try {
    await lexoNdjson(r, (n) => {
      switch (n.e) {
        case "degjuar":
          transkripti = typeof n.transkripti === "string" ? n.transkripti : "";
          ng.onDegjuar?.(transkripti);
          break;
        case "kthesa":
          kthesaErdhi = true;
          ng.onKthesa?.(lexoPasPergjigjes(n));
          break;
        case "pcm":
          if (typeof n.b === "string" && typeof n.s === "number") ng.onPcm(n.b, n.s);
          break;
        case "gabim_zerit":
          ng.onGabimZerit(typeof n.mesazhi === "string" ? n.mesazhi : "Zëri s'u krijua.");
          break;
        case "gabim":
          throw new GabimIIntervistes(
            typeof n.error === "string" ? n.error : "Diçka shkoi keq. Provo përsëri.",
            kodiIGabimit(n.kodi),
            typeof n.status === "number" ? n.status : null,
            lexoKthesen(n.kthesa),
            transkripti || null,
          );
        case "mbaroi":
          mbaroi = true;
          break;
      }
    });
  } catch (e) {
    if (e instanceof GabimIIntervistes) throw e;
    // Lidhja u këput gjatë leximit.
    if (!kthesaErdhi) throw new GabimIIntervistes(PA_INTERNET_SHKURT, "rrjeti", null, null, transkripti || null);
    ng.onGabimZerit("Zëri u ndërpre. Pyetja është në ekran.");
    return { degjuar: true };
  }
  if (!kthesaErdhi) throw new GabimIIntervistes(PERGJIGJE_E_PAPLOTE, "rrjeti", null, null, transkripti || null);
  if (!mbaroi) ng.onGabimZerit("Zëri u ndërpre. Pyetja është në ekran.");
  return { degjuar: true };
}

/** Zëri i pyetjes aktuale me rrjedhë (pyetja e parë, ose kur intervista rihapet në Fol). Hedh GabimIIntervistes para zërit. */
export async function zeriIPyetjesMeRrjedhe(
  intervistaId: string,
  nr: number,
  ng: Pick<PerRrjedhen, "onPcm" | "onGabimZerit">,
): Promise<void> {
  const r = await hapRrjedhen(
    JSON.stringify({ veprimi: "fol", intervista_id: intervistaId, nr, rrjedhe: true }),
    "application/json",
    "Zëri i pyetjes s'u krijua.",
  );
  let mbaroi = false;
  try {
    await lexoNdjson(r, (n) => {
      if (n.e === "pcm" && typeof n.b === "string" && typeof n.s === "number") ng.onPcm(n.b, n.s);
      else if (n.e === "gabim_zerit") ng.onGabimZerit(typeof n.mesazhi === "string" ? n.mesazhi : "Zëri s'u krijua.");
      else if (n.e === "mbaroi") mbaroi = true;
    });
  } catch {
    ng.onGabimZerit("Zëri u ndërpre. Pyetja është në ekran.");
    return;
  }
  if (!mbaroi) ng.onGabimZerit("Zëri u ndërpre. Pyetja është në ekran.");
}

/** Raporti përfundimtar. Nëse ekziston, serveri e kthen pa thirrur AI-në. Zgjat 10–40 sekonda herën e parë. */
export async function krijoRaportin(intervistaId: string): Promise<Raporti> {
  const data = await thirr(
    "intervista-raporti",
    { intervista_id: intervistaId },
    "Raporti s'u bë. Provo përsëri.",
  );
  const raporti: unknown = eshteObjekt(data) ? data.raporti : null;
  if (!eshteRaport(raporti)) throw new GabimIIntervistes("AI-ja ktheu një raport të paplotë. Provo përsëri.", "ai");
  return raporti;
}

export type IntervistaELexuar = { info: IntervistaInfo; biseda: RreshtiIBisedes[]; raporti: Raporti | null };

/** Lexon intervistën dhe bisedën nga tabelat (RLS: vetëm të miat). null nëse s'ekziston ose s'është e imja. */
export async function lexoIntervisten(intervistaId: string): Promise<IntervistaELexuar | null> {
  const [intervista, kthesat] = await Promise.all([
    supabase
      .from("intervistat")
      .select("id, puna_id, gjuha, roli, gjatesia, gjendja, nr_pyetjeve, raporti, punet(titulli, kompania)")
      .eq("id", intervistaId)
      .maybeSingle(),
    supabase
      .from("intervista_kthesat")
      .select("nr, lloji, reagimi, pyetja, pergjigja")
      .eq("intervista_id", intervistaId)
      .order("nr", { ascending: true }),
  ]);
  if (intervista.error) throw new GabimIIntervistes(mesazhiIGabimit(intervista.error), "rrjeti");
  if (kthesat.error) throw new GabimIIntervistes(mesazhiIGabimit(kthesat.error), "rrjeti");
  if (!intervista.data) return null;

  const r = intervista.data as Record<string, unknown>;
  const punet = r.punet as { titulli?: unknown; kompania?: unknown } | null;
  const puna =
    typeof r.puna_id === "string" && punet && typeof punet.titulli === "string" && typeof punet.kompania === "string"
      ? { id: r.puna_id, titulli: punet.titulli, kompania: punet.kompania }
      : null;
  const raporti = eshteRaport(r.raporti) ? r.raporti : null;
  // Raporti e mban vetë emrin; përndryshe ai i ruajtur në telefon; përndryshe "Arta" (intervistat e vjetra).
  const intervistuesi =
    (raporti && eshteIntervistues(raporti.intervistuesi) ? raporti.intervistuesi : null) ??
    (await lexoIntervistuesinPer(intervistaId)) ??
    INTERVISTUESI_FILLESTAR;
  const info = lexoInfon({ ...r, puna, intervistuesi });
  if (!info) throw new GabimIIntervistes(PERGJIGJE_E_PAPLOTE, "tjeter");

  const biseda = ((kthesat.data ?? []) as RreshtiIBisedes[]).map((k) => ({
    nr: k.nr,
    lloji: k.lloji,
    reagimi: k.reagimi,
    pyetja: k.pyetja,
    pergjigja: k.pergjigja,
  }));
  return { info, biseda, raporti };
}

export type RreshtiIHistorikut = {
  id: string;
  nota: number | null;
  data: string;
  puna: string | null;
  gjuha: Gjuha;
  nrPyetjeve: number;
  /** Ndryshimi i gatishmërisë nga kjo intervistë (pas − para); null kur s'matet. */
  ndryshimi: number | null;
};

/** Historiku (bordi, ekrani 31): intervistat e mia që kanë mbaruar, më e reja e para. RLS: vetëm të miat. */
export async function lexoHistorikun(kufiri = 50): Promise<RreshtiIHistorikut[]> {
  const { data, error } = await supabase
    .from("intervistat")
    .select("id, nota, krijuar_me, perfunduar_me, gjuha, nr_pyetjeve, raporti, punet(titulli, kompania)")
    .in("gjendja", ["mbaroi", "po_vleresohet", "perfunduar"])
    .order("krijuar_me", { ascending: false })
    .limit(kufiri);
  if (error) throw new GabimIIntervistes(mesazhiIGabimit(error), "rrjeti");
  return (data ?? []).flatMap((r) => {
    const rreshti = r as Record<string, unknown>;
    if (typeof rreshti.id !== "string" || !eshteGjuhe(rreshti.gjuha)) return [];
    const punet = rreshti.punet as { titulli?: unknown; kompania?: unknown } | null;
    const raporti = eshteRaport(rreshti.raporti) ? rreshti.raporti : null;
    const g = raporti?.gatishmeria;
    return [
      {
        id: rreshti.id,
        nota: typeof rreshti.nota === "number" ? rreshti.nota : null,
        data: typeof rreshti.perfunduar_me === "string" ? rreshti.perfunduar_me : String(rreshti.krijuar_me ?? ""),
        puna:
          punet && typeof punet.titulli === "string"
            ? typeof punet.kompania === "string"
              ? `${punet.titulli} · ${punet.kompania}`
              : punet.titulli
            : null,
        gjuha: rreshti.gjuha,
        nrPyetjeve: typeof rreshti.nr_pyetjeve === "number" ? rreshti.nr_pyetjeve : 0,
        ndryshimi: g && g.para !== null && g.pas !== null ? g.pas - g.para : null,
      },
    ];
  });
}

export type PerMbledhjeIntervistes = { id: string; nota: number | null; data: string; puna: string | null };

/** Intervistat e mia që kanë mbaruar (raporti gati ose ende pa u shkruar), më e reja e para. RLS: vetëm të miat. */
export async function listoIntervistatEPerfunduara(kufiri = 10): Promise<PerMbledhjeIntervistes[]> {
  const { data, error } = await supabase
    .from("intervistat")
    .select("id, nota, krijuar_me, perfunduar_me, punet(titulli, kompania)")
    .in("gjendja", ["mbaroi", "po_vleresohet", "perfunduar"])
    .order("krijuar_me", { ascending: false })
    .limit(kufiri);
  if (error) throw new GabimIIntervistes(mesazhiIGabimit(error), "rrjeti");
  return (data ?? []).flatMap((r) => {
    const rreshti = r as Record<string, unknown>;
    if (typeof rreshti.id !== "string") return [];
    const punet = rreshti.punet as { titulli?: unknown; kompania?: unknown } | null;
    const data = typeof rreshti.perfunduar_me === "string" ? rreshti.perfunduar_me : String(rreshti.krijuar_me ?? "");
    return [
      {
        id: rreshti.id,
        nota: typeof rreshti.nota === "number" ? rreshti.nota : null,
        data,
        puna:
          punet && typeof punet.titulli === "string"
            ? typeof punet.kompania === "string"
              ? `${punet.titulli} · ${punet.kompania}`
              : punet.titulli
            : null,
      },
    ];
  });
}
