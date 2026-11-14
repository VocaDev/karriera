// Të gjitha thirrjet e Supabase për shpalljet e punës. Ekranet thërrasin vetëm këto funksione.
import { mesazhiIGabimit } from "@/lib/hyrja-offline";
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
};

export type Portali = "kosovajob" | "portalpune" | "ofertapune";

export const EMRI_I_PORTALIT: Record<Portali, string> = {
  kosovajob: "KosovaJob",
  portalpune: "PortalPune",
  ofertapune: "OfertaPune",
};

const FUSHAT =
  "id, titulli, kompania, qyteti, roli, pershkrimi, aftesite, burimi, krijuar_me, pronari_id, linku, portali, afati, aktive";

// M1: lexon listën nga tabela "punet" (më të rejat lart). Vetëm punët aktive: shpalljet e skaduara
// të portaleve mbeten në tabelë (që ⭐ të mos humbasin), por s'dalin më në listë.
export async function listoPunet(): Promise<Puna[]> {
  const { data, error } = await supabase
    .from("punet")
    .select(FUSHAT)
    .eq("aktive", true)
    .order("krijuar_me", { ascending: false });
  if (error) throw new Error(mesazhiIGabimit(error));
  return data as Puna[];
}

// Ekrani i detajeve: null nëse id-ja s'ekziston (roja e /pune/x99).
export async function gjePunen(id: string): Promise<Puna | null> {
  const { data, error } = await supabase.from("punet").select(FUSHAT).eq("id", id).maybeSingle();
  if (error) throw new Error(mesazhiIGabimit(error));
  return data as Puna | null;
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

// Shton një shpallje. RLS-i (punet_shto) e lejon vetëm për punëdhënësin dhe qendrën, me burimi = "perdoruesi";
// pronari_id nuk dërgohet: serveri e vendos vetë (default auth.uid()).
export async function shtoPunen(puna: PunaERe): Promise<Puna> {
  const { data, error } = await supabase
    .from("punet")
    .insert({ ...puna, burimi: "perdoruesi" })
    .select(FUSHAT)
    .single();
  if (error) throw new Error(mesazhiIGabimit(error));
  return data as Puna;
}

// "Punët e mia" (punëdhënësi, qendra). Pa filtër në kod: RLS-i (punet_lexo) i kthen punëdhënësit
// vetëm punët e veta, kështu që dy punëdhënës s'ia shohin shpalljet njëri-tjetrit as përmes API-t.
export async function listoPunetEMia(): Promise<Puna[]> {
  const { data, error } = await supabase.from("punet").select(FUSHAT).order("krijuar_me", { ascending: false });
  if (error) throw new Error(mesazhiIGabimit(error));
  return data as Puna[];
}

// Fshin një punë timen. Nëse s'është imja, RLS-i (punet_fshi) s'fshin asgjë: e tregojmë si gabim.
export async function fshiPunen(id: string): Promise<void> {
  const { data, error } = await supabase.from("punet").delete().eq("id", id).select("id");
  if (error) throw new Error(mesazhiIGabimit(error));
  if (!data || data.length === 0) throw new Error("Kjo punë s'mund të fshihet nga llogaria jote.");
}

// Punët e reja në kohë reale (Supabase Realtime): kur një punëdhënës poston, kërkuesi e merr menjëherë.
// Realtime-i zbaton të njëjtin RLS: vetëm llogaritë e kyçura i marrin ngjarjet. Kthen funksionin për t'u shkëputur.
// Vetëm burimi = "perdoruesi": importi i përditshëm nga portalet shton dhjetëra rreshta njëherësh,
// dhe secili do të jepte një njoftim dhe një dridhje. Ato dalin në listë me rifreskimin e radhës.
export function degjoPunetERe(emriIKanalit: string, kurVjen: (puna: Puna) => void): () => void {
  const kanali = supabase
    .channel(emriIKanalit)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "punet", filter: "burimi=eq.perdoruesi" }, (ngjarja) => {
      kurVjen(ngjarja.new as Puna);
    })
    .subscribe();
  return () => {
    supabase.removeChannel(kanali);
  };
}
