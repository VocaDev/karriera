// portalet: sjell shpalljet e vërteta nga portalet e Kosovës te tabela "punet" (burimi = 'portal').
//
// Thirret nga pg_cron (një herë në ditë për çdo portal), jo nga app-i.
// Hyrja:  POST { "portalet"?: ["kosovajob" | "portalpune" | "ofertapune"], "provo"?: true, "maks_detaje"?: number,
//                "maks_ai"?: number, "rifresko_kerkesat"?: true }
//         me header-in "x-portalet-sekreti: <PORTALET_SEKRETI>".
//         "provo": true = vetëm lexon dhe kthen raportin (me kërkesat e AI-së), s'shkruan asgjë në databazë.
//         "maks_ai": kufiri i thirrjeve te Haiku në një ekzekutim (parazgjedhja dhe maksimumi: MAKS_AI).
//         "rifresko_kerkesat": true = s'lexon listat; rihap shpalljet aktive pa "kerkesat" (max MAKS_RIFRESKIM) dhe i plotëson.
// Dalja:  raporti: sa u panë, sa hynë në HARTA, sa të reja, sa u rifreskuan, sa skaduan, dublikatat, gabimet.
//
// 1. Për çdo portal (me radhë, një kërkesë në një kohë, robots.txt i respektuar): lista → kandidatët
//    (titulli i ngjan SWE ose Asistent/PR) → faqja e shpalljes vetëm për kandidatët e rinj.
// 2. Harta (harta.ts): rregulla, pa AI (roli, qyteti, afati). Pastaj Haiku (kerkesat.ts) nxjerr kërkesat nga teksti i plotë.
//    Teksti i shpalljes s'ruhet: vetëm faktet, përmbledhja me fjalët tona, linku. Nëse AI-ja dështon, rreshti hyn pa "kerkesat".
// 3. Dublikatat: e njëjta punë (gjurma = titulli + kompania) mbahet vetëm një herë.
// 4. Shkrimi me çelësin sekret (RLS-i s'ia lejon app-it rreshtat "portal").
// 5. Skadimi: aktive = false kur afati kaloi ose shpallja s'u pa 3 ditë (vetëm për portalet që u lexuan pa gabim).
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import { BURIMET, RADHA, trupiNgaFaqja, type RezultatiIBurimit } from "./burimet.ts";
import { eshteENjejta, gjurma, hiqDublikatat, neRresht, sot, type Portali, type Roli, type RreshtiPunes } from "./harta.ts";
import { fushatNgaKerkesat, nxirrKerkesat, shtoKerkesat, type RaportiAI } from "./kerkesat.ts";
import { Shfletuesi } from "./shfletuesi.ts";

const MAKS_DETAJE = 20;
const MAKS_AI = 30; // thirrje te Haiku në një ekzekutim (kosto + koha: 150 s)
const MAKS_RIFRESKIM = 25; // shpallje të vjetra pa kërkesa që plotësohen në një ekzekutim "rifresko_kerkesat"
const KOHA_AI_MS = 125_000; // pas kësaj s'nisim thirrje të reja AI (Edge Function ka 150 s)
const DITE_PA_U_PARE = 3;
const HEADERS = { "Content-Type": "application/json" };

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: HEADERS });
}

// Çelësat e rinj vijnë si JSON {"default": "..."}; çelësi i vjetër (service_role) si tekst.
function celesiSekret(): string {
  const teRinjte = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (teRinjte) {
    try {
      const v = JSON.parse(teRinjte)?.default;
      if (typeof v === "string" && v) return v;
    } catch {
      // vazhdon te çelësi i vjetër
    }
  }
  const vjeter = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!vjeter) throw new Error("Mungon çelësi sekret i Supabase.");
  return vjeter;
}

function teBarabarta(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let ndryshimi = 0;
  for (let i = 0; i < ea.length; i++) ndryshimi |= ea[i] ^ eb[i];
  return ndryshimi === 0;
}

type Kerkesa = { portalet?: unknown; provo?: unknown; maks_detaje?: unknown; maks_ai?: unknown; rifresko_kerkesat?: unknown };

type RreshtiIVjeter = { id: string; titulli: string; kompania: string; qyteti: string; roli: Roli; portali: Portali; linku: string; aftesite: string[] };

/**
 * Plotëson "kerkesat" për shpalljet aktive që s'i kanë (rreshta të importuar para kësaj veçorie, ose ku AI-ja dështoi).
 * Rihap faqen e shpalljes (robots.txt i njëjtë, një kërkesë në një kohë), nxjerr kërkesat, përditëson vetëm kerkesat,
 * pershkrimi dhe aftesite. Më të rejat së pari. Faqja që s'hapet ose s'ka tekst anashkalohet.
 */
async function rifreskoKerkesat(
  admin: SupabaseClient,
  shf: Shfletuesi,
  provo: boolean,
  maksAI: number,
  afati: number,
) {
  const { data, error } = await admin
    .from("punet")
    .select("id, titulli, kompania, qyteti, roli, portali, linku, aftesite")
    .eq("burimi", "portal")
    .eq("aktive", true)
    .is("kerkesat", null)
    .order("krijuar_me", { ascending: false })
    .limit(MAKS_RIFRESKIM);
  if (error) throw new Error(`Leximi i rreshtave pa kërkesa: ${error.message}`);
  const rreshtat = (data ?? []) as RreshtiIVjeter[];

  const raporti: RaportiAI & { te_gjetura: number; plotesuar: number; pa_faqe: string[] } = {
    kufiri: maksAI, thirrje: 0, sukses: 0, deshtuan: 0, pa_trup: 0, pa_koha: 0, arsyet: [],
    te_gjetura: rreshtat.length, plotesuar: 0, pa_faqe: [],
  };
  const pergjigjet: { id: string; kerkesat: unknown }[] = [];
  const ne_fluks: Promise<void>[] = [];
  for (const r of rreshtat) {
    if (raporti.thirrje >= maksAI || Date.now() > afati) {
      raporti.pa_koha++;
      continue;
    }
    let trupi: string | null = null;
    try {
      trupi = trupiNgaFaqja(r.portali, await shf.merr(r.linku));
    } catch (e) {
      raporti.pa_faqe.push(`${r.id}: ${(e as Error).message}`.slice(0, 160));
      continue;
    }
    if (!trupi) {
      raporti.pa_trup++;
      continue;
    }
    raporti.thirrje++;
    // Faqja e radhës merret ndërsa AI-ja i përgjigjet kësaj (kërkesat HTTP mbeten një nga një).
    ne_fluks.push(
      (async () => {
        const p = await nxirrKerkesat({ titulli: r.titulli, kompania: r.kompania, qyteti: r.qyteti, portali: r.portali }, trupi);
        if (!p.kerkesat) {
          raporti.deshtuan++;
          if (raporti.arsyet.length < 5) raporti.arsyet.push(`${r.id}: ${p.arsyeja}`);
          return;
        }
        raporti.sukses++;
        const fushat = fushatNgaKerkesat(r.roli, r.aftesite, p.kerkesat);
        pergjigjet.push({ id: r.id, kerkesat: fushat.kerkesat });
        if (provo) return;
        const { error: gabim } = await admin.from("punet").update(fushat).eq("id", r.id);
        if (gabim) raporti.arsyet.push(`${r.id}: shkrimi ${gabim.message}`.slice(0, 160));
        else raporti.plotesuar++;
      })(),
    );
  }
  await Promise.all(ne_fluks);
  console.log(
    `[portalet] rifresko_kerkesat: ${raporti.te_gjetura} pa kërkesa, ${raporti.thirrje} thirrje AI (kufiri ${maksAI}), ${raporti.sukses} me sukses, ${raporti.plotesuar} të shkruara`,
  );
  return { raporti, pergjigjet: provo ? pergjigjet : undefined };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Vetëm POST." }, 405);

  const sekreti = Deno.env.get("PORTALET_SEKRETI");
  if (!sekreti) return json({ error: "Mungon PORTALET_SEKRETI." }, 500);
  if (!teBarabarta(req.headers.get("x-portalet-sekreti") ?? "", sekreti)) return json({ error: "Jo i autorizuar." }, 401);

  let trupi: Kerkesa = {};
  try {
    trupi = (await req.json()) as Kerkesa;
  } catch {
    // trup bosh = të gjitha portalet
  }
  const teKerkuara = Array.isArray(trupi.portalet) ? trupi.portalet.filter((p): p is Portali => RADHA.includes(p as Portali)) : RADHA;
  const portalet = RADHA.filter((p) => teKerkuara.includes(p));
  const provo = trupi.provo === true;
  const maksDetaje = typeof trupi.maks_detaje === "number" ? Math.max(0, Math.min(60, Math.floor(trupi.maks_detaje))) : MAKS_DETAJE;
  const maksAI = typeof trupi.maks_ai === "number" ? Math.max(0, Math.min(MAKS_AI, Math.floor(trupi.maks_ai))) : MAKS_AI;
  const afatiIAI = Date.now() + KOHA_AI_MS;

  const url = Deno.env.get("SUPABASE_URL");
  if (!url) return json({ error: "Mungon SUPABASE_URL." }, 500);
  const admin = createClient(url, celesiSekret(), { auth: { persistSession: false } });

  // Rifreskimi i kërkesave: pa lexuar listat e portaleve (shpejt, brenda 150 s). Thirret me dorë, jo nga pg_cron.
  if (trupi.rifresko_kerkesat === true) {
    try {
      const { raporti, pergjigjet } = await rifreskoKerkesat(
        admin,
        new Shfletuesi((m) => console.log(`[portalet] ${m}`)),
        provo,
        maksAI,
        afatiIAI,
      );
      return json({ provo, rifresko_kerkesat: true, ai: raporti, kerkesat: pergjigjet });
    } catch (e) {
      return json({ error: (e as Error).message }, 500);
    }
  }

  // Çka kemi tashmë: id-të (për të mos e hapur sërish faqen) dhe gjurmët (dublikatat mes portaleve).
  const { data: ekzistuese, error: gabimLeximi } = await admin
    .from("punet")
    .select("id, gjurma, qyteti, aktive")
    .eq("burimi", "portal");
  if (gabimLeximi) return json({ error: `Leximi i punet: ${gabimLeximi.message}` }, 500);
  const idTeNjohura = new Set(ekzistuese.map((r) => r.id as string));
  const aktivet = ekzistuese
    .filter((r) => r.aktive)
    .map((r) => ({ id: r.id as string, gjurma: r.gjurma as string, qyteti: r.qyteti as string }));
  const gjurmetAktive = new Set(aktivet.map((r) => r.gjurma));

  const fillimi = new Date().toISOString();
  const shf = new Shfletuesi((m) => console.log(`[portalet] ${m}`));
  const rezultatet: RezultatiIBurimit[] = [];
  const teDeshtuara: { portali: Portali; gabimi: string }[] = [];
  for (const portali of portalet) {
    try {
      rezultatet.push(
        await BURIMET[portali](shf, {
          eshteERe: (p, id) => !idTeNjohura.has(`${p}-${id}`),
          eshteDublikate: (titulli, kompania) => {
            const g = gjurma(titulli, kompania);
            return gjurmetAktive.has(g) || rezultatet.some((r) => r.shpalljet.some((s) => s.kompania && gjurma(s.titulli, s.kompania) === g));
          },
          maksDetaje,
          log: (m) => console.log(`[portalet] ${m}`),
        }),
      );
    } catch (e) {
      teDeshtuara.push({ portali, gabimi: (e as Error).message });
    }
  }

  const dita = sot();
  const teReja: RreshtiPunes[] = rezultatet
    .flatMap((r) => r.shpalljet)
    .map((s) => neRresht(s, fillimi, dita))
    .filter((r): r is RreshtiPunes => r !== null);
  const { unike, dublikata } = hiqDublikatat(teReja);
  // E njëjta punë është tashmë në databazë nga një portal tjetër (p.sh. KosovaJob ↔ PortalPune).
  const perTeShkruar = unike.filter((r) => {
    const tjetri = aktivet.find((e) => e.id !== r.id && eshteENjejta(e, r));
    if (tjetri) {
      dublikata.push({ mbajtur: tjetri.id, hequr: r.id });
      return false;
    }
    return true;
  });
  const teNjohura = rezultatet.flatMap((r) => r.teNjohura);

  // Kërkesat nga AI-ja vetëm për rreshtat që do të shkruhen (jo për dublikatat). Teksti i shpalljes lexohet këtu dhe harrohet.
  const trupat = new Map(
    rezultatet.flatMap((r) => r.shpalljet).flatMap((s) => (s.trupi ? [[`${s.portali}-${s.id_e_jashtme}`, s.trupi] as const] : [])),
  );
  const ai = await shtoKerkesat(perTeShkruar, trupat, { maksAI, afati: afatiIAI, log: (m) => console.log(`[portalet] ${m}`) });
  trupat.clear();

  const raporti = {
    provo,
    dita,
    kerkesa_http: shf.kerkesat,
    portalet: rezultatet.map((r) => ({
      portali: r.portali,
      ne_liste: r.neListe,
      kandidate: r.kandidate,
      te_reja: perTeShkruar.filter((x) => x.portali === r.portali).length,
      te_njohura: r.teNjohura.length,
      dublikata_nga_lista: r.dublikataNgaLista,
      gabime: r.gabime.slice(0, 10),
    })),
    te_deshtuara: teDeshtuara,
    dublikata,
    ai,
    shkruar: 0,
    rifreskuar: 0,
    skaduar: 0,
  };
  if (provo) return json({ ...raporti, rreshtat: perTeShkruar });

  if (perTeShkruar.length) {
    // id = "<portali>-<id_e_jashtme>": e njëjta shpallje përditësohet, s'dyfishohet. krijuar_me s'dërgohet (mbetet e para).
    const { error } = await admin.from("punet").upsert(perTeShkruar, { onConflict: "id" });
    if (error) return json({ ...raporti, error: `Shkrimi: ${error.message}` }, 500);
    raporti.shkruar = perTeShkruar.length;
  }

  if (teNjohura.length) {
    const { error } = await admin
      .from("punet")
      .update({ pare_me: fillimi, aktive: true })
      .in("id", teNjohura.map((r) => r.id));
    if (error) return json({ ...raporti, error: `Rifreskimi: ${error.message}` }, 500);
    raporti.rifreskuar = teNjohura.length;
  }

  // Skadimi: vetëm për portalet që u lexuan (një portal i rënë s'i fik shpalljet e veta).
  const teLexuara = rezultatet.filter((r) => r.neListe > 0).map((r) => r.portali);
  if (teLexuara.length) {
    const kufiri = new Date(Date.now() - DITE_PA_U_PARE * 86400_000).toISOString();
    const { data, error } = await admin
      .from("punet")
      .update({ aktive: false })
      .eq("burimi", "portal")
      .eq("aktive", true)
      .in("portali", teLexuara)
      .or(`afati.lt.${dita},pare_me.lt."${kufiri}"`)
      .select("id");
    if (error) return json({ ...raporti, error: `Skadimi: ${error.message}` }, 500);
    raporti.skaduar = data?.length ?? 0;
  }

  console.log(
    `[portalet] ${dita}: ${raporti.shkruar} të reja, ${raporti.rifreskuar} rifreskuar, ${raporti.skaduar} skaduar, ${teDeshtuara.length} portale dështuan`,
  );
  return json(raporti, teDeshtuara.length === portalet.length ? 502 : 200);
});
