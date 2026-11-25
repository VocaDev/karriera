// intervista-zeri: e njëjta intervistë si me shkrim, por me zë. Dy veprime:
//
// 1) Përgjigjja me zë · POST multipart/form-data: intervista_id, nr, audio (WAV nga expo-audio AudioStream)
//    audio → STT (Groq Whisper, gjuha e intervistës) → perpunoKthesen() (KODI I NJËJTË si intervista-kthesa, transkripti ruhet
//    te intervista_kthesat.pergjigja si një përgjigje e shkruar) → app-i, PA zë: teksti del menjëherë në ekran dhe
//    app-i e kërkon zërin me (2), reagimin dhe pyetjen paralelisht (reagimi i shkurtër nis i pari, < 4 s).
//    Vetëm kur intervista mbaron, zëri (reagimi i fundit + mbyllja) vjen këtu: reagimi i fundit s'ruhet në DB.
//    Dalja: { degjuar: true, transkripti, ...dalja e intervista-kthesa, zeri: { fjalite } | null, gabimi_zerit? }
//           ose { degjuar: false, transkripti: "" } kur s'u dëgjua asnjë fjalë (pyetja s'konsumohet).
//    Kur kthesa dështon PAS STT-së, gabimi kthehet me "transkripti": app-i e ruan dhe e riprovon me intervista-kthesa.
//
// 2) Zëri i pyetjes aktuale · POST JSON { veprimi: "fol", intervista_id, nr, pjesa?: "reagimi" | "pyetja" | "mbushesi" }
//    Teksti merret nga DB (ose nga lista fikse e mbushësve), jo nga app-i, që funksioni të mos bëhet TTS falas.
//    Pa "pjesa": reagimi + pyetja në një audio. "mbushesi": një pranim i shkurtër ("Mirë, e kuptoj.") që app-i e luan
//    sapo kandidati mbaron së foluri, ndërsa pret kthesën.
//    Dalja: { zeri: { fjalite: [{ teksti, audio_base64, mime }] } } (fjalite bosh kur pjesa s'ka tekst)
//
// 3) Me rrjedhë (24.11): të njëjtat dy veprime, por përgjigjja është `application/x-ndjson` (një JSON për rresht) dhe zëri
//    vjen në copa PCM sapo Gemini i krijon (byte-i i parë pas ~2 s, jo ~4,5 s pas tekstit). Kërkohet me fushën
//    `rrjedhe=1` (multipart) ose `"rrjedhe": true` (JSON "fol"). Ngjarjet:
//      {"e":"degjuar","transkripti"}                  pas STT-së (vetëm multipart)
//      {"e":"kthesa", ...dalja e intervista-kthesa}   teksti i pyetjes së re, pa pritur zërin
//      {"e":"pcm","b":"<base64 PCM16 mono>","s":24000} copa zëri (reagimi + pyetja, ose reagimi + mbyllja, në një audio)
//      {"e":"gabim_zerit","mesazhi"}                  zëri u ndërpre: teksti është tashmë në ekran
//      {"e":"gabim","error","kodi","status","transkripti"?}  kthesa dështoi (si trupi i gabimit HTTP)
//      {"e":"mbaroi"}                                 gjithçka u dërgua
//    Vlerësimi i përgjigjes (që s'e përdor askush gjatë intervistës) vazhdon në sfond, para "mbaroi".
//
// Ofruesit e zërit (25.11): Azure → Gemini 3.8 Flash TTS → Flash-Lite (en/de) → teksti. Te rrjedha, para copës së parë
// vjen {"e":"zeri_nga","ofruesi"}. Kufiri i shërbimit (429 ose numëruesi mujor): HTTP 429 / "gabim_zerit" me
// {"kodi":"kuota","ditor"} dhe fjalinë "Zëri s'është i disponueshëm tani (kufiri i shërbimit). Pyetja është në ekran."
//
// Gabimet e zërit: 502 "zeri" (riprovo ose shkruaj), 503 "zeri_pa_konfigurim" (vazhdo me shkrim),
// 429 "kufiri_zerit" (minutat e zërit për sot mbaruan). Të tjerat si te intervista-kthesa.
//
// Audio s'ruhet kurrë: vetëm në memorie gjatë kërkesës. Ruhen vetëm numrat e përdorimit (intervista_zeri).
// Asnjë log me audio, transkript ose tekst të intervistës.
import {
  ETIKETA_E_THIRRESIT,
  gabim,
  type Gjuha,
  intervistuesiNga,
  type Intervistuesi,
  type Konteksti,
  MAKS_PERGJIGJJA,
  UUID,
} from "../_shared/intervista-ai.ts";
import { perpunoKthesen } from "../_shared/intervista-kthesa.ts";
import { eshteJehonaEPromptit, ndertoPromptinSTT } from "../_shared/zeri-fjalori.ts";
import { CORS_HEADERS, json, kontrolloThirresin, type Thirresi } from "../_shared/thirresi.ts";
import {
  type CopaAudio,
  type Degjuesi,
  MBUSHESIT,
  type Folesi,
  GabimIZerit,
  pamjaEGabimitTeZerit,
  KUFIRI_DITOR_MINUTA_ZERI,
  lexoWav,
  MAKS_BAJT_AUDIO,
  MAKS_SEKONDA_PERGJIGJE,
  MBYLLJA,
  MIN_SEKONDA_PERGJIGJE,
  neBase64,
  rimostro,
  SHKALLA_STT,
} from "../_shared/zeri.ts";
import { azure, KUFIRI_MUJOR_SHKRONJA } from "../_shared/zeri-azure.ts";
import { gemini, MODELI_TTS_LITE } from "../_shared/zeri-gemini.ts";
import { groq } from "../_shared/zeri-groq.ts";
import { zinxhiriIZerit } from "../_shared/zeri-zinxhiri.ts";

/**
 * Zëri i reagimit para se kthesa të mbarojë (Claude me rrjedhë) e sjell zërin ~1,3 s më shpejt, por bën DY kërkesa TTS për
 * një kthesë. Me kufirin falas të Gemini TTS (429 në prodhim, 25.11) e dyta dështonte dhe Arta ndalej pas reagimit.
 * Prandaj: NJË kërkesë për kthesë (reagimi + pyetja në një audio). Kthehet në true kur kufiri i TTS rritet (me pagesë).
 */
const REAGIMI_I_HERSHEM = false;

// Ofruesit, secili pas përshtatësit të vet (zeri.ts): ndërrohen këtu.
const degjuesi: Degjuesi = groq();
/**
 * Zëri i intervistuesit: Azure → Gemini 3.8 Flash TTS → Gemini Flash-Lite (vetëm en / de) → teksti me fjalinë e kufirit.
 * Pa sekretet e Azure-s, zinxhiri fillon te Gemini. Numëruesi mujor i Azure-s rezervon shkronjat para çdo kërkese.
 */
function folesiPer(t: Thirresi): Folesi {
  const rezervo = async (shkronja: number) => {
    const { data, error } = await t.admin.rpc("zeri_azure_rezervo", { p_shkronja: shkronja, p_kufiri: KUFIRI_MUJOR_SHKRONJA });
    if (error) {
      console.error("[intervista-zeri] Numëruesi i Azure-s s'u lexua (a është aplikuar migrimi zeri_azure?). Po përdoret Gemini.");
      return false;
    }
    return data === true;
  };
  return zinxhiriIZerit([azure(rezervo), gemini(), gemini(MODELI_TTS_LITE)]);
}

type Objekt = Record<string, unknown>;
const eshteObjekt = (v: unknown): v is Objekt => typeof v === "object" && v !== null && !Array.isArray(v);

type FjaliaMeZe = { teksti: string; audio_base64: string; mime: string };
type IntervistaEZerit = { gjuha: Gjuha; intervistuesi: Intervistuesi; konteksti: Konteksti; folesi: Folesi };

/** Ngjarja "gabim_zerit" e rrjedhës; "kodi" ("kuota" te kufiri i shërbimit) dhe "ditor" i tregojnë app-it çka të thotë. */
function ngjarjaEGabimitTeZerit(e: unknown): Objekt {
  const p = pamjaEGabimitTeZerit(e);
  return { e: "gabim_zerit", mesazhi: p.mesazhi, kodi: p.kodi, ditor: p.ditor };
}

function gabimIZerit(e: unknown): Response {
  if (!(e instanceof GabimIZerit)) console.error("[intervista-zeri] Gabim i papritur te zëri.");
  const p = pamjaEGabimitTeZerit(e);
  if (p.kodi === "kuota") console.error(`[intervista-zeri] kuota: asnjë ofrues zëri i lirë (ditor: ${p.ditor}).`);
  return json({ error: p.mesazhi, kodi: p.kodi, ditor: p.ditor }, p.status);
}

/** Intervista aktive e këtij përdoruesi dhe pyetja aktuale (e fundit, pa përgjigje). Response = gabim për app-in. */
async function lexoIntervisten(
  t: Thirresi,
  intervistaId: string,
  nr: number,
): Promise<
  | (IntervistaEZerit & { kthesa: { nr: number; reagimi: string | null; pyetja: string; pergjigjur_me: string | null } })
  | Response
> {
  const { data: intervista, error } = await t.admin
    .from("intervistat")
    .select("id, gjuha, gjendja, konteksti")
    .eq("id", intervistaId)
    .eq("user_id", t.userId)
    .maybeSingle();
  if (error) {
    console.error("[intervista-zeri] Leximi i intervistës dështoi.");
    return gabim("S'u lexua intervista. Provo përsëri.", 500);
  }
  if (!intervista) return gabim("Intervista nuk u gjet.", 404);
  if (intervista.gjendja !== "aktive") return gabim("Kjo intervistë ka mbaruar.", 409, "mbaroi");

  const { data: eFundit, error: gabimiKthesave } = await t.admin
    .from("intervista_kthesat")
    .select("nr, reagimi, pyetja, pergjigjur_me")
    .eq("intervista_id", intervistaId)
    .eq("user_id", t.userId)
    .order("nr", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (gabimiKthesave || !eFundit) {
    console.error("[intervista-zeri] Leximi i kthesave dështoi.");
    return gabim("S'u lexua intervista. Provo përsëri.", 500);
  }
  if (eFundit.nr !== nr || eFundit.pergjigjur_me) {
    return json({ error: "Kjo pyetje s'është më aktuale.", kodi: "jashte_radhe" }, 409);
  }
  const konteksti = (eshteObjekt(intervista.konteksti) ? intervista.konteksti : {}) as Konteksti;
  return {
    gjuha: intervista.gjuha as Gjuha,
    intervistuesi: intervistuesiNga(konteksti),
    konteksti,
    folesi: folesiPer(t),
    kthesa: eFundit,
  };
}

/** punet.kerkesat (jsonb) e punës së intervistës, për fjalorin e dëgjimit. null kur s'ka ose leximi dështoi. */
async function lexoKerkesatEPunes(t: Thirresi, punaId: unknown): Promise<unknown> {
  if (typeof punaId !== "string") return null;
  const { data, error } = await t.admin.from("punet").select("kerkesat").eq("id", punaId).maybeSingle();
  return error ? null : (data?.kerkesat ?? null);
}

/** Minutat e zërit në 24 orët e fundit; Response 429 nëse kufiri është arritur. */
async function kontrolloKufirin(t: Thirresi): Promise<Response | null> {
  const nje24OreMePare = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await t.admin
    .from("intervista_zeri")
    .select("sekonda_stt, sekonda_tts")
    .eq("user_id", t.userId)
    .gte("krijuar_me", nje24OreMePare);
  if (error) {
    console.error("[intervista-zeri] Numërimi i minutave dështoi.");
    return gabim("Diçka shkoi keq. Provo përsëri.", 500);
  }
  const sekonda = (data ?? []).reduce(
    (s, r) => s + Number(r.sekonda_stt ?? 0) + Number(r.sekonda_tts ?? 0),
    0,
  );
  if (sekonda >= KUFIRI_DITOR_MINUTA_ZERI * 60) {
    return gabim(
      `Ke përdorur ${KUFIRI_DITOR_MINUTA_ZERI} minutat e zërit për sot. Vazhdo me shkrim ose provo nesër.`,
      429,
      "kufiri_zerit",
    );
  }
  return null;
}

/** Shënon përdorimin (edhe kur një hap dështoi: ofruesi e ka faturuar). Dështimi s'e prish përgjigjen. */
async function regjistro(
  t: Thirresi,
  intervistaId: string,
  lloji: "pergjigje" | "fol",
  sekondaStt: number,
  sekondaTts: number,
) {
  const { error } = await t.admin.from("intervista_zeri").insert({
    user_id: t.userId,
    intervista_id: intervistaId,
    lloji,
    sekonda_stt: Math.min(600, Math.round(sekondaStt * 100) / 100),
    sekonda_tts: Math.min(600, Math.round(sekondaTts * 100) / 100),
  });
  if (error) console.error("[intervista-zeri] Përdorimi s'u regjistrua.");
}

/**
 * Teksti i një kthese (reagimi + pyetja, ose reagimi + mbyllja) → NJË audio. Një thirrje për kthesë (jo për fjali):
 * kufijtë e Gemini TTS numërojnë kërkesat, dhe intonacioni mes fjalive del më i natyrshëm. Hedh GabimIZerit.
 */
async function thuaj(
  tekstet: (string | null)[],
  iv: IntervistaEZerit,
): Promise<{ fjalite: FjaliaMeZe[]; sekonda: number; ofruesi?: string }> {
  const teksti = tekstet.filter((t): t is string => !!t && !!t.trim()).map((t) => t.trim()).join(" ");
  if (!teksti) return { fjalite: [], sekonda: 0 };
  const a = await iv.folesi.fol(teksti, iv.gjuha, iv.intervistuesi);
  return { fjalite: [{ teksti, audio_base64: neBase64(a.audio), mime: a.mime }], sekonda: a.sekonda, ofruesi: a.ofruesi };
}

// ---------- Rrjedha NDJSON ----------
type Dergo = (ngjarja: Objekt) => void;
const koduesi = new TextEncoder();

/** Përgjigje me rrjedhë: `pune` shkruan ngjarje; gabimi i papritur bëhet ngjarje "gabim", jo rrjedhë e prerë. */
function rrjedhaNdjson(pune: (d: Dergo) => Promise<void>): Response {
  const rrjedha = new ReadableStream<Uint8Array>({
    async start(c) {
      const d: Dergo = (o) => {
        try {
          c.enqueue(koduesi.encode(`${JSON.stringify(o)}\n`));
        } catch {
          // klienti u shkëput: puna vazhdon që gjendja në DB të mbetet e plotë
        }
      };
      try {
        await pune(d);
      } catch {
        console.error("[intervista-zeri] Gabim i papritur në rrjedhë.");
        d({ e: "gabim", error: "Diçka shkoi keq. Provo përsëri.", kodi: "tjeter", status: 500 });
      }
      try {
        c.close();
      } catch {
        // tashmë e mbyllur
      }
    },
  });
  return new Response(rrjedha, {
    headers: { ...CORS_HEADERS, "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** Copa e parë dërgohet menjëherë; pastaj përbashkohen ~200 ms audio për çdo mesazh (më pak punë për urën e telefonit). */
const COPA_E_PARE_BAJT = 1;
const COPA_BAJT = 9_600;

/** Audio nga ofruesi → copa PCM te `d`. Kthen sekondat e audios. Hedh GabimIZerit. */
async function transmetoZerin(d: Dergo, copat: AsyncGenerator<CopaAudio>): Promise<number> {
  let tampon: Uint8Array[] = [];
  let bajtNeTampon = 0;
  let gjithsej = 0;
  let shkalla = 24_000;
  let ePara = true;
  const fshij = () => {
    if (bajtNeTampon === 0) return;
    const bashku = new Uint8Array(bajtNeTampon);
    let i = 0;
    for (const c of tampon) {
      bashku.set(c, i);
      i += c.length;
    }
    tampon = [];
    bajtNeTampon = 0;
    d({ e: "pcm", b: neBase64(bashku), s: shkalla });
  };
  let ofruesiIThene = false;
  for await (const c of copat) {
    if (!ofruesiIThene && c.ofruesi) {
      // App-i e ruan pranimin e shkurtër veç për çdo ofrues, që zëri të mos ndryshojë mes pranimit dhe pyetjes.
      d({ e: "zeri_nga", ofruesi: c.ofruesi });
      ofruesiIThene = true;
    }
    shkalla = c.shkalla;
    tampon.push(c.pcm);
    bajtNeTampon += c.pcm.length;
    gjithsej += c.pcm.length;
    if (bajtNeTampon >= (ePara ? COPA_E_PARE_BAJT : COPA_BAJT)) {
      ePara = false;
      fshij();
    }
  }
  fshij();
  return gjithsej / 2 / shkalla;
}

/** Zëri i një teksti si rrjedhë copash (ofruesit pa rrjedhë japin një copë të vetme). */
async function* copatE(teksti: string, iv: IntervistaEZerit): AsyncGenerator<CopaAudio> {
  if (iv.folesi.rrjedhe) {
    yield* iv.folesi.rrjedhe(teksti, iv.gjuha, iv.intervistuesi);
    return;
  }
  const a = await iv.folesi.fol(teksti, iv.gjuha, iv.intervistuesi);
  const wav = lexoWav(a.audio);
  if (!wav) throw new GabimIZerit("Zëri doli bosh. Provo përsëri.");
  yield { pcm: new Uint8Array(wav.mostrat.buffer, wav.mostrat.byteOffset, wav.mostrat.byteLength), shkalla: wav.shkalla };
}

const bashkoTekstet = (tekstet: (string | null)[]) =>
  tekstet
    .filter((t): t is string => !!t && !!t.trim())
    .map((t) => t.trim())
    .join(" ");

// ---------- 2) Zëri i pyetjes aktuale ----------
async function fol(t: Thirresi, b: Objekt): Promise<Response> {
  const intervistaId = b.intervista_id;
  if (typeof intervistaId !== "string" || !UUID.test(intervistaId)) return gabim("Mungon intervista.", 400);
  if (typeof b.nr !== "number" || !Number.isInteger(b.nr) || b.nr < 1) return gabim("Mungon numri i pyetjes.", 400);

  const iv = await lexoIntervisten(t, intervistaId, b.nr);
  if (iv instanceof Response) return iv;
  const kufiri = await kontrolloKufirin(t);
  if (kufiri) return kufiri;

  const pjesa = b.pjesa;
  if (pjesa !== undefined && pjesa !== "reagimi" && pjesa !== "pyetja" && pjesa !== "mbushesi") {
    return gabim("Kërkesa nuk është e vlefshme.", 400);
  }
  const tekstet =
    pjesa === "reagimi"
      ? [iv.kthesa.reagimi]
      : pjesa === "pyetja"
        ? [iv.kthesa.pyetja]
        : pjesa === "mbushesi"
          ? [MBUSHESIT[iv.gjuha]]
          : [iv.kthesa.reagimi, iv.kthesa.pyetja];
  if (b.rrjedhe === true) {
    const teksti = bashkoTekstet(tekstet);
    if (!teksti) return rrjedhaNdjson((d) => Promise.resolve(d({ e: "mbaroi" })));
    // Copa e parë merret para përgjigjes: një gabim i ofruesit del si status HTTP, si më parë.
    const copat = copatE(teksti, iv);
    let e1: IteratorResult<CopaAudio>;
    try {
      e1 = await copat.next();
    } catch (e) {
      return gabimIZerit(e);
    }
    if (e1.done) return gabimIZerit(new GabimIZerit("Zëri doli bosh. Provo përsëri."));
    const copaEPare = e1.value;
    async function* meCopenEPare(): AsyncGenerator<CopaAudio> {
      yield copaEPare;
      yield* copat;
    }
    return rrjedhaNdjson(async (d) => {
      let sekonda = 0;
      try {
        sekonda = await transmetoZerin(d, meCopenEPare());
      } catch (e) {
        d(ngjarjaEGabimitTeZerit(e));
      }
      await regjistro(t, intervistaId, "fol", 0, sekonda);
      d({ e: "mbaroi" });
    });
  }
  try {
    const { fjalite, sekonda, ofruesi } = await thuaj(tekstet, iv);
    await regjistro(t, intervistaId, "fol", 0, sekonda);
    return json({ zeri: { fjalite, ofruesi } });
  } catch (e) {
    return gabimIZerit(e);
  }
}

// ---------- 1) Përgjigjja me zë ----------
async function pergjigju(t: Thirresi, req: Request): Promise<Response> {
  const gjatesia = Number(req.headers.get("content-length") ?? "0");
  if (gjatesia > MAKS_BAJT_AUDIO + 64 * 1024) return gabim("Përgjigjja me zë është shumë e gjatë.", 413);

  let forma: FormData;
  try {
    forma = await req.formData();
  } catch {
    return gabim("Kërkesa nuk është e vlefshme.", 400);
  }
  const intervistaId = forma.get("intervista_id");
  const nr = Number(forma.get("nr"));
  const skedari = forma.get("audio");
  if (typeof intervistaId !== "string" || !UUID.test(intervistaId)) return gabim("Mungon intervista.", 400);
  if (!Number.isInteger(nr) || nr < 1) return gabim("Mungon numri i pyetjes.", 400);
  if (!(skedari instanceof File) || skedari.size === 0) return gabim("Mungon zëri i përgjigjes.", 400);
  if (skedari.size > MAKS_BAJT_AUDIO) return gabim("Përgjigjja me zë është shumë e gjatë.", 413);

  const iv = await lexoIntervisten(t, intervistaId, nr);
  if (iv instanceof Response) return iv;
  // Kërkesat e shpalljes për fjalorin e dëgjimit lexohen njëkohësisht me kufirin; pa to dëgjimi punon me pjesën tjetër.
  const [kufiri, kerkesat] = await Promise.all([kontrolloKufirin(t), lexoKerkesatEPunes(t, iv.konteksti.puna?.id)]);
  if (kufiri) return kufiri;

  // ---------- Audio → PCM 16 kHz mono ----------
  const wav = lexoWav(new Uint8Array(await skedari.arrayBuffer()));
  if (!wav || wav.mostrat.length === 0) {
    return gabim("Ky format zëri s'njihet. Provo përsëri ose shkruaje përgjigjen.", 415);
  }
  const pcm = rimostro(wav, SHKALLA_STT);
  const sekonda = pcm.length / SHKALLA_STT;
  if (sekonda > MAKS_SEKONDA_PERGJIGJE) return gabim("Përgjigjja me zë mund të jetë deri në 90 sekonda.", 413);
  if (sekonda < MIN_SEKONDA_PERGJIGJE) return json({ degjuar: false, transkripti: "" });

  // ---------- STT ----------
  let transkripti: string;
  try {
    const fjalori = ndertoPromptinSTT({ konteksti: iv.konteksti, kerkesat });
    transkripti = (await degjuesi.degjo(pcm, iv.gjuha, fjalori)).replace(/\s+/g, " ").trim().slice(0, MAKS_PERGJIGJJA);
    if (eshteJehonaEPromptit(transkripti, fjalori)) transkripti = "";
  } catch (e) {
    if (!(e instanceof GabimIZerit && e.konfigurim)) await regjistro(t, intervistaId, "pergjigje", sekonda, 0);
    return gabimIZerit(e);
  }
  if (!transkripti) {
    await regjistro(t, intervistaId, "pergjigje", sekonda, 0);
    return json({ degjuar: false, transkripti: "" });
  }

  // Raporti duhet ta dijë që disa përgjigje erdhën nga njohja e zërit (një herë për intervistë).
  if (iv.konteksti.zeri !== true) {
    const { error } = await t.admin
      .from("intervistat")
      .update({ konteksti: { ...iv.konteksti, zeri: true } })
      .eq("id", intervistaId)
      .eq("user_id", t.userId);
    if (error) console.error("[intervista-zeri] Shënimi i zërit te konteksti dështoi.");
  }

  if (forma.get("rrjedhe") === "1") {
    return rrjedhaNdjson(async (d) => {
      d({ e: "degjuar", transkripti });
      const nePlan: Promise<unknown>[] = [];
      // Reagimi flitet sapo Claude e mbyll atë fushë (para pyetjes): TTS i tij nis menjëherë dhe copat dalin pa pritur
      // pjesën tjetër të kthesës. Zëri i pyetjes nis kur kthesa mbaron, por pritet derisa reagimi të mbarojë (rendi).
      let reagimiFolur: string | null = null;
      let reagimiMbaroi: Promise<number> = Promise.resolve(0);
      const folReagimin = (teksti: string) => {
        if (reagimiFolur || !teksti.trim()) return;
        reagimiFolur = teksti.trim();
        reagimiMbaroi = transmetoZerin(d, copatE(reagimiFolur, iv)).catch(() => 0); // pa reagim, pyetja del e vetme
      };
      const r = await perpunoKthesen(t, {
        intervistaId,
        nr,
        perfundo: false,
        pergjigja: transkripti,
        meZe: true,
        nePlan: (p) => nePlan.push(p),
        onReagimi: REAGIMI_I_HERSHEM ? folReagimin : undefined,
      });
      if (r.status !== 200) {
        const sekondaReagim = await reagimiMbaroi;
        await regjistro(t, intervistaId, "pergjigje", sekonda, sekondaReagim);
        d({ ...r.trupi, e: "gabim", status: r.status, transkripti });
        return;
      }
      const k = r.trupi;
      d({ ...k, e: "kthesa" });
      const kt = k.fund === true ? null : (k.kthesa as { reagimi: string | null; pyetja: string });
      const reagimiIFunditStr = kt ? kt.reagimi : typeof k.reagimi === "string" ? k.reagimi : null;
      // Nëse reagimi s'u lexua herët (rrjedha s'e dha), thuhet bashkë me pyetjen si më parë.
      const tekstet = [reagimiFolur ? null : reagimiIFunditStr, kt ? kt.pyetja : MBYLLJA[iv.gjuha]];
      const teksti = bashkoTekstet(tekstet);
      const kopatEPyetjes = copatE(teksti, iv);
      const eParaEPyetjes = kopatEPyetjes.next(); // fillon thirrjen te Gemini tani, ndërsa reagimi ende flitet
      eParaEPyetjes.catch(() => {});
      let sekondaTts = await reagimiMbaroi;
      try {
        const e1 = await eParaEPyetjes;
        if (e1.done) throw new GabimIZerit("Zëri doli bosh. Provo përsëri.");
        const copaEPare = e1.value;
        const meCopenEPare = async function* (): AsyncGenerator<CopaAudio> {
          yield copaEPare;
          yield* kopatEPyetjes;
        };
        sekondaTts += await transmetoZerin(d, meCopenEPare());
      } catch (e) {
        d(ngjarjaEGabimitTeZerit(e));
      }
      await regjistro(t, intervistaId, "pergjigje", sekonda, sekondaTts);
      await Promise.allSettled(nePlan); // vlerësimi i përgjigjes mbaron para se kërkesa të mbyllet
      d({ e: "mbaroi" });
    });
  }

  // ---------- Kthesa: i njëjti kod si me shkrim ----------
  const r = await perpunoKthesen(t, { intervistaId, nr, perfundo: false, pergjigja: transkripti, meZe: true });
  if (r.status !== 200) {
    await regjistro(t, intervistaId, "pergjigje", sekonda, 0);
    return json({ ...r.trupi, transkripti }, r.status);
  }

  // ---------- TTS: vetëm për fundin ----------
  const k = r.trupi;
  if (k.fund !== true) {
    // Teksti kthehet menjëherë; app-i e kërkon zërin në dy pjesë paralelisht (shih krye).
    await regjistro(t, intervistaId, "pergjigje", sekonda, 0);
    return json({ degjuar: true, transkripti, ...k, zeri: null });
  }
  const tekstet: (string | null)[] = [typeof k.reagimi === "string" ? k.reagimi : null, MBYLLJA[iv.gjuha]];
  try {
    const z = await thuaj(tekstet, iv);
    await regjistro(t, intervistaId, "pergjigje", sekonda, z.sekonda);
    const fjalite = z.fjalite;
    return json({ degjuar: true, transkripti, ...k, zeri: { fjalite } });
  } catch (e) {
    // Kthesa është ruajtur: app-i e tregon pyetjen si tekst dhe intervista vazhdon.
    await regjistro(t, intervistaId, "pergjigje", sekonda, 0);
    const mesazhi = e instanceof GabimIZerit ? e.message : "Zëri s'u krijua.";
    return json({ degjuar: true, transkripti, ...k, zeri: null, gabimi_zerit: mesazhi });
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return gabim("Metoda nuk lejohet.", 405);

  const t = await kontrolloThirresin(req, ETIKETA_E_THIRRESIT, Number.POSITIVE_INFINITY);
  if (t instanceof Response) return t;

  try {
    const lloji = req.headers.get("content-type") ?? "";
    if (lloji.startsWith("multipart/form-data")) return await pergjigju(t, req);
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return gabim("Kërkesa nuk është e vlefshme.", 400);
    }
    if (eshteObjekt(body) && body.veprimi === "fol") return await fol(t, body);
    return gabim("Kërkesa nuk është e vlefshme.", 400);
  } catch {
    // Pa detaje: mund të përmbajnë përgjigjen e kandidatit.
    console.error("[intervista-zeri] Gabim i papritur.");
    return gabim("Diçka shkoi keq. Provo përsëri.", 500);
  }
});
