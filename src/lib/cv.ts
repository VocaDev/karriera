// KONTRATA E CV-SË · pronar: Edoniku (ekranet, AI, tabelat cvs/cv_reviews, Storage, ky fajll).
// Ekranet e CV-së thërrasin VETËM funksionet e këtij fajlli.
//
// Ku jetojnë të dhënat (supabase/migrations/20261111000000_cv.sql):
//   PDF-ja       Storage, bucket privat "cv", dosja {user_id}/
//   CV-të        tabela cvs (RLS: vetëm të miat; versioni dhe pronari i vendos serveri)
//   analizat     tabela cv_reviews (i shkruan vetëm Edge Function cv-review; app-i vetëm lexon)
//   AI-ja        Edge Functions cv-review dhe cv-create (çelësi i AI-së s'del kurrë në telefon)
// Pa filtër për përdoruesin në kod: RLS-i kthen vetëm rreshtat e mi.
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";

import { mesazhiIGabimit } from "@/lib/hyrja-offline";
import { supabase } from "@/lib/supabase";

// ---------- Tipet ----------

/** Rezultati i Edge Function `cv-review` (AI-ja e lexon PDF-në). */
export type AnalizaCV = {
  nota: number; // 0–100, vlerësim i AI-së për CV-në (jo parashikim punësimi)
  permbledhja: string; // 1 fjali, p.sh. "2 gjëra e ngrenë mbi 75"
  seksionet: {
    emri: string; // "Profili", "Përvoja", "Projektet", "Formati", "Aftësitë", "Arsimi"
    gjendja: "mire" | "permiresim";
    komenti: string; // këshillë e qartë, konkrete
    roast: string; // e njëjta pikë me humor, e ashpër por e drejtë, pa ofendime personale
  }[];
  rishkrimet: { para: string; pas: string }[]; // rreshta nga CV-ja, të rishkruar me rezultate
  pikat_e_forta: string[];
  fjalia_roast: string; // një fjali për kartën "Ndaje", pa emër dhe pa të dhëna personale
};

export type FormatiCV = "ks" | "europass" | "eu" | "us" | "uk" | "ats";
export type GjuhaCV = "sq" | "en";

/** CV-ja si të dhëna (rezultati i `cv-create`), që app-i e vizaton në çdo format. */
export type CvStrukturuar = {
  emri: string;
  titulli: string; // p.sh. "Student i Inxhinierisë Kompjuterike"
  qyteti: string;
  email: string;
  telefoni: string | null;
  datelindja: string | null; // vetëm për ks / europass / eu; null për us / uk / ats
  profili: string;
  arsimi: { programi: string; institucioni: string; periudha: string }[];
  pervoja: { roli: string; vendi: string; periudha: string; pershkrimi: string; nga_ai: boolean }[];
  projektet: { titulli: string; pershkrimi: string; linku: string | null; nga_ai: boolean }[];
  aftesite: string[];
  gjuhet: { gjuha: string; niveli: string }[]; // niveli në CEFR (A1–C2) ose "amtare"
};

/** Një CV e ruajtur (e ngarkuar ose e krijuar). */
export type CvRresht = {
  id: string;
  burimi: "ngarkuar" | "krijuar";
  emri_skedarit: string | null; // për CV-të e ngarkuara
  versioni: number; // v1, v2, …
  nota: number | null; // nota e analizës së fundit, nëse ka
  krijuar_me: string; // ISO
};

/** Skedari që kthen expo-document-picker (vetëm fushat që na duhen). */
export type SkedariPDF = { uri: string; name: string; size: number | null; mimeType: string | null };

export const MADHESIA_MAKS_CV = 5 * 1024 * 1024; // e njëjta si bucket-i "cv"

// ---------- Kontrolli i përgjigjeve (AI-ja dhe JSON-i nga serveri s'merren të mirëqena) ----------

const eshteTekst = (v: unknown): v is string => typeof v === "string";
const eshteObjekt = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const listeMe = (v: unknown, kontrollo: (x: unknown) => boolean) => Array.isArray(v) && v.every(kontrollo);
const tekstOseNull = (v: unknown) => v === null || eshteTekst(v);

export function eshteAnalizeCV(v: unknown): v is AnalizaCV {
  if (!eshteObjekt(v)) return false;
  return (
    typeof v.nota === "number" &&
    Number.isInteger(v.nota) &&
    v.nota >= 0 &&
    v.nota <= 100 &&
    eshteTekst(v.permbledhja) &&
    eshteTekst(v.fjalia_roast) &&
    listeMe(v.pikat_e_forta, eshteTekst) &&
    listeMe(v.rishkrimet, (r) => eshteObjekt(r) && eshteTekst(r.para) && eshteTekst(r.pas)) &&
    listeMe(
      v.seksionet,
      (s) =>
        eshteObjekt(s) &&
        eshteTekst(s.emri) &&
        (s.gjendja === "mire" || s.gjendja === "permiresim") &&
        eshteTekst(s.komenti) &&
        eshteTekst(s.roast),
    )
  );
}

export function eshteCvStrukturuar(v: unknown): v is CvStrukturuar {
  if (!eshteObjekt(v)) return false;
  return (
    eshteTekst(v.emri) &&
    eshteTekst(v.titulli) &&
    eshteTekst(v.qyteti) &&
    eshteTekst(v.email) &&
    tekstOseNull(v.telefoni) &&
    tekstOseNull(v.datelindja) &&
    eshteTekst(v.profili) &&
    listeMe(v.aftesite, eshteTekst) &&
    listeMe(v.arsimi, (a) => eshteObjekt(a) && eshteTekst(a.programi) && eshteTekst(a.institucioni) && eshteTekst(a.periudha)) &&
    listeMe(
      v.pervoja,
      (p) =>
        eshteObjekt(p) &&
        eshteTekst(p.roli) &&
        eshteTekst(p.vendi) &&
        eshteTekst(p.periudha) &&
        eshteTekst(p.pershkrimi) &&
        typeof p.nga_ai === "boolean",
    ) &&
    listeMe(
      v.projektet,
      (p) =>
        eshteObjekt(p) &&
        eshteTekst(p.titulli) &&
        eshteTekst(p.pershkrimi) &&
        tekstOseNull(p.linku) &&
        typeof p.nga_ai === "boolean",
    ) &&
    listeMe(v.gjuhet, (g) => eshteObjekt(g) && eshteTekst(g.gjuha) && eshteTekst(g.niveli))
  );
}

// Mesazhi i Edge Function-it (shqip) kur kthen 4xx/5xx; përndryshe një fjali e përgjithshme.
async function mesazhiIFunksionit(gabimi: unknown, rezerva: string): Promise<string> {
  if (gabimi instanceof FunctionsHttpError) {
    try {
      const trupi: unknown = await (gabimi.context as Response).json();
      if (eshteObjekt(trupi) && eshteTekst(trupi.error)) return trupi.error;
    } catch {
      // përgjigje pa JSON
    }
    return rezerva;
  }
  if (gabimi instanceof FunctionsFetchError || gabimi instanceof FunctionsRelayError) {
    return "Pa internet ose serveri s'u përgjigj. Provo përsëri.";
  }
  return rezerva;
}

const FUSHAT_CV = "id, burimi, emri_skedarit, versioni, krijuar_me";
type RreshtiCV = Omit<CvRresht, "nota">;

// ---------- Funksionet ----------

/** Ruan PDF-në në Storage (privat) dhe krijon rreshtin. Hedh Error me mesazh në shqip nëse dështon. */
export async function ngarkoCV(skedari: SkedariPDF): Promise<CvRresht> {
  if (skedari.size !== null && skedari.size > MADHESIA_MAKS_CV) {
    throw new Error("CV-ja duhet të jetë deri në 5 MB.");
  }
  if (skedari.mimeType && skedari.mimeType !== "application/pdf") {
    throw new Error("Zgjidh një dokument PDF.");
  }

  const { data: sesioni } = await supabase.auth.getSession();
  const uid = sesioni.session?.user.id;
  if (!uid) throw new Error("Hyr në llogari për ta ngarkuar CV-në.");

  let bajtet: ArrayBuffer;
  try {
    bajtet = await fetch(skedari.uri).then((r) => r.arrayBuffer());
  } catch {
    throw new Error("S'u lexua skedari. Provo përsëri.");
  }
  if (bajtet.byteLength > MADHESIA_MAKS_CV) throw new Error("CV-ja duhet të jetë deri në 5 MB.");
  const koka = String.fromCharCode(...new Uint8Array(bajtet, 0, Math.min(5, bajtet.byteLength)));
  if (koka !== "%PDF-") throw new Error("Skedari nuk është PDF i vlefshëm.");

  // Dosja e parë = id-ja ime: policy-ja e Storage-it lejon vetëm këtë.
  const rruga = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.pdf`;
  const { error: gabimiNgarkimit } = await supabase.storage
    .from("cv")
    .upload(rruga, bajtet, { contentType: "application/pdf", upsert: false });
  if (gabimiNgarkimit) throw new Error(mesazhiIGabimit(gabimiNgarkimit));

  const { data, error } = await supabase
    .from("cvs")
    .insert({ burimi: "ngarkuar", emri_skedarit: skedari.name.slice(0, 150), storage_path: rruga })
    .select(FUSHAT_CV)
    .single();
  if (error) {
    // Rreshti s'u krijua: fshij PDF-në që të mos mbetet skedar pa pronar në listë.
    await supabase.storage.from("cv").remove([rruga]);
    throw new Error(mesazhiIGabimit(error));
  }
  return { ...(data as RreshtiCV), nota: null };
}

/** Thërret `cv-review` (AI-ja lexon PDF-në nga Storage dhe e ruan analizën). Zgjat 10–40 sekonda. */
export async function analizoCV(cvId: string): Promise<AnalizaCV> {
  const { data, error } = await supabase.functions.invoke("cv-review", { body: { cv_id: cvId } });
  if (error) throw new Error(await mesazhiIFunksionit(error, "Analiza e CV-së dështoi. Provo përsëri."));
  const analiza: unknown = eshteObjekt(data) ? data.analiza : null;
  if (!eshteAnalizeCV(analiza)) throw new Error("AI-ja ktheu një përgjigje të paplotë. Provo përsëri.");
  return analiza;
}

/** Analiza e fundit e kësaj CV-je, ose null nëse s'është analizuar ende (pa thirrur AI-në). */
export async function analizaPerCV(cvId: string): Promise<AnalizaCV | null> {
  const { data, error } = await supabase
    .from("cv_reviews")
    .select("analiza")
    .eq("cv_id", cvId)
    .order("krijuar_me", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(mesazhiIGabimit(error));
  if (!data) return null;
  const analiza: unknown = (data as { analiza: unknown }).analiza;
  return eshteAnalizeCV(analiza) ? analiza : null;
}

/** Analiza e fundit e përdoruesit, ose null nëse s'ka ende. */
export async function analizaEFundit(): Promise<{ cv: CvRresht; analiza: AnalizaCV } | null> {
  const { data: review, error } = await supabase
    .from("cv_reviews")
    .select("cv_id, nota, analiza")
    .order("krijuar_me", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(mesazhiIGabimit(error));
  if (!review) return null;

  const r = review as { cv_id: string; nota: number; analiza: unknown };
  if (!eshteAnalizeCV(r.analiza)) return null;

  const { data: cv, error: gabimiCV } = await supabase.from("cvs").select(FUSHAT_CV).eq("id", r.cv_id).maybeSingle();
  if (gabimiCV) throw new Error(mesazhiIGabimit(gabimiCV));
  if (!cv) return null;

  return { cv: { ...(cv as RreshtiCV), nota: r.nota }, analiza: r.analiza };
}

/** Të gjitha versionet e CV-së, më e reja e para, me notën e analizës së fundit të secilës. */
export async function listoVersionet(): Promise<CvRresht[]> {
  const [cvs, reviews] = await Promise.all([
    supabase.from("cvs").select(FUSHAT_CV).order("versioni", { ascending: false }),
    supabase.from("cv_reviews").select("cv_id, nota").order("krijuar_me", { ascending: false }),
  ]);
  if (cvs.error) throw new Error(mesazhiIGabimit(cvs.error));
  if (reviews.error) throw new Error(mesazhiIGabimit(reviews.error));

  const notat = new Map<string, number>();
  for (const r of (reviews.data ?? []) as { cv_id: string; nota: number }[]) {
    if (!notat.has(r.cv_id)) notat.set(r.cv_id, r.nota); // e para = më e reja
  }
  return ((cvs.data ?? []) as RreshtiCV[]).map((cv) => ({ ...cv, nota: notat.get(cv.id) ?? null }));
}

// ---------- Ndërtuesi i CV-së (del tani, vendimi i Gentit 11.11) ----------
// Formatet e tjera dhe rishkrimi në anglisht mbeten pas Demo Day-t (CV_PAS_DEMO_DAY_HAPUR).
// Funksionet s'kthejnë kurrë të dhëna shembull si CV të përdoruesit.

/** Një CV e krijuar me AI (versioni `cvId`, ose i fundit nëse s'jepet), ose null nëse s'ka. */
export async function merrCVTeFundit(
  cvId?: string,
): Promise<{ cv: CvStrukturuar; formati: FormatiCV; gjuha: GjuhaCV } | null> {
  let pyetja = supabase.from("cvs").select("permbajtja, formati, gjuha").eq("burimi", "krijuar");
  if (cvId) pyetja = pyetja.eq("id", cvId);
  const { data, error } = await pyetja.order("versioni", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(mesazhiIGabimit(error));
  if (!data) return null;
  const r = data as { permbajtja: unknown; formati: FormatiCV; gjuha: GjuhaCV };
  return eshteCvStrukturuar(r.permbajtja) ? { cv: r.permbajtja, formati: r.formati, gjuha: r.gjuha } : null;
}

/** Thërret `cv-create`: nga 5 përgjigjet, ose rishkruan një CV ekzistuese për një format/gjuhë tjetër. */
export async function krijoCV(
  burimi: { pergjigjet: string[] } | { cv: CvStrukturuar },
  formati: FormatiCV,
  gjuha: GjuhaCV,
): Promise<CvStrukturuar> {
  const { data, error } = await supabase.functions.invoke("cv-create", { body: { burimi, formati, gjuha } });
  if (error) throw new Error(await mesazhiIFunksionit(error, "Krijimi i CV-së dështoi. Provo përsëri."));
  if (!eshteCvStrukturuar(data)) throw new Error("AI-ja ktheu një CV të paplotë. Provo përsëri.");
  return data;
}

/** Ruan një CV të krijuar si version i ri. */
export async function ruajCV(cv: CvStrukturuar, formati: FormatiCV, gjuha: GjuhaCV = "sq"): Promise<CvRresht> {
  const { data, error } = await supabase
    .from("cvs")
    .insert({ burimi: "krijuar", permbajtja: cv, formati, gjuha })
    .select(FUSHAT_CV)
    .single();
  if (error) throw new Error(mesazhiIGabimit(error));
  return { ...(data as RreshtiCV), nota: null };
}
