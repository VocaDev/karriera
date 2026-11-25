// Një kërkesë e vetme, e nisur nga përdoruesi, te faqja e shpalljes. Jo crawler: s'ndjek linqe, s'lexon robots.txt
// (si shfletuesi kur përdoruesi e hap vetë linkun), s'dërgon cookies dhe s'hyn në llogari. Rojet:
//   - SSRF: rojaESSRF para kërkesës së parë DHE para çdo ridrejtimi (ridrejtimet ndiqen me dorë, maksimumi 4)
//   - koha: 8 s gjithsej (ridrejtimet + leximi i trupit)
//   - madhësia: lexohet maksimumi 1 MB; pjesa tjetër hidhet (JSON-LD dhe teksti janë zakonisht në fillim)
//   - vetëm HTML
import { rojaESSRF, type ZgjidhAdresat } from "./linku.ts";

export const USER_AGENT = "KarrieraBot/0.1 (university course project; reads one job page when a user pastes its link)";
export const KOHA_MS = 8_000;
export const MAKS_BAJT = 1024 * 1024;
const MAKS_RIDREJTIME = 4;

export type ArsyejaEDeshtimit =
  | "ssrf" // linku ose një ridrejtim çon te një adresë jo-publike
  | "koha" // s'u përgjigj brenda 8 s
  | "http" // status jo 2xx (403, 404, 999 i LinkedIn-it, ...)
  | "jo_html" // PDF, imazh, JSON...
  | "ridrejtime" // shumë ridrejtime
  | "rrjeti"; // DNS, TLS, lidhja

export type FaqjaELexuar =
  | { ok: true; html: string; urlFundit: string; status: number }
  | { ok: false; arsyeja: ArsyejaEDeshtimit; status?: number; urlFundit?: string };

export type Opsionet = { zgjidh: ZgjidhAdresat; fetch?: typeof fetch; kohaMs?: number; maksBajt?: number };

/** Lexon trupin deri në `maks` bajt; pjesa tjetër anulohet. */
async function lexoTrupin(res: Response, maks: number): Promise<Uint8Array> {
  if (!res.body) return new Uint8Array();
  const lexuesi = res.body.getReader();
  const copat: Uint8Array[] = [];
  let gjithsej = 0;
  for (;;) {
    const { done, value } = await lexuesi.read();
    if (done) break;
    const mbetet = maks - gjithsej;
    copat.push(value.length > mbetet ? value.subarray(0, mbetet) : value);
    gjithsej += Math.min(value.length, mbetet);
    if (gjithsej >= maks) {
      await lexuesi.cancel().catch(() => {});
      break;
    }
  }
  const dalja = new Uint8Array(gjithsej);
  let i = 0;
  for (const c of copat) {
    dalja.set(c, i);
    i += c.length;
  }
  return dalja;
}

/** Kodimi nga Content-Type ose <meta charset>, përndryshe UTF-8. */
function dekodoHtml(bajtet: Uint8Array, contentType: string): string {
  const ngaKoka = /charset=["']?([\w-]+)/i.exec(contentType)?.[1];
  const fillimi = new TextDecoder("latin1").decode(bajtet.subarray(0, 2048));
  const ngaMeta = /<meta[^>]+charset=["']?([\w-]+)/i.exec(fillimi)?.[1];
  for (const etiketa of [ngaKoka, ngaMeta, "utf-8"]) {
    if (!etiketa) continue;
    try {
      return new TextDecoder(etiketa.toLowerCase()).decode(bajtet);
    } catch {
      // etiketë e panjohur: provojmë tjetrën
    }
  }
  return new TextDecoder().decode(bajtet);
}

export async function merrFaqen(linku: string, op: Opsionet): Promise<FaqjaELexuar> {
  const merr = op.fetch ?? fetch;
  const sinjali = AbortSignal.timeout(op.kohaMs ?? KOHA_MS);
  let url = new URL(linku);
  try {
    for (let hapi = 0; hapi <= MAKS_RIDREJTIME; hapi++) {
      if (await rojaESSRF(url, op.zgjidh)) return { ok: false, arsyeja: "ssrf", urlFundit: url.href };
      const res = await merr(url.href, {
        method: "GET",
        redirect: "manual",
        credentials: "omit",
        signal: sinjali,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
          "Accept-Language": "sq,en;q=0.8,de;q=0.6",
        },
      });
      if (res.status >= 300 && res.status < 400) {
        const vendi = res.headers.get("location");
        await res.body?.cancel().catch(() => {});
        if (!vendi) return { ok: false, arsyeja: "http", status: res.status, urlFundit: url.href };
        url = new URL(vendi, url); // ridrejtimi relativ; kontrollohet në fillim të ciklit
        continue;
      }
      if (res.status < 200 || res.status >= 300) {
        await res.body?.cancel().catch(() => {});
        return { ok: false, arsyeja: "http", status: res.status, urlFundit: url.href };
      }
      const lloji = res.headers.get("content-type") ?? "";
      if (lloji && !/html/i.test(lloji)) {
        await res.body?.cancel().catch(() => {});
        return { ok: false, arsyeja: "jo_html", status: res.status, urlFundit: url.href };
      }
      const bajtet = await lexoTrupin(res, op.maksBajt ?? MAKS_BAJT);
      return { ok: true, html: dekodoHtml(bajtet, lloji), urlFundit: url.href, status: res.status };
    }
    return { ok: false, arsyeja: "ridrejtime", urlFundit: url.href };
  } catch (e) {
    const emri = e instanceof Error ? e.name : "";
    return { ok: false, arsyeja: emri === "TimeoutError" || emri === "AbortError" ? "koha" : "rrjeti", urlFundit: url.href };
  }
}
