// Pyetje më të mira (25.11): shembuj para / pas për kontrollet e kodit dhe prompt-in e kthesës, pa asnjë thirrje AI.
// "Para" = çka bënte kodi i vjetër me të njëjtën hyrje (s'kishte shenja, as kontroll përsëritjeje, as kërkesat te prompt-i).
// Shembujt me modelin e vërtetë: _provat/intervista-para-pas.ts (dhe rezultati te docs/intervista-pyetjet.md).
//
//   deno test --node-modules-dir=none supabase/functions/_provat/intervista-testet.ts
import { assert, assertEquals } from "jsr:@std/assert@1.0.19";

import {
  eshtePyetjeEPerseritur,
  type Konteksti,
  type KthesaAI,
  type KthesaDB,
  ndertoPromptinEKthesës,
  shenjatEPergjigjes,
  vendosKthesen,
} from "../_shared/intervista-ai.ts";

const KONTEKSTI: Konteksti = {
  puna: {
    id: "p1",
    titulli: "Junior QA Engineer",
    kompania: "Dardania Soft",
    qyteti: "Prishtinë",
    roli: "SWE",
    pershkrimi: "Testim i aplikacionit web.",
    aftesite: ["Playwright", "SQL"],
    kerkesat: ["Shkrim i testeve e2e me Playwright", "Raportim i qartë i gabimeve"],
  },
  cv: "Projektet:\n- Karriera: app me React Native dhe Supabase\nAftësitë: React Native, Git",
  gatishmeria: null,
};

const kthesa = (nr: number, pyetja: string, pergjigja: string): KthesaDB => ({
  id: `k${nr}`,
  nr,
  lloji: "pyetje",
  reagimi: null,
  pyetja,
  pergjigja,
  vleresimi: null,
  pergjigjur_me: null,
});

Deno.test("shembulli 1 · përgjigje e paqartë: tani kodi i thotë modelit të kërkojë një rast konkret", () => {
  const p = "Po, kam punuar në shumë projekte me ekip, kemi bërë shumë gjëra dhe ka shkuar mirë.";
  assertEquals(shenjatEPergjigjes(p), { pretendim: null, paqarte: true });
  const prompt = ndertoPromptinEKthesës({ konteksti: KONTEKSTI, kthesat: [kthesa(1, "Si punoni në ekip?", p)], detyra: "D", qasjet: "" });
  assert(prompt.includes("është e përgjithshme"));
  assert(prompt.includes("kërko një rast konkret"));
});

Deno.test("shembulli 2 · pretendim i fryrë: tani kodi kërkon provë (\"ekspert\", \"gjithçka\")", () => {
  const p = "Jam ekspert në Playwright, e di gjithçka dhe testet e mia janë perfekte.";
  assertEquals(shenjatEPergjigjes(p).pretendim?.toLowerCase(), "ekspert");
  const prompt = ndertoPromptinEKthesës({ konteksti: KONTEKSTI, kthesat: [kthesa(1, "Sa e njihni Playwright?", p)], detyra: "D", qasjet: "" });
  assert(prompt.includes('pretendim absolut ("ekspert")'));
});

Deno.test("shembulli 3 · përgjigje konkrete ose pranim i sinqertë: pa shënim skeptik", () => {
  for (const p of [
    "Te projekti Karriera shkrova 12 teste me Jest për hyrjen dhe gjeta dy gabime te rrjedha e fjalëkalimit.",
    "Playwright s'e kam përdorur kurrë, por kam shkruar teste me Jest dhe po e mësoj tani.",
  ]) {
    assertEquals(shenjatEPergjigjes(p), { pretendim: null, paqarte: false }, p);
    assert(!ndertoPromptinEKthesës({ konteksti: KONTEKSTI, kthesat: [kthesa(1, "Q?", p)], detyra: "D", qasjet: "" }).includes("Shënim nga kodi"));
  }
});

Deno.test("shembulli 4 · pyetje e përsëritur me fjalë pak të ndryshme zëvendësohet", () => {
  const teBera = [
    "Për të filluar: më tregoni pak për veten dhe pse ju intereson kjo punë?",
    "Si e keni testuar aplikacionin te projekti juaj Karriera?",
  ];
  const ai: KthesaAI = {
    shprehja: "interesim",
    vazhdo: true,
    lloji: "pyetje",
    qasja: "thellim",
    arsyeja_e_qasjes: "x",
    reagimi: "Mirë.",
    pyetja: "Si e testuat aplikacionin tuaj Karriera te ai projekt?",
  };
  assert(eshtePyetjeEPerseritur(ai.pyetja, teBera));
  const opts = { ai, menyra: "vazhdo" as const, lejohetVazhdim: true, konteksti: KONTEKSTI, gjuha: "sq" as const, roli: "SWE" as const, nrPyetjeve: 2, nrAktual: 2 };
  // para (pa listën e pyetjeve): pyetja e përsëritur kalonte
  assertEquals(vendosKthesen(opts).pyetja, ai.pyetja);
  // pas: zëvendësohet me një aftësi të shpalljes që s'është pyetur ende
  const pas = vendosKthesen({ ...opts, pyetjetEMeparshme: teBera });
  assertEquals(pas.lloji, "pyetje");
  assert(pas.pyetja.includes("Playwright"), pas.pyetja);
  assert(!eshtePyetjeEPerseritur(pas.pyetja, teBera));
});

Deno.test("shembulli 5 · prompt-i ka kërkesat e shpalljes dhe pyetjet e bëra; pyetje të ndryshme s'quhen përsëritje", () => {
  const prompt = ndertoPromptinEKthesës({
    konteksti: KONTEKSTI,
    kthesat: [kthesa(1, "Pse ju intereson testimi?", "Më pëlqen të gjej gabime para përdoruesve, sidomos te Karriera.")],
    detyra: "DETYRA",
    qasjet: "",
  });
  for (const f of ["Shkrim i testeve e2e me Playwright", "Raportim i qartë i gabimeve", "Pyetjet e bëra tashmë", "- Pse ju intereson testimi?", "DETYRA"]) {
    assert(prompt.includes(f), f);
  }
  assert(!eshtePyetjeEPerseritur("Si i raportoni gabimet që gjeni?", ["Pse ju intereson testimi?", "Si punoni me ekipin?"]));
});

Deno.test("kontrolli i përsëritjes: pyetje të tjera për të njëjtin projekt ose me të njëjtën formë kalojnë", () => {
  const raste: [string, string, boolean][] = [
    ["Si e testuat aplikacionin te projekti Karriera?", "Si e dizajnuat bazën e të dhënave te projekti Karriera?", false],
    ["Çfarë roli patët te projekti Karriera?", "Si e testuat aplikacionin te projekti Karriera?", false],
    [
      "Shpallja kërkon SQL. Më tregoni një rast kur e keni përdorur: çfarë bëtë ju vetë?",
      "Shpallja kërkon Playwright. Më tregoni një rast kur e keni përdorur: çfarë bëtë ju vetë?",
      false,
    ],
    ["Pse ju intereson kjo punë?", "Pse ju intereson puna te ne?", true],
  ];
  for (const [a, b, pritet] of raste) assertEquals(eshtePyetjeEPerseritur(a, [b]), pritet, `${a} || ${b}`);
});
