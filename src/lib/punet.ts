// Të gjitha thirrjet e Supabase për shpalljet e punës. Ekranet thërrasin vetëm këto funksione.
import { supabase } from "@/lib/supabase";

export type Puna = {
  id: string;
  titulli: string;
  kompania: string;
  qyteti: string;
  roli: "SWE" | "Asistent/PR" | "Tjetër";
  pershkrimi: string;
  aftesite: string[];
  burimi: "seed" | "perdoruesi";
};

const FUSHAT = "id, titulli, kompania, qyteti, roli, pershkrimi, aftesite, burimi";

// M1: lexon listën nga tabela "punet" (më të rejat lart).
export async function listoPunet(): Promise<Puna[]> {
  const { data, error } = await supabase
    .from("punet")
    .select(FUSHAT)
    .order("krijuar_me", { ascending: false });
  if (error) throw new Error(error.message);
  return data as Puna[];
}

// Ekrani i detajeve: null nëse id-ja s'ekziston (roja e /pune/x99).
export async function gjePunen(id: string): Promise<Puna | null> {
  const { data, error } = await supabase.from("punet").select(FUSHAT).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Puna | null;
}

export type PunaERe = Pick<Puna, "titulli" | "kompania" | "qyteti" | "roli" | "pershkrimi">;

// M2: ruan një shpallje të shtuar nga telefoni. RLS lejon vetëm burimi = "perdoruesi".
export async function shtoPunen(puna: PunaERe): Promise<Puna> {
  const { data, error } = await supabase
    .from("punet")
    .insert({ ...puna, burimi: "perdoruesi" })
    .select(FUSHAT)
    .single();
  if (error) throw new Error(error.message);
  return data as Puna;
}
