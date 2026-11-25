// Zëri i intervistuesit me Azure AI Speech (vendimi i Gentit, 25.11: "Yes, switch to Azure"), vetëm me REST dhe fetch.
// Sekretet: AZURE_SPEECH_KEY dhe AZURE_SPEECH_REGION (Genti i vendos vetë te Supabase → Edge Functions → Secrets).
// Çelësi s'del kurrë në app, s'shkruhet në log dhe s'vihet në teste. Pa sekrete, zinxhiri e kapërcen Azure-n pa zë.
//
// Docs (learn.microsoft.com, kontrolluar 25.11):
//   - REST: POST https://{rajoni}.tts.speech.microsoft.com/cognitiveservices/v1, SSML, "Ocp-Apim-Subscription-Key",
//     "X-Microsoft-OutputFormat", "User-Agent" (.../speech-service/rest-text-to-speech)
//   - formati raw-24khz-16bit-mono-pcm: PCM i zhveshur 24 kHz, i njëjti si te rruga me rrjedhë e app-it
//   - zërat (.../speech-service/language-support?tabs=tts): sq-AL-AnilaNeural (femër), sq-AL-IlirNeural (mashkull),
//     en-US-JennyNeural / en-US-AndrewNeural, de-DE-KatjaNeural / de-DE-ConradNeural. Zërat sq-AL s'kanë vizema:
//     goja lëviz nga vala e audios te faqja, si deri tani.
//   - shkronjat e faturuara: gjithçka te SSML përveç etiketave <speak> dhe <voice>
//   - F0: 20 kërkesa në 60 s; kufiri mujor falas (0,5 milion shkronja neural) ruhet nga numëruesi ynë (rezervo)
import type { Gjuha, Intervistuesi } from "./intervista-ai.ts";
import { type AudioIFolur, type CopaAudio, type Folesi, GabimIZerit, gabimIKuotes, lexoKufirin, shkruajWav } from "./zeri.ts";

export const ZERAT_AZURE: Record<Intervistuesi, Record<Gjuha, string>> = {
  arta: { sq: "sq-AL-AnilaNeural", en: "en-US-JennyNeural", de: "de-DE-KatjaNeural" },
  arber: { sq: "sq-AL-IlirNeural", en: "en-US-AndrewNeural", de: "de-DE-ConradNeural" },
};
const LOKALET: Record<Gjuha, string> = { sq: "sq-AL", en: "en-US", de: "de-DE" };

/** Nën kufirin falas të F0 (0,5 milion shkronja neural në muaj), me hapësirë rezervë. */
export const KUFIRI_MUJOR_SHKRONJA = 480_000;
export const FORMATI_AZURE = "raw-24khz-16bit-mono-pcm";
const SHKALLA = 24_000;
const AFATI_MS = 30_000;
const MAKS_PRITJA_429_MS = 5_000;

/** Rezervon shkronja te numëruesi mujor PARA kërkesës; false = kufiri u arrit (ose numëruesi s'u lexua). */
export type Rezervo = (shkronja: number) => Promise<boolean>;

const xml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** SSML-ja dhe shkronjat që Azure faturon: teksti (me shenjat XML), pa etiketat <speak> dhe <voice> (s'përdorim tjetër). */
export function ssmlPer(teksti: string, gjuha: Gjuha, intervistuesi: Intervistuesi): { ssml: string; shkronja: number } {
  const brenda = xml(teksti);
  const ssml =
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${LOKALET[gjuha]}">` +
    `<voice name="${ZERAT_AZURE[intervistuesi][gjuha]}">${brenda}</voice></speak>`;
  return { ssml, shkronja: brenda.length };
}

function konfigurimi(): { celesi: string; rajoni: string } | null {
  const celesi = Deno.env.get("AZURE_SPEECH_KEY") ?? "";
  const rajoni = (Deno.env.get("AZURE_SPEECH_REGION") ?? "").trim().toLowerCase();
  return celesi && /^[a-z0-9]+$/.test(rajoni) ? { celesi, rajoni } : null;
}

export function azure(rezervo: Rezervo): Folesi {
  /** Një kërkesë; te 429 pritet retry-after (kufiri 20/min i F0) dhe provohet edhe një herë. */
  async function kerko(teksti: string, gjuha: Gjuha, intervistuesi: Intervistuesi): Promise<Response> {
    const k = konfigurimi();
    if (!k) throw new GabimIZerit("Zëri s'është konfiguruar ende. Vazhdo me shkrim.", true);
    const { ssml, shkronja } = ssmlPer(teksti, gjuha, intervistuesi);
    for (let prova = 1; ; prova++) {
      // Numërohet çdo kërkesë, edhe riprovimi: Azure faturon tekstin e dërguar. Mbinumërimi është i sigurt.
      if (!(await rezervo(shkronja))) throw gabimIKuotes(null, true);
      let r: Response;
      try {
        r = await fetch(`https://${k.rajoni}.tts.speech.microsoft.com/cognitiveservices/v1`, {
          method: "POST",
          headers: {
            "Ocp-Apim-Subscription-Key": k.celesi,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": FORMATI_AZURE,
            "User-Agent": "karriera-intervista",
          },
          body: ssml,
          signal: AbortSignal.timeout(AFATI_MS),
        });
      } catch {
        throw new GabimIZerit("Zëri s'u përgjigj. Provo përsëri.");
      }
      if (r.ok) return r;
      await r.body?.cancel().catch(() => {});
      console.error(`[zeri-azure] HTTP ${r.status}`); // vetëm statusi: pa çelës, pa tekst
      if (r.status === 401 || r.status === 403) throw new GabimIZerit("Zëri s'është konfiguruar mirë. Vazhdo me shkrim.", true);
      if (r.status !== 429) throw new GabimIZerit("Zëri dështoi. Provo përsëri.");
      const { vonesaMs } = lexoKufirin({ kufijte: { "retry-after": r.headers.get("retry-after") ?? "" }, trupi: "" });
      const pritja = vonesaMs ?? 1_000;
      if (prova >= 2 || pritja > MAKS_PRITJA_429_MS) throw gabimIKuotes();
      await new Promise((zgjidh) => setTimeout(zgjidh, pritja + 100));
    }
  }

  async function* rrjedhe(teksti: string, gjuha: Gjuha, intervistuesi: Intervistuesi): AsyncGenerator<CopaAudio> {
    const r = await kerko(teksti, gjuha, intervistuesi);
    const lexuesi = r.body?.getReader();
    if (!lexuesi) throw new GabimIZerit("Zëri ktheu një përgjigje të paplotë. Provo përsëri.");
    let tek: Uint8Array | null = null; // bajti tek mes dy copave: PCM-ja është 16 bit
    let pati = false;
    try {
      for (;;) {
        const { value, done } = await lexuesi.read();
        if (done) break;
        let b: Uint8Array = value;
        if (tek) {
          const bashku = new Uint8Array(tek.length + b.length);
          bashku.set(tek);
          bashku.set(b, tek.length);
          b = bashku;
          tek = null;
        }
        if (b.length % 2 === 1) {
          tek = b.slice(b.length - 1);
          b = b.subarray(0, b.length - 1);
        }
        if (b.length === 0) continue;
        pati = true;
        yield { pcm: b, shkalla: SHKALLA };
      }
    } catch {
      throw new GabimIZerit("Zëri u ndërpre. Provo përsëri.");
    } finally {
      lexuesi.cancel().catch(() => {});
    }
    if (!pati) throw new GabimIZerit("Zëri doli bosh. Provo përsëri.");
  }

  return {
    emri: "azure",
    iGatshem: () => konfigurimi() !== null,
    rrjedhe,
    async fol(teksti: string, gjuha: Gjuha, intervistuesi: Intervistuesi): Promise<AudioIFolur> {
      const copat: Uint8Array[] = [];
      for await (const c of rrjedhe(teksti, gjuha, intervistuesi)) copat.push(c.pcm.slice());
      const gjithsej = copat.reduce((s, c) => s + c.length, 0);
      const bajtet = new Uint8Array(gjithsej);
      let i = 0;
      for (const c of copat) {
        bajtet.set(c, i);
        i += c.length;
      }
      const pcm = new Int16Array(bajtet.buffer, 0, Math.floor(gjithsej / 2));
      if (pcm.length < SHKALLA * 0.2) throw new GabimIZerit("Zëri doli bosh. Provo përsëri.");
      return { audio: shkruajWav(pcm, SHKALLA), mime: "audio/wav", sekonda: pcm.length / SHKALLA };
    },
  };
}
