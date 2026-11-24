// Logjika e një kthese të intervistës: merr përgjigjen e kandidatit, e vlerëson dhe kthen pyetjen tjetër (ose fundin).
// E përdorin dy funksione me të njëjtin kod: intervista-kthesa (përgjigje e shkruar) dhe intervista-zeri
// (përgjigje me zë, pasi STT-ja e ka kthyer në tekst). Kodi është trupi i intervista-kthesa (java 16.11, intervistuesi
// adaptiv) i zhvendosur këtu pa ndryshim; i vetmi shtim është "meZe", që ia kalon prompt-eve shënimin e zërit.
//
// Mbrojtja nga dërgimi i dyfishtë dhe nga kthesat jashtë radhe:
//   - "nr" duhet të jetë pyetja e fundit (aktuale) e intervistës;
//   - kthesa "zihet" me një UPDATE me kusht (pergjigjur_me is null dhe pa qira të freskët): vetëm një kërkesë fiton;
//   - pyetja tjetër futet me unique (intervista_id, nr): s'mund të ketë dy pyetje me të njëjtin numër.
// Nëse AI-ja dështon, qiraja lirohet menjëherë dhe app-i mund ta riprovojë të njëjtën përgjigje.
//
// Privatësia: asgjë këtu s'shkruan në log pyetje, përgjigje apo tekst të AI-së.
import {
  eshteVleresim,
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
  MAKS_VAZHDIME,
  meQasjen,
  QIRAJA_MS,
  type Roli,
  vazhdimetRadhazi,
  vendosKthesen,
  vendosMenyren,
  vleresoPergjigjen,
} from "./intervista-ai.ts";
import type { Thirresi } from "./thirresi.ts";

export type HyrjaEKthesës = {
  intervistaId: string;
  nr: number;
  /** Kandidati e mbyll vetë (duhet ≥ 1 përgjigje); atëherë "pergjigja" injorohet. */
  perfundo: boolean;
  pergjigja: string;
  /** Përgjigjja erdhi nga njohja e zërit: prompt-i e di që mund të ketë fjalë të gabuara. */
  meZe?: boolean;
  /**
   * Vetëm zëri: pyetja tjetër s'pret vlerësimin e përgjigjes (që s'e përdor askush gjatë intervistës, vetëm raporti).
   * Vlerësimi dhe mbyllja e kthesës vazhdojnë në sfond; ky thirret me premtimin që kërkesa ta presë para se të mbarojë.
   */
  nePlan?: (premtimi: Promise<unknown>) => void;
};

/** Rezultati si JSON + status HTTP. Trupi është kontrata e intervista-kthesa (shih krye të atij skedari). */
export type RezultatiIKthesës = { status: number; trupi: Record<string, unknown> };

const ok = (trupi: Record<string, unknown>): RezultatiIKthesës => ({ status: 200, trupi });
const gabimi = (mesazhi: string, status: number, kodi?: string): RezultatiIKthesës => ({
  status,
  trupi: kodi ? { error: mesazhi, kodi } : { error: mesazhi },
});

export async function perpunoKthesen(t: Thirresi, hyrja: HyrjaEKthesës): Promise<RezultatiIKthesës> {
  const { intervistaId, nr, perfundo } = hyrja;
  const pergjigja = hyrja.pergjigja.trim();
  if (!perfundo) {
    if (!pergjigja) return gabimi("Shkruaj një përgjigje.", 400);
    if (pergjigja.length > MAKS_PERGJIGJJA) {
      return gabimi(`Përgjigjja duhet të jetë deri në ${MAKS_PERGJIGJJA} shkronja.`, 400);
    }
  }

  // Kthesa e zënë nga kjo kërkesë; lirohet nëse diçka dështon para fundit.
  let kthesaEZene: string | null = null;
  const liroQirane = async () => {
    if (!kthesaEZene) return;
    await t.admin.from("intervista_kthesat").update({ perpunim_nga: null }).eq("id", kthesaEZene);
    kthesaEZene = null;
  };

  try {
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
      return gabimi("S'u lexua intervista. Provo përsëri.", 500);
    }
    if (!intervista) return gabimi("Intervista nuk u gjet.", 404);
    if (intervista.gjendja !== "aktive") return gabimi("Kjo intervistë ka mbaruar.", 409, "mbaroi");

    const { data: rreshtat, error: gabimiKthesave } = await t.admin
      .from("intervista_kthesat")
      .select("id, nr, lloji, reagimi, pyetja, pergjigja, vleresimi, pergjigjur_me")
      .eq("intervista_id", intervistaId)
      .eq("user_id", t.userId)
      .order("nr", { ascending: true });
    if (gabimiKthesave || !rreshtat || rreshtat.length === 0) {
      console.error("[intervista-kthesa] Leximi i kthesave dështoi.");
      return gabimi("S'u lexua intervista. Provo përsëri.", 500);
    }
    const kthesat = rreshtat as KthesaDB[];
    const aktuale = kthesat[kthesat.length - 1];
    const gjatesia: Gjatesia = intervista.gjatesia === "plote" ? "plote" : "shkurter";
    const { min, max } = GJATESITE[gjatesia];
    const nrPyetjeve = kthesat.filter((k) => k.lloji === "pyetje").length;

    // ---------- Kandidati e mbyll vetë ----------
    if (perfundo) {
      if (!kthesat.some((k) => k.pergjigja)) {
        return gabimi("Përgjigju të paktën një pyetjeje para se ta mbyllësh.", 400);
      }
      const { data: mbyllur } = await t.admin
        .from("intervistat")
        .update({ gjendja: "mbaroi" })
        .eq("id", intervistaId)
        .eq("user_id", t.userId)
        .eq("gjendja", "aktive")
        .select("id");
      if (!mbyllur || mbyllur.length === 0) return gabimi("Kjo intervistë ka mbaruar.", 409, "mbaroi");
      return ok({ fund: true, reagimi: null, nr_pyetjeve: nrPyetjeve });
    }

    if (nr !== aktuale.nr || aktuale.pergjigjur_me) {
      return {
        status: 409,
        trupi: { error: "Kjo pyetje s'është më aktuale.", kodi: "jashte_radhe", kthesa: kthesaPerApp(aktuale) },
      };
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
      return gabimi("Përgjigjja s'u ruajt. Provo përsëri.", 500);
    }
    if (!zene || zene.length === 0) {
      return gabimi("Përgjigjja jote po përpunohet tashmë.", 409, "po_perpunohet");
    }
    kthesaEZene = aktuale.id;

    const konteksti = intervista.konteksti as Konteksti;
    const intervistuesi = intervistuesiNga(konteksti); // intervistat e vjetra pa fushën: "arta"
    const roli = intervista.roli as Roli;
    const gjuha = intervista.gjuha as Gjuha;
    const meZe = hyrja.meZe === true; // përgjigjja erdhi nga njohja e zërit (intervista-zeri)
    // Deri në MAKS_VAZHDIME pyetje vazhduese radhazi për të njëjtën pyetje kryesore.
    const lejohetVazhdim = vazhdimetRadhazi(kthesat) < MAKS_VAZHDIME;
    const menyra = vendosMenyren({ nrPyetjeve, gjatesia, lejohetVazhdim, pergjigja });
    const meKetePergjigje = kthesat.map((k) => (k.id === aktuale.id ? { ...k, pergjigja } : k));

    // Vlerësimi dhe pyetja tjetër njëherësh: kandidati pret vetëm sa më e ngadalta.
    const vleresimiP = vleresoPergjigjen({
      konteksti,
      intervistuesi,
      roli,
      gjuha,
      meZe,
      kthesa: { reagimi: aktuale.reagimi, pyetja: aktuale.pyetja, pergjigja },
    });
    const kthesaP = gjeneroKthesen({
      konteksti,
      intervistuesi,
      roli,
      gjuha,
      gjatesia,
      kthesat: meKetePergjigje,
      nrPyetjeve,
      menyra,
      lejohetVazhdim,
      meZe,
    });
    const nePlan = hyrja.nePlan;
    const [vleresimi, kthesaAI] = nePlan
      ? [null, (await Promise.allSettled([kthesaP]))[0]]
      : await Promise.allSettled([vleresimiP, kthesaP]);
    if (nePlan) vleresimiP.catch(() => {}); // trajtohet te mbyllja në sfond; kjo vetëm e shënon si të trajtuar
    if (kthesaAI.status === "rejected") {
      await liroQirane();
      const e = kthesaAI.reason;
      if (e instanceof GabimIntervista) return gabimi(e.message, e.status, e.kodi);
      throw e;
    }
    if (vleresimi?.status === "rejected") {
      // S'e ndal intervistën: raporti e vlerëson sërish këtë përgjigje.
      console.error("[intervista-kthesa] Vlerësimi i përgjigjes dështoi; do të provohet te raporti.");
    }

    // ---------- Kodi vendos: vazhdon apo mbaron ----------
    const ai = kthesaAI.value;
    const { vazhdon, lloji, reagimi, pyetja, nrIRi, qasja } = vendosKthesen({
      ai,
      menyra,
      lejohetVazhdim,
      konteksti,
      gjuha,
      roli,
      nrPyetjeve,
      nrAktual: aktuale.nr,
    });

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
          return gabimi("Përgjigjja jote po përpunohet tashmë.", 409, "po_perpunohet");
        }
        console.error("[intervista-kthesa] Pyetja tjetër s'u ruajt.");
        return gabimi("Pyetja tjetër s'u ruajt. Provo përsëri.", 500);
      }
      kthesaERe = eRe;
      // Qasja e pyetjes së re ruhet te konteksti (private: app-i s'e lexon dot gjatë intervistës).
      await t.admin
        .from("intervistat")
        .update({ nr_pyetjeve: nrIRi, ...(qasja ? { konteksti: meQasjen(konteksti, qasja) } : {}) })
        .eq("id", intervistaId)
        .eq("user_id", t.userId);
    } else {
      await t.admin
        .from("intervistat")
        .update({ gjendja: "mbaroi", nr_pyetjeve: nrIRi })
        .eq("id", intervistaId)
        .eq("user_id", t.userId)
        .eq("gjendja", "aktive");
    }

    // Kthesa aktuale mbyllet e fundit: nëse funksioni ndalet para kësaj, pyetja tjetër ekziston tashmë.
    const mbyllKthesen = async (v: unknown) => {
      const { error: gabimiMbylljes } = await t.admin
        .from("intervista_kthesat")
        .update({
          vleresimi: eshteVleresim(v) ? v : null,
          pergjigjur_me: new Date().toISOString(),
          perpunim_nga: null,
        })
        .eq("id", aktuale.id);
      if (gabimiMbylljes) console.error("[intervista-kthesa] Vlerësimi s'u ruajt; raporti do ta provojë sërish.");
    };
    if (nePlan) {
      // Qiraja mbetet derisa mbyllja në sfond ta lirojë; pyetja tjetër ekziston, ndaj përgjigjja s'mund të dërgohet sërish.
      nePlan(
        vleresimiP.then(
          (v) => mbyllKthesen(v),
          () => {
            console.error("[intervista-kthesa] Vlerësimi i përgjigjes dështoi; do të provohet te raporti.");
            return mbyllKthesen(null);
          },
        ),
      );
    } else {
      await mbyllKthesen(vleresimi?.status === "fulfilled" ? vleresimi.value : null);
    }
    kthesaEZene = null;

    if (kthesaERe) {
      return ok({ fund: false, kthesa: kthesaPerApp(kthesaERe, ai.shprehja), nr_pyetjeve: nrIRi, min, max });
    }
    return ok({ fund: true, reagimi, nr_pyetjeve: nrIRi });
  } catch (e) {
    await liroQirane().catch(() => {});
    if (e instanceof GabimIntervista) return gabimi(e.message, e.status, e.kodi);
    // Pa detaje: mund të përmbajnë përgjigjen e kandidatit.
    console.error("[intervista-kthesa] Gabim i papritur.");
    return gabimi("Diçka shkoi keq. Provo përsëri.", 500);
  }
}
