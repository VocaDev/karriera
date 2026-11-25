// Linku që ngjit përdoruesi: të njëjtat rregulla si `kontrolloLinkun` te src/lib/punet.ts (app-i s'është roje: serveri i
// kontrollon vetë), plus rojet e serverit kundër SSRF: vetëm porti 443 dhe asnjë adresë IP jo-publike pas DNS-it.
// Pa API të Deno-s këtu (përveç `zgjidhAdresat`, që e merr si argument): testohet pa rrjet.

/** Kufiri i kolonës punet.linku (migrimi 20261118100000). */
export const MAKS_LINKU = 500;

const GJURMIMI = /^(utm_[a-z]+|fbclid|gclid|dclid|msclkid|igshid|mc_cid|mc_eid|_ga|ref_src)$/i;
const EMRAT_E_BRENDSHEM = /(^|\.)(localhost|local|internal|intranet|lan|home|corp|test|invalid|example)$/i;
const DOMENI = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.([a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;

export type LinkuIKontrolluar = { ok: true; linku: string } | { ok: false; gabimi: string };

/** E njëjta logjikë dhe të njëjtat fjali si `kontrolloLinkun` në app. Kthen linkun në formën kanonike. */
export function kontrolloLinkun(teksti: string): LinkuIKontrolluar {
  let s = teksti.trim();
  if (!s) return { ok: false, gabimi: "Ngjit linkun e shpalljes." };
  if (/\s/.test(s)) return { ok: false, gabimi: "Linku s'duhet të ketë hapësira. Kopjoje përsëri nga shfletuesi." };
  if (/^http:\/\//i.test(s)) return { ok: false, gabimi: "Linku duhet të fillojë me https:// (lidhje e sigurt)." };
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = `https://${s}`;
  const pjeset = /^https:\/\/([^/?#]+)([^?#]*)(\?[^#]*)?(#.*)?$/i.exec(s);
  if (!pjeset) return { ok: false, gabimi: "Ky s'duket si link i një faqeje (https://...)." };
  const [, autoriteti, rruga, pyetja] = pjeset;
  if (autoriteti.includes("@")) return { ok: false, gabimi: "Linku s'duhet të ketë emër përdoruesi apo fjalëkalim." };

  const hp = /^([^:]+)(?::(\d{1,5}))?$/.exec(autoriteti);
  if (!hp) return { ok: false, gabimi: "Adresa e faqes s'është e saktë." };
  const domeni = hp[1].toLowerCase().replace(/\.$/, "");
  const porti = hp[2] && hp[2] !== "443" ? `:${hp[2]}` : "";
  if (/^\d+(\.\d+){3}$/.test(domeni) || domeni.startsWith("[")) {
    return { ok: false, gabimi: "Përdor linkun me emrin e faqes, jo me adresë IP." };
  }
  if (!DOMENI.test(domeni) || EMRAT_E_BRENDSHEM.test(domeni)) {
    return { ok: false, gabimi: "Ky s'duket si link i një faqeje publike." };
  }

  const rrugaPa = rruga.length > 1 ? rruga.replace(/\/+$/, "") : "";
  const parametrat = (pyetja ?? "")
    .slice(1)
    .split("&")
    .filter((p) => p && !GJURMIMI.test(p.split("=")[0]));
  const linku = `https://${domeni}${porti}${rrugaPa}${parametrat.length ? `?${parametrat.join("&")}` : ""}`;
  if (linku.length > MAKS_LINKU) return { ok: false, gabimi: "Linku është shumë i gjatë (maksimumi 500 shkronja)." };
  return { ok: true, linku };
}

/**
 * A lejohet serveri ta hapë këtë URL (linku i parë ose një ridrejtim)? Vetëm https, emër domeni publik (jo IP, jo emra
 * të brendshëm), pa "user:pass@" dhe vetëm porti 443. Kthen hostin, ose null.
 */
export function hostiIHapshem(url: URL): string | null {
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (url.port && url.port !== "443") return null;
  const hosti = url.hostname.toLowerCase().replace(/\.$/, "");
  if (/^\d+(\.\d+){3}$/.test(hosti) || hosti.startsWith("[") || hosti.includes(":")) return null;
  if (!DOMENI.test(hosti) || EMRAT_E_BRENDSHEM.test(hosti)) return null;
  return hosti;
}

// ---------------------------------------------------------------- Adresat IP

function ipv4(a: string): number[] | null {
  const p = a.split(".");
  if (p.length !== 4) return null;
  const n = p.map((x) => (/^\d{1,3}$/.test(x) ? Number(x) : NaN));
  return n.every((x) => x >= 0 && x <= 255) ? n : null;
}

/** IPv4 publike? Jo: 0/8, 10/8, 100.64/10, 127/8, 169.254/16, 172.16/12, 192.0.0/24, 192.0.2/24, 192.168/16, 198.18/15, 198.51.100/24, 203.0.113/24, 224/4 e lart. */
function ipv4Publike(n: number[]): boolean {
  const [a, b, c] = n;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

/** IPv6 → 8 numra 16-bitësh, ose null. Pranon "::" dhe një IPv4 në fund (::ffff:10.0.0.1). */
function ipv6(a: string): number[] | null {
  let s = a.toLowerCase().replace(/^\[|\]$/g, "").replace(/%.*$/, "");
  const v4 = /(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (v4) {
    const n = ipv4(v4[1]);
    if (!n) return null;
    s = s.slice(0, -v4[1].length) + `${((n[0] << 8) | n[1]).toString(16)}:${((n[2] << 8) | n[3]).toString(16)}`;
  }
  const dy = s.split("::");
  if (dy.length > 2) return null;
  const pjese = (x: string) => (x ? x.split(":") : []);
  const majtas = pjese(dy[0]);
  const djathtas = dy.length === 2 ? pjese(dy[1]) : [];
  const mungojne = 8 - majtas.length - djathtas.length;
  if (dy.length === 1 ? mungojne !== 0 : mungojne < 1) return null;
  const te = [...majtas, ...Array(dy.length === 2 ? mungojne : 0).fill("0"), ...djathtas];
  const n = te.map((x) => (/^[0-9a-f]{1,4}$/.test(x) ? parseInt(x, 16) : NaN));
  return n.length === 8 && n.every((x) => !Number.isNaN(x)) ? n : null;
}

/** IPv6 publike? Vetëm 2000::/3, pa dokumentimin, Teredo, 6to4 me IPv4 private, dhe IPv4 e futur brenda (::ffff:, 64:ff9b::). */
function ipv6Publike(n: number[]): boolean {
  const v4 = (h: number, l: number) => [h >> 8, h & 0xff, l >> 8, l & 0xff];
  if (n.slice(0, 5).every((x) => x === 0) && n[5] === 0xffff) return ipv4Publike(v4(n[6], n[7]));
  if (n[0] === 0x64 && n[1] === 0xff9b) return ipv4Publike(v4(n[6], n[7]));
  if ((n[0] & 0xe000) !== 0x2000) return false; // jo global unicast: ::1, fc00::/7, fe80::/10, ff00::/8, ::
  if (n[0] === 0x2001 && n[1] === 0x0db8) return false; // dokumentimi
  if (n[0] === 0x2001 && n[1] === 0) return false; // Teredo
  if (n[0] === 0x2002) return ipv4Publike(v4(n[1], n[2])); // 6to4
  return true;
}

/** Një adresë IP (4 ose 6) që i lejohet serverit ta hapë. Çdo gjë që s'kuptohet = jo. */
export function eshteIPPublike(adresa: string): boolean {
  const a4 = ipv4(adresa);
  if (a4) return ipv4Publike(a4);
  const a6 = ipv6(adresa);
  return a6 ? ipv6Publike(a6) : false;
}

export type ZgjidhAdresat = (hosti: string) => Promise<string[]>;

/** Adresat A + AAAA të hostit me Deno.resolveDns. Pa këtë API (ose pa asnjë adresë) = gabim: s'hapim dot verbërisht. */
export const zgjidhMeDeno: ZgjidhAdresat = async (hosti) => {
  const deno = (globalThis as { Deno?: { resolveDns?: (h: string, t: "A" | "AAAA") => Promise<string[]> } }).Deno;
  if (typeof deno?.resolveDns !== "function") throw new Error("Deno.resolveDns s'është në dispozicion");
  const [a, aaaa] = await Promise.allSettled([deno.resolveDns(hosti, "A"), deno.resolveDns(hosti, "AAAA")]);
  const adresat = [...(a.status === "fulfilled" ? a.value : []), ...(aaaa.status === "fulfilled" ? aaaa.value : [])];
  if (adresat.length === 0) throw new Error("DNS s'ktheu asnjë adresë");
  return adresat;
};

/**
 * Roja e plotë para çdo kërkese (edhe pas çdo ridrejtimi): rregullat e URL-së, pastaj DNS, dhe ÇDO adresë duhet të jetë
 * publike. Kthen null nëse lejohet, përndryshe arsyen (për log-un, pa linkun e përdoruesit).
 * Kufiri i njohur: DNS rebinding (adresa ndryshon mes kontrollit dhe lidhjes) s'mbyllet plotësisht pa kontroll në socket.
 */
export async function rojaESSRF(url: URL, zgjidh: ZgjidhAdresat): Promise<string | null> {
  const hosti = hostiIHapshem(url);
  if (!hosti) return "url_jo_publik";
  let adresat: string[];
  try {
    adresat = await zgjidh(hosti);
  } catch {
    return "dns";
  }
  return adresat.every(eshteIPPublike) ? null : "ip_jo_publike";
}
