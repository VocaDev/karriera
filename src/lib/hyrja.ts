// Të gjitha thirrjet e Supabase Auth dhe të profilit. Ekranet thërrasin vetëm këto funksione.
// Roli (lloji) jeton te tabela profiles dhe e mbron RLS-i; nuk lexohet kurrë nga user_metadata.
import { mesazhiIGabimit } from "@/lib/hyrja-offline";
import { HYR_PERSERI } from "@/lib/mesazhet";
import { pastroKeshinEPuneve } from "@/lib/punet-kesh";
import { shenoDaljenVullnetare } from "@/lib/sesioni-skaduar";
import { supabase } from "@/lib/supabase";

export type Lloji = "kerkues" | "punedhenes" | "qender";

/** Roli për të cilin përgatitet kërkuesi (HARTA: SWE ose Asistent/PR). Njëlloj si `punet.roli`. */
export type RoliSynuar = "SWE" | "Asistent/PR";
/** Gjuha e intervistës: shqip, anglisht, gjermanisht. */
export type Gjuha = "sq" | "en" | "de";

export const ROLET: readonly RoliSynuar[] = ["SWE", "Asistent/PR"];
export const GJUHET: readonly Gjuha[] = ["sq", "en", "de"];

export const EMRAT_E_ROLEVE: Record<RoliSynuar, { titulli: string; pershkrimi: string }> = {
  SWE: { titulli: "Zhvillues/e softueri", pershkrimi: "Frontend, backend, mobile" },
  "Asistent/PR": { titulli: "Asistent/e ose PR", pershkrimi: "Zyrë, administratë, komunikim me klientët" },
};

export const EMRAT_E_GJUHEVE: Record<Gjuha, string> = { sq: "Shqip", en: "English", de: "Deutsch" };

export type Profili = {
  id: string;
  lloji: Lloji;
  emri: string;
  organizata: string | null;
  gjuha: Gjuha;
  /** null = kërkuesi s'e ka zgjedhur ende (onboarding). Punëdhënësi dhe qendra e kanë gjithmonë null. */
  roli_synuar: RoliSynuar | null;
};

const KOLONAT_E_PROFILIT = "id, lloji, emri, organizata, gjuha, roli_synuar";

export const EMRAT_E_LLOJEVE: Record<Lloji, string> = {
  kerkues: "Kërkoj punë",
  punedhenes: "Punëdhënës",
  qender: "Qendra e karrierës",
};

export type TeDhenatERegjistrimit = {
  email: string;
  fjalekalimi: string;
  emri: string;
  // Gjatë regjistrimit zgjidhen vetëm këto dy. "qender" e jep ekipi nga SQL Editor-i.
  lloji: "kerkues" | "punedhenes";
  organizata: string;
};

/** Hyrja me email dhe fjalëkalim. */
export async function hyr(email: string, fjalekalimi: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password: fjalekalimi,
  });
  if (error) throw new Error(mesazhiIGabimit(error));
}

/**
 * Krijon llogarinë. Emri, organizata dhe lloji i zgjedhur shkojnë si dëshirë te regjistrimi;
 * profilin e krijon serveri (trigger-i kur_krijohet_llogaria), që lejon vetëm "kerkues" ose "punedhenes".
 */
export async function regjistrohu(d: TeDhenatERegjistrimit): Promise<void> {
  const { data, error } = await supabase.auth.signUp({
    email: d.email.trim().toLowerCase(),
    password: d.fjalekalimi,
    options: {
      data: {
        emri: d.emri.trim(),
        lloji: d.lloji,
        organizata: d.lloji === "punedhenes" ? d.organizata.trim() : "",
      },
    },
  });
  if (error) throw new Error(mesazhiIGabimit(error));
  // Me "Confirm email" të fikur, Supabase kthen sesionin menjëherë.
  if (!data.session) throw new Error("Llogaria u krijua, por duhet konfirmuar email-i para hyrjes.");
}

/** Dalja: fshin sesionin nga telefoni. */
export async function dil(): Promise<void> {
  shenoDaljenVullnetare(); // dalja jonë s'është "sesion i mbaruar"
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(mesazhiIGabimit(error));
  await pastroKeshinEPuneve(); // lista e ruajtur e punëve s'mbetet në telefon pas daljes
}

/** Profili im. Pa filtër në kod: RLS-i (profili_lexo) kthen vetëm rreshtin tim. */
export async function merrProfilin(): Promise<Profili | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(KOLONAT_E_PROFILIT)
    .maybeSingle();
  if (error) throw new Error(mesazhiIGabimit(error));
  return data as Profili | null;
}

/**
 * Ndryshon rolin dhe/ose gjuhën e intervistës. Serveri lejon vetëm këto kolona (+ emrin) dhe vetëm rreshtin tim;
 * lloji i llogarisë s'ndryshohet dot nga app-i. Kthen profilin e ri që ekrani ta vendosë pa e lexuar sërish.
 */
export async function ndryshoProfilin(ndryshimet: { roli_synuar?: RoliSynuar; gjuha?: Gjuha }): Promise<Profili> {
  const { data: sesioni } = await supabase.auth.getSession();
  const uid = sesioni.session?.user.id;
  if (!uid) throw new Error(HYR_PERSERI.cfare);
  const { data, error } = await supabase
    .from("profiles")
    .update(ndryshimet)
    .eq("id", uid)
    .select(KOLONAT_E_PROFILIT)
    .single();
  if (error) throw new Error(mesazhiIGabimit(error));
  return data as Profili;
}

export type NumratEQendres = { kerkues: number; punedhenes: number; punet: number; ruajtje: number };

/** Vetëm për qendrën e karrierës: totale, asnjë emër. Serveri refuzon çdo llogari tjetër. */
export async function merrNumratEQendres(): Promise<NumratEQendres> {
  const { data, error } = await supabase.rpc("numrat_e_qendres").single();
  if (error) throw new Error(mesazhiIGabimit(error));
  const n = data as Record<keyof NumratEQendres, number | string>;
  return {
    kerkues: Number(n.kerkues),
    punedhenes: Number(n.punedhenes),
    punet: Number(n.punet),
    ruajtje: Number(n.ruajtje),
  };
}
