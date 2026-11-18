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
import { CORS_HEADERS, json, kontrolloThirresin, type Thirresi } from "../_shared/thirresi.ts";
import {
  type Degjuesi,
  MBUSHESIT,
  type Folesi,
  GabimIZerit,
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
import { gemini } from "../_shared/zeri-gemini.ts";
import { groq } from "../_shared/zeri-groq.ts";

// Ofruesit, secili pas përshtatësit të vet (zeri.ts): ndërrohen këtu.
const degjuesi: Degjuesi = groq();
const folesi: Folesi = gemini();

type Objekt = Record<string, unknown>;
const eshteObjekt = (v: unknown): v is Objekt => typeof v === "object" && v !== null && !Array.isArray(v);

type FjaliaMeZe = { teksti: string; audio_base64: string; mime: string };
type IntervistaEZerit = { gjuha: Gjuha; intervistuesi: Intervistuesi; konteksti: Konteksti };

function gabimIZerit(e: unknown): Response {
  if (e instanceof GabimIZerit) {
    return e.konfigurim ? gabim(e.message, 503, "zeri_pa_konfigurim") : gabim(e.message, 502, "zeri");
  }
  console.error("[intervista-zeri] Gabim i papritur te zëri.");
  return gabim("Zëri dështoi. Provo përsëri ose vazhdo me shkrim.", 502, "zeri");
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
    kthesa: eFundit,
  };
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
async function thuaj(tekstet: (string | null)[], iv: IntervistaEZerit): Promise<{ fjalite: FjaliaMeZe[]; sekonda: number }> {
  const teksti = tekstet.filter((t): t is string => !!t && !!t.trim()).map((t) => t.trim()).join(" ");
  if (!teksti) return { fjalite: [], sekonda: 0 };
  const a = await folesi.fol(teksti, iv.gjuha, iv.intervistuesi);
  return { fjalite: [{ teksti, audio_base64: neBase64(a.audio), mime: a.mime }], sekonda: a.sekonda };
}

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
  try {
    const { fjalite, sekonda } = await thuaj(tekstet, iv);
    await regjistro(t, intervistaId, "fol", 0, sekonda);
    return json({ zeri: { fjalite } });
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
  const kufiri = await kontrolloKufirin(t);
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
    transkripti = (await degjuesi.degjo(pcm, iv.gjuha)).replace(/\s+/g, " ").trim().slice(0, MAKS_PERGJIGJJA);
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
