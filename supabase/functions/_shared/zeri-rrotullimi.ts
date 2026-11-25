// Gemini TTS me rradhë mes modeleve falas (25.11): secili ka kuotën e vet (niveli falas: 3 RPM për 3.8 Flash TTS, nga
// faqja e kufijve te AI Studio e Gentit). Para çdo kërkese rezervohet një vend te kufizuesi (zeri-kufizuesi.ts): merret
// modeli i parë me vend të lirë; kur janë të gjitha plot, PRITET vendi i radhës (deri në ~15 s, app-i tregon "Arta po
// mendon…"). Një 429 e bllokon modelin sa thotë Google-i; një model që s'e pranon kërkesën (400 / 404) bllokohet një
// orë. Pa projekte apo çelësa shtesë: kjo është kundër kushteve të Google-it.
//
// Docs (aistudio.google.com/docs/speech-generation, 25.11): shqipja ("Tosk Albanian") është shënuar vetëm te 3.8 Flash
// TTS; te Flash-Lite "—" (sekreti GEMINI_LITE_SQ=0 e heq për shqip); për 3.1 preview docs s'thonë as gjuhët, as nëse
// punon me Interactions API (e përdorim njësoj; nëse e refuzon, bllokohet dhe kalohet te tjetri). RPD rinisen në
// mesnatë sipas orës së Paqësorit.
import type { Gjuha, Intervistuesi } from "./intervista-ai.ts";
import { type AudioIFolur, type CopaAudio, type Folesi, GabimIZerit, gabimIKuotes, lexoKufirin } from "./zeri.ts";
import { gemini, MODELI_TTS, MODELI_TTS_LITE } from "./zeri-gemini.ts";
import { type Kufizuesi, type KufiriIModelit, mesnataTjeterPacifike } from "./zeri-kufizuesi.ts";
import { gabimiPerfundimtar } from "./zeri-zinxhiri.ts";

export const MODELI_TTS_31 = "gemini-3.1-flash-tts-preview";
/** Rendi i parapëlqimit. */
export const RADHA_E_MODELEVE = [MODELI_TTS, MODELI_TTS_31, MODELI_TTS_LITE] as const;

/**
 * Kufijtë e nivelit falas. RPM 3 nga faqja e kufijve e Gentit (25.11); 10 në ditë për 3.8 Flash nga vetë gabimi 429 i
 * Google-it. Për dy të tjerët kufiri ditor s'dihet: kur Google-i thotë se mbaroi, modeli bllokohet deri në mesnatë.
 */
export const KUFIJTE_FALAS: Record<string, { rpm: number; rpd: number | null }> = {
  [MODELI_TTS]: { rpm: 3, rpd: 10 },
  [MODELI_TTS_31]: { rpm: 3, rpd: null },
  [MODELI_TTS_LITE]: { rpm: 3, rpd: null },
};

/**
 * Sekreti TTS_RPM_LIMITS: "modeli=rpm[/rpd]" të ndara me presje, p.sh.
 * "gemini-3.8-flash-tts=3/10,gemini-3.1-flash-tts-preview=3,gemini-3.8-flash-lite-tts=0". Hyrja e zëvendëson krejtësisht
 * parazgjedhjen e atij modeli (pa "/rpd" = pa kufi ditor); rpm 0 e fik modelin. Kur paguhet, mjafton të rriten numrat.
 */
export function lexoKufijte(sekreti: string | undefined): KufiriIModelit[] {
  const kufijte: Record<string, { rpm: number; rpd: number | null }> = { ...KUFIJTE_FALAS };
  for (const pjesa of (sekreti ?? "").split(",").map((x) => x.trim()).filter(Boolean)) {
    const m = /^([a-z0-9.-]+)\s*=\s*(\d{1,6})(?:\s*\/\s*(\d{1,8}))?$/.exec(pjesa);
    if (!m || !(m[1] in KUFIJTE_FALAS)) {
      console.error(`[zeri-rrotullimi] TTS_RPM_LIMITS: hyrje e panjohur u injorua ("${pjesa.slice(0, 80)}").`);
      continue;
    }
    kufijte[m[1]] = { rpm: Number(m[2]), rpd: m[3] === undefined ? null : Number(m[3]) };
  }
  return RADHA_E_MODELEVE.map((modeli) => ({ modeli, ...kufijte[modeli] }));
}

function mbulonGjuhen(modeli: string, gjuha: Gjuha): boolean {
  return !(modeli === MODELI_TTS_LITE && gjuha === "sq" && Deno.env.get("GEMINI_LITE_SQ") === "0");
}

export const MAKS_PRITJA_MS = 15_000;
const BLLOKIMI_429_MS = 60_000; // kur Google-i s'thotë sa të presim
const BLLOKIMI_I_REFUZIMIT_MS = 60 * 60 * 1000;
const NJE_ORE_MS = 60 * 60 * 1000;
const MAKS_HAPA = 12;

export type Opsionet = {
  kufizuesi: Kufizuesi;
  kufijte: KufiriIModelit[];
  /** Sa pritet gjithsej për një vend të lirë (0 = s'pritet: punë me përparësi të ulët). */
  maksPritjaMs?: number;
  /** Rezervo vetëm nëse mbeten kaq vende të lira (përparësi e ulët). */
  lerTeLira?: number;
  /** Për testet. */
  krijo?: (modeli: string) => Folesi;
  prit?: (ms: number) => Promise<void>;
  tani?: () => number;
};

export function geminiMeRradhe(o: Opsionet): Folesi {
  const maksPritja = o.maksPritjaMs ?? MAKS_PRITJA_MS;
  const prit = o.prit ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const tani = o.tani ?? Date.now;
  // Pa riprovim brenda përshtatësit: një riprovim pa rezervim do ta kalonte kufirin; vendos kufizuesi.
  const krijo = o.krijo ?? ((modeli: string) => gemini(modeli, { riprovo: false }));

  /** Sa të bllokohet modeli pas këtij gabimi (null = s'bllokohet, vetëm s'provohet më për këtë kërkesë). */
  function bllokimi(e: GabimIZerit): number | null {
    if (e.kuota) {
      const vonesa = lexoKufirin(e.detaje).vonesaMs;
      if (e.kufiriDitor) return vonesa ?? mesnataTjeterPacifike(tani()) - tani();
      return vonesa ?? BLLOKIMI_429_MS;
    }
    return e.detaje?.status === 400 || e.detaje?.status === 404 ? BLLOKIMI_I_REFUZIMIT_MS : null;
  }

  /** Rezervon një vend dhe provon modelin; te dështimi kalon te tjetri. Hedh gabimin përfundimtar. */
  async function zgjidh<T>(gjuha: Gjuha, provo: (f: Folesi, modeli: string) => Promise<T>): Promise<T> {
    const lista = o.kufijte.filter((k) => k.rpm > 0 && mbulonGjuhen(k.modeli, gjuha));
    if (lista.length === 0) throw new GabimIZerit("Zëri s'është konfiguruar ende. Vazhdo me shkrim.", true);
    const perjashtuar = new Set<string>();
    const deshtimet: GabimIZerit[] = [];
    let pritur = 0;
    for (let hapi = 0; hapi < MAKS_HAPA; hapi++) {
      const kandidatet = lista.filter((k) => !perjashtuar.has(k.modeli));
      if (kandidatet.length === 0) break;
      const r = await o.kufizuesi.rezervo(kandidatet, o.lerTeLira ?? 0);
      if (!r.modeli) {
        const pritja = r.pritjaMs + 150; // pak hapësirë mbi dritaren e Google-it
        if (pritur + pritja <= maksPritja) {
          pritur += pritja;
          await prit(pritja);
          continue;
        }
        deshtimet.push(gabimIKuotes(null, r.pritjaMs >= NJE_ORE_MS));
        break;
      }
      try {
        return await provo(krijo(r.modeli), r.modeli);
      } catch (e) {
        const g = e instanceof GabimIZerit ? e : new GabimIZerit("Zëri dështoi. Provo përsëri.");
        if (g.konfigurim) throw g; // çelës i gabuar: asnjë model tjetër s'ndihmon
        deshtimet.push(g);
        const ms = bllokimi(g);
        if (ms !== null) await o.kufizuesi.blloko(r.modeli, ms);
        if (!g.kuota) perjashtuar.add(r.modeli); // 429: bllokimi e mban jashtë (dhe pritet nëse zgjat pak)
        console.error(`[zeri-rrotullimi] ${r.modeli} s'dha zë${ms !== null ? `; i bllokuar ${Math.round(ms / 1000)} s` : ""}.`);
      }
    }
    throw gabimiPerfundimtar(deshtimet);
  }

  /** Kesh-i mban audion gjatë: për shqip vetëm atë të 3.8 Flash TTS (i vetmi me shqip te docs). */
  const eRuajtshme = (modeli: string, gjuha: Gjuha) => gjuha !== "sq" || modeli === MODELI_TTS;

  return {
    emri: "gemini",
    iGatshem: () => !!Deno.env.get("GEMINI_API_KEY"),
    async *rrjedhe(teksti: string, gjuha: Gjuha, intervistuesi: Intervistuesi): AsyncGenerator<CopaAudio> {
      // Modeli zgjidhet te copa e parë; pasi zëri ka filluar, s'ndërrohet në mes të fjalisë.
      const { ePara, copat, ruaj } = await zgjidh(gjuha, async (f, modeli) => {
        const copat = f.rrjedhe!(teksti, gjuha, intervistuesi);
        const ePara = await copat.next();
        if (ePara.done) throw new GabimIZerit("Zëri doli bosh. Provo përsëri.");
        return { ePara: ePara.value, copat, ruaj: eRuajtshme(modeli, gjuha) };
      });
      yield { ...ePara, ruaj };
      for await (const c of copat) yield { ...c, ruaj };
    },
    fol(teksti: string, gjuha: Gjuha, intervistuesi: Intervistuesi): Promise<AudioIFolur> {
      return zgjidh(gjuha, async (f, modeli) => ({
        ...(await f.fol(teksti, gjuha, intervistuesi)),
        ruaj: eRuajtshme(modeli, gjuha),
      }));
    },
  };
}
