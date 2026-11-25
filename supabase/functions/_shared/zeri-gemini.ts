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
/** Rezerva me kuotë të veten. Docs (aistudio.google.com/docs/speech-generation, 25.11): shqipja ("Tosk Albanian") është
 * VETËM te 3.8 Flash TTS, jo te Flash-Lite, ndaj Lite përdoret vetëm për anglisht dhe gjermanisht. */
export const MODELI_TTS_LITE = "gemini-3.8-flash-lite-tts";
const GJUHET_E_LITE: readonly Gjuha[] = ["en", "de"];
const URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
const SHKALLA_TTS = 24_000; // kur vjen PCM pa header (audio/l16)

/** Zëri sipas intervistuesit; i njëjti zë për sq / en / de (gjuha zbulohet nga teksti). Prova e dëgjimit vendos. */
export const ZERAT: Record<Intervistuesi, string> = { arta: "Kore", arber: "Charon" };

/** Stili i të folurit për të gjitha kthesat (s'përmban gjini, moshë apo theks, si thonë docs). */
const STILI: Record<Gjuha, string> = {
  sq: "Calm, warm and professional job interviewer speaking standard Albanian at a natural, unhurried pace.",
  en: "Calm, warm and professional job interviewer at a natural, unhurried pace.",
  de: "Calm, warm and professional job interviewer speaking standard German at a natural, unhurried pace.",
};

/** Kërkon një audio në çdo vend të përgjigjes (forma e saktë e "steps" mund të ndryshojë mes versioneve). */
function gjejAudion(v: unknown): string | null {
  if (Array.isArray(v)) {
    for (let i = v.length - 1; i >= 0; i--) {
      const a = gjejAudion(v[i]);
      if (a) return a;
    }
    return null;
  }
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  if (o.type === "audio" && typeof o.data === "string" && o.data.length > 0) return o.data;
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
async function thirrGemini(init: RequestInit, afatiMs: number): Promise<Response> {
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
    if (pritja > MAKS_PRITJA_429_MS) throw e;
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
  );
  if (!r.body) throw new GabimIZerit("Zëri ktheu një përgjigje të paplotë. Provo përsëri.");
  const lexuesi = r.body.getReader();
  const dek = new TextDecoder();
  let tampon = "";
  let pjesaPaGjysem: Uint8Array | null = null; // bajti tek që mbetet mes dy copave
  let pati = false;
  let perfundoi = false; // pa "interaction.completed" rrjedha u pre në mes: është dështim, jo fund
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
          continue;
        }
        if (!d || d.type !== "audio" || typeof d.data !== "string" || !d.data) continue;
        let b = ngaBase64(d.data);
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
        const shkalla = typeof d.sample_rate === "number" && d.sample_rate >= 8000 ? d.sample_rate : SHKALLA_TTS;
        yield { pcm: b, shkalla };
      }
    }
  } catch (e) {
    if (e instanceof GabimIZerit) throw e;
    throw new GabimIZerit("Zëri u ndërpre. Provo përsëri.");
  } finally {
    lexuesi.cancel().catch(() => {});
  }
  if (!pati) throw new GabimIZerit("Zëri doli bosh. Provo përsëri.");
  if (!perfundoi) throw new GabimIZerit("Zëri u ndërpre para fundit. Provo përsëri.");
}

export function gemini(modeli: string = MODELI_TTS): Folesi {
  const lite = modeli === MODELI_TTS_LITE;
  return {
    emri: lite ? "gemini-lite" : "gemini",
    ...(lite ? { gjuhet: GJUHET_E_LITE } : {}),
    iGatshem: () => !!Deno.env.get("GEMINI_API_KEY"),
    rrjedhe: (teksti, gjuha, intervistuesi) => rrjedhaGemini(modeli, teksti, gjuha, intervistuesi),
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
      );
      const kufijte = headerAtEKufijve(r.headers);
      let json: unknown;
      try {
        json = await r.json();
      } catch {
        throw new GabimIZerit("Zëri ktheu një përgjigje të paplotë. Provo përsëri.");
      }
      const b64 = gjejAudion(json);
      if (!b64) throw new GabimIZerit("Zëri doli bosh. Provo përsëri.");
      const bajtet = ngaBase64(b64);
      // Zakonisht WAV me header; nëse vjen PCM i zhveshur (audio/l16), e mbështjellim vetë.
      const wav = lexoWav(bajtet);
      const pcm = wav ? wav.mostrat : new Int16Array(bajtet.buffer, bajtet.byteOffset, Math.floor(bajtet.length / 2));
      const shkalla = wav ? wav.shkalla : SHKALLA_TTS;
      if (pcm.length < shkalla * 0.2) throw new GabimIZerit("Zëri doli bosh. Provo përsëri.");
      return { audio: shkruajWav(pcm, shkalla), mime: "audio/wav", sekonda: pcm.length / shkalla, kufijte };
    },
  };
}
