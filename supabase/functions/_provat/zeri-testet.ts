// Testet e zërit pa asnjë thirrje të vërtetë (fetch i rremë): 429 me riprovim dhe rrjedha e prerë (arsyet pse Arta
// ndalej në mes, 25.11).
//
//   deno test --node-modules-dir=none --allow-env supabase/functions/_provat/zeri-testet.ts
import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1.0.19";

import { GabimIZerit, lexoKufirin } from "../_shared/zeri.ts";
import { gemini } from "../_shared/zeri-gemini.ts";
import { emratTekniko, eshteJehonaEPromptit, MAKS_SHENJA_PROMPTI, ndertoPromptinSTT } from "../_shared/zeri-fjalori.ts";
import { groq } from "../_shared/zeri-groq.ts";
import type { Konteksti } from "../_shared/intervista-ai.ts";

Deno.env.set("GEMINI_API_KEY", "prove");

const b64 = btoa(String.fromCharCode(...new Uint8Array(28_800).fill(1))); // 600 ms PCM16 24 kHz (jo heshtje)
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

Deno.test("429 i kufirit ditor (si te prodhimi): pa riprovim, shënohet si kufi ditor", async () => {
  const trupi = JSON.stringify({
    error: {
      message: "Rate limit exceeded for model gemini-3.8-flash-tts (limit: 10 requests per day on Free Tier). Please retry in 15h35m38s",
      code: "too_many_requests",
    },
  });
  const f = meFetch([() => new Response(trupi, { status: 429, headers: { "retry-after": "56138" } })]);
  try {
    const e = await assertRejects(mblidh, GabimIZerit);
    assertEquals([e.kufiriDitor, f.thirrjet.length], [true, 1]);
    assertEquals(lexoKufirin({ kufijte: { "retry-after": "56138" }, trupi }), {
      vonesaMs: 56_138_000,
      kufiri: "10 requests per day on Free Tier",
    });
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

// ---------- Fjalori i Whisper-it ----------
const KONTEKSTI: Konteksti = {
  puna: {
    id: "p1",
    titulli: "QA Engineer",
    kompania: "Dardania Soft",
    qyteti: "Prishtinë",
    roli: "SWE",
    pershkrimi: "Teste automatike me Cypress dhe CI/CD në GitLab.",
    aftesite: ["Playwright", "TypeScript"],
  },
  cv: "Titulli: Student\nProjektet:\n- Karriera: app me React Native dhe Supabase, testuar me Vitest\nAftësitë: Claude, Python, punë në ekip",
  gatishmeria: null,
};

Deno.test("fjalori: ka aftësitë e punës, kërkesat, CV-në dhe emrat e zakonshëm, pa dyfishime", () => {
  const p = ndertoPromptinSTT({
    konteksti: KONTEKSTI,
    kerkesat: { kerkesat: ["Postman", "Njohuri të mira në testimin e API me k6 dhe JMeter"], perparesi: [], detyrat: [] },
  });
  for (const f of ["QA Engineer", "Dardania Soft", "Playwright", "TypeScript", "Claude", "Python", "Postman", "JMeter", "React Native", "Supabase", "Docker"]) {
    assert(p.includes(f), `mungon ${f}: ${p}`);
  }
  // Vetëm listë fjalësh: pa fjali hyrëse dhe pa fraza shqipe (si "punë në ekip" nga CV-ja).
  assert(!/[ëç]/i.test(p), p);
  assert(!p.includes("Intervistë"));
  assertEquals(p.replace(/[.]$/, "").split(", ").filter((x) => x === "Playwright").length, 1);
  assert(p.length <= MAKS_SHENJA_PROMPTI + 2, `shumë i gjatë: ${p.length}`);
  // Aftësia e punës (më e rëndësishmja) është në fund të prompt-it, që Whisper-i ta mbajë.
  assert(p.indexOf("Playwright") > p.indexOf("Docker"));
});

Deno.test("fjalori: kufizohet edhe me shumë aftësi, dhe punon pa CV e pa kërkesa", () => {
  const shume = ndertoPromptinSTT({
    konteksti: { ...KONTEKSTI, cv: null, puna: { ...KONTEKSTI.puna, aftesite: Array.from({ length: 200 }, (_, i) => `Aftesia${i}`) } },
  });
  assert(shume.length <= MAKS_SHENJA_PROMPTI + 2);
  assert(shume.includes("Aftesia0"));
  assert(ndertoPromptinSTT({ konteksti: { ...KONTEKSTI, cv: null } }).includes("Playwright"));
});

Deno.test("fjalori: emrat teknikë nga teksti i lirë", () => {
  assertEquals(emratTekniko("Punova me Node.js, TypeScript, C# dhe SQL në projektin tim."), ["Node.js", "TypeScript", "C#", "SQL"]);
  assertEquals(emratTekniko("Punova me ekipin tim çdo ditë."), []);
});

Deno.test("jehona e prompt-it mbi heshtje s'bëhet përgjigje", () => {
  const p = ndertoPromptinSTT({ konteksti: KONTEKSTI });
  assert(eshteJehonaEPromptit(p.slice(0, 60), p));
  assert(!eshteJehonaEPromptit("Kam përdorur Playwright që përdor Claude.", p));
});

Deno.test("Groq merr language dhe prompt-in te kërkesa", async () => {
  Deno.env.set("GROQ_API_KEY", "prove");
  let forma: FormData | null = null;
  const iVjetri = globalThis.fetch;
  globalThis.fetch = ((_u: unknown, init: RequestInit) => {
    forma = init.body as FormData;
    return Promise.resolve(Response.json({ text: "Mirë" }));
  }) as typeof fetch;
  try {
    assertEquals(await groq().degjo(new Int16Array(1600), "sq", "Fjalori: Claude."), "Mirë");
    const f = forma as unknown as FormData;
    assertEquals([f.get("model"), f.get("language"), f.get("prompt")], ["whisper-large-v3", "sq", "Fjalori: Claude."]);
  } finally {
    globalThis.fetch = iVjetri;
  }
});
