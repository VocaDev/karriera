// Klienti i intervistës: ekranet thërrasin VETËM këto funksione.
//
//   intervista-nis      nis (ose vazhdon) intervistën për një punë → pyetja e parë
//   intervista-kthesa   dërgon përgjigjen → pyetja tjetër ose fundi
//   intervista-raporti  raporti përfundimtar + gatishmëria e re (idempotent)
//   tabelat             intervistat dhe intervista_kthesat lexohen me RLS (vetëm të miat); app-i s'shkruan aty
//
// Çelësi i AI-së s'del kurrë në telefon. Pyetjet dhe përgjigjet s'shkruhen në log.
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";

import { mesazhiIGabimit } from "@/lib/hyrja-offline";
import { supabase } from "@/lib/supabase";

import {
  eshteObjekt,
  eshteRaport,
  lexoInfon,
  lexoKthesen,
  type Gjatesia,
  type Gjuha,
  type IntervistaInfo,
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
  | "rrjeti"
  | "sesioni"
  | "tjeter";

/** Gabim me mesazh në shqip (nga serveri ose nga ky fajll) dhe një kod që ekrani e përdor për të vendosur çka bën. */
export class GabimIIntervistes extends Error {
  readonly kodi: KodiIGabimit;
  readonly status: number | null;
  /** Kur serveri thotë "jashte_radhe", kthen edhe pyetjen aktuale. */
  readonly kthesa: Kthesa | null;

  constructor(mesazhi: string, kodi: KodiIGabimit, status: number | null = null, kthesa: Kthesa | null = null) {
    super(mesazhi);
    this.name = "GabimIIntervistes";
    this.kodi = kodi;
    this.status = status;
    this.kthesa = kthesa;
  }

  /** A ka kuptim butoni "Provo përsëri" me të njëjtën kërkesë. */
  get riprovohet(): boolean {
    return this.kodi === "ai" || this.kodi === "rrjeti" || this.kodi === "tjeter" || this.kodi === "po_perpunohet";
  }
}

const KODET: readonly string[] = ["kufiri", "ai", "jashte_radhe", "po_perpunohet", "mbaroi", "aktive"];

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
        return new GabimIIntervistes(trupi.error, kodi, status, lexoKthesen(trupi.kthesa));
      }
    } catch {
      // përgjigje pa JSON
    }
    return new GabimIIntervistes(rezerva, status === 401 ? "sesioni" : "tjeter", status);
  }
  if (gabimi instanceof FunctionsFetchError || gabimi instanceof FunctionsRelayError) {
    return new GabimIIntervistes("Pa internet ose serveri s'u përgjigj. Provo përsëri.", "rrjeti");
  }
  return new GabimIIntervistes(rezerva, "tjeter");
}

function eshte401(gabimi: unknown): boolean {
  return gabimi instanceof FunctionsHttpError && (gabimi.context as Response).status === 401;
}

type Funksioni = "intervista-nis" | "intervista-kthesa" | "intervista-raporti";

// Si te lib/cv.ts: 401 = serveri s'e njeh më sesionin → një rifreskim; nëse s'mjafton, dalim nga llogaria.
async function thirr(emri: Funksioni, body: object, rezerva: string): Promise<unknown> {
  let { data, error } = await supabase.functions.invoke(emri, { body });
  if (error && eshte401(error)) {
    const { error: gabimiRifreskimit } = await supabase.auth.refreshSession();
    if (gabimiRifreskimit) {
      await supabase.auth.signOut({ scope: "local" });
      throw new GabimIIntervistes("Sesioni ka skaduar. Hyr përsëri.", "sesioni", 401);
    }
    ({ data, error } = await supabase.functions.invoke(emri, { body }));
  }
  if (error) throw await perktheGabimin(error, rezerva);
  return data;
}

const PERGJIGJE_E_PAPLOTE = "Serveri ktheu një përgjigje të paplotë. Provo përsëri.";

// ---------- Funksionet ----------

export type Nisja = { intervista: IntervistaInfo; kthesa: Kthesa; rifilluar: boolean };

/** Nis një intervistë për punën; nëse ka një të nisur (24 orët e fundit, e njëjta gjuhë e gjatësi), e vazhdon atë. */
export async function nisIntervisten(opts: { punaId: string; gjuha: Gjuha; gjatesia: Gjatesia }): Promise<Nisja> {
  const data = await thirr(
    "intervista-nis",
    { puna_id: opts.punaId, gjuha: opts.gjuha, gjatesia: opts.gjatesia },
    "Intervista s'u nis. Provo përsëri.",
  );
  const intervista = eshteObjekt(data) ? lexoInfon(data.intervista) : null;
  const kthesa = eshteObjekt(data) ? lexoKthesen(data.kthesa) : null;
  if (!intervista || !kthesa) throw new GabimIIntervistes(PERGJIGJE_E_PAPLOTE, "tjeter");
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
  const info = lexoInfon({ ...r, puna });
  if (!info) throw new GabimIIntervistes(PERGJIGJE_E_PAPLOTE, "tjeter");

  const biseda = ((kthesat.data ?? []) as RreshtiIBisedes[]).map((k) => ({
    nr: k.nr,
    lloji: k.lloji,
    reagimi: k.reagimi,
    pyetja: k.pyetja,
    pergjigja: k.pergjigja,
  }));
  return { info, biseda, raporti: eshteRaport(r.raporti) ? r.raporti : null };
}
