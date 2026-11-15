// intervista-kthesa: merr përgjigjen e kandidatit, e vlerëson dhe kthen pyetjen tjetër (ose fundin).
//
// Hyrja:  POST { "intervista_id": "<uuid>", "nr": 3, "pergjigja": "..." }
//         ose  { "intervista_id": "<uuid>", "nr": 3, "perfundo": true }   (kandidati e mbyll vetë; duhet ≥ 1 përgjigje)
// Dalja:  { "fund": false, "kthesa": { nr, lloji, reagimi, pyetja, shprehja }, "nr_pyetjeve", "min", "max" }
//         ose { "fund": true, "reagimi": string | null, "nr_pyetjeve" }
// Gabimet 409 kanë "kodi": "jashte_radhe" (app-i rilexon gjendjen), "po_perpunohet" (dërgim i dyfishtë)
// ose "mbaroi" (intervista s'është më aktive: app-i hap rezultatet).
//
// Mbrojtja nga dërgimi i dyfishtë dhe nga kthesat jashtë radhe:
//   - "nr" duhet të jetë pyetja e fundit (aktuale) e intervistës;
//   - kthesa "zihet" me një UPDATE me kusht (pergjigjur_me is null dhe pa qira të freskët): vetëm një kërkesë fiton;
//   - pyetja tjetër futet me unique (intervista_id, nr): s'mund të ketë dy pyetje me të njëjtin numër.
// Nëse AI-ja dështon, qiraja lirohet menjëherë dhe app-i mund ta riprovojë të njëjtën përgjigje.
import {
  eshteVleresim,
  ETIKETA_E_THIRRESIT,
  gabim,
  GabimIntervista,
  GJATESITE,
  type Gjatesia,
  type Gjuha,
  gjeneroKthesen,
  intervistuesiNga,
  type Konteksti,
  type KthesaDB,
  kthesaPerApp,
  MAKS_PERGJIGJJA,
  pyetjaRezerve,
  QIRAJA_MS,
  type Roli,
  UUID,
  vendosMenyren,
  vleresoPergjigjen,
} from "../_shared/intervista-ai.ts";
import { CORS_HEADERS, json, kontrolloThirresin } from "../_shared/thirresi.ts";

type Objekt = Record<string, unknown>;
const eshteObjekt = (v: unknown): v is Objekt => typeof v === "object" && v !== null && !Array.isArray(v);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return gabim("Metoda nuk lejohet.", 405);

  const t = await kontrolloThirresin(req, ETIKETA_E_THIRRESIT, Number.POSITIVE_INFINITY);
  if (t instanceof Response) return t;

  // Kthesa e zënë nga kjo kërkesë; lirohet nëse diçka dështon para fundit.
  let kthesaEZene: string | null = null;
  const liroQirane = async () => {
    if (!kthesaEZene) return;
    await t.admin.from("intervista_kthesat").update({ perpunim_nga: null }).eq("id", kthesaEZene);
    kthesaEZene = null;
  };

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return gabim("Kërkesa nuk është e vlefshme.", 400);
    }
    const b = eshteObjekt(body) ? body : {};
    const intervistaId = b.intervista_id;
    if (typeof intervistaId !== "string" || !UUID.test(intervistaId)) return gabim("Mungon intervista.", 400);
    if (typeof b.nr !== "number" || !Number.isInteger(b.nr) || b.nr < 1) return gabim("Mungon numri i pyetjes.", 400);
    const nr = b.nr;
    const perfundo = b.perfundo === true;
    const pergjigja = typeof b.pergjigja === "string" ? b.pergjigja.trim() : "";
    if (!perfundo) {
      if (!pergjigja) return gabim("Shkruaj një përgjigje.", 400);
      if (pergjigja.length > MAKS_PERGJIGJJA) {
        return gabim(`Përgjigjja duhet të jetë deri në ${MAKS_PERGJIGJJA} shkronja.`, 400);
      }
    }

    // Intervista dhe kthesat: me çelësin sekret (konteksti s'është i lexueshëm nga app-i),
    // prandaj pronari kontrollohet qartë me user_id.
    const { data: intervista, error: gabimiIntervistes } = await t.admin
      .from("intervistat")
      .select("id, gjuha, roli, gjatesia, gjendja, nr_pyetjeve, konteksti")
      .eq("id", intervistaId)
      .eq("user_id", t.userId)
      .maybeSingle();
    if (gabimiIntervistes) {
      console.error("[intervista-kthesa] Leximi i intervistës dështoi.");
      return gabim("S'u lexua intervista. Provo përsëri.", 500);
    }
    if (!intervista) return gabim("Intervista nuk u gjet.", 404);
    if (intervista.gjendja !== "aktive") return gabim("Kjo intervistë ka mbaruar.", 409, "mbaroi");

    const { data: rreshtat, error: gabimiKthesave } = await t.admin
      .from("intervista_kthesat")
      .select("id, nr, lloji, reagimi, pyetja, pergjigja, vleresimi, pergjigjur_me")
      .eq("intervista_id", intervistaId)
      .eq("user_id", t.userId)
      .order("nr", { ascending: true });
    if (gabimiKthesave || !rreshtat || rreshtat.length === 0) {
      console.error("[intervista-kthesa] Leximi i kthesave dështoi.");
      return gabim("S'u lexua intervista. Provo përsëri.", 500);
    }
    const kthesat = rreshtat as KthesaDB[];
    const aktuale = kthesat[kthesat.length - 1];
    const gjatesia: Gjatesia = intervista.gjatesia === "plote" ? "plote" : "shkurter";
    const { min, max } = GJATESITE[gjatesia];
    const nrPyetjeve = kthesat.filter((k) => k.lloji === "pyetje").length;

    // ---------- Kandidati e mbyll vetë ----------
    if (perfundo) {
      if (!kthesat.some((k) => k.pergjigja)) {
        return gabim("Përgjigju të paktën një pyetjeje para se ta mbyllësh.", 400);
      }
      const { data: mbyllur } = await t.admin
        .from("intervistat")
        .update({ gjendja: "mbaroi" })
        .eq("id", intervistaId)
        .eq("user_id", t.userId)
        .eq("gjendja", "aktive")
        .select("id");
      if (!mbyllur || mbyllur.length === 0) return gabim("Kjo intervistë ka mbaruar.", 409, "mbaroi");
      return json({ fund: true, reagimi: null, nr_pyetjeve: nrPyetjeve });
    }

    if (nr !== aktuale.nr || aktuale.pergjigjur_me) {
      return json(
        { error: "Kjo pyetje s'është më aktuale.", kodi: "jashte_radhe", kthesa: kthesaPerApp(aktuale) },
        409,
      );
    }

    // ---------- Zë kthesën (vetëm një kërkesë fiton) ----------
    const tani = new Date();
    const afati = new Date(tani.getTime() - QIRAJA_MS).toISOString();
    const { data: zene, error: gabimiZenies } = await t.admin
      .from("intervista_kthesat")
      .update({ pergjigja, perpunim_nga: tani.toISOString() })
      .eq("id", aktuale.id)
      .is("pergjigjur_me", null)
      .or(`perpunim_nga.is.null,perpunim_nga.lt."${afati}"`)
      .select("id");
    if (gabimiZenies) {
      console.error("[intervista-kthesa] Ruajtja e përgjigjes dështoi.");
      return gabim("Përgjigjja s'u ruajt. Provo përsëri.", 500);
    }
    if (!zene || zene.length === 0) {
      return gabim("Përgjigjja jote po përpunohet tashmë.", 409, "po_perpunohet");
    }
    kthesaEZene = aktuale.id;

    const konteksti = intervista.konteksti as Konteksti;
    const intervistuesi = intervistuesiNga(konteksti); // intervistat e vjetra pa fushën: "arta"
    const roli = intervista.roli as Roli;
    const gjuha = intervista.gjuha as Gjuha;
    const lejohetVazhdim = aktuale.lloji === "pyetje";
    const menyra = vendosMenyren({ nrPyetjeve, gjatesia, lejohetVazhdim, pergjigja });
    const meKetePergjigje = kthesat.map((k) => (k.id === aktuale.id ? { ...k, pergjigja } : k));

    // Vlerësimi dhe pyetja tjetër njëherësh: kandidati pret vetëm sa më e ngadalta.
    const [vleresimi, kthesaAI] = await Promise.allSettled([
      vleresoPergjigjen({ konteksti, intervistuesi, roli, gjuha, kthesa: { reagimi: aktuale.reagimi, pyetja: aktuale.pyetja, pergjigja } }),
      gjeneroKthesen({ konteksti, intervistuesi, roli, gjuha, gjatesia, kthesat: meKetePergjigje, nrPyetjeve, menyra, lejohetVazhdim }),
    ]);
    if (kthesaAI.status === "rejected") {
      await liroQirane();
      const e = kthesaAI.reason;
      if (e instanceof GabimIntervista) return gabim(e.message, e.status, e.kodi);
      throw e;
    }
    if (vleresimi.status === "rejected") {
      // S'e ndal intervistën: raporti e vlerëson sërish këtë përgjigje.
      console.error("[intervista-kthesa] Vlerësimi i përgjigjes dështoi; do të provohet te raporti.");
    }

    // ---------- Kodi vendos: vazhdon apo mbaron ----------
    const ai = kthesaAI.value;
    let vazhdon: boolean;
    let lloji: "pyetje" | "vazhdim" = "pyetje";
    if (menyra === "vazhdim") {
      vazhdon = true;
      lloji = "vazhdim";
    } else if (menyra === "mbyll") {
      vazhdon = false;
    } else {
      vazhdon = menyra === "vazhdo" || ai.vazhdo;
      lloji = ai.lloji === "vazhdim" && lejohetVazhdim ? "vazhdim" : "pyetje";
    }
    const reagimi = ai.reagimi.trim().slice(0, 600) || null;
    let pyetja = ai.pyetja.trim().slice(0, 1000);
    if (vazhdon && !pyetja) {
      pyetja = pyetjaRezerve(gjuha, roli, nrPyetjeve);
      lloji = "pyetje";
    }
    const nrIRi = vazhdon && lloji === "pyetje" ? nrPyetjeve + 1 : nrPyetjeve;

    let kthesaERe: Pick<KthesaDB, "nr" | "lloji" | "reagimi" | "pyetja"> | null = null;
    if (vazhdon) {
      const { data: eRe, error: gabimiInsertit } = await t.admin
        .from("intervista_kthesat")
        .insert({ intervista_id: intervistaId, user_id: t.userId, nr: aktuale.nr + 1, lloji, reagimi, pyetja })
        .select("nr, lloji, reagimi, pyetja")
        .single();
      if (gabimiInsertit || !eRe) {
        await liroQirane();
        if (gabimiInsertit?.code === "23505") {
          return gabim("Përgjigjja jote po përpunohet tashmë.", 409, "po_perpunohet");
        }
        console.error("[intervista-kthesa] Pyetja tjetër s'u ruajt.");
        return gabim("Pyetja tjetër s'u ruajt. Provo përsëri.", 500);
      }
      kthesaERe = eRe;
      await t.admin.from("intervistat").update({ nr_pyetjeve: nrIRi }).eq("id", intervistaId).eq("user_id", t.userId);
    } else {
      await t.admin
        .from("intervistat")
        .update({ gjendja: "mbaroi", nr_pyetjeve: nrIRi })
        .eq("id", intervistaId)
        .eq("user_id", t.userId)
        .eq("gjendja", "aktive");
    }

    // Kthesa aktuale mbyllet e fundit: nëse funksioni ndalet para kësaj, pyetja tjetër ekziston tashmë.
    const { error: gabimiMbylljes } = await t.admin
      .from("intervista_kthesat")
      .update({
        vleresimi: vleresimi.status === "fulfilled" && eshteVleresim(vleresimi.value) ? vleresimi.value : null,
        pergjigjur_me: new Date().toISOString(),
        perpunim_nga: null,
      })
      .eq("id", aktuale.id);
    if (gabimiMbylljes) console.error("[intervista-kthesa] Vlerësimi s'u ruajt; raporti do ta provojë sërish.");
    kthesaEZene = null;

    if (kthesaERe) {
      return json({ fund: false, kthesa: kthesaPerApp(kthesaERe, ai.shprehja), nr_pyetjeve: nrIRi, min, max });
    }
    return json({ fund: true, reagimi, nr_pyetjeve: nrIRi });
  } catch (e) {
    await liroQirane().catch(() => {});
    if (e instanceof GabimIntervista) return gabim(e.message, e.status, e.kodi);
    // Pa detaje: mund të përmbajnë përgjigjen e kandidatit.
    console.error("[intervista-kthesa] Gabim i papritur.");
    return gabim("Diçka shkoi keq. Provo përsëri.", 500);
  }
});
