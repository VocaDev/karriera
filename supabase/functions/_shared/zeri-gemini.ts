// Zëri i intervistuesit (TTS) me Gemini TTS përmes Gemini API (çelës AI Studio), vendimi i menaxherit 15.11.
// REST: POST /v1beta/interactions (Interactions API), modeli gemini-3.8-flash-tts.
// Sekreti: GEMINI_API_KEY. Çelësi s'del kurrë në app dhe s'shkruhet në log.
//
// Docs: aistudio.google.com/docs/speech-generation (kontrolluar 15.11.2026):
//   - kërkesa: { model, input: [{ type: "user_input", content: [{ type: "text", text }] }],
//               response_format: { type: "audio" }, generation_config: { speech_config: [{ voice }] } }
//   - përgjigjja: steps[].type "model_output" → content[].type "audio" → data (base64), WAV 24 kHz mono 16 bit
//   - gjuha zbulohet vetë nga teksti (s'ka fushë gjuhe); shqipja figuron si "Tosk Albanian" (vetëm te 3.8 Flash TTS)
//   - zërat janë 30 zëra të gatshëm me përshkrim (jo me gjuhë): Kore "Firm", Charon "Informative", ...
import type { Gjuha, Intervistuesi } from "./intervista-ai.ts";
import {
  type AudioIFolur,
  type CopaAudio,
  type Folesi,
  GabimIZerit,
  gabimIKuotes,
  headerAtEKufijve,
  lexoKufirin,
  lexoWav,
  shkruajWav,
  thirrOfruesin,
} from "./zeri.ts";

export const MODELI_TTS = "gemini-3.8-flash-tts";
/**
 * Rezerva me kuotë të veten (id i kontrolluar te lista e modeleve dhe te docs, 25.11). Përdoret kur 3.8 Flash TTS e ka
 * mbaruar kufirin, edhe për shqip (kërkesa e menaxherit). KUJDES: docs (aistudio.google.com/docs/speech-generation) e
 * listojnë "Tosk Albanian" vetëm te 3.8 Flash TTS, jo te Lite, dhe zëri shqip i Lite s'është dëgjuar ende
 * (_provat/zeri-lite-mostra.ts). Nëse tingëllon keq: sekreti GEMINI_LITE_SQ=0 e heq për shqip, pa ndryshim kodi.
 */
export const MODELI_TTS_LITE = "gemini-3.8-flash-lite-tts";
const gjuhetELite = (): readonly Gjuha[] => (Deno.env.get("GEMINI_LITE_SQ") === "0" ? ["en", "de"] : ["sq", "en", "de"]);
const URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
const SHKALLA_TTS = 24_000; // e vetmja shkallë e pranuar (matur: WAV pa rrjedhë dhe audio/l16 me rrjedhë)

/** Zëri sipas intervistuesit; i njëjti zë për sq / en / de (gjuha zbulohet nga teksti). Prova e dëgjimit vendos. */
export const ZERAT: Record<Intervistuesi, string> = { arta: "Kore", arber: "Charon" };

/** Stili i të folurit për të gjitha kthesat (s'përmban gjini, moshë apo theks, si thonë docs). */
const STILI: Record<Gjuha, string> = {
  sq: "Calm, warm and professional job interviewer speaking standard Albanian at a natural, unhurried pace.",
  en: "Calm, warm and professional job interviewer at a natural, unhurried pace.",
  de: "Calm, warm and professional job interviewer speaking standard German at a natural, unhurried pace.",
};

// ---------- Kontrolli i audios: asnjë rezultat s'përdoret dhe s'ruhet pa kaluar këtu ----------
// Katër mostrat e vërteta (docs/zeri-mostra, 3.8 Flash TTS, 15.11) kanë 12–16 shkronja në sekondë. Kufiri i poshtëm
// pranon deri në 30 (dy herë më shpejt), që një zë i shpejtë të mos hidhet poshtë: ai kap audion bosh ose të cunguar.
const MAKS_SHKRONJA_NE_SEKONDE = 30;
const MIN_SEKONDA_AUDIO = 0.3;
const PRAGU_I_TINGULLIT = 64; // nga 32767: nën të, gjithë audioja është heshtje (mostrat e vërteta arrijnë 24000+)

/** Sa bajte PCM (24 kHz, 16 bit, mono) duhet të ketë së paku audioja e këtij teksti. */
export function minimumiIBajteve(teksti: string): number {
  const shkronja = teksti.replace(/\s+/g, " ").trim().length;
  return 2 * Math.ceil(SHKALLA_TTS * Math.max(MIN_SEKONDA_AUDIO, shkronja / MAKS_SHKRONJA_NE_SEKONDE));
}

/** Gabim i modelit: rradha (zeri-rrotullimi.ts) e bllokon dhe kalon te tjetri. `arsyeja` është teknike, pa tekst. */
function audioEPavlefshme(modeli: string, arsyeja: string): GabimIZerit {
  console.error(`[zeri-gemini] ${modeli}: audio e pavlefshme (${arsyeja}).`);
  const e = new GabimIZerit("Zëri doli i dëmtuar. Provo përsëri.");
  e.pavlefshem = true;
  return e;
}

/** Çka thotë përgjigjja për formatin; null kur s'bie ndesh me PCM 24 kHz mono (ose WAV, i cili lexohet veç). */
function formatiIGabuar(a: Record<string, unknown>): string | null {
  const mime = typeof a.mime_type === "string" ? a.mime_type.toLowerCase().slice(0, 60) : "";
  if (mime && !/^audio\/(l16|pcm|wav|x-wav|wave)\b/.test(mime)) return `formati ${mime}`;
  const ngaMime = /\brate=(\d+)/.exec(mime)?.[1];
  for (const shkalla of [a.sample_rate, ngaMime === undefined ? undefined : Number(ngaMime)]) {
    if (shkalla !== undefined && shkalla !== SHKALLA_TTS) return `shkalla ${String(shkalla).slice(0, 12)}`;
  }
  if (a.channels !== undefined && a.channels !== 1) return `kanalet ${String(a.channels).slice(0, 4)}`;
  return null;
}

/** Fillimi i një skedari audio të paketuar (jo PCM i zhveshur): po të lexohej si PCM, do të dilte zhurmë. */
const ePaketuar = (b: Uint8Array) => ["RIFF", "OggS", "ID3", "fLaC"].some((m) => [...m].every((c, i) => b[i] === c.charCodeAt(0)));

function kaTingull(b: Uint8Array): boolean {
  for (let i = 0; i + 1 < b.length; i += 2) {
    if (Math.abs(((b[i] | (b[i + 1] << 8)) << 16) >> 16) >= PRAGU_I_TINGULLIT) return true;
  }
  return false;
}

function dekodo(modeli: string, b64: string): Uint8Array {
  try {
    return ngaBase64(b64);
  } catch {
    throw audioEPavlefshme(modeli, "base64 i palexueshëm");
  }
}

const sekondat = (bajt: number) => (bajt / 2 / SHKALLA_TTS).toFixed(1);

/** Kërkon një audio në çdo vend të përgjigjes (forma e saktë e "steps" mund të ndryshojë mes versioneve). */
function gjejAudion(v: unknown): (Record<string, unknown> & { data: string }) | null {
  if (Array.isArray(v)) {
    for (let i = v.length - 1; i >= 0; i--) {
      const a = gjejAudion(v[i]);
      if (a) return a;
    }
    return null;
  }
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  if (o.type === "audio" && typeof o.data === "string" && o.data.length > 0) return { ...o, data: o.data };
  for (const k of ["steps", "outputs", "content", "output_audio"]) {
    const a = gjejAudion(o[k]);
    if (a) return a;
  }
  return null;
}

function ngaBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const a = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
  return a;
}

function trupiIKerkeses(modeli: string, teksti: string, gjuha: Gjuha, intervistuesi: Intervistuesi, rrjedhe: boolean) {
  return {
    model: modeli,
    ...(rrjedhe ? { stream: true } : {}),
    input: [
      {
        type: "user_input",
        content: [{ type: "text", text: teksti, annotations: [{ type: "speech_metadata", style: STILI[gjuha] }] }],
      },
    ],
    response_format: { type: "audio" },
    generation_config: { speech_config: [{ voice: ZERAT[intervistuesi] }] },
  };
}

function celesiIGemini(): string {
  const celesi = Deno.env.get("GEMINI_API_KEY") ?? "";
  if (!celesi) throw new GabimIZerit("Zëri s'është konfiguruar ende. Vazhdo me shkrim.", true);
  return celesi;
}

/** Vonesë më e gjatë se kaq ose "per day" te kufiri = kufiri ditor i ofruesit. */
const VONESA_E_KUFIRIT_DITOR_MS = 60 * 60 * 1000;

/** Më shumë se kaq s'presim brenda një kërkese: kandidati sheh tekstin dhe app-i ka rrugën e vet rezervë. */
const MAKS_PRITJA_429_MS = 8_000;

/**
 * Thirrja te Gemini me NJË riprovim pas një 429 (kufiri i kërkesave në minutë, i parë në prodhim 25.11), me vonesën që
 * thotë vetë Google-i, vetëm nëse është e shkurtër. Në log shkruhet emri i kufirit dhe vonesa (asnjë tekst).
 */
async function thirrGemini(init: RequestInit, afatiMs: number, riprovo: boolean): Promise<Response> {
  try {
    return await thirrOfruesin(URL, init, "Zëri", "zeri-gemini", afatiMs);
  } catch (e) {
    if (!(e instanceof GabimIZerit) || e.detaje?.status !== 429) throw e;
    const { vonesaMs, kufiri } = lexoKufirin(e.detaje);
    console.error(`[zeri-gemini] 429: kufiri ${kufiri ?? "i pathënë"} · vonesa ${vonesaMs ?? "?"} ms`);
    if ((vonesaMs !== null && vonesaMs >= VONESA_E_KUFIRIT_DITOR_MS) || /per day/i.test(kufiri ?? "")) {
      throw gabimIKuotes(e.detaje, true);
    }
    const pritja = vonesaMs ?? 3_000;
    if (!riprovo || pritja > MAKS_PRITJA_429_MS) throw e;
    await new Promise((r) => setTimeout(r, pritja + 250));
    return await thirrOfruesin(URL, init, "Zëri", "zeri-gemini", afatiMs);
  }
}

/**
 * Rrjedha SSE e Interactions API (`stream: true`, matur 24.11): ngjarje `step.delta` me `delta.type: "audio"`,
 * `mime_type: "audio/l16"` (PCM 16 bit mono, `sample_rate` 24000), copa 40–80 ms; byte-i i parë vjen pas ~2 s dhe
 * pjesa tjetër brenda <1 s (shumë më shpejt se koha reale). Përfundon me `interaction.completed` dhe `[DONE]`.
 */
async function* rrjedhaGemini(
  modeli: string,
  riprovo: boolean,
  teksti: string,
  gjuha: Gjuha,
  intervistuesi: Intervistuesi,
): AsyncGenerator<CopaAudio> {
  const celesi = celesiIGemini();
  const r = await thirrGemini(
    {
      method: "POST",
      headers: { "x-goog-api-key": celesi, "Content-Type": "application/json" },
      body: JSON.stringify(trupiIKerkeses(modeli, teksti, gjuha, intervistuesi, true)),
    },
    60_000,
    riprovo,
  );
  if (!r.body) throw new GabimIZerit("Zëri ktheu një përgjigje të paplotë. Provo përsëri.");
  const lexuesi = r.body.getReader();
  const dek = new TextDecoder();
  let tampon = "";
  let pjesaPaGjysem: Uint8Array | null = null; // bajti tek që mbetet mes dy copave
  let pati = false;
  let perfundoi = false; // pa "interaction.completed" rrjedha u pre në mes: është dështim, jo fund
  // Copat mbahen derisa audioja të arrijë gjatësinë e pranueshme për tekstin dhe të ketë tingull: para kësaj asgjë s'i
  // jepet thirrësit, ndaj rradha mund ta ndërrojë modelin. null = kontrolli u kalua, copat dalin sapo vijnë.
  const minimumi = minimumiIBajteve(teksti);
  let nePritje: CopaAudio[] | null = [];
  let bajtNePritje = 0;
  let meTingull = false;
  try {
    for (;;) {
      const { value, done } = await lexuesi.read();
      if (done) break;
      tampon += dek.decode(value, { stream: true });
      let i: number;
      while ((i = tampon.indexOf("\n\n")) >= 0) {
        const ngjarja = tampon.slice(0, i);
        tampon = tampon.slice(i + 2);
        const m = /^event: ?(.*)\ndata: ?(.*)$/s.exec(ngjarja);
        if (!m) continue;
        if (m[1] === "error") throw new GabimIZerit("Zëri dështoi. Provo përsëri.");
        if (m[1] === "interaction.completed") perfundoi = !/"status"\s*:\s*"(?!completed)/.test(m[2]);
        if (m[1] !== "step.delta") continue;
        let d: Record<string, unknown> | undefined;
        try {
          d = (JSON.parse(m[2]) as { delta?: Record<string, unknown> }).delta;
        } catch {
          throw audioEPavlefshme(modeli, "ngjarje e palexueshme");
        }
        if (!d || d.type !== "audio" || typeof d.data !== "string" || !d.data) continue;
        const formati = formatiIGabuar(d);
        if (formati) throw audioEPavlefshme(modeli, formati);
        let b = dekodo(modeli, d.data);
        if (!pati && ePaketuar(b)) throw audioEPavlefshme(modeli, "skedar audio në vend të PCM");
        if (pjesaPaGjysem) {
          const bashku = new Uint8Array(pjesaPaGjysem.length + b.length);
          bashku.set(pjesaPaGjysem);
          bashku.set(b, pjesaPaGjysem.length);
          b = bashku;
          pjesaPaGjysem = null;
        }
        if (b.length % 2 === 1) {
          pjesaPaGjysem = b.subarray(b.length - 1);
          b = b.subarray(0, b.length - 1);
        }
        if (b.length === 0) continue;
        pati = true;
        const copa = { pcm: b, shkalla: SHKALLA_TTS };
        if (nePritje === null) {
          yield copa;
          continue;
        }
        nePritje.push(copa);
        bajtNePritje += b.length;
        meTingull ||= kaTingull(b);
        if (bajtNePritje >= minimumi && meTingull) {
          yield* nePritje;
          nePritje = null;
        }
      }
    }
  } catch (e) {
    if (e instanceof GabimIZerit) throw e;
    throw new GabimIZerit("Zëri u ndërpre. Provo përsëri.");
  } finally {
    lexuesi.cancel().catch(() => {});
  }
  if (!pati) throw audioEPavlefshme(modeli, "bosh");
  if (!perfundoi) throw new GabimIZerit("Zëri u ndërpre para fundit. Provo përsëri.");
  if (nePritje !== null) {
    throw audioEPavlefshme(modeli, meTingull ? `${sekondat(bajtNePritje)} s nga së paku ${sekondat(minimumi)} s` : "vetëm heshtje");
  }
}

/** `riprovo: false` kur kërkesat i vendos kufizuesi (zeri-rrotullimi.ts): asnjë kërkesë pa vend të rezervuar. */
export function gemini(modeli: string = MODELI_TTS, { riprovo = true }: { riprovo?: boolean } = {}): Folesi {
  const lite = modeli === MODELI_TTS_LITE;
  return {
    emri: lite ? "gemini-lite" : "gemini",
    ...(lite ? { gjuhet: gjuhetELite() } : {}),
    iGatshem: () => !!Deno.env.get("GEMINI_API_KEY"),
    rrjedhe: (teksti, gjuha, intervistuesi) => rrjedhaGemini(modeli, riprovo, teksti, gjuha, intervistuesi),
    async fol(teksti: string, gjuha: Gjuha, intervistuesi: Intervistuesi): Promise<AudioIFolur> {
      const celesi = celesiIGemini();
      const trupi = trupiIKerkeses(modeli, teksti, gjuha, intervistuesi, false);
      const r = await thirrGemini(
        {
          method: "POST",
          headers: { "x-goog-api-key": celesi, "Content-Type": "application/json" },
          body: JSON.stringify(trupi),
        },
        45_000,
        riprovo,
      );
      const kufijte = headerAtEKufijve(r.headers);
      let json: unknown;
      try {
        json = await r.json();
      } catch {
        throw audioEPavlefshme(modeli, "përgjigje e palexueshme");
      }
      const a = gjejAudion(json);
      if (!a) throw audioEPavlefshme(modeli, "bosh");
      const bajtet = dekodo(modeli, a.data);
      // Zakonisht WAV me header; nëse vjen PCM i zhveshur (audio/l16), e mbështjellim vetë.
      const wav = lexoWav(bajtet);
      if (wav && wav.shkalla !== SHKALLA_TTS) throw audioEPavlefshme(modeli, `shkalla ${wav.shkalla}`);
      if (!wav) {
        const formati = ePaketuar(bajtet) ? "skedar audio i palexueshëm" : formatiIGabuar(a);
        if (formati) throw audioEPavlefshme(modeli, formati);
        if (bajtet.length % 2 !== 0) throw audioEPavlefshme(modeli, "PCM me numër tek bajtesh");
      }
      const pcm = wav ? wav.mostrat : new Int16Array(bajtet.buffer, bajtet.byteOffset, bajtet.length / 2);
      const minimumi = minimumiIBajteve(teksti);
      if (pcm.length * 2 < minimumi) {
        throw audioEPavlefshme(modeli, `${sekondat(pcm.length * 2)} s nga së paku ${sekondat(minimumi)} s`);
      }
      if (!kaTingull(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength))) throw audioEPavlefshme(modeli, "vetëm heshtje");
      return { audio: shkruajWav(pcm, SHKALLA_TTS), mime: "audio/wav", sekonda: pcm.length / SHKALLA_TTS, kufijte };
    },
  };
}
