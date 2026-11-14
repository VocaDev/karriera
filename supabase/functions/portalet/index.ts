// portalet: sjell shpalljet e vërteta nga portalet e Kosovës te tabela "punet" (burimi = 'portal').
//
// Thirret nga pg_cron (një herë në ditë për çdo portal), jo nga app-i.
// Hyrja:  POST { "portalet"?: ["kosovajob" | "portalpune" | "ofertapune"], "provo"?: true, "maks_detaje"?: number }
//         me header-in "x-portalet-sekreti: <PORTALET_SEKRETI>".
//         "provo": true = vetëm lexon dhe kthen raportin, s'shkruan asgjë në databazë.
// Dalja:  raporti: sa u panë, sa hynë në HARTA, sa të reja, sa u rifreskuan, sa skaduan, dublikatat, gabimet.
//
// 1. Për çdo portal (me radhë, një kërkesë në një kohë, robots.txt i respektuar): lista → kandidatët
//    (titulli i ngjan SWE ose Asistent/PR) → faqja e shpalljes vetëm për kandidatët e rinj.
// 2. Harta (harta.ts): rregulla, pa AI. Teksti i shpalljes s'ruhet: vetëm faktet, një përmbledhje me fjalët tona, linku.
// 3. Dublikatat: e njëjta punë (gjurma = titulli + kompania) mbahet vetëm një herë.
// 4. Shkrimi me çelësin sekret (RLS-i s'ia lejon app-it rreshtat "portal").
// 5. Skadimi: aktive = false kur afati kaloi ose shpallja s'u pa 3 ditë (vetëm për portalet që u lexuan pa gabim).
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { BURIMET, RADHA, type RezultatiIBurimit } from "./burimet.ts";
import { eshteENjejta, gjurma, hiqDublikatat, neRresht, sot, type Portali, type RreshtiPunes } from "./harta.ts";
import { Shfletuesi } from "./shfletuesi.ts";

const MAKS_DETAJE = 20;
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

type Kerkesa = { portalet?: unknown; provo?: unknown; maks_detaje?: unknown };

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

  const url = Deno.env.get("SUPABASE_URL");
  if (!url) return json({ error: "Mungon SUPABASE_URL." }, 500);
  const admin = createClient(url, celesiSekret(), { auth: { persistSession: false } });

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
