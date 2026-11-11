
import Anthropic from "npm:@anthropic-ai/sdk";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk/helpers/zod";
import { z } from "npm:zod";

// ---------- Modelet e të dhënave ----------

export const AnalizaCVSchema = z.object({
  nota: z.number().int().min(0).max(100),
  permbledhja: z.string(),
  seksionet: z.array(
    z.object({
      emri: z.string(),
      gjendja: z.enum(["mire", "permiresim"]),
      komenti: z.string(),
      roast: z.string(),
    }),
  ),
  rishkrimet: z.array(
    z.object({
      para: z.string(),
      pas: z.string(),
    }),
  ),
  pikat_e_forta: z.array(z.string()),
  fjalia_roast: z.string(),
});

export const CvStrukturuarSchema = z.object({
  emri: z.string(),
  titulli: z.string(),
  qyteti: z.string(),
  email: z.string(),
  telefoni: z.string().nullable(),
  datelindja: z.string().nullable(),
  profili: z.string(),
  arsimi: z.array(
    z.object({
      programi: z.string(),
      institucioni: z.string(),
      periudha: z.string(),
    }),
  ),
  pervoja: z.array(
    z.object({
      roli: z.string(),
      vendi: z.string(),
      periudha: z.string(),
      pershkrimi: z.string(),
      nga_ai: z.boolean(),
    }),
  ),
  projektet: z.array(
    z.object({
      titulli: z.string(),
      pershkrimi: z.string(),
      linku: z.string().nullable(),
      nga_ai: z.boolean(),
    }),
  ),
  aftesite: z.array(z.string()),
  gjuhet: z.array(
    z.object({
      gjuha: z.string(),
      niveli: z.string(),
    }),
  ),
});

export type AnalizaCV = z.infer<typeof AnalizaCVSchema>;
export type CvStrukturuar = z.infer<typeof CvStrukturuarSchema>;

export type FormatiCV = "ks" | "europass" | "eu" | "us" | "uk" | "ats";
export type GjuhaCV = "sq" | "en";

// ---------- Konfigurimi i AI-së ----------

const MODELI = "claude-sonnet-5";

function merrKlientin(): Anthropic {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");

  if (!apiKey) {
    throw new Error("Mungon çelësi i AI-së.");
  }

  return new Anthropic({ apiKey });
}

// ---------- Gjenerimi i përgjigjeve JSON ----------

export async function gjeneroJSON<T extends z.ZodType>(
  schema: T,
  system: string,
  prompt: string | Anthropic.Messages.ContentBlockParam[],
  maxTokens = 4096,
): Promise<z.infer<T>> {
  const klienti = merrKlientin();

  const response = await klienti.messages.parse({
    model: MODELI,
    max_tokens: maxTokens,
    system,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    output_config: {
      format: zodOutputFormat(schema),
    },
  });

  if (response.stop_reason === "max_tokens") {
    throw new Error("Përgjigjja e AI-së ishte tepër e gjatë.");
  }

  if (response.stop_reason === "refusal") {
    throw new Error("AI-ja nuk mund ta përpunojë këtë kërkesë.");
  }

  if (!response.parsed_output) {
    throw new Error("AI-ja nuk ktheu përgjigje në formatin e kërkuar.");
  }

  return response.parsed_output as z.infer<T>;
}
