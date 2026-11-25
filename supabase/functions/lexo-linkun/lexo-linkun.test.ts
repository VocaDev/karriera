// Provat e lexo-linkun, pa rrjet dhe pa AI (fetch dhe DNS janë të rremë; AI-ja zëvendësohet me një përgjigje të gatshme).
//   deno test --node-modules-dir=none --allow-read=supabase/functions/lexo-linkun/mostrat supabase/functions/lexo-linkun/lexo-linkun.test.ts
// Mostrat (mostrat/*.html) janë faqe të sajuara, të ruajtura si skedarë: një me JobPosting JSON-LD, një pa të, një mur hyrjeje.
import assert from "node:assert/strict";

import { pastroPergjigjen, type PergjigjjaELinkut } from "./ai.ts";
import { merrFaqen } from "./faqja.ts";
import { eshteIPPublike, hostiIHapshem, kontrolloLinkun, rojaESSRF, type ZgjidhAdresat } from "./linku.ts";
import { MIN_TEKST, nxirrNgaHtml } from "./nxirr.ts";

const mostra = (emri: string) => Deno.readTextFileSync(new URL(`./mostrat/${emri}`, import.meta.url));

// ---------------------------------------------------------------- Nxjerrja

Deno.test("JobPosting JSON-LD (brenda @graph): titulli, kompania, qyteti dhe teksti nga JSON-LD", () => {
  const nx = nxirrNgaHtml(mostra("me-jsonld.html"));
  assert.equal(nx.burimi, "jsonld");
  assert.equal(nx.titulli, "Junior Frontend Developer");
  assert.equal(nx.kompania, "Drita Tech Sh.p.k.");
  assert.equal(nx.qyteti, "Prishtinë"); // "Prishtina" normalizohet si te portalet
  assert.match(nx.teksti, /Ndërton ekrane të reja me React dhe TypeScript/);
  assert.match(nx.teksti, /Përvojë me Git/);
  assert.match(nx.teksti, /Employment type: FULL_TIME/);
  assert.doesNotMatch(nx.teksti, /<li>|&lt;/); // HTML-ja e përshkrimit u kthye në tekst
  console.log(`  me-jsonld: ${nx.teksti.length} shkronja tekst për AI-në`);
});

Deno.test("Faqe pa JSON-LD: teksti i <article>, pa menu, cookie, skripte, aside e footer", () => {
  const nx = nxirrNgaHtml(mostra("pa-jsonld.html"));
  assert.equal(nx.burimi, "faqja");
  assert.equal(nx.titulli, null); // AI-ja e nxjerr nga teksti
  assert.equal(nx.titulliIFaqes, "Office Assistant (m/f) - Lumi Logistics GmbH");
  assert.match(nx.teksti, /Answer phone calls and emails/);
  assert.match(nx.teksti, /Good command of MS Office/);
  for (const jo of ["Accept cookies", "dataLayer", "Other jobs", "Rruga e Shkronjave", "font-family"]) {
    assert.ok(!nx.teksti.includes(jo), `teksti s'duhet të ketë "${jo}"`);
  }
  assert.ok(nx.teksti.length >= MIN_TEKST);
  console.log(`  pa-jsonld: ${nx.teksti.length} shkronja tekst për AI-në`);
});

Deno.test("Mur hyrjeje: tekst më pak se MIN_TEKST, AI-ja s'thirret", () => {
  const nx = nxirrNgaHtml(mostra("mur-hyrjeje.html"));
  assert.equal(nx.burimi, "faqja");
  assert.ok(nx.teksti.length < MIN_TEKST, `teksti: ${nx.teksti.length}`);
});

Deno.test("Përgjigjja e AI-së: kërkesat në formën e portalet; kontakti dhe kopjimi hidhen; jo-shpallja = null", () => {
  const teksti = nxirrNgaHtml(mostra("pa-jsonld.html")).teksti;
  const ai: PergjigjjaELinkut = {
    eshte_shpallje: true,
    titulli: "Office Assistant (m/f)",
    kompania: "Lumi Logistics GmbH",
    qyteti: "Prizren",
    permbledhja: "Asistent zyre në një kompani transporti në Prizren, që mbështet zyrën dhe ekipin e dërgesave.",
    detyrat: ["Përgjigjet në telefonata dhe email-e të klientëve", "Përgatit dokumentet e dërgesave"],
    // e dyta është kopjuar fjalë për fjalë (11+ fjalë) dhe hidhet
    kerkesat: ["MS Office, sidomos Excel dhe Word", "Answer phone calls and emails from customers and drivers prepare delivery"],
    perparesi: ["Gjermanisht"],
    arsimi: "Shkollë e mesme",
    pervoja: null,
    gjuhet: ["Shqip (rrjedhshëm)", "Anglisht (mirë)"],
    orari: "Kohë e plotë",
    paga: "550–650 EUR neto",
    perfitimet: ["Trajnim i paguar"],
    aplikimi: "Dërgo CV-në te jobs@lumi-logistics.example.org", // me email: hidhet
  };
  const f = pastroPergjigjen(ai, teksti);
  assert.equal(f.eshteShpallje, true);
  assert.equal(f.titulli, "Office Assistant (m/f)");
  assert.equal(f.kompania, "Lumi Logistics GmbH");
  assert.ok(f.kerkesat);
  assert.deepEqual(f.kerkesat.kerkesat, ["MS Office, sidomos Excel dhe Word"]);
  assert.equal(f.kerkesat.aplikimi, null);
  assert.equal(f.kerkesat.paga, "550–650 EUR neto");

  const jo = pastroPergjigjen({ ...ai, eshte_shpallje: false }, teksti);
  assert.deepEqual(jo, { eshteShpallje: false, titulli: null, kompania: null, qyteti: null, kerkesat: null });
});

// ---------------------------------------------------------------- SSRF

Deno.test("SSRF: linqet që app-i dhe serveri i refuzojnë", () => {
  for (const l of [
    "http://kosovajob.com/pune/1",
    "https://127.0.0.1/admin",
    "https://169.254.169.254/latest/meta-data",
    "https://[::1]/",
    "https://localhost/x",
    "https://db.internal/x",
    "https://user:pass@kosovajob.com/x",
    "file:///etc/passwd",
    "ftp://kosovajob.com/x",
    "https://kosovajob",
  ]) {
    assert.equal(kontrolloLinkun(l).ok, false, l);
  }
  assert.deepEqual(kontrolloLinkun("kosovajob.com/pune/1/?utm_source=fb&id=2#x"), { ok: true, linku: "https://kosovajob.com/pune/1?id=2" });
  // Serveri hap vetëm portin 443, edhe kur app-i e ruan linkun me port tjetër.
  assert.equal(hostiIHapshem(new URL("https://kosovajob.com:8443/x")), null);
  assert.equal(hostiIHapshem(new URL("https://kosovajob.com/x")), "kosovajob.com");
});

Deno.test("SSRF: adresat IP jo-publike (IPv4, IPv6, IPv4 brenda IPv6)", () => {
  for (const ip of [
    "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0",
    "224.0.0.1", "255.255.255.255", "198.18.0.1", "::1", "::", "fe80::1", "fc00::1", "fd12:3456::1", "::ffff:10.0.0.1",
    "::ffff:7f00:1", "64:ff9b::a00:1", "2002:a00:1::", "2001:db8::1", "2001:0:4136:e378::1", "ff02::1", "jo-ip",
  ]) {
    assert.equal(eshteIPPublike(ip), false, ip);
  }
  for (const ip of ["8.8.8.8", "172.32.0.1", "104.18.1.1", "2606:4700::1111", "::ffff:8.8.8.8"]) {
    assert.equal(eshteIPPublike(ip), true, ip);
  }
});

const dnsIRreme = (harta: Record<string, string[]>): ZgjidhAdresat => (hosti) =>
  harta[hosti] ? Promise.resolve(harta[hosti]) : Promise.reject(new Error("NXDOMAIN"));

Deno.test("SSRF: domen publik që zgjidhet në IP private refuzohet (edhe kur një nga adresat është publike)", async () => {
  const dns = dnsIRreme({ "mire.com": ["104.18.1.1"], "keq.com": ["10.0.0.5"], "perzier.com": ["104.18.1.1", "127.0.0.1"] });
  assert.equal(await rojaESSRF(new URL("https://mire.com/x"), dns), null);
  assert.equal(await rojaESSRF(new URL("https://keq.com/x"), dns), "ip_jo_publike");
  assert.equal(await rojaESSRF(new URL("https://perzier.com/x"), dns), "ip_jo_publike");
  assert.equal(await rojaESSRF(new URL("https://sska.com/x"), dns), "dns");
});

// ---------------------------------------------------------------- Kërkesa te faqja (fetch i rremë)

type Thirrja = { url: string; init?: RequestInit };
function fetchIRreme(pergjigjet: Record<string, () => Response>, thirrjet: Thirrja[]): typeof fetch {
  return ((input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    thirrjet.push({ url, init });
    const p = pergjigjet[url];
    return p ? Promise.resolve(p()) : Promise.reject(new TypeError("lidhja dështoi"));
  }) as typeof fetch;
}
const html = (trupi: string) => new Response(trupi, { headers: { "content-type": "text/html; charset=utf-8" } });
const ridrejto = (te: string) => new Response(null, { status: 302, headers: { location: te } });

Deno.test("Kërkesa: ridrejtim te një host privat ndalet para kërkesës së dytë", async () => {
  const thirrjet: Thirrja[] = [];
  const r = await merrFaqen("https://mire.com/pune", {
    zgjidh: dnsIRreme({ "mire.com": ["104.18.1.1"], "keq.com": ["10.0.0.5"] }),
    fetch: fetchIRreme({ "https://mire.com/pune": () => ridrejto("https://keq.com/admin") }, thirrjet),
  });
  assert.deepEqual(r.ok ? null : r.arsyeja, "ssrf");
  assert.equal(thirrjet.length, 1); // keq.com s'u thirr kurrë
  assert.equal(thirrjet[0].init?.redirect, "manual");
  assert.equal(thirrjet[0].init?.credentials, "omit");
  assert.match(String((thirrjet[0].init?.headers as Record<string, string>)["User-Agent"]), /^KarrieraBot\//);
});

Deno.test("Kërkesa: ridrejtim te http:// ose te IP refuzohet; ridrejtimi relativ ndiqet", async () => {
  for (const te of ["http://mire.com/pune", "https://127.0.0.1/", "https://[::1]/"]) {
    const thirrjet: Thirrja[] = [];
    const r = await merrFaqen("https://mire.com/a", {
      zgjidh: dnsIRreme({ "mire.com": ["104.18.1.1"] }),
      fetch: fetchIRreme({ "https://mire.com/a": () => ridrejto(te) }, thirrjet),
    });
    assert.equal(r.ok ? null : r.arsyeja, "ssrf", te);
    assert.equal(thirrjet.length, 1, te);
  }
  const thirrjet: Thirrja[] = [];
  const r = await merrFaqen("https://mire.com/a", {
    zgjidh: dnsIRreme({ "mire.com": ["104.18.1.1"] }),
    fetch: fetchIRreme({ "https://mire.com/a": () => ridrejto("/b"), "https://mire.com/b": () => html("<p>ok</p>") }, thirrjet),
  });
  assert.equal(r.ok && r.urlFundit, "https://mire.com/b");
});

Deno.test("Kërkesa: shumë ridrejtime, jo-HTML, 999 e LinkedIn-it, koha dhe kufiri 1 MB", async () => {
  const dns = dnsIRreme({ "mire.com": ["104.18.1.1"], "www.linkedin.com": ["13.107.42.14"] });
  const rreth = await merrFaqen("https://mire.com/a", { zgjidh: dns, fetch: fetchIRreme({ "https://mire.com/a": () => ridrejto("/a") }, []) });
  assert.equal(rreth.ok ? null : rreth.arsyeja, "ridrejtime");

  const pdf = await merrFaqen("https://mire.com/a.pdf", {
    zgjidh: dns,
    fetch: fetchIRreme({ "https://mire.com/a.pdf": () => new Response("%PDF-", { headers: { "content-type": "application/pdf" } }) }, []),
  });
  assert.equal(pdf.ok ? null : pdf.arsyeja, "jo_html");

  const li = await merrFaqen("https://www.linkedin.com/jobs/view/123", {
    zgjidh: dns,
    // `new Response` s'pranon 999 (jashtë 200–599), ndaj e vendosim me dorë. Nëse fetch-i i vërtetë hedh gabim te 999,
    // arsyeja bëhet "rrjeti", dhe index.ts e tregon prapë si mur hyrjeje të LinkedIn-it.
    fetch: fetchIRreme({ "https://www.linkedin.com/jobs/view/123": () => Object.defineProperty(new Response(""), "status", { value: 999 }) }, []),
  });
  assert.deepEqual(li.ok ? null : [li.arsyeja, li.status], ["http", 999]);

  const ngadale: typeof fetch = (_u, init) =>
    new Promise((_zgjidh, refuzo) => init?.signal?.addEventListener("abort", () => refuzo(init.signal?.reason)));
  const koha = await merrFaqen("https://mire.com/a", { zgjidh: dns, fetch: ngadale, kohaMs: 50 });
  assert.equal(koha.ok ? null : koha.arsyeja, "koha");

  const madhe = await merrFaqen("https://mire.com/a", {
    zgjidh: dns,
    maksBajt: 1024,
    fetch: fetchIRreme({ "https://mire.com/a": () => html("x".repeat(5000)) }, []),
  });
  assert.equal(madhe.ok && madhe.html.length, 1024);
});
