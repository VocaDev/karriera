// Kufizuesi i kërkesave TTS dhe rradha mes modeleve (25.11). Me orë të rreme dhe fetch të rremë: asnjë thirrje e vërtetë,
// asnjë pritje e vërtetë, asnjë çelës i vërtetë. Funksionet SQL (migrimi 20261125123000) s'provohen këtu.
//
//   deno test --node-modules-dir=none --allow-env supabase/functions/_provat/zeri-rrotullimi-testet.ts
import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1.0.19";

import { type Folesi, GabimIZerit, gabimIKuotes } from "../_shared/zeri.ts";
import { MODELI_TTS, MODELI_TTS_LITE } from "../_shared/zeri-gemini.ts";
import {
  fillimiIDitesPacifike,
  type Kufizuesi,
  type KufiriIModelit,
  kufizuesiNeDB,
  kufizuesiNeKujtese,
  mesnataTjeterPacifike,
} from "../_shared/zeri-kufizuesi.ts";
import { geminiMeRradhe, lexoKufijte, MODELI_TTS_31, type Opsionet } from "../_shared/zeri-rrotullimi.ts";
import { type DepoEZerit, meKesh, zbrazKujtesen, type ZeriIRuajtur } from "../_shared/zeri-keshi.ts";
import { zinxhiriIZerit } from "../_shared/zeri-zinxhiri.ts";

const F = MODELI_TTS;
const T31 = MODELI_TTS_31;
const L = MODELI_TTS_LITE;
const NISJA = Date.parse("2026-11-25T12:00:00Z");
const pa = (modeli: string, rpm = 3, rpd: number | null = null): KufiriIModelit => ({ modeli, rpm, rpd });
const treModelet = [pa(F), pa(T31), pa(L)];

const kuota429 = (retryAfter?: string, ditor = false) =>
  gabimIKuotes({ status: 429, kufijte: retryAfter ? { "retry-after": retryAfter } : {}, trupi: "" }, ditor);
const http = (status: number) => new GabimIZerit("Zëri dështoi. Provo përsëri.", false, { status, kufijte: {}, trupi: "" });

type Sjellja = GabimIZerit | "ok";

/** Orë e rreme, kufizues në kujtesë dhe modele të rreme; `sjelljet[modeli]` = radha e përgjigjeve (e fundit përsëritet). */
function bota(sjelljet: Partial<Record<string, Sjellja[]>> = {}) {
  let ora = NISJA;
  const kerkesat: string[] = [];
  const pritjet: number[] = [];
  const kufizuesi = kufizuesiNeKujtese(() => ora);
  const krijo = (modeli: string): Folesi => {
    const provo = () => {
      const nr = kerkesat.filter((m) => m === modeli).length;
      kerkesat.push(modeli);
      const radha = sjelljet[modeli] ?? ["ok"];
      const s = radha[Math.min(nr, radha.length - 1)];
      if (s !== "ok") throw s;
    };
    return {
      emri: modeli,
      fol: () => (provo(), Promise.resolve({ audio: new Uint8Array(4), mime: "audio/wav", sekonda: 1 })),
      async *rrjedhe() {
        provo();
        yield { pcm: new Uint8Array(4), shkalla: 24_000 };
        await Promise.resolve();
        yield { pcm: new Uint8Array(4), shkalla: 24_000 };
      },
    };
  };
  const folesi = (o: Partial<Opsionet> = {}) =>
    geminiMeRradhe({
      kufizuesi,
      kufijte: treModelet,
      krijo,
      tani: () => ora,
      prit: (ms) => (pritjet.push(ms), (ora += ms), Promise.resolve()),
      ...o,
    });
  return {
    kufizuesi,
    kerkesat,
    pritjet,
    folesi,
    tani: () => ora,
    kalo: (ms: number) => (ora += ms),
    cakto: (t: number) => (ora = t),
  };
}

const fol = (f: Folesi, gjuha: "sq" | "en" = "sq") => f.fol("Mirëdita.", gjuha, "arta");
async function folShume(f: Folesi, n: number, gjuha: "sq" | "en" = "sq") {
  for (let i = 0; i < n; i++) await fol(f, gjuha);
}
const gabimi = async (p: () => Promise<unknown>) => (await assertRejects(p, GabimIZerit)) as GabimIZerit;

Deno.test("dritarja rrëshqitëse: 3 në 60 s, i katërti pret sa t'i dalë koha të parit", async () => {
  const b = bota();
  const nje = [pa(F)];
  for (let i = 0; i < 3; i++) {
    assertEquals((await b.kufizuesi.rezervo(nje, 0)).modeli, F);
    b.kalo(10_000);
  }
  assertEquals(await b.kufizuesi.rezervo(nje, 0), { modeli: null, pritjaMs: 30_000 });
  b.kalo(30_000);
  assertEquals((await b.kufizuesi.rezervo(nje, 0)).modeli, F); // u lirua vendi i të parit
  assertEquals(await b.kufizuesi.rezervo(nje, 0), { modeli: null, pritjaMs: 10_000 });
});

Deno.test("kufiri ditor rinis në mesnatën e Paqësorit (edhe kur ndërron ora)", async () => {
  const b = bota();
  b.cakto(Date.parse("2026-11-25T07:59:00Z")); // 23:59 në Los Angeles
  const nje = [pa(F, 3, 1)];
  assertEquals((await b.kufizuesi.rezervo(nje, 0)).modeli, F);
  assertEquals(await b.kufizuesi.rezervo(nje, 0), { modeli: null, pritjaMs: 60_000 });
  b.kalo(60_000);
  assertEquals((await b.kufizuesi.rezervo(nje, 0)).modeli, F);

  const iso = (t: number) => new Date(t).toISOString();
  assertEquals(iso(fillimiIDitesPacifike(Date.parse("2026-11-25T12:00:00Z"))), "2026-11-25T08:00:00.000Z");
  assertEquals(iso(mesnataTjeterPacifike(Date.parse("2026-11-01T07:30:00Z"))), "2026-11-02T08:00:00.000Z"); // dita 25-orëshe
  assertEquals(iso(mesnataTjeterPacifike(Date.parse("2027-03-14T09:00:00Z"))), "2027-03-15T07:00:00.000Z"); // dita 23-orëshe
});

Deno.test("rradha: modeli i parë me vend të lirë (3.8 Flash → 3.1 → Flash-Lite)", async () => {
  const b = bota();
  await folShume(b.folesi(), 9);
  assertEquals(b.kerkesat, [F, F, F, T31, T31, T31, L, L, L]);
  assertEquals(b.pritjet, []);
});

Deno.test("GEMINI_LITE_SQ=0: Flash-Lite s'përdoret për shqip, vetëm për en / de", async () => {
  Deno.env.set("GEMINI_LITE_SQ", "0");
  try {
    const b = bota();
    const f = b.folesi({ maksPritjaMs: 0 });
    await folShume(f, 6);
    assertEquals((await gabimi(() => fol(f))).kuota, true);
    await fol(f, "en");
    assertEquals(b.kerkesat, [F, F, F, T31, T31, T31, L]);
  } finally {
    Deno.env.delete("GEMINI_LITE_SQ");
  }
});

Deno.test("dritaret plot: pritet vendi i radhës kur është brenda ~15 s, pastaj zëri del", async () => {
  const b = bota();
  const f = b.folesi();
  await folShume(f, 9);
  b.kalo(50_000);
  await fol(f);
  assertEquals(b.pritjet, [10_150]);
  assertEquals(b.kerkesat.at(-1), F);
});

Deno.test("pritja mbi 15 s: s'pritet; kodi kuota, jo ditor", async () => {
  const b = bota();
  const f = b.folesi();
  await folShume(f, 9);
  const e = await gabimi(() => fol(f));
  assertEquals([e.kuota, e.kufiriDitor, b.pritjet.length, b.kerkesat.length], [true, false, 0, 9]);
});

Deno.test("të gjitha në kufirin ditor: kuota dhe ditor", async () => {
  const b = bota();
  const e = await gabimi(() => fol(b.folesi({ kufijte: [pa(F, 3, 0), pa(T31, 3, 0), pa(L, 3, 0)] })));
  assertEquals([e.kuota, e.kufiriDitor, b.kerkesat.length], [true, true, 0]);
});

Deno.test("429: modeli bllokohet sa thotë Google-i dhe kalohet te tjetri", async () => {
  const b = bota({ [F]: [kuota429("30"), "ok"] });
  const f = b.folesi();
  await fol(f);
  await fol(f);
  assertEquals(b.kerkesat, [F, T31, T31]);
  b.kalo(31_000);
  await fol(f);
  assertEquals(b.kerkesat.at(-1), F);
});

Deno.test("429 i kufirit ditor pa 'retry-after': i bllokuar deri në mesnatën e Paqësorit", async () => {
  const b = bota({ [F]: [kuota429(undefined, true), "ok"] });
  const f = b.folesi();
  await fol(f);
  b.cakto(Date.parse("2026-11-26T07:59:00Z"));
  await fol(f);
  assertEquals(b.kerkesat.at(-1), T31);
  b.cakto(Date.parse("2026-11-26T08:00:01Z"));
  await fol(f);
  assertEquals(b.kerkesat.at(-1), F);
});

Deno.test("një 429 kur ka vetëm një model: pritet retry-after i shkurtër dhe provohet sërish, me vend të rezervuar", async () => {
  const b = bota({ [F]: [kuota429("5"), "ok"] });
  await fol(b.folesi({ kufijte: [pa(F)] }));
  assertEquals(b.kerkesat, [F, F]);
  assertEquals(b.pritjet, [5_150]);
});

Deno.test("modeli që e refuzon kërkesën (400 / 404) bllokohet një orë; 500 s'e bllokon", async () => {
  const b = bota({ [F]: [http(500), "ok"], [T31]: [http(400)] });
  const kufijte = [pa(F), pa(T31), pa(L)];
  const f = b.folesi({ kufijte });
  await fol(f); // F 500 → T31 400 → L
  assertEquals(b.kerkesat, [F, T31, L]);
  await fol(f); // F s'ishte i bllokuar
  assertEquals(b.kerkesat.at(-1), F);
  await folShume(f, 1); // vendi i tretë i F
  await folShume(f, 1); // F plot: T31 i bllokuar → L
  assertEquals(b.kerkesat.at(-1), L);
  b.kalo(60 * 60 * 1000 + 1);
  await folShume(f, 4);
  assertEquals(b.kerkesat.filter((m) => m === T31).length, 2);
});

Deno.test("çelësi i gabuar (konfigurim) del menjëherë, pa provuar modele të tjera", async () => {
  const b = bota({ [F]: [new GabimIZerit("Zëri s'është konfiguruar mirë.", true)] });
  const e = await gabimi(() => fol(b.folesi()));
  assertEquals([e.konfigurim, b.kerkesat.length], [true, 1]);
});

Deno.test("përparësia e ulët (pranimi): vetëm me vend të tepërt, pa pritur kurrë", async () => {
  const b = bota();
  const kufijte = [pa(F)];
  const ulet = b.folesi({ kufijte, maksPritjaMs: 0, lerTeLira: 1 });
  await fol(ulet); // 3 të lira → lejohet
  await fol(b.folesi({ kufijte })); // pyetja
  const e = await gabimi(() => fol(ulet)); // 1 e lirë: i ruhet pyetjes
  assertEquals([e.kuota, b.pritjet.length, b.kerkesat.length], [true, 0, 2]);
  await fol(b.folesi({ kufijte }));
  assertEquals(b.kerkesat.length, 3);
});

Deno.test("zëri i nisur s'ndërrohet: gabimi mes rrjedhës del jashtë pa provuar model tjetër", async () => {
  const b = bota();
  const krijo = (): Folesi => ({
    emri: "pritet",
    fol: () => Promise.reject(new Error("s'pritej")),
    async *rrjedhe() {
      b.kerkesat.push("nisi");
      yield { pcm: new Uint8Array(4), shkalla: 24_000 };
      await Promise.resolve();
      throw http(500);
    },
  });
  await assertRejects(async () => {
    for await (const _ of b.folesi({ krijo }).rrjedhe!("A.", "sq", "arta")) { /* copat */ }
  }, GabimIZerit);
  assertEquals(b.kerkesat, ["nisi"]);
});

Deno.test("kesh: për shqip ruhet vetëm audio e 3.8 Flash TTS", async () => {
  const m = new Map<string, ZeriIRuajtur>();
  const depo: DepoEZerit = {
    lexo: (k) => Promise.resolve(m.get(k) ?? null),
    shkruaj: (k, z) => (m.set(k, z), Promise.resolve()),
  };
  const mblidh = async (kufijte: KufiriIModelit[], teksti: string, gjuha: "sq" | "en") => {
    const b = bota();
    Deno.env.set("GEMINI_API_KEY", "i-rreme");
    const kesh = meKesh(zinxhiriIZerit([b.folesi({ kufijte })]), depo, "gemini");
    for await (const _ of kesh.rrjedhe!(teksti, gjuha, "arta")) { /* copat */ }
  };
  zbrazKujtesen();
  await mblidh([pa(T31)], "A", "sq");
  await mblidh([pa(L)], "B", "sq");
  assertEquals(m.size, 0);
  await mblidh([pa(F)], "C", "sq");
  await mblidh([pa(L)], "D", "en");
  assertEquals(m.size, 2);
});

Deno.test("TTS_RPM_LIMITS: parazgjedhjet falas, zëvendësimet, fikja me 0 dhe hyrjet e gabuara", () => {
  assertEquals(lexoKufijte(undefined), [pa(F, 3, 10), pa(T31), pa(L)]);
  assertEquals(lexoKufijte(`${F}=100/5000, ${T31}=0 ,${L} = 20 / 200`), [pa(F, 100, 5000), pa(T31, 0), pa(L, 20, 200)]);
  assertEquals(lexoKufijte(`${F}=10`)[0], pa(F, 10)); // pa "/rpd": pa kufi ditor
  assertEquals(lexoKufijte("tjeter=5, abc, =3, " + `${F}=x`), lexoKufijte(""));
});

Deno.test("kufizuesi te DB: pa migrim (gabim rpc) bie te numëruesi në kujtesë; me DB përdoret përgjigjja e saj", async () => {
  type Admin = Parameters<typeof kufizuesiNeDB>[0];
  const thirrjet: unknown[] = [];
  const admin = (pergjigja: unknown) =>
    ({ rpc: (emri: string, args: unknown) => (thirrjet.push([emri, args]), Promise.resolve(pergjigja)) }) as unknown as Admin;
  const rezerva = (): Kufizuesi => kufizuesiNeKujtese(() => NISJA);

  const paMigrim = kufizuesiNeDB(admin({ data: null, error: { message: "function does not exist" } }), rezerva());
  assertEquals((await paMigrim.rezervo([pa(F, 1)], 0)).modeli, F);
  assertEquals((await paMigrim.rezervo([pa(F, 1)], 0)).modeli, null);

  thirrjet.length = 0;
  const meDB = kufizuesiNeDB(admin({ data: { modeli: T31, pritja_ms: 0 }, error: null }), rezerva());
  assertEquals(await meDB.rezervo(treModelet, 1), { modeli: T31, pritjaMs: 0 });
  await meDB.blloko(F, 1234.6);
  assertEquals(thirrjet, [
    ["zeri_tts_rezervo", { p_modelet: treModelet, p_ler_te_lira: 1 }],
    ["zeri_tts_blloko", { p_modeli: F, p_ms: 1235 }],
  ]);
});

Deno.test("me përshtatësin e vërtetë: 429 s'riprovohet brenda tij (asnjë kërkesë pa vend), kalohet te modeli tjetër", async () => {
  Deno.env.set("GEMINI_API_KEY", "i-rreme");
  const b64 = btoa(String.fromCharCode(...new Uint8Array(480).fill(1)));
  const modelet: string[] = [];
  const iVjetri = globalThis.fetch;
  globalThis.fetch = ((_url: string, init: RequestInit) => {
    const modeli = (JSON.parse(String(init.body)) as { model: string }).model;
    modelet.push(modeli);
    return Promise.resolve(
      modeli === F
        ? new Response("{}", { status: 429, headers: { "retry-after": "2" } })
        : new Response(
          `event: step.delta\ndata: {"delta":{"type":"audio","data":"${b64}","sample_rate":24000}}\n\n` +
            `event: interaction.completed\ndata: {"interaction":{"status":"completed"}}\n\n`,
          { status: 200 },
        ),
    );
  }) as typeof fetch;
  try {
    const f = geminiMeRradhe({ kufizuesi: kufizuesiNeKujtese(), kufijte: treModelet });
    let bajt = 0;
    for await (const c of f.rrjedhe!("Mirëdita.", "sq", "arta")) bajt += c.pcm.length;
    assert(bajt > 0);
    assertEquals(modelet, [F, T31]);
  } finally {
    globalThis.fetch = iVjetri;
  }
});
