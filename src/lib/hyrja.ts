// Të gjitha thirrjet e Supabase Auth dhe të profilit. Ekranet thërrasin vetëm këto funksione.
// Roli (lloji) jeton te tabela profiles dhe e mbron RLS-i; nuk lexohet kurrë nga user_metadata.
import { mesazhiIGabimit } from "@/lib/hyrja-offline";
import { supabase } from "@/lib/supabase";

export type Lloji = "kerkues" | "punedhenes" | "qender";

export type Profili = {
  id: string;
  lloji: Lloji;
  emri: string;
  organizata: string | null;
  gjuha: "sq" | "en" | "de";
};

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
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(mesazhiIGabimit(error));
}

/** Profili im. Pa filtër në kod: RLS-i (profili_lexo) kthen vetëm rreshtin tim. */
export async function merrProfilin(): Promise<Profili | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, lloji, emri, organizata, gjuha")
    .maybeSingle();
  if (error) throw new Error(mesazhiIGabimit(error));
  return data as Profili | null;
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
