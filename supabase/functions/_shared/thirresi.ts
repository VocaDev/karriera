// Kush e thërret funksionin? Çdo Edge Function e CV-së e kontrollon vetë thirrësin,
// sepse me çelësat e rinj (sb_publishable_ / sb_secret_) gateway-i s'e verifikon JWT-në
// (deploy me --no-verify-jwt; docs: "Migrating to publishable and secret API keys").
//
// 1. Duhet një sesion i vërtetë (JWT i përdoruesit) → 401
// 2. Llogaria duhet të jetë "kerkues" (public.lloji_im(), si te RLS-i i J6) → 403
// 3. Kufiri ditor i thirrjeve të AI-së për përdorues (tabela cv_ai_thirrjet) → 429
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: CORS_HEADERS });
}

export type FunksioniAI = "cv-review" | "cv-create";

export type Thirresi = {
  userId: string;
  /** Klient me JWT-në e përdoruesit: RLS-i zbatohet si në telefon. */
  klienti: SupabaseClient;
  /** Klient me çelësin sekret: anashkalon RLS-in. Vetëm për cv_reviews dhe cv_ai_thirrjet. */
  admin: SupabaseClient;
};

// Çelësat e rinj vijnë si JSON {"default": "..."}; çelësat e vjetër (anon / service_role) si tekst.
function celesi(emriIRi: string, emriIVjeter: string): string {
  const teRinjte = Deno.env.get(emriIRi);
  if (teRinjte) {
    try {
      const vlera = JSON.parse(teRinjte)?.default;
      if (typeof vlera === "string" && vlera) return vlera;
    } catch {
      // vazhdon te çelësi i vjetër
    }
  }
  const iVjetri = Deno.env.get(emriIVjeter);
  if (iVjetri) return iVjetri;
  throw new Error(`Mungon ${emriIRi} në Edge Functions.`);
}

const PA_SESION = { persistSession: false, autoRefreshToken: false } as const;

/** Kthen thirrësin, ose një Response gabimi (401 / 403 / 429 / 500) që funksioni e kthen menjëherë. */
export async function kontrolloThirresin(
  req: Request,
  funksioni: FunksioniAI,
  kufiriDitor: number,
): Promise<Thirresi | Response> {
  const header = req.headers.get("Authorization") ?? "";
  const jwt = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!jwt) {
    return json({ error: "Hyr në llogari për ta përdorur këtë." }, 401);
  }

  let url: string;
  let publik: string;
  let sekret: string;
  try {
    url = Deno.env.get("SUPABASE_URL") ?? "";
    if (!url) throw new Error("Mungon SUPABASE_URL.");
    publik = celesi("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
    sekret = celesi("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
  } catch {
    console.error(`[${funksioni}] Konfigurimi i Supabase mungon.`);
    return json({ error: "Shërbimi s'është konfiguruar ende." }, 500);
  }

  const klienti = createClient(url, publik, {
    auth: PA_SESION,
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  // getUser e pyet serverin e Auth-it: JWT-ja e skaduar ose e falsifikuar refuzohet.
  const { data: perdoruesi, error: gabimiAuth } = await klienti.auth.getUser(jwt);
  if (gabimiAuth || !perdoruesi.user) {
    return json({ error: "Sesioni ka skaduar. Hyr përsëri." }, 401);
  }
  const userId = perdoruesi.user.id;

  const { data: lloji, error: gabimiLlojit } = await klienti.rpc("lloji_im");
  if (gabimiLlojit) {
    console.error(`[${funksioni}] lloji_im dështoi.`);
    return json({ error: "S'u lexua llogaria. Provo përsëri." }, 500);
  }
  if (lloji !== "kerkues") {
    return json({ error: "Kjo është vetëm për llogaritë e kërkuesve të punës." }, 403);
  }

  const admin = createClient(url, sekret, { auth: PA_SESION });

  const nje24OreMePare = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error: gabimiNumrit } = await admin
    .from("cv_ai_thirrjet")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("funksioni", funksioni)
    .gte("krijuar_me", nje24OreMePare);
  if (gabimiNumrit) {
    console.error(`[${funksioni}] Numërimi i thirrjeve dështoi.`);
    return json({ error: "Diçka shkoi keq. Provo përsëri." }, 500);
  }
  if ((count ?? 0) >= kufiriDitor) {
    return json(
      { error: `Ke arritur kufirin: ${kufiriDitor} herë në 24 orë. Provo përsëri nesër.` },
      429,
    );
  }

  return { userId, klienti, admin };
}

/** Shënon një thirrje të AI-së (edhe kur dështon), që kufiri ditor të mos anashkalohet me riprovime. */
export async function regjistroThirrjen(t: Thirresi, funksioni: FunksioniAI): Promise<void> {
  const { error } = await t.admin.from("cv_ai_thirrjet").insert({ user_id: t.userId, funksioni });
  if (error) console.error(`[${funksioni}] Thirrja s'u regjistrua.`);
}
