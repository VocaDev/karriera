// Shfletuesi i sjellshëm: një kërkesë në një kohë për çdo host, pauzë mes kërkesave,
// robots.txt i respektuar (Disallow dhe Crawl-delay për "User-agent: *" ose për emrin tonë),
// User-Agent i ndershëm dhe pa të dhëna personale. Pa API të Deno-s (punon edhe me Node).

export const USER_AGENT = "KarrieraJobsBot/0.1 (university course project; respects robots.txt)";
const EMRI_I_BOTIT = "karrierajobsbot";
const PAUZA_MIN_MS = 2000;
const KOHA_MAKS_MS = 20000;

type Rregullat = { ndalohet: string[]; lejohet: string[]; vonesaMs: number };

function lexoRobots(teksti: string): Rregullat {
  const grupet: { agjentet: string[]; ndalohet: string[]; lejohet: string[]; vonesa: number | null }[] = [];
  let grupi: (typeof grupet)[number] | null = null;
  let ishteRregull = false;
  for (const rreshti of teksti.split(/\r?\n/)) {
    const paster = rreshti.replace(/#.*/, "").trim();
    const i = paster.indexOf(":");
    if (i < 0) continue;
    const celesi = paster.slice(0, i).trim().toLowerCase();
    const vlera = paster.slice(i + 1).trim();
    if (celesi === "user-agent") {
      if (!grupi || ishteRregull) {
        grupi = { agjentet: [], ndalohet: [], lejohet: [], vonesa: null };
        grupet.push(grupi);
        ishteRregull = false;
      }
      grupi.agjentet.push(vlera.toLowerCase());
    } else if (grupi) {
      ishteRregull = true;
      if (celesi === "disallow" && vlera) grupi.ndalohet.push(vlera);
      if (celesi === "allow" && vlera) grupi.lejohet.push(vlera);
      if (celesi === "crawl-delay" && Number.isFinite(Number(vlera))) grupi.vonesa = Number(vlera);
    }
  }
  const imi = grupet.find((g) => g.agjentet.some((a) => a !== "*" && EMRI_I_BOTIT.includes(a)));
  const yll = grupet.filter((g) => g.agjentet.includes("*"));
  const zgjedhur = imi ? [imi] : yll;
  return {
    ndalohet: zgjedhur.flatMap((g) => g.ndalohet),
    lejohet: zgjedhur.flatMap((g) => g.lejohet),
    vonesaMs: Math.max(PAUZA_MIN_MS, ...zgjedhur.map((g) => (g.vonesa ?? 0) * 1000)),
  };
}

function perputhet(rruga: string, modeli: string): boolean {
  const regex = new RegExp(
    "^" +
      modeli
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*")
        .replace(/\\\$$/, "$"),
  );
  return regex.test(rruga);
}

/** Rregulli më i gjatë fiton (si te Google); barazim → Allow. */
function lejohet(r: Rregullat, rruga: string): boolean {
  const nd = r.ndalohet.filter((m) => perputhet(rruga, m)).reduce((a, m) => Math.max(a, m.length), -1);
  const le = r.lejohet.filter((m) => perputhet(rruga, m)).reduce((a, m) => Math.max(a, m.length), -1);
  return nd < 0 || le >= nd;
}

const pret = (ms: number) => new Promise((zgjidh) => setTimeout(zgjidh, ms));

export class GabimRobots extends Error {}

export class Shfletuesi {
  private rregullat = new Map<string, Rregullat>();
  private eFundit = new Map<string, number>();
  kerkesat = 0;

  private log: (m: string) => void;

  constructor(log: (m: string) => void = () => {}) {
    this.log = log;
  }

  private async pritRradhen(hosti: string, vonesaMs: number) {
    const e = this.eFundit.get(hosti);
    if (e !== undefined) {
      const mbetet = e + vonesaMs - Date.now();
      if (mbetet > 0) await pret(mbetet);
    }
    this.eFundit.set(hosti, Date.now());
  }

  private async kerko(url: string): Promise<Response> {
    this.kerkesat++;
    return await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xml;q=0.9,*/*;q=0.8" },
      redirect: "follow",
      signal: AbortSignal.timeout(KOHA_MAKS_MS),
    });
  }

  async rregullatPer(origjina: string): Promise<Rregullat> {
    const ruajtur = this.rregullat.get(origjina);
    if (ruajtur) return ruajtur;
    const hosti = new URL(origjina).host;
    await this.pritRradhen(hosti, PAUZA_MIN_MS);
    const pergjigja = await this.kerko(`${origjina}/robots.txt`);
    // 4xx = s'ka robots.txt → lejohet; 5xx ose rrjet = s'e dimë → ndalohet (më e sigurta).
    let r: Rregullat;
    if (pergjigja.ok) r = lexoRobots(await pergjigja.text());
    else if (pergjigja.status >= 400 && pergjigja.status < 500) r = { ndalohet: [], lejohet: [], vonesaMs: PAUZA_MIN_MS };
    else throw new GabimRobots(`robots.txt i ${hosti}: HTTP ${pergjigja.status}`);
    this.rregullat.set(origjina, r);
    this.log(`robots.txt ${hosti}: pauza ${r.vonesaMs / 1000}s, ${r.ndalohet.length} rregulla Disallow`);
    return r;
  }

  /** Merr një faqe si tekst. Hedh gabim nëse robots.txt e ndalon ose nëse HTTP s'është 2xx. */
  async merr(url: string): Promise<string> {
    const u = new URL(url);
    const r = await this.rregullatPer(u.origin);
    if (!lejohet(r, u.pathname + u.search)) throw new GabimRobots(`robots.txt e ndalon: ${url}`);
    await this.pritRradhen(u.host, r.vonesaMs);
    const pergjigja = await this.kerko(url);
    if (!pergjigja.ok) throw new Error(`HTTP ${pergjigja.status}: ${url}`);
    return await pergjigja.text();
  }
}
