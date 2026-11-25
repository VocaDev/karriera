// Dëgjimi (STT) me Groq Whisper (vendimi i menaxherit 15.11: Azure s'pranon Kosovën).
// REST, i pajtueshëm me OpenAI: POST multipart te /openai/v1/audio/transcriptions.
// Sekreti: GROQ_API_KEY (Supabase → Edge Functions → Secrets). Çelësi s'del kurrë në app dhe s'shkruhet në log.
//
// Docs: console.groq.com/docs/speech-to-text (kontrolluar 15.11.2026): wav pranohet, deri në 25 MB (free tier),
// "language" ISO-639-1 (sq / en / de), faturohet minimumi 10 s për kërkesë.
import type { Gjuha } from "./intervista-ai.ts";
import { type Degjuesi, GabimIZerit, SHKALLA_STT, shkruajWav, thirrOfruesin } from "./zeri.ts";

/** whisper-large-v3 ($0.111/orë) dëgjon më mirë shqip se -turbo ($0.04/orë); ndrysho këtu nëse prova tregon ndryshe. */
export const MODELI_STT = "whisper-large-v3";
const URL = "https://api.groq.com/openai/v1/audio/transcriptions";

export function groq(): Degjuesi {
  return {
    emri: "groq",
    async degjo(pcm: Int16Array, gjuha: Gjuha, fjalori?: string): Promise<string> {
      const celesi = Deno.env.get("GROQ_API_KEY") ?? "";
      if (!celesi) throw new GabimIZerit("Zëri s'është konfiguruar ende. Vazhdo me shkrim.", true);
      const forma = new FormData();
      forma.append("file", new Blob([shkruajWav(pcm, SHKALLA_STT)], { type: "audio/wav" }), "pergjigja.wav");
      forma.append("model", MODELI_STT);
      forma.append("language", gjuha);
      forma.append("response_format", "json");
      forma.append("temperature", "0");
      // Emrat teknikë të punës dhe të CV-së (docs: "prompt" deri në 224 tokena, i përdorur si kontekst drejtshkrimi).
      if (fjalori) forma.append("prompt", fjalori);
      const r = await thirrOfruesin(
        URL,
        { method: "POST", headers: { Authorization: `Bearer ${celesi}` }, body: forma },
        "Dëgjimi",
        "zeri-groq",
      );
      let trupi: unknown;
      try {
        trupi = await r.json();
      } catch {
        throw new GabimIZerit("Dëgjimi ktheu një përgjigje të paplotë. Provo përsëri.");
      }
      const t = (typeof trupi === "object" && trupi !== null ? trupi : {}) as Record<string, unknown>;
      const teksti = typeof t.text === "string" ? t.text.trim() : "";
      // Whisper në heshtje ndonjëherë "shpik" fjalë të shkurtra; një përgjigje pa asnjë shkronjë = s'u dëgjua.
      return /\p{L}/u.test(teksti) ? teksti : "";
    },
  };
}
