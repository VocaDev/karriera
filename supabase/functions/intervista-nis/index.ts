// intervista-nis: nis një intervistë me tekst për një punë konkrete dhe kthen pyetjen e parë.
//
// Hyrja:  POST { "puna_id": "p1", "gjuha"?: "sq" | "en" | "de", "gjatesia"?: "shkurter" | "plote",
//                "intervistuesi"?: "arta" | "arber" }   (pa të: "arta"; ruhet te intervistat.konteksti)
// Dalja:  { "intervista": IntervistaInfo (me "intervistuesi"), "kthesa": { nr, lloji, reagimi, pyetja, shprehja }, "rifilluar": boolean }
//
// 1. Thirrësi: sesion i vërtetë dhe llogari "kerkues" (_shared/thirresi.ts, vetëm lexim).
// 2. Nëse kjo punë ka një intervistë "aktive" nga 24 orët e fundit (e njëjta gjuhë e gjatësi), e vazhdon atë
//    në vend që të hapë një të re: pauza = dil dhe kthehu më vonë.
// 3. Kufiri: KUFIRI_DITOR_INTERVISTAVE intervista të reja në 24 orë (numërohen te intervistat).
// 4. Konteksti: puna, CV-ja e fundit (pa emër, email, telefon) dhe gatishmëria e fundit për këtë punë.
//    Ngrihet te intervistat.konteksti, që intervista të mbetet e njëjtë edhe nëse CV-ja ndryshon në mes.
// 5. Pyetja e parë s'kërkon AI: është e menjëhershme, falas, dhe përmend punën e kompaninë.
import {
  ETIKETA_E_THIRRESIT,
  eshteGjuhe,
  eshteRol,
  gabim,
  GJATESITE,
  type Gjatesia,
  type Gjuha,
  INTERVISTUESI_FILLESTAR,
  type Intervistuesi,
  intervistuesiNga,
  IntervistuesiSchema,
  type Konteksti,
  KUFIRI_DITOR_INTERVISTAVE,
  kthesaPerApp,
  pyetjaEPare,
  type Roli,
} from "../_shared/intervista-ai.ts";
import { CORS_HEADERS, json, kontrolloThirresin } from "../_shared/thirresi.ts";

const MAKS_CV = 3000; // shkronja nga CV-ja në kontekst (mjafton për pyetjet, mban koston të ulët)

type Objekt = Record<string, unknown>;
const eshteObjekt = (v: unknown): v is Objekt => typeof v === "object" && v !== null && !Array.isArray(v);
const tekst = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const liste = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

// punet.kerkesat (nxjerrë nga AI-ja nga shpallja): kërkesat, përparësitë dhe detyrat, të shkurtuara. Pyetjet lidhen me to.
function kerkesatEShpalljes(v: unknown): string[] {
  if (!eshteObjekt(v)) return [];
  return [...liste(v.kerkesat), ...liste(v.perparesi), ...liste(v.detyrat)]
    .map((x) => tekst(x).slice(0, 200))
    .filter(Boolean)
    .slice(0, 14);
}

// CV-ja e krijuar (CvStrukturuar): vetëm faktet profesionale. Emri, email-i, telefoni, qyteti dhe datëlindja s'hyjnë.
function cvNgaPermbajtja(p: unknown): string | null {
  if (!eshteObjekt(p)) return null;
  const rreshtat: string[] = [];
  if (tekst(p.titulli)) rreshtat.push(`Titulli: ${tekst(p.titulli)}`);
  if (tekst(p.profili)) rreshtat.push(`Profili: ${tekst(p.profili)}`);
  const pervoja = liste(p.pervoja)
    .filter(eshteObjekt)
    .map((x) => `- ${tekst(x.roli)} te ${tekst(x.vendi)} (${tekst(x.periudha)}): ${tekst(x.pershkrimi)}`);
  if (pervoja.length) rreshtat.push("Përvoja:", ...pervoja);
  const projektet = liste(p.projektet)
    .filter(eshteObjekt)
    .map((x) => `- ${tekst(x.titulli)}: ${tekst(x.pershkrimi)}`);
  if (projektet.length) rreshtat.push("Projektet:", ...projektet);
  const arsimi = liste(p.arsimi)
    .filter(eshteObjekt)
    .map((x) => `- ${tekst(x.programi)}, ${tekst(x.institucioni)} (${tekst(x.periudha)})`);
  if (arsimi.length) rreshtat.push("Arsimi:", ...arsimi);
  const aftesite = liste(p.aftesite).map(tekst).filter(Boolean);
  if (aftesite.length) rreshtat.push(`Aftësitë: ${aftesite.join(", ")}`);
  const gjuhet = liste(p.gjuhet)
    .filter(eshteObjekt)
    .map((x) => `${tekst(x.gjuha)} ${tekst(x.niveli)}`.trim());
  if (gjuhet.length) rreshtat.push(`Gjuhët: ${gjuhet.join(", ")}`);
  const teksti = rreshtat.join("\n").slice(0, MAKS_CV);
  return teksti || null;
}

// CV-ja e ngarkuar (PDF): s'e dërgojmë PDF-në në çdo kthesë; përdorim analizën e saj (cv_reviews), që s'ka të dhëna kontakti.
function cvNgaAnaliza(a: unknown): string | null {
  if (!eshteObjekt(a)) return null;
  const rreshtat: string[] = ["(Përmbledhje e CV-së nga analiza e AI-së)"];
  if (tekst(a.permbledhja)) rreshtat.push(tekst(a.permbledhja));
  const forta = liste(a.pikat_e_forta).map(tekst).filter(Boolean);
  if (forta.length) rreshtat.push(`Pikat e forta: ${forta.join("; ")}`);
  const seksionet = liste(a.seksionet)
    .filter(eshteObjekt)
    .map((s) => `- ${tekst(s.emri)} (${s.gjendja === "mire" ? "mirë" : "për t'u përmirësuar"}): ${tekst(s.komenti)}`);
  if (seksionet.length) rreshtat.push("Seksionet:", ...seksionet);
  return rreshtat.length > 1 ? rreshtat.join("\n").slice(0, MAKS_CV) : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return gabim("Metoda nuk lejohet.", 405);

  const t = await kontrolloThirresin(req, ETIKETA_E_THIRRESIT, Number.POSITIVE_INFINITY);
  if (t instanceof Response) return t;

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return gabim("Kërkesa nuk është e vlefshme.", 400);
    }
    const b = eshteObjekt(body) ? body : {};
    const punaId = b.puna_id;
    if (typeof punaId !== "string" || punaId.length < 1 || punaId.length > 100) {
      return gabim("Zgjidh punën për intervistën.", 400);
    }
    if (b.gjuha !== undefined && !eshteGjuhe(b.gjuha)) return gabim("Gjuha duhet të jetë sq, en ose de.", 400);
    if (b.gjatesia !== undefined && b.gjatesia !== "shkurter" && b.gjatesia !== "plote") {
      return gabim("Gjatësia duhet të jetë e shkurtër ose e plotë.", 400);
    }
    const gjatesia: Gjatesia = b.gjatesia === "plote" ? "plote" : "shkurter";
    const intervistuesiParsuar = b.intervistuesi === undefined ? null : IntervistuesiSchema.safeParse(b.intervistuesi);
    if (intervistuesiParsuar && !intervistuesiParsuar.success) {
      return gabim("Intervistuesi duhet të jetë arta ose arber.", 400);
    }
    const intervistuesi: Intervistuesi = intervistuesiParsuar?.data ?? INTERVISTUESI_FILLESTAR;

    // Puna, me JWT-në e përdoruesit (RLS: kërkuesi i lexon shpalljet).
    const { data: puna, error: gabimiPunes } = await t.klienti
      .from("punet")
      .select("id, titulli, kompania, qyteti, roli, pershkrimi, aftesite, kerkesat")
      .eq("id", punaId)
      .maybeSingle();
    if (gabimiPunes) {
      console.error("[intervista-nis] Leximi i punës dështoi.");
      return gabim("S'u lexua puna. Provo përsëri.", 500);
    }
    if (!puna) return gabim("Kjo punë nuk u gjet.", 404);

    // Profili: "*" që funksioni të punojë edhe para migrimit të WP2 (roli_synuar mund të mos ekzistojë ende).
    const { data: profili } = await t.klienti.from("profiles").select("*").eq("id", t.userId).maybeSingle();
    const p = eshteObjekt(profili) ? profili : {};
    const gjuha: Gjuha = eshteGjuhe(b.gjuha) ? b.gjuha : eshteGjuhe(p.gjuha) ? p.gjuha : "sq";
    const roli: Roli =
      p.roli_synuar === "SWE" || p.roli_synuar === "Asistent/PR" ? p.roli_synuar : eshteRol(puna.roli) ? puna.roli : "Tjetër";

    const nje24OreMePare = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { min, max } = GJATESITE[gjatesia];
    const infoPune = { id: puna.id as string, titulli: puna.titulli as string, kompania: puna.kompania as string };

    // Vazhdo intervistën e nisur për këtë punë (pa e harxhuar kufirin), vetëm nëse e bën i njëjti intervistues:
    // kush provon Artën dhe pastaj Arbërin për të njëjtën punë duhet të marrë një intervistë të re.
    const { data: teNisurat } = await t.admin
      .from("intervistat")
      .select("id, gjuha, roli, gjatesia, gjendja, nr_pyetjeve, cv_id, konteksti")
      .eq("user_id", t.userId)
      .eq("puna_id", puna.id)
      .eq("gjendja", "aktive")
      .eq("gjuha", gjuha)
      .eq("gjatesia", gjatesia)
      .gte("krijuar_me", nje24OreMePare)
      .order("krijuar_me", { ascending: false })
      .limit(10);
    const eNisur = (teNisurat ?? []).find(
      (x) => intervistuesiNga(eshteObjekt(x.konteksti) ? x.konteksti : null) === intervistuesi,
    );
    if (eNisur) {
      const { data: kthesa } = await t.admin
        .from("intervista_kthesat")
        .select("nr, lloji, reagimi, pyetja")
        .eq("intervista_id", eNisur.id)
        .eq("user_id", t.userId)
        .order("nr", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (kthesa) {
        const { konteksti: _konteksti, ...tePublikat } = eNisur; // konteksti (me CV-në) s'del te app-i
        return json({
          intervista: { ...tePublikat, intervistuesi, min, max, puna: infoPune, ka_cv: eNisur.cv_id !== null },
          kthesa: kthesaPerApp(kthesa),
          rifilluar: true,
        });
      }
    }

    // Kufiri ditor (vetëm për intervista të reja).
    const { count, error: gabimiNumrit } = await t.admin
      .from("intervistat")
      .select("id", { count: "exact", head: true })
      .eq("user_id", t.userId)
      .gte("krijuar_me", nje24OreMePare);
    if (gabimiNumrit) {
      console.error("[intervista-nis] Numërimi i intervistave dështoi.");
      return gabim("Diçka shkoi keq. Provo përsëri.", 500);
    }
    if ((count ?? 0) >= KUFIRI_DITOR_INTERVISTAVE) {
      return gabim(
        `Ke arritur kufirin: ${KUFIRI_DITOR_INTERVISTAVE} intervista në 24 orë. Provo përsëri nesër.`,
        429,
        "kufiri",
      );
    }

    // CV-ja e fundit (RLS: vetëm e imja).
    let cvId: string | null = null;
    let cvTekst: string | null = null;
    const { data: cv } = await t.klienti
      .from("cvs")
      .select("id, burimi, permbajtja")
      .order("versioni", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cv) {
      cvId = cv.id as string;
      if (cv.burimi === "krijuar") {
        cvTekst = cvNgaPermbajtja(cv.permbajtja);
      } else {
        const { data: analiza } = await t.klienti
          .from("cv_reviews")
          .select("analiza")
          .eq("cv_id", cv.id)
          .order("krijuar_me", { ascending: false })
          .limit(1)
          .maybeSingle();
        cvTekst = cvNgaAnaliza(analiza?.analiza);
      }
    }

    // Gatishmëria e fundit për këtë punë (tabela e WP3). Nëse tabela s'ekziston ende, intervista vazhdon pa të.
    let gatishmeria: Konteksti["gatishmeria"] = null;
    const { data: gati, error: gabimiGatishmerise } = await t.klienti
      .from("gatishmeria")
      .select("id, perqindja, mungon")
      .eq("puna_id", puna.id)
      .order("krijuar_me", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!gabimiGatishmerise && gati && typeof gati.perqindja === "number") {
      const mungon = liste(gati.mungon)
        .filter(eshteObjekt)
        .map((m) => tekst(m.aftesia))
        .filter(Boolean)
        .slice(0, 8);
      gatishmeria = { id: gati.id as string, perqindja: gati.perqindja, mungon };
    }

    const konteksti: Konteksti = {
      puna: {
        id: puna.id as string,
        titulli: puna.titulli as string,
        kompania: puna.kompania as string,
        qyteti: puna.qyteti as string,
        roli: eshteRol(puna.roli) ? puna.roli : "Tjetër",
        pershkrimi: tekst(puna.pershkrimi),
        aftesite: liste(puna.aftesite).map(tekst).filter(Boolean),
        kerkesat: kerkesatEShpalljes(puna.kerkesat),
      },
      cv: cvTekst,
      gatishmeria,
      intervistuesi,
      // Pyetja e parë është gjithmonë hapje e ngrohtë (qasjet e tjera i vendos intervista-kthesa).
      qasjet: [{ nr: 1, qasja: "ngrohje", arsyeja: "Hapja e intervistës." }],
    };

    const { data: intervista, error: gabimiKrijimit } = await t.admin
      .from("intervistat")
      .insert({
        user_id: t.userId,
        puna_id: puna.id,
        cv_id: cvId,
        gjuha,
        roli,
        gjatesia,
        konteksti,
        nr_pyetjeve: 1,
      })
      .select("id, gjuha, roli, gjatesia, gjendja, nr_pyetjeve, cv_id")
      .single();
    if (gabimiKrijimit || !intervista) {
      console.error("[intervista-nis] Krijimi i intervistës dështoi.");
      return gabim("Intervista s'u krijua. Provo përsëri.", 500);
    }

    const ePara = pyetjaEPare(gjuha, konteksti.puna.titulli, konteksti.puna.kompania, intervistuesi);
    const { data: kthesa, error: gabimiKthesesSe } = await t.admin
      .from("intervista_kthesat")
      .insert({
        intervista_id: intervista.id,
        user_id: t.userId,
        nr: 1,
        lloji: "pyetje",
        reagimi: ePara.reagimi,
        pyetja: ePara.pyetja,
      })
      .select("nr, lloji, reagimi, pyetja")
      .single();
    if (gabimiKthesesSe || !kthesa) {
      console.error("[intervista-nis] Pyetja e parë s'u ruajt.");
      await t.admin.from("intervistat").delete().eq("id", intervista.id).eq("user_id", t.userId);
      return gabim("Intervista s'u krijua. Provo përsëri.", 500);
    }

    return json({
      intervista: { ...intervista, intervistuesi, min, max, puna: infoPune, ka_cv: cvId !== null },
      kthesa: kthesaPerApp(kthesa, "buzeqeshje"),
      rifilluar: false,
    });
  } catch {
    // Pa detaje: mund të përmbajnë të dhëna të CV-së.
    console.error("[intervista-nis] Gabim i papritur.");
    return gabim("Intervista s'u nis. Provo përsëri.", 500);
  }
});
