// lexo-linkun: "Sill linkun tënd" e lexon vetë shpalljen nga linku, që fushat dhe "A jam gati?" të mos varen nga
// teksti që e ngjit përdoruesi.
//
// Hyrja:  POST { "linku": "<https://...>", "roli"?: "SWE" | "Asistent/PR" } me JWT-në e përdoruesit.
// Dalja:  { linku, titulli, kompania, qyteti, pershkrimi, kerkesat, aftesite, lexuar_nga: "jsonld" | "faqja" }
//         titulli/kompania/qyteti: null kur faqja s'i thotë. pershkrimi = përmbledhja me fjalët tona (≤ 1000, nga
//         kerkesat), "" kur AI-ja s'i nxori dot. kerkesat = forma e portalet (Kerkesat) ose null.
// Gabim:  { "error": "<një fjali në shqip>", "kodi": "linku" | "s_lexohet" | "pa_shpallje" | "ai" | "kufiri" }
//         App-i s'bllokohet kurrë: fushat mbeten për t'u plotësuar me dorë dhe teksti i shpalljes ngjitet vetë.
//
// 1. Thirrësi: sesion + "kerkues" (_shared/thirresi.ts); kufiri KUFIRI_DITOR në 24 orë te cv_ai_thirrjet
//    (funksioni "lexo-linkun", migrimi 20261125100000). Çdo thirrje me link të vlefshëm numërohet para leximit.
// 2. Linku rikontrollohet këtu (linku.ts, rregullat e app-it) + roja SSRF (DNS, vetëm IP publike, edhe pas ridrejtimeve).
// 3. Një kërkesë te faqja (faqja.ts): 8 s, 1 MB, vetëm HTML, pa cookies, User-Agent i ndershëm.
// 4. JobPosting (JSON-LD) nëse ka, përndryshe teksti i faqes (nxirr.ts); pastaj Haiku (ai.ts) me skemën e portalet.
// Teksti i faqes s'ruhet dhe s'regjistrohet në log; as linku i përdoruesit.
import { GabimIAI } from "../_shared/cv-ai.ts";
import { CORS_HEADERS, json, kontrolloThirresin } from "../_shared/thirresi.ts";
import { bashkoAftesite, gjejAftesite, gjejRolin, pershkrimiNgaKerkesat, type Roli } from "../portalet/harta.ts";
import { lexoMeAI, type FaktetEAI } from "./ai.ts";
import { merrFaqen, type FaqjaELexuar } from "./faqja.ts";
import { kontrolloLinkun, zgjidhMeDeno } from "./linku.ts";
import { MIN_TEKST, nxirrNgaHtml } from "./nxirr.ts";

const KUFIRI_DITOR = 20;

const eshteLinkedIn = (url: string) => /(^|\.)linkedin\.com$/i.test(new URL(url).hostname);
const eshteMurHyrjeje = (url: string | undefined) =>
  !!url && /\/(authwall|login|signin|sign-in|uas\/login|checkpoint)\b|[?&](session_redirect|returnUrl|redirect_uri)=/i.test(url);

const MUR_HYRJEJE = "Kjo faqe e tregon shpalljen vetëm pasi hyn në llogari, ndaj s'e lexojmë dot.";
// LinkedIn u kthen lexuesve automatikë 404, 429, 999 ose murin e hyrjes (prova 25.11: 404 dhe 429 te dy shpallje reale).
const MUR_LINKEDIN = "LinkedIn s'i lejon lexuesit automatikë t'i hapin shpalljet pa hyrë në llogari, ndaj s'e lexojmë dot.";

/** Pse s'u lexua faqja, në një fjali. */
function fjaliaEDeshtimit(f: Extract<FaqjaELexuar, { ok: false }>, linku: string): string {
  if (eshteLinkedIn(linku) && f.arsyeja !== "koha") return MUR_LINKEDIN;
  if (eshteMurHyrjeje(f.urlFundit)) return MUR_HYRJEJE;
  switch (f.arsyeja) {
    case "ssrf":
      return "Kjo adresë s'mund të hapet nga Karriera.";
    case "koha":
      return "Faqja s'u përgjigj në kohë.";
    case "jo_html":
      return "Linku s'hap një faqe shpalljeje (p.sh. është PDF ose imazh).";
    case "ridrejtime":
      return "Faqja na dërgoi nga një adresë te tjetra pa mbaruar.";
    case "rrjeti":
      return "S'arritëm ta hapim këtë faqe.";
    case "http":
      if (f.status === 404 || f.status === 410) return "Kjo faqe s'ekziston më (mund të jetë hequr shpallja).";
      if (f.status === 401 || f.status === 403 || f.status === 429 || f.status === 999) {
        return "Faqja s'na lejoi ta lexojmë (kërkon hyrje ose i bllokon lexuesit automatikë).";
      }
      return "Faqja ktheu gabim kur provuam ta lexojmë.";
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Metoda nuk lejohet." }, 405);

  const thirresi = await kontrolloThirresin(req, "lexo-linkun", KUFIRI_DITOR);
  if (thirresi instanceof Response) {
    if (thirresi.status !== 429) return thirresi;
    const trupi = await thirresi.json();
    return json({ ...trupi, kodi: "kufiri" }, 429);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Kërkesa nuk është e vlefshme." }, 400);
  }
  const hyrja = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  if (typeof hyrja.linku !== "string" || hyrja.linku.length > 1000) {
    return json({ error: "Ngjit linkun e shpalljes.", kodi: "linku" }, 400);
  }
  const kontrolli = kontrolloLinkun(hyrja.linku);
  if (!kontrolli.ok) return json({ error: kontrolli.gabimi, kodi: "linku" }, 400);
  const linku = kontrolli.linku;

  // Numërohet para leximit: edhe një faqe që s'lexohet e harxhon kufirin (funksioni s'bëhet proxy pa fund).
  const { error: gabimiRegjistrimit } = await thirresi.admin
    .from("cv_ai_thirrjet")
    .insert({ user_id: thirresi.userId, funksioni: "lexo-linkun" });
  if (gabimiRegjistrimit) {
    console.error("[lexo-linkun] Thirrja s'u regjistrua (a është aplikuar migrimi 20261125100000?).");
    return json({ error: "Leximi i linkut s'punon tani. Plotëso fushat vetë.", kodi: "s_lexohet" }, 503);
  }

  try {
    const faqja = await merrFaqen(linku, { zgjidh: zgjidhMeDeno });
    if (!faqja.ok) {
      console.log(`[lexo-linkun] S'u lexua: ${faqja.arsyeja}${faqja.status ? ` ${faqja.status}` : ""}`);
      return json({ error: fjaliaEDeshtimit(faqja, linku), kodi: "s_lexohet" }, 422);
    }

    const nx = nxirrNgaHtml(faqja.html);
    const murHyrjeje = eshteMurHyrjeje(faqja.urlFundit);
    if (nx.burimi === "faqja" && (murHyrjeje || nx.teksti.length < MIN_TEKST)) {
      const fjalia = eshteLinkedIn(linku)
        ? MUR_LINKEDIN
        : murHyrjeje
          ? MUR_HYRJEJE
          : "Në këtë faqe s'gjetëm tekstin e një shpalljeje pune.";
      return json({ error: fjalia, kodi: "pa_shpallje" }, 422);
    }

    let ai: FaktetEAI | null = null;
    try {
      ai = await lexoMeAI(
        { linku, titulliIFaqes: nx.titulliIFaqes, titulli: nx.titulli, kompania: nx.kompania },
        nx.teksti,
      );
    } catch (e) {
      // Pa JobPosting s'kemi asgjë të sigurt për të kthyer; me JobPosting kthejmë të paktën titullin, kompaninë, qytetin.
      if (nx.burimi === "faqja") {
        const mesazhi = e instanceof GabimIAI ? e.message : "AI-ja s'e lexoi dot shpalljen.";
        return json({ error: mesazhi, kodi: "ai" }, e instanceof GabimIAI ? e.status : 502);
      }
      console.error("[lexo-linkun] AI-ja dështoi; kthejmë vetëm JobPosting.");
    }

    if (ai && !ai.eshteShpallje && nx.burimi === "faqja") {
      const fjalia = eshteLinkedIn(linku) ? MUR_LINKEDIN : "Në këtë faqe s'gjetëm një shpallje pune.";
      return json({ error: fjalia, kodi: "pa_shpallje" }, 422);
    }

    // JSON-LD fiton për titullin, kompaninë dhe qytetin (janë fakte të strukturuara); AI-ja plotëson çka mungon.
    const titulli = nx.titulli ?? ai?.titulli ?? null;
    const kompania = nx.kompania ?? ai?.kompania ?? null;
    const qyteti = nx.qyteti ?? ai?.qyteti ?? null;
    const kerkesat = ai?.kerkesat ?? null;

    const roliNgaHyrja: Roli | null = hyrja.roli === "SWE" || hyrja.roli === "Asistent/PR" ? hyrja.roli : null;
    const roli = (titulli ? gjejRolin(titulli) : null) ?? roliNgaHyrja;
    const ngaTeksti = roli ? gjejAftesite(roli, titulli, nx.teksti) : [];
    const aftesite = roli && kerkesat ? bashkoAftesite(roli, ngaTeksti, kerkesat) : ngaTeksti;

    return json({
      linku,
      titulli,
      kompania,
      qyteti,
      pershkrimi: kerkesat ? pershkrimiNgaKerkesat(kerkesat) : "",
      kerkesat,
      aftesite,
      lexuar_nga: nx.burimi,
    });
  } catch {
    // Pa linkun, pa tekstin e faqes.
    console.error("[lexo-linkun] Gabim i papritur.");
    return json({ error: "S'arritëm ta lexojmë këtë faqe.", kodi: "s_lexohet" }, 500);
  }
});
