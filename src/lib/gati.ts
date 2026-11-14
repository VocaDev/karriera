// "A jam gati?" (WP3): sa gati jam për një punë konkrete. Ekrani thërret vetëm funksionet e këtij fajlli.
//
// Ku jetojnë të dhënat (supabase/migrations/20261115110000_gatishmeria.sql):
//   gatishmeria   një rresht për çdo llogaritje; i shkruajnë vetëm Edge Functions:
//                 `gati` (burimi "cv") dhe intervista (burimi "intervista", WP4). App-i vetëm lexon.
//   AI-ja         Edge Function `gati` (çelësi i AI-së s'del kurrë në telefon), 10 herë në 24 orë.
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

/** Gabimi kur s'ka CV: ekrani tregon gjendjen bosh me lidhjen te /cv. */
export class GabimPaCV extends Error {
  constructor(mesazhi = "Së pari ngarko ose ndërto CV-në tënde.") {
    super(mesazhi);
    this.name = "GabimPaCV";
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

// ---------- Thirrja e Edge Function-it ----------

type TrupiIGabimit = { mesazhi: string; paCV: boolean };

async function lexoGabimin(gabimi: unknown): Promise<TrupiIGabimit> {
  const rezerva = "Llogaritja dështoi. Provo përsëri.";
  if (gabimi instanceof FunctionsHttpError) {
    try {
      const trupi: unknown = await (gabimi.context as Response).json();
      if (eshteObjekt(trupi) && eshteTekst(trupi.error)) {
        return { mesazhi: trupi.error, paCV: trupi.kodi === "pa_cv" };
      }
    } catch {
      // përgjigje pa JSON
    }
    return { mesazhi: rezerva, paCV: false };
  }
  if (gabimi instanceof FunctionsFetchError || gabimi instanceof FunctionsRelayError) {
    return { mesazhi: "Pa internet ose serveri s'u përgjigj. Provo përsëri.", paCV: false };
  }
  return { mesazhi: rezerva, paCV: false };
}

function eshte401(gabimi: unknown): boolean {
  return gabimi instanceof FunctionsHttpError && (gabimi.context as Response).status === 401;
}

/**
 * Thërret `gati`: AI-ja krahason CV-në e fundit me punën dhe e ruan rezultatin. Zgjat 10–40 sekonda dhe
 * numërohet te kufiri ditor. Hedh `GabimPaCV` kur s'ka CV, përndryshe Error me mesazh në shqip.
 */
export async function llogaritGatishmerine(punaId: string): Promise<Gatishmeria> {
  const body = { puna_id: punaId };
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
    const { mesazhi, paCV } = await lexoGabimin(error);
    throw paCV ? new GabimPaCV(mesazhi) : new Error(mesazhi);
  }

  const rreshti: unknown = eshteObjekt(data) ? data.gatishmeria : null;
  if (!eshteGatishmeri(rreshti)) throw new Error("AI-ja ktheu një përgjigje të paplotë. Provo përsëri.");
  return rreshti;
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
