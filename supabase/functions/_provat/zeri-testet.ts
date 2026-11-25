// Testet e zërit pa asnjë thirrje të vërtetë (fetch i rremë): 429 me riprovim dhe rrjedha e prerë (arsyet pse Arta
// ndalej në mes, 25.11).
//
//   deno test --node-modules-dir=none --allow-env supabase/functions/_provat/zeri-testet.ts
import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1.0.19";

import { GabimIZerit, lexoKufirin } from "../_shared/zeri.ts";
import { gemini } from "../_shared/zeri-gemini.ts";

Deno.env.set("GEMINI_API_KEY", "prove");

const b64 = btoa(String.fromCharCode(...new Uint8Array(4800))); // 100 ms heshtje PCM16 24 kHz
const ngjarja = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
const copa = ngjarja("step.delta", { delta: { type: "audio", mime_type: "audio/l16", sample_rate: 24000, data: b64 } });
const fundi = ngjarja("interaction.completed", { interaction: { status: "completed" } });

function meFetch(pergjigjet: (() => Response)[]) {
  const thirrjet: number[] = [];
  const iVjetri = globalThis.fetch;
  globalThis.fetch = (() => {
    thirrjet.push(Date.now());
    return Promise.resolve(pergjigjet[Math.min(thirrjet.length - 1, pergjigjet.length - 1)]());
  }) as typeof fetch;
  return { thirrjet, rikthe: () => (globalThis.fetch = iVjetri) };
}

const sse = (trupi: string) => new Response(trupi, { status: 200, headers: { "content-type": "text/event-stream" } });
const kufiri429 = (vonesa: string) =>
  new Response(
    JSON.stringify({ error: { code: 429, details: [{ violations: [{ quotaId: "GenerateRequestsPerMinute-FreeTier" }] }, { retryDelay: vonesa }] } }),
    { status: 429 },
  );

async function mblidh() {
  const copat: number[] = [];
  for await (const c of gemini().rrjedhe!("Tekst prove.", "sq", "arta")) copat.push(c.pcm.length);
  return copat;
}

Deno.test("lexoKufirin: retry-after dhe retryDelay", () => {
  assertEquals(lexoKufirin({ kufijte: { "retry-after": "5" }, trupi: "" }), { vonesaMs: 5000, kufiri: null });
  assertEquals(
    lexoKufirin({ kufijte: {}, trupi: '{"quotaId":"PerMinute-X","retryDelay":"2.5s"}' }),
    { vonesaMs: 2500, kufiri: "PerMinute-X" },
  );
  assertEquals(lexoKufirin(null), { vonesaMs: null, kufiri: null });
});

Deno.test("rrjedha e plotë kalon", async () => {
  const f = meFetch([() => sse(copa + copa + fundi + "event: done\ndata: [DONE]\n\n")]);
  try {
    assertEquals((await mblidh()).length, 2);
  } finally {
    f.rikthe();
  }
});

Deno.test("rrjedha e prerë (pa interaction.completed) është dështim, jo fund", async () => {
  const f = meFetch([() => sse(copa + copa)]);
  try {
    const e = await assertRejects(mblidh, GabimIZerit);
    assert(e.message.includes("u ndërpre"));
  } finally {
    f.rikthe();
  }
});

Deno.test("429 me vonesë të shkurtër: riprovohet një herë dhe del audio", async () => {
  const f = meFetch([() => kufiri429("0.1s"), () => sse(copa + fundi)]);
  try {
    assertEquals((await mblidh()).length, 1);
    assertEquals(f.thirrjet.length, 2);
  } finally {
    f.rikthe();
  }
});

Deno.test("429 me vonesë të gjatë: s'pritet, dështon menjëherë", async () => {
  const f = meFetch([() => kufiri429("40s")]);
  try {
    await assertRejects(mblidh, GabimIZerit);
    assertEquals(f.thirrjet.length, 1);
  } finally {
    f.rikthe();
  }
});
