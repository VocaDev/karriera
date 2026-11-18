// Faqja e avatarit për WebView-in e intervistës me zë (portuar nga prototipi Karriera-Intervista,
// app/src/spike/intervista-faqja.ts, 10.11). AGENTS.md: avatari (TalkingHead 3D) jeton qëllimisht në WebView.
//
// Çka bën kjo faqe: VETËM flet. Mikrofoni, transkripti, butonat dhe gjendjet janë native (ekrani [id].tsx);
// pa kamerë, pa MediaPipe, pa mikrofon këtu. Faqja s'flet me internetin për intervistën: audio vjen nga app-i
// (postMessage), dhe ngarkon vetëm three.js, TalkingHead dhe modelin nga jsDelivr (versione të ngrira).
//
// Lip-sync: Gemini TTS kthen vetëm audio (WAV), pa vizema dhe pa kohët e fjalëve që jepte edge-tts. Faqja e di
// kohëzgjatjen e saktë të audios pas dekodimit dhe e ndan mes fjalëve sipas peshës (numri i vizemave + pushim te presja
// dhe te fundi i fjalisë), pastaj ia jep TalkingHead-it si në prototip (docs/zeri-ne-app.md §3). Pa thirrje shtesë.
//
// Arbër: s'ka ende model 3D mashkullor, ndaj një unazë neutrale pulson me zërin (pa fytyrë femërore).
// Nëse avatari s'ngarkohet (pa WebGL, pa internet për CDN-në), e njëjta unazë, me zë.
//
// Kujdes: brenda faqes s'përdoren backtick as "${", sepse e gjithë faqja është një String.raw.

/** Modeli i Artës: i njëjti skedar si assets/avatar/arta.glb (blob 01d4e1b), i publikuar te commit-i i ngrirë. */
export const URL_I_MODELIT =
  "https://cdn.jsdelivr.net/gh/VocaDev/karriera@461cbaa47946cba42a087ec58db022fc512b69d0/spike/mpfb-opt.glb";

export const FAQJA_E_AVATARIT = String.raw`<!doctype html>
<html lang="sq">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
<title>Intervistuesi</title>
<script type="importmap">
{ "imports": {
  "three": "https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js",
  "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.186.0/examples/jsm/",
  "talkinghead": "https://cdn.jsdelivr.net/gh/met4citizen/TalkingHead@1.8/modules/talkinghead.mjs"
} }
</script>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-user-select: none; user-select: none; }
  html, body { height: 100%; overflow: hidden; background: var(--sfondi, #F5F5F4); }
  #avatar { position: fixed; inset: 0; pointer-events: none; touch-action: none; }
  #unaza { position: fixed; left: 50%; top: 50%; width: 132px; height: 132px; margin: -66px 0 0 -66px; border-radius: 50%;
    border: 9px solid var(--unaza, #A8A29E); display: flex; align-items: center; justify-content: center;
    font: 700 20px -apple-system, system-ui, sans-serif; color: var(--teksti, #1C1917); will-change: transform; }
  #prek { position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%); min-height: 44px; padding: 0 20px;
    border: 0; border-radius: 22px; font: 600 15px -apple-system, system-ui, sans-serif;
    background: var(--teksti, #1C1917); color: var(--sfondi, #F5F5F4); }
  [hidden] { display: none !important; }
</style>
</head>
<body>
<div id="avatar"></div>
<div id="unaza" hidden></div>
<button id="prek" hidden>Prek për ta dëgjuar</button>

<script type="module">
const $ = (id) => document.getElementById(id);
const pritje = (ms) => new Promise((r) => setTimeout(r, ms));
const URL_MODELI = "__URL_I_MODELIT__";

function teApp(m) { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
window.addEventListener("error", (e) => teApp({ lloji: "gabim", kodi: "faqja", mesazhi: String(e.message || "").slice(0, 200) }));
window.addEventListener("unhandledrejection", (e) => teApp({ lloji: "gabim", kodi: "faqja", mesazhi: String((e.reason && e.reason.message) || e.reason || "").slice(0, 200) }));

// ---------- Zëri: një AudioContext; iPhone-it i themi "playback" (altoparlanti, edhe në Silent) ----------
let head = null, ctxRezerve = null;
function ctx() { return head ? head.audioCtx : (ctxRezerve || (ctxRezerve = new (window.AudioContext || window.webkitAudioContext)())); }
function sesioni() {
  try { if (navigator.audioSession && navigator.audioSession.type !== "playback") navigator.audioSession.type = "playback"; } catch (e) { /* s'ka gjë */ }
}
function prekje() {
  return new Promise((r) => {
    $("prek").hidden = false;
    teApp({ lloji: "prek" });
    $("prek").onclick = () => { $("prek").hidden = true; ctx().resume().finally(r); };
  });
}
async function gatiPerTeFolur() {
  sesioni();
  try { await ctx().resume(); } catch (e) { /* provojmë me prekje */ }
  if (ctx().state !== "running") await prekje();
}

// ---------- Shkronja → vizema (shqip; anglisht/gjermanisht përdorin të njëjtën hartë, mjafton për ritmin) ----------
const DIG = { dh: "TH", th: "TH", gj: "kk", ll: "nn", nj: "nn", rr: "RR", sh: "CH", xh: "CH", zh: "CH", ch: "CH", sch: "CH" };
const ONE = { a: "aa", "ä": "E", e: "E", "ë": "E", i: "I", y: "U", o: "O", "ö": "O", u: "U", "ü": "U",
  b: "PP", p: "PP", m: "PP", f: "FF", v: "FF", w: "FF", d: "DD", t: "DD", n: "nn", l: "nn", k: "kk", g: "kk", q: "kk",
  c: "SS", "ç": "CH", x: "SS", s: "SS", "ß": "SS", z: "SS", r: "RR", j: "I", h: "kk" };
function vizemat(fjala) {
  const w = fjala.toLowerCase().replace(/[^a-zëçäöüß]/g, ""), out = [];
  for (let i = 0; i < w.length; i++) {
    const tre = w.slice(i, i + 3), dy = w.slice(i, i + 2);
    if (DIG[tre]) { out.push(DIG[tre]); i += 2; continue; }
    if (DIG[dy]) { out.push(DIG[dy]); i++; continue; }
    if (ONE[w[i]]) out.push(ONE[w[i]]);
  }
  return out;
}

// Kohët e vlerësuara të fjalëve (ms) brenda një fjalie me kohëzgjatje të njohur.
const HESHTJA_PARA_MS = 80, HESHTJA_PAS_MS = 120;
function kohetEFjaleve(teksti, kohezgjatjaMs) {
  const fjalet = teksti.split(/\s+/).filter((w) => vizemat(w).length > 0);
  const flet = fjalet.map((w) => Math.max(1, vizemat(w).length));
  // Pushimet: një audio mbulon gjithë kthesën (reagimi + pyetja), ndaj fundi i fjalisë ka pushimin më të gjatë.
  const pushim = fjalet.map((w, i) => (i >= fjalet.length - 1 ? 0 : /[.?!…]["”»]?$/.test(w) ? 5 : /[,;:—–-]$/.test(w) ? 2.5 : 0));
  const gjithsej = flet.reduce((a, b) => a + b, 0) + pushim.reduce((a, b) => a + b, 0);
  const koha = Math.max(200, kohezgjatjaMs - HESHTJA_PARA_MS - HESHTJA_PAS_MS);
  const njesia = gjithsej > 0 ? koha / gjithsej : 0;
  const r = { words: [], wtimes: [], wdurations: [], visemes: [], vtimes: [], vdurations: [] };
  let t = HESHTJA_PARA_MS;
  fjalet.forEach((w, i) => {
    const d = flet[i] * njesia;
    r.words.push(w); r.wtimes.push(t); r.wdurations.push(d);
    const v = vizemat(w), hapi = d / v.length;
    v.forEach((x, k) => { r.visemes.push(x); r.vtimes.push(t + k * hapi); r.vdurations.push(hapi); });
    t += d + pushim[i] * njesia;
  });
  return r;
}
function neBajte(b64) { const s = atob(b64), a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a.buffer; }

// ---------- Unaza (Arbër, ose kur avatari s'ngarkohet) ----------
let analizuesi = null;
function pulsoUnazen() {
  const t = new Uint8Array(analizuesi.fftSize);
  const hap = () => {
    analizuesi.getByteTimeDomainData(t);
    let s = 0;
    for (const v of t) s += ((v - 128) / 128) ** 2;
    $("unaza").style.transform = "scale(" + (1 + Math.min(Math.sqrt(s / t.length) * 2.4, 0.3)).toFixed(3) + ")";
    requestAnimationFrame(hap);
  };
  hap();
}
function tregoUnazen(emri) {
  if (head) { try { head.stop(); } catch (e) { /* s'ka gjë */ } head = null; }
  $("avatar").hidden = true;
  $("unaza").textContent = emri;
  $("unaza").hidden = false;
}

// ---------- Mimika ----------
function avatari(fn) { if (head) { try { fn(head); } catch (e) { /* avatari s'e ndal zërin */ } } }
function shpreh(sh) {
  avatari((h) => {
    if (sh === "buzeqeshje") h.setMood("happy");
    else if (sh === "interesim") { h.setMood("neutral"); h.playGesture("😊", 1.8); }
    else if (sh === "empati") { h.setMood("happy"); h.playGesture("yes", 1.3); }
    else h.setMood("neutral");
  });
}

// ---------- Të folurit ----------
let zinxhiri = Promise.resolve();
let burimet = [];        // burimet e unazës, për "ndalo"
let fundiPaAvatar = 0;   // kur mbaron zëri i fundit i unazës
let radha = 0;           // çdo "fol" e re anulon të vjetrën

function poFlet() {
  if (head) return head.isSpeaking || head.speechQueue.length > 0;
  return ctx().currentTime < fundiPaAvatar;
}
async function luaj(f, para) {
  const buf = await ctx().decodeAudioData(neBajte(f.audio_base64));
  if (head) {
    if (para) head.speakMarker(para);
    const k = kohetEFjaleve(f.teksti || "", buf.duration * 1000);
    head.speakAudio(Object.assign({ audio: buf }, k), {});
  } else {
    const burimi = ctx().createBufferSource();
    burimi.buffer = buf;
    if (!analizuesi) { analizuesi = ctx().createAnalyser(); analizuesi.fftSize = 256; analizuesi.connect(ctx().destination); pulsoUnazen(); }
    burimi.connect(analizuesi);
    const fillo = Math.max(ctx().currentTime, fundiPaAvatar);
    burimi.start(fillo);
    burimet.push(burimi);
    fundiPaAvatar = fillo + buf.duration;
  }
}
function ndalo() {
  radha++;
  avatari((h) => h.stopSpeaking());
  burimet.forEach((b) => { try { b.stop(); } catch (e) { /* s'ka gjë */ } });
  burimet = [];
  fundiPaAvatar = 0;
}
// "shto": pjesa vjen pas asaj që po thuhet (p.sh. pyetja pas reagimit), pa e ndërprerë; përndryshe zëvendëson gjithçka.
function fol(m) {
  if (!m.shto) ndalo();
  const kjo = radha;
  const fjalite = Array.isArray(m.fjalite) ? m.fjalite : [];
  zinxhiri = zinxhiri.then(async () => {
    if (kjo !== radha) return;
    await gatiPerTeFolur();
    teApp({ lloji: "foli_filloi", id: m.id });
    let ePara = true;
    for (const f of fjalite) {
      if (kjo !== radha) return;
      if (typeof f.audio_base64 !== "string") continue;
      let para = null;
      if (ePara) {
        ePara = false;
        const sh = m.shprehja;
        para = m.pershendetje ? () => avatari((h) => { h.setMood("happy"); h.playGesture("👋", 1.8); }) : () => shpreh(sh);
      } else if (String(f.teksti || "").trim().endsWith("?") && Math.random() < 0.5) {
        para = () => avatari((h) => h.playGesture(Math.random() < 0.6 ? "side" : "index", 1.6, Math.random() < 0.5));
      }
      try { await luaj(f, para); } catch (e) { teApp({ lloji: "gabim", kodi: "zeri", mesazhi: "Një fjali s'u luajt." }); }
    }
    for (;;) {
      if (kjo !== radha) return;
      if (!poFlet()) { await pritje(200); if (!poFlet()) break; }
      await pritje(100);
    }
    if (kjo === radha) teApp({ lloji: "foli_mbaroi", id: m.id });
  }).catch(() => teApp({ lloji: "foli_mbaroi", id: m.id }));
}

// Kur kandidati flet: avatari e shikon; kur pret përgjigjen e serverit: shikon anash, "po mendon".
function degjon(po) { avatari((h) => { if (po) { h.setMood("neutral"); h.makeEyeContact(4000); } }); }
function mendon() { avatari((h) => { h.lookAhead(900); h.playGesture("🤔", 1.4); }); }

// ---------- Nisja ----------
async function nis(m) {
  const r = document.documentElement.style;
  if (m.ngjyrat) {
    r.setProperty("--sfondi", m.ngjyrat.sfondi);
    r.setProperty("--teksti", m.ngjyrat.teksti);
    r.setProperty("--unaza", m.ngjyrat.unaza);
  }
  if (m.intervistuesi !== "arta") { tregoUnazen(m.emri || ""); teApp({ lloji: "gati", avatari: false }); return; }
  try {
    const { TalkingHead } = await import("talkinghead");
    head = new TalkingHead($("avatar"), { lipsyncModules: ["fi"], cameraView: "upper", cameraRotateEnable: false,
      cameraPanEnable: false, cameraZoomEnable: false, avatarIdleEyeContact: 0.6, avatarSpeakingEyeContact: 0.8 });
    await head.showAvatar({ url: URL_MODELI, body: "F", avatarMood: "neutral", lipsyncLang: "fi", avatarListeningEyeContact: 0.9 });
    teApp({ lloji: "gati", avatari: true });
  } catch (e) {
    tregoUnazen(m.emri || "");
    teApp({ lloji: "gati", avatari: false });
  }
}

function ngaApp(e) {
  let m;
  try { m = JSON.parse(e.data); } catch (er) { return; }
  if (!m || typeof m.lloji !== "string") return;
  if (m.lloji === "nis") nis(m);
  else if (m.lloji === "fol") fol(m);
  else if (m.lloji === "ndalo") ndalo();
  else if (m.lloji === "degjon") degjon(m.po === true);
  else if (m.lloji === "mendon") mendon();
}
window.addEventListener("message", ngaApp);
document.addEventListener("message", ngaApp);
teApp({ lloji: "ngarkuar" });
</script>
</body>
</html>`.replace("__URL_I_MODELIT__", URL_I_MODELIT);
