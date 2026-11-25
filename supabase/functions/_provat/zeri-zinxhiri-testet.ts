// Zinxhiri i zërit (25.11): Azure → Gemini 3.8 Flash → Flash-Lite → teksti, me 429 / numërues mujor si "kuota".
// Pa asnjë thirrje të vërtetë (fetch i rremë) dhe pa asnjë çelës të vërtetë: vlerat më poshtë janë të rreme.
//
//   deno test --node-modules-dir=none --allow-env supabase/functions/_provat/zeri-zinxhiri-testet.ts
import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1.0.19";

import { GabimIZerit, MESAZHI_I_KUOTES, pamjaEGabimitTeZerit } from "../_shared/zeri.ts";
import { azure, FORMATI_AZURE, KUFIRI_MUJOR_SHKRONJA, ssmlPer } from "../_shared/zeri-azure.ts";
import { gemini, MODELI_TTS, MODELI_TTS_LITE } from "../_shared/zeri-gemini.ts";
import { zinxhiriIZerit } from "../_shared/zeri-zinxhiri.ts";
import { type DepoEZerit, meKesh, zbrazKujtesen, type ZeriIRuajtur } from "../_shared/zeri-keshi.ts";

type Kerkesa = { ofruesi: string; url: string; init: RequestInit };
type Pergjigja = () => Response;

const pcm = (bajt: number) => new Uint8Array(bajt).fill(1);
const azureOk: Pergjigja = () => new Response(pcm(9601), { status: 200 }); // numër tek bajtesh me qëllim
const b64 = btoa(String.fromCharCode(...pcm(4800)));
const geminiOk: Pergjigja = () =>
  new Response(
    `event: step.delta\ndata: {"delta":{"type":"audio","data":"${b64}","sample_rate":24000}}\n\n` +
      `event: interaction.completed\ndata: {"interaction":{"status":"completed"}}\n\n`,
    { status: 200 },
  );
const e429 = (retryAfter: string): Pergjigja => () => new Response("{}", { status: 429, headers: { "retry-after": retryAfter } });
const DITOR = "56000"; // sekonda: kufiri ditor

/** fetch i rremë që e njeh ofruesin nga URL-ja dhe modeli; çdo ofrues ka radhën e vet të përgjigjeve. */
function meOfruesit(radhet: Record<"azure" | "gemini" | "gemini-lite", Pergjigja[]>) {
  const kerkesat: Kerkesa[] = [];
  const iVjetri = globalThis.fetch;
  globalThis.fetch = ((url: string, init: RequestInit) => {
    const ofruesi = url.includes("tts.speech.microsoft.com")
      ? "azure"
      : String(init.body).includes(`"model":"${MODELI_TTS_LITE}"`)
        ? "gemini-lite"
        : "gemini";
    const radha = radhet[ofruesi];
    const nr = kerkesat.filter((k) => k.ofruesi === ofruesi).length;
    kerkesat.push({ ofruesi, url, init });
    if (!radha.length) return Promise.reject(new Error("s'pritej kërkesë te " + ofruesi));
    return Promise.resolve(radha[Math.min(nr, radha.length - 1)]());
  }) as typeof fetch;
  return { kerkesat, kush: () => kerkesat.map((k) => k.ofruesi), rikthe: () => (globalThis.fetch = iVjetri) };
}

function mjedisi(meAzure: boolean) {
  Deno.env.set("GEMINI_API_KEY", "i-rreme");
  if (meAzure) {
    Deno.env.set("AZURE_SPEECH_KEY", "celes-i-rreme-per-teste");
    Deno.env.set("AZURE_SPEECH_REGION", "westeurope");
  } else {
    Deno.env.delete("AZURE_SPEECH_KEY");
    Deno.env.delete("AZURE_SPEECH_REGION");
  }
}

const rezervime: number[] = [];
const lejo = (n: number) => (rezervime.push(n), Promise.resolve(true));
const zinxhiri = (rezervo = lejo) => zinxhiriIZerit([azure(rezervo), gemini(), gemini(MODELI_TTS_LITE)]);

async function fol(z = zinxhiri(), gjuha: "sq" | "en" = "sq") {
  const copat: { ofruesi?: string; gjatesia: number }[] = [];
  for await (const c of z.rrjedhe!("Mirëdita, si jeni?", gjuha, "arta")) copat.push({ ofruesi: c.ofruesi, gjatesia: c.pcm.length });
  return copat;
}

Deno.test("Azure: URL, header-at, formati, zëri sipas gjuhës dhe intervistuesit, SSML i pastruar, bajte çift", async () => {
  mjedisi(true);
  const f = meOfruesit({ azure: [azureOk], gemini: [], "gemini-lite": [] });
  try {
    const copat = await fol();
    assertEquals(copat.every((c) => c.ofruesi === "azure" && c.gjatesia % 2 === 0), true);
    assertEquals(f.kush(), ["azure"]); // një kërkesë për kthesë
    const k = f.kerkesat[0];
    assertEquals(k.url, "https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1");
    const h = k.init.headers as Record<string, string>;
    assertEquals(h["X-Microsoft-OutputFormat"], FORMATI_AZURE);
    assertEquals(h["Content-Type"], "application/ssml+xml");
    assert("Ocp-Apim-Subscription-Key" in h && !!h["User-Agent"]);
    assert(String(k.init.body).includes('<voice name="sq-AL-AnilaNeural">Mirëdita, si jeni?</voice>'));
  } finally {
    f.rikthe();
  }
  assert(ssmlPer("x", "sq", "arber").ssml.includes("sq-AL-IlirNeural"));
  assert(ssmlPer("x", "en", "arta").ssml.includes("en-US-JennyNeural"));
  assert(ssmlPer("x", "de", "arber").ssml.includes("de-DE-ConradNeural"));
  const s = ssmlPer('A < B & "C"', "sq", "arta");
  assert(s.ssml.includes("A &lt; B &amp; &quot;C&quot;"));
  assertEquals(s.shkronja, "A &lt; B &amp; &quot;C&quot;".length); // numërohet teksti i dërguar, jo etiketat speak/voice
  assertEquals(KUFIRI_MUJOR_SHKRONJA, 480_000);
});

Deno.test("pa sekretin e Azure-s: kapërcehet pa zë, pa rezervim, Gemini punon", async () => {
  mjedisi(false);
  rezervime.length = 0;
  const f = meOfruesit({ azure: [], gemini: [geminiOk], "gemini-lite": [] });
  try {
    assertEquals((await fol())[0].ofruesi, "gemini");
    assertEquals(f.kush(), ["gemini"]);
    assertEquals(rezervime, []);
  } finally {
    f.rikthe();
  }
});

Deno.test("numëruesi mujor plot (ose i palexueshëm): s'dërgohet asgjë te Azure, bie te Gemini", async () => {
  mjedisi(true);
  const f = meOfruesit({ azure: [], gemini: [geminiOk], "gemini-lite": [] });
  try {
    assertEquals((await fol(zinxhiri(() => Promise.resolve(false))))[0].ofruesi, "gemini");
    assertEquals(f.kush(), ["gemini"]);
  } finally {
    f.rikthe();
  }
});

Deno.test("Azure 429: një riprovim sipas retry-after, pastaj Gemini; çdo kërkesë numërohet", async () => {
  mjedisi(true);
  rezervime.length = 0;
  const f = meOfruesit({ azure: [e429("0"), e429("0")], gemini: [geminiOk], "gemini-lite": [] });
  try {
    assertEquals((await fol())[0].ofruesi, "gemini");
    assertEquals(f.kush(), ["azure", "azure", "gemini"]);
    assertEquals(rezervime.length, 2);
  } finally {
    f.rikthe();
  }
});

Deno.test("Gemini në kufirin ditor: bie te Flash-Lite (edhe shqip); GEMINI_LITE_SQ=0 e heq për shqip", async () => {
  mjedisi(false);
  for (const gjuha of ["en", "sq"] as const) {
    const f = meOfruesit({ azure: [], gemini: [e429(DITOR)], "gemini-lite": [geminiOk] });
    try {
      assertEquals((await fol(zinxhiri(), gjuha))[0].ofruesi, "gemini-lite");
      assertEquals(f.kush(), ["gemini", "gemini-lite"]);
      assert(String(f.kerkesat[0].init.body).includes(`"model":"${MODELI_TTS}"`));
    } finally {
      f.rikthe();
    }
  }
  Deno.env.set("GEMINI_LITE_SQ", "0");
  const f = meOfruesit({ azure: [], gemini: [e429(DITOR)], "gemini-lite": [] });
  try {
    const e = await assertRejects(() => fol(zinxhiri(), "sq"), GabimIZerit);
    assertEquals(f.kush(), ["gemini"]);
    assertEquals(pamjaEGabimitTeZerit(e), { status: 429, kodi: "kuota", mesazhi: MESAZHI_I_KUOTES, ditor: true });
  } finally {
    f.rikthe();
    Deno.env.delete("GEMINI_LITE_SQ");
  }
});

Deno.test("të dy modelet e Gemini-t me 429: kodi kuota me fjalinë e sinqertë", async () => {
  mjedisi(false);
  const f = meOfruesit({ azure: [], gemini: [e429(DITOR)], "gemini-lite": [e429(DITOR)] });
  try {
    const e = await assertRejects(() => fol(), GabimIZerit);
    assertEquals(f.kush(), ["gemini", "gemini-lite"]);
    assertEquals(pamjaEGabimitTeZerit(e), { status: 429, kodi: "kuota", mesazhi: MESAZHI_I_KUOTES, ditor: true });
  } finally {
    f.rikthe();
  }
});

Deno.test("429 i përkohshëm te Azure + kufiri ditor i Gemini-t: kodi kuota, por JO ditor (Azure kthehet pas pak)", async () => {
  mjedisi(true);
  const f = meOfruesit({ azure: [e429("60")], gemini: [e429(DITOR)], "gemini-lite": [e429(DITOR)] });
  try {
    const e = await assertRejects(() => fol(), GabimIZerit);
    assertEquals(f.kush(), ["azure", "gemini", "gemini-lite"]); // retry-after 60 s > 5 s: s'pritet brenda kërkesës
    const p = pamjaEGabimitTeZerit(e);
    assertEquals([p.kodi, p.ditor, p.mesazhi], ["kuota", false, "Zëri s'është i disponueshëm tani (kufiri i shërbimit). Pyetja është në ekran."]);
  } finally {
    f.rikthe();
  }
});

Deno.test("edhe rruga pa rrjedhë kalon nga zinxhiri dhe e thotë ofruesin; gabimet e tjera s'bëhen kuota", async () => {
  mjedisi(true);
  const f = meOfruesit({ azure: [azureOk], gemini: [], "gemini-lite": [] });
  try {
    const a = await zinxhiri().fol("Mirë.", "sq", "arta");
    assertEquals([a.ofruesi, a.mime], ["azure", "audio/wav"]);
  } finally {
    f.rikthe();
  }
  mjedisi(false);
  const g = meOfruesit({ azure: [], gemini: [() => new Response("x", { status: 500 })], "gemini-lite": [() => new Response("x", { status: 500 })] });
  try {
    const e = await assertRejects(() => fol(), GabimIZerit);
    assertEquals(pamjaEGabimitTeZerit(e).kodi, "zeri");
  } finally {
    g.rikthe();
  }
});

// ---------- Kesh-i i teksteve fikse ----------
function depoERreme() {
  const m = new Map<string, ZeriIRuajtur>();
  const depo: DepoEZerit = {
    lexo: (k) => Promise.resolve(m.get(k) ?? null),
    shkruaj: (k, z) => (m.set(k, z), Promise.resolve()),
  };
  return { m, depo };
}
const mblidh = async (z: ReturnType<typeof meKesh>, teksti: string) => {
  let bajt = 0;
  for await (const c of z.rrjedhe!(teksti, "sq", "arta")) bajt += c.pcm.length;
  return bajt;
};

Deno.test("kesh: i njëjti tekst herën e dytë s'bën asnjë kërkesë (edhe pas rinisjes së instancës, nga tabela)", async () => {
  mjedisi(false);
  zbrazKujtesen();
  const { m, depo } = depoERreme();
  const f = meOfruesit({ azure: [], gemini: [geminiOk], "gemini-lite": [] });
  try {
    const kesh = meKesh(zinxhiri(), depo, "gemini");
    const e1 = await mblidh(kesh, "Mirëdita, unë jam Arta.");
    const e2 = await mblidh(kesh, "Mirëdita, unë jam Arta.");
    zbrazKujtesen(); // instancë e re: vetëm tabela
    const wav = await meKesh(zinxhiri(), depo, "gemini").fol("Mirëdita, unë jam Arta.", "sq", "arta");
    assertEquals([e1, e2, f.kerkesat.length, m.size, wav.mime, wav.ofruesi], [4800, 4800, 1, 1, "audio/wav", "gemini"]);
    await mblidh(kesh, "Një tekst tjetër.");
    assertEquals(f.kerkesat.length, 2);
  } finally {
    f.rikthe();
  }
});

Deno.test("kesh: audio e prerë dhe audio e rezervës s'ruhen", async () => {
  mjedisi(false);
  zbrazKujtesen();
  const { m, depo } = depoERreme();
  const ePrere: Pergjigja = () =>
    new Response(`event: step.delta\ndata: {"delta":{"type":"audio","data":"${b64}","sample_rate":24000}}\n\n`, { status: 200 });
  let f = meOfruesit({ azure: [], gemini: [ePrere], "gemini-lite": [] });
  try {
    await assertRejects(() => mblidh(meKesh(zinxhiri(), depo, "gemini"), "A"), GabimIZerit);
  } finally {
    f.rikthe();
  }
  f = meOfruesit({ azure: [], gemini: [e429(DITOR)], "gemini-lite": [geminiOk] });
  try {
    await mblidh(meKesh(zinxhiri(), depo, "gemini"), "B"); // e bëri rezerva (Lite)
    assertEquals(m.size, 0);
  } finally {
    f.rikthe();
  }
});
