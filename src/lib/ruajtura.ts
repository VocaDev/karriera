// ⭐ Punët e ruajtura (tabela punet_e_ruajtura). Pa filtër për përdoruesin në kod:
// RLS-i kthen dhe lejon vetëm rreshtat e mi, dhe pronari_id e vendos serveri.
import { mesazhiIGabimit } from "@/lib/hyrja-offline";
import { supabase } from "@/lib/supabase";

/** Id-të e punëve që kam ruajtur. */
export async function listoTeRuajturat(): Promise<Set<string>> {
  const { data, error } = await supabase.from("punet_e_ruajtura").select("puna_id");
  if (error) throw new Error(mesazhiIGabimit(error));
  return new Set((data ?? []).map((r: { puna_id: string }) => r.puna_id));
}

export async function ruajPunen(punaId: string): Promise<void> {
  const { error } = await supabase.from("punet_e_ruajtura").insert({ puna_id: punaId });
  // 23505 = e ruajtur tashmë (p.sh. dy prekje shumë shpejt): s'është gabim për përdoruesin.
  if (error && error.code !== "23505") throw new Error(mesazhiIGabimit(error));
}

export async function hiqeNgaTeRuajturat(punaId: string): Promise<void> {
  // .eq zgjedh CILËN punë; RLS-i (ruajtura_fshi) lejon të fshihet vetëm ylli im.
  const { error } = await supabase.from("punet_e_ruajtura").delete().eq("puna_id", punaId);
  if (error) throw new Error(mesazhiIGabimit(error));
}

export type PunaERuajtur = { puna_id: string; ruajtur_me: string; titulli: string; kompania: string; qyteti: string };

/** Të ruajturat e mia me titullin e punës (Profili i kërkuesit). RLS-i kthen vetëm yjet e mi. */
export async function listoTeRuajturatMePune(): Promise<PunaERuajtur[]> {
  const { data, error } = await supabase
    .from("punet_e_ruajtura")
    .select("puna_id, ruajtur_me, punet(titulli, kompania, qyteti)")
    .order("ruajtur_me", { ascending: false });
  if (error) throw new Error(mesazhiIGabimit(error));
  type Rreshti = { puna_id: string; ruajtur_me: string; punet: { titulli: string; kompania: string; qyteti: string } | null };
  return ((data ?? []) as unknown as Rreshti[])
    .filter((r) => r.punet !== null)
    .map((r) => ({ puna_id: r.puna_id, ruajtur_me: r.ruajtur_me, ...r.punet! }));
}
