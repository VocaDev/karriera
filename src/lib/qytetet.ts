// "Afër meje" pa server: komunat e Kosovës me qendrën e tyre (afërsisht, mjafton për "cili qytet është më afër"),
// dhe njohja e qytetit te punet.qyteti, që vjen si të shkruajë portali ose punëdhënësi: "Prishtinë", "Prishtina",
// "Pristina", "Mitrovic", "Prishtinë, Kosovë", "Remote". Gjithçka llogaritet në telefon; koordinatat s'dalin prej tij.

export type Komuna = { emri: string; lat: number; lng: number; emrat_e_tjere: readonly string[] };

// 37 komuna (Mitrovica e Veriut bashkë me Mitrovicën: për punët është i njëjti qytet). Emri = forma që shfaqim.
// Emrat e tjerë: forma e shquar, serbisht pa shenja dhe emrat e vjetër që përdorin portalet.
export const KOMUNAT: readonly Komuna[] = [
  { emri: "Prishtinë", lat: 42.6629, lng: 21.1655, emrat_e_tjere: ["Prishtina", "Pristina", "Priština"] },
  { emri: "Prizren", lat: 42.2139, lng: 20.7397, emrat_e_tjere: ["Prizreni"] },
  { emri: "Ferizaj", lat: 42.3702, lng: 21.1553, emrat_e_tjere: ["Ferizaji", "Uroševac"] },
  { emri: "Pejë", lat: 42.6593, lng: 20.2887, emrat_e_tjere: ["Peja", "Peć"] },
  { emri: "Gjakovë", lat: 42.3803, lng: 20.4308, emrat_e_tjere: ["Gjakova", "Đakovica"] },
  { emri: "Gjilan", lat: 42.4635, lng: 21.4694, emrat_e_tjere: ["Gjilani", "Gnjilane"] },
  {
    emri: "Mitrovicë",
    lat: 42.8914,
    lng: 20.866,
    emrat_e_tjere: ["Mitrovica", "Mitrovica e Veriut", "Mitrovicë e Veriut", "Mitrovicë Veri", "Mitrovica Jug", "Kosovska Mitrovica"],
  },
  { emri: "Podujevë", lat: 42.9106, lng: 21.1933, emrat_e_tjere: ["Podujeva", "Podujevo"] },
  { emri: "Vushtrri", lat: 42.8231, lng: 20.9675, emrat_e_tjere: ["Vushtrria", "Vučitrn"] },
  { emri: "Suharekë", lat: 42.3586, lng: 20.825, emrat_e_tjere: ["Suhareka", "Therandë", "Suva Reka"] },
  { emri: "Rahovec", lat: 42.3994, lng: 20.6547, emrat_e_tjere: ["Rahoveci", "Orahovac"] },
  { emri: "Drenas", lat: 42.625, lng: 20.8933, emrat_e_tjere: ["Drenasi", "Gllogoc", "Glogovac"] },
  { emri: "Lipjan", lat: 42.5217, lng: 21.1258, emrat_e_tjere: ["Lipjani", "Lipljan"] },
  { emri: "Malishevë", lat: 42.4828, lng: 20.7458, emrat_e_tjere: ["Malisheva", "Mališevo"] },
  { emri: "Kamenicë", lat: 42.5781, lng: 21.5803, emrat_e_tjere: ["Kamenica"] },
  { emri: "Viti", lat: 42.3214, lng: 21.3581, emrat_e_tjere: ["Vitia", "Vitina"] },
  { emri: "Deçan", lat: 42.5403, lng: 20.2878, emrat_e_tjere: ["Deçani", "Dečani"] },
  { emri: "Istog", lat: 42.7808, lng: 20.4875, emrat_e_tjere: ["Istogu", "Istok"] },
  { emri: "Klinë", lat: 42.6203, lng: 20.5778, emrat_e_tjere: ["Klina"] },
  { emri: "Skenderaj", lat: 42.7467, lng: 20.7883, emrat_e_tjere: ["Skënderaj", "Skenderaji", "Srbica"] },
  { emri: "Dragash", lat: 42.0611, lng: 20.6528, emrat_e_tjere: ["Dragashi", "Dragaš"] },
  { emri: "Fushë Kosovë", lat: 42.6381, lng: 21.0961, emrat_e_tjere: ["Fushë Kosova", "Fushe-Kosove", "Kosovo Polje"] },
  { emri: "Kaçanik", lat: 42.2319, lng: 21.2592, emrat_e_tjere: ["Kaçaniku", "Kačanik"] },
  { emri: "Shtime", lat: 42.4331, lng: 21.0397, emrat_e_tjere: ["Shtimja", "Štimlje"] },
  { emri: "Obiliq", lat: 42.6869, lng: 21.0703, emrat_e_tjere: ["Obiliqi", "Obilić"] },
  { emri: "Novobërdë", lat: 42.6153, lng: 21.4339, emrat_e_tjere: ["Novobërda", "Novo Brdo"] },
  { emri: "Graçanicë", lat: 42.6003, lng: 21.1936, emrat_e_tjere: ["Graçanica", "Gračanica"] },
  { emri: "Shtërpcë", lat: 42.2394, lng: 21.0272, emrat_e_tjere: ["Shtërpca", "Štrpce"] },
  { emri: "Hani i Elezit", lat: 42.15, lng: 21.2967, emrat_e_tjere: ["Elez Han"] },
  { emri: "Junik", lat: 42.4761, lng: 20.2775, emrat_e_tjere: ["Juniku"] },
  { emri: "Mamushë", lat: 42.3242, lng: 20.725, emrat_e_tjere: ["Mamusha", "Mamuša"] },
  { emri: "Zubin Potok", lat: 42.9147, lng: 20.6894, emrat_e_tjere: [] },
  { emri: "Zveçan", lat: 42.9075, lng: 20.8403, emrat_e_tjere: ["Zveçani", "Zvečan"] },
  { emri: "Leposaviq", lat: 43.1039, lng: 20.8028, emrat_e_tjere: ["Leposaviqi", "Leposavić"] },
  { emri: "Ranillug", lat: 42.4919, lng: 21.5986, emrat_e_tjere: ["Ranilug"] },
  { emri: "Kllokot", lat: 42.3683, lng: 21.3794, emrat_e_tjere: ["Klokot"] },
  { emri: "Partesh", lat: 42.4019, lng: 21.4336, emrat_e_tjere: ["Parteš"] },
];

/** Listë e renditur për zgjedhjen me dorë: qytetet e mëdha lart (siç janë te KOMUNAT), pastaj sipas alfabetit. */
export const KOMUNAT_PER_ZGJEDHJE: readonly Komuna[] = [
  ...KOMUNAT.slice(0, 7),
  ...[...KOMUNAT.slice(7)].sort((a, b) => a.emri.localeCompare(b.emri, "sq")),
];

/**
 * Forma e krahasimit: pa shenja (ë → e, ç → c, đ → dj), shkronja të vogla, vetëm shkronja e hapësira, dhe pa zanoret
 * në fund, që "Prishtinë", "Prishtina" dhe "Prishtine" të bëhen e njëjta "prishtin", dhe "Mitrovic" = "Mitrovicë".
 */
export function rrenja(teksti: string): string {
  return pastro(teksti).replace(/[aeiouy]+$/, "");
}

/** Pa shenja, shkronja të vogla, vetëm shkronja e hapësira (zanoret në fund mbeten). */
function pastro(teksti: string): string {
  return teksti
    .toLowerCase()
    .replace(/đ/g, "dj")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]+/g, " ")
    .trim();
}

const KOMUNA_SIPAS_RRENJES = new Map<string, string>();
for (const k of KOMUNAT) {
  for (const emri of [k.emri, ...k.emrat_e_tjere]) KOMUNA_SIPAS_RRENJES.set(rrenja(emri), k.emri);
}

// "Kosovë" pa qytet: shpallje për gjithë vendin. Shfaqet bashkë me punët e qytetit tënd.
const GJITHE_KOSOVA = new Set(["Kosovë", "Republika e Kosovës", "Gjithë Kosova", "E gjithë Kosova"].map(rrenja));
// Punë nga distanca: shfaqen gjithmonë te "Afër meje".
const DISTANCA = /\b(remote|online|distanc|nga shtepia|home office|work from home|wfh)/;

export type VendiIPunes = { qyteti: string | null; distance: boolean; gjitheKosova: boolean };

/** Teksti i punet.qyteti → qyteti (emri ynë), a është punë nga distanca, a vlen për gjithë Kosovën. */
export function vendiIPunes(teksti: string): VendiIPunes {
  const pjeset = teksti.split(/[,/()|;·\-–]+/).map(rrenja).filter(Boolean);
  const iPlote = rrenja(teksti);
  let qyteti = KOMUNA_SIPAS_RRENJES.get(iPlote) ?? null;
  for (const p of pjeset) {
    if (qyteti) break;
    qyteti = KOMUNA_SIPAS_RRENJES.get(p) ?? null;
  }
  return {
    qyteti,
    distance: DISTANCA.test(pastro(teksti)),
    gjitheKosova: qyteti === null && (GJITHE_KOSOVA.has(iPlote) || pjeset.some((p) => GJITHE_KOSOVA.has(p))),
  };
}

/** A shfaqet puna te "Afër meje" për qytetin tënd: i njëjti qytet, nga distanca, ose për gjithë Kosovën. */
export function eshteAferMeje(qytetiIPunes: string, qytetiIm: string): boolean {
  const v = vendiIPunes(qytetiIPunes);
  return v.distance || v.gjitheKosova || v.qyteti === qytetiIm;
}

/** A është ky një nga emrat tanë (p.sh. vlera e ruajtur në telefon s'është prishur). */
export function eshteKomune(emri: unknown): emri is string {
  return typeof emri === "string" && KOMUNAT.some((k) => k.emri === emri);
}

const RREZJA_E_TOKES_KM = 6371;
const neRadian = (g: number) => (g * Math.PI) / 180;

function distancaKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = neRadian(lat2 - lat1);
  const dLng = neRadian(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(neRadian(lat1)) * Math.cos(neRadian(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * RREZJA_E_TOKES_KM * Math.asin(Math.sqrt(a));
}

// Çdo pikë në Kosovë është brenda ~30 km nga qendra e një komune. Më larg = jashtë Kosovës: s'e sajojmë qytetin.
const LARGESIA_MAKS_KM = 40;

/** Qyteti më i afërt për një pikë, ose null kur pika është jashtë Kosovës. */
export function qytetiMeIAfert(lat: number, lng: number): string | null {
  let iAferti: Komuna | null = null;
  let largesia = Infinity;
  for (const k of KOMUNAT) {
    const d = distancaKm(lat, lng, k.lat, k.lng);
    if (d < largesia) {
      largesia = d;
      iAferti = k;
    }
  }
  return iAferti && largesia <= LARGESIA_MAKS_KM ? iAferti.emri : null;
}
