// intervista-raporti: raporti përfundimtar i intervistës dhe gatishmëria e re për punën.
//
// Hyrja:  POST { "intervista_id": "<uuid>" }
// Dalja:  { "raporti": RaportiIIntervistes }   (i njëjti objekt që ruhet te intervistat.raporti)
// Gabimet 409 kanë "kodi": "aktive" (intervista s'ka mbaruar) ose "po_perpunohet" (raporti po shkruhet: prit e riprovo).
//
// 1. Idempotent: nëse raporti ekziston, kthehet pa thirrur AI-në.
// 2. Vetëm një raport njëherësh: gjendja kalon "mbaroi" → "po_vleresohet" me UPDATE me kusht (qira 120 s).
// 3. Përgjigjet që s'u vlerësuan gjatë intervistës vlerësohen tani.
// 4. Gatishmëria e re futet te public.gatishmeria (tabela e WP3) me burimi = 'intervista'. Kodi e kufizon
//    ndryshimin në ±15 pikë nga e mëparshmja: një intervistë praktike s'duhet ta hedhë numrin lart a poshtë pa masë.
import {
  eshteVleresim,
  ETIKETA_E_THIRRESIT,
  gabim,
  GabimIntervista,
  type Gjuha,
  gjeneroRaportin,
  type Konteksti,
  type KthesaDB,
  kufizo,
  MODELI_RAPORTI,
  QIRAJA_MS,
  type Roli,
  UUID,
  type Vleresimi,
  vleresoPergjigjen,
} from "../_shared/intervista-ai.ts";
import { CORS_HEADERS, json, kontrolloThirresin } from "../_shared/thirresi.ts";

const NDRYSHIMI_MAKS = 15; // pikë gatishmërie për një intervistë

type Objekt = Record<string, unknown>;
const eshteObjekt = (v: unknown): v is Objekt => typeof v === "object" && v !== null && !Array.isArray(v);

const PA_VLERESIM: Vleresimi = {
  cka_ishte_mire: "—",
  cka_te_permiresosh: "Kjo përgjigje s'u vlerësua dot këtë herë.",
  shembull_me_i_mire: "—",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return gabim("Metoda nuk lejohet.", 405);

  const t = await kontrolloThirresin(req, ETIKETA_E_THIRRESIT, Number.POSITIVE_INFINITY);
  if (t instanceof Response) return t;

  let eZene: string | null = null;
  const liro = async () => {
    if (!eZene) return;
    await t.admin
      .from("intervistat")
      .update({ gjendja: "mbaroi", perpunim_nga: null })
      .eq("id", eZene)
      .eq("gjendja", "po_vleresohet");
    eZene = null;
  };

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return gabim("Kërkesa nuk është e vlefshme.", 400);
    }
    const intervistaId = eshteObjekt(body) ? body.intervista_id : undefined;
    if (typeof intervistaId !== "string" || !UUID.test(intervistaId)) return gabim("Mungon intervista.", 400);

    const { data: intervista, error: gabimiLeximit } = await t.admin
      .from("intervistat")
      .select("id, puna_id, cv_id, gjuha, roli, gjendja, konteksti, raporti")
      .eq("id", intervistaId)
      .eq("user_id", t.userId)
      .maybeSingle();
    if (gabimiLeximit) {
      console.error("[intervista-raporti] Leximi i intervistës dështoi.");
      return gabim("S'u lexua intervista. Provo përsëri.", 500);
    }
    if (!intervista) return gabim("Intervista nuk u gjet.", 404);
    if (intervista.gjendja === "perfunduar" && intervista.raporti) return json({ raporti: intervista.raporti });
    if (intervista.gjendja === "aktive") return gabim("Intervista s'ka mbaruar ende.", 409, "aktive");

    // ---------- Zë raportin ----------
    const tani = new Date();
    const afati = new Date(tani.getTime() - QIRAJA_MS).toISOString();
    const { data: zene, error: gabimiZenies } = await t.admin
      .from("intervistat")
      .update({ gjendja: "po_vleresohet", perpunim_nga: tani.toISOString() })
      .eq("id", intervistaId)
      .eq("user_id", t.userId)
      .or(`gjendja.eq.mbaroi,and(gjendja.eq.po_vleresohet,perpunim_nga.lt."${afati}")`)
      .select("id");
    if (gabimiZenies) {
      console.error("[intervista-raporti] Nisja e raportit dështoi.");
      return gabim("Raporti s'u nis. Provo përsëri.", 500);
    }
    if (!zene || zene.length === 0) return gabim("Raporti po përgatitet. Prit pak.", 409, "po_perpunohet");
    eZene = intervistaId;

    const { data: rreshtat, error: gabimiKthesave } = await t.admin
      .from("intervista_kthesat")
      .select("id, nr, lloji, reagimi, pyetja, pergjigja, vleresimi, pergjigjur_me")
      .eq("intervista_id", intervistaId)
      .eq("user_id", t.userId)
      .not("pergjigja", "is", null)
      .order("nr", { ascending: true });
    if (gabimiKthesave) {
      await liro();
      console.error("[intervista-raporti] Leximi i kthesave dështoi.");
      return gabim("S'u lexua intervista. Provo përsëri.", 500);
    }
    const kthesat = (rreshtat ?? []) as KthesaDB[];
    if (kthesat.length === 0) {
      await liro();
      return gabim("S'ka përgjigje për të vlerësuar.", 400);
    }

    const konteksti = intervista.konteksti as Konteksti;
    const roli = intervista.roli as Roli;
    const gjuha = intervista.gjuha as Gjuha;

    // ---------- Përgjigjet pa vlerësim (AI-ja dështoi gjatë intervistës) ----------
    const paVleresim = kthesat.filter((k) => !eshteVleresim(k.vleresimi));
    if (paVleresim.length) {
      const rezultatet = await Promise.allSettled(
        paVleresim.map((k) =>
          vleresoPergjigjen({ konteksti, roli, gjuha, kthesa: { reagimi: k.reagimi, pyetja: k.pyetja, pergjigja: k.pergjigja ?? "" } }),
        ),
      );
      await Promise.all(
        rezultatet.map(async (r, i) => {
          if (r.status !== "fulfilled") return;
          paVleresim[i].vleresimi = r.value;
          await t.admin.from("intervista_kthesat").update({ vleresimi: r.value }).eq("id", paVleresim[i].id);
        }),
      );
    }

    // ---------- Raporti ----------
    let ai;
    try {
      ai = await gjeneroRaportin({ konteksti, roli, gjuha, kthesat });
    } catch (e) {
      await liro();
      if (e instanceof GabimIntervista) return gabim(e.message, e.status, e.kodi);
      throw e;
    }

    // ---------- Gatishmëria: para → pas ----------
    let para: number | null = null;
    let gatishmeriaId: string | null = null;
    let pas: number | null = null;
    if (intervista.puna_id) {
      // Nëse një riprovim e ka futur tashmë rreshtin për këtë intervistë, s'futet i dyti.
      const { data: ekzistues } = await t.admin
        .from("gatishmeria")
        .select("id, perqindja")
        .eq("user_id", t.userId)
        .eq("intervista_id", intervistaId)
        .maybeSingle();
      const { data: eMeparshme, error: gabimiGatishmerise } = await t.admin
        .from("gatishmeria")
        .select("perqindja")
        .eq("user_id", t.userId)
        .eq("puna_id", intervista.puna_id)
        .or(`intervista_id.is.null,intervista_id.neq.${intervistaId}`)
        .order("krijuar_me", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!gabimiGatishmerise && typeof eMeparshme?.perqindja === "number") para = eMeparshme.perqindja;

      if (ekzistues) {
        gatishmeriaId = ekzistues.id as string;
        pas = ekzistues.perqindja as number;
      } else {
        const propozim = kufizo(ai.gatishmeria.perqindja, 0, 100);
        const perqindja =
          para === null ? propozim : kufizo(propozim, Math.max(0, para - NDRYSHIMI_MAKS), Math.min(100, para + NDRYSHIMI_MAKS));
        const { data: rreshti, error: gabimiRuajtjes } = await t.admin
          .from("gatishmeria")
          .insert({
            user_id: t.userId,
            puna_id: intervista.puna_id,
            cv_id: intervista.cv_id,
            burimi: "intervista",
            intervista_id: intervistaId,
            perqindja,
            ke: ai.gatishmeria.ke.slice(0, 8),
            mungon: ai.gatishmeria.mungon.slice(0, 8),
            hapat: ai.tri_hapat_e_radhes.map((h) => h.trim()).filter(Boolean).slice(0, 3),
            arsyeja: ai.gatishmeria.arsyeja.trim() || "Nga intervista praktike.",
            modeli: MODELI_RAPORTI,
          })
          .select("id")
          .single();
        if (gabimiRuajtjes || !rreshti) {
          // Raporti vazhdon; gatishmëria e re s'tregohet nëse s'u ruajt.
          console.error("[intervista-raporti] Gatishmëria s'u ruajt.");
        } else {
          gatishmeriaId = rreshti.id as string;
          pas = perqindja;
        }
      }
    }

    const raporti = {
      versioni: 1,
      nota: kufizo(ai.nota, 0, 100),
      permbledhja: ai.permbledhja,
      tri_hapat_e_radhes: ai.tri_hapat_e_radhes.map((h) => h.trim()).filter(Boolean).slice(0, 3),
      pergjigjet: kthesat.map((k) => ({
        nr: k.nr,
        lloji: k.lloji,
        pyetja: k.pyetja,
        ...(eshteVleresim(k.vleresimi) ? k.vleresimi : PA_VLERESIM),
      })),
      gatishmeria: {
        id: gatishmeriaId,
        para,
        pas,
        ke: ai.gatishmeria.ke.slice(0, 8),
        mungon: ai.gatishmeria.mungon.slice(0, 8),
        arsyeja: ai.gatishmeria.arsyeja,
      },
      puna: { id: konteksti.puna.id, titulli: konteksti.puna.titulli, kompania: konteksti.puna.kompania },
      gjuha,
      modeli: MODELI_RAPORTI,
    };

    const { error: gabimiPerfundimit } = await t.admin
      .from("intervistat")
      .update({
        gjendja: "perfunduar",
        nota: raporti.nota,
        raporti,
        perfunduar_me: new Date().toISOString(),
        perpunim_nga: null,
      })
      .eq("id", intervistaId)
      .eq("user_id", t.userId);
    if (gabimiPerfundimit) {
      await liro();
      console.error("[intervista-raporti] Raporti s'u ruajt.");
      return gabim("Raporti u bë, por s'u ruajt. Provo përsëri.", 500);
    }
    eZene = null;

    return json({ raporti });
  } catch (e) {
    await liro().catch(() => {});
    if (e instanceof GabimIntervista) return gabim(e.message, e.status, e.kodi);
    // Pa detaje: mund të përmbajnë përgjigjet e kandidatit.
    console.error("[intervista-raporti] Gabim i papritur.");
    return gabim("Raporti s'u bë. Provo përsëri.", 500);
  }
});
