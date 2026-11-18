// Të tre mesazhet e gabimeve (Agon, "TODO A"), në një vend. Çdo mesazh ka dy pjesë: çka ndodhi dhe çka bën
// përdoruesi. Pa fjalë teknike: asnjë "server", "401", "timeout". Ekranet dhe lib/*.ts i marrin vetëm nga këtu.
//   1. Pa internet               → paInternet(...)
//   2. Po vonon më shumë se zakonisht → VONON
//   3. Hyr përsëri (sesioni mbaroi)    → HYR_PERSERI

export type Mesazhi = { titulli: string; cfare: string; bere: string };

/** Teksti i plotë (çka ndodhi + çka bën) kur ekrani ka vetëm një vend teksti. */
export const tekstiIPlote = (m: Pick<Mesazhi, "cfare" | "bere">): string => `${m.cfare} ${m.bere}`;

// ---------- 1. Pa internet ----------

/** Shenja e fundit që ndan "pa internet" nga çdo gabim tjetër (njihet te `eshteGabimRrjeti`). */
export const FILLIMI_PA_INTERNET = "S'ke lidhje me internetin";

/**
 * "S'ke lidhje me internetin, prandaj <çka mbetet në ekran>." + çka bën. `vetvetiu`: ekrani rifreskohet vetë
 * kur kthehet interneti (listat); përndryshe përdoruesi prek "Provo përsëri".
 */
export function paInternet(mbetet: string, vetvetiu = true): Mesazhi {
  return {
    titulli: "Pa internet",
    cfare: `${FILLIMI_PA_INTERNET}, prandaj ${mbetet}.`,
    bere: vetvetiu
      ? 'Lidhu me internet dhe lista rifreskohet vetë, ose prek "Provo përsëri".'
      : 'Lidhu me internet dhe prek "Provo përsëri".',
  };
}

/** Kur gabimi vjen nga libraria dhe nuk dihet ekrani: fjalia e shkurtër (pa internet). */
export const PA_INTERNET_SHKURT = `${FILLIMI_PA_INTERNET}. Lidhu me internet dhe provo përsëri.`;

// ---------- 2. Po vonon më shumë se zakonisht ----------

export const VONON = {
  titulli: "Po vonon më shumë se zakonisht",
  bere: 'Prit pak dhe prek "Provo përsëri".',
  // Çka nuk mbaroi dhe çka mbetet i sigurt. Fjalia e dytë i thotë përdoruesit se asgjë s'humbi.
  gati: 'Kontrolli "A jam gati?" nuk mbaroi në kohë. Rezultati yt i fundit mbetet aty.',
  analiza: "Analiza e CV-së nuk mbaroi në kohë. CV-ja jote është ruajtur.",
  ngarkimi: "Ngarkimi i CV-së nuk mbaroi në kohë. Skedari yt mbetet i zgjedhur.",
  krijimi: "Krijimi i CV-së nuk mbaroi në kohë. Përgjigjet e tua mbeten aty.",
  intervista: "Intervistuesi nuk u përgjigj në kohë. Përgjigjja jote është ruajtur.",
  leximi: "Leximi nuk mbaroi në kohë. Çka pe herën e fundit mbetet aty.",
  nisja: "Hapja e intervistës nuk mbaroi në kohë. Asgjë nuk u humb.",
  rezultatet: "Rezultatet e intervistës nuk mbaruan në kohë. Përgjigjet e tua janë ruajtur.",
  pergjithshme: "Kërkesa nuk mbaroi në kohë. Asgjë nga ç'ke bërë nuk humbi.",
} as const;

/** Shenja që e njeh një mesazh vonese kur ai ka mbetur vetëm si tekst (gjendja e ekranit). */
const SHENJA_E_VONESES = "në kohë.";
export const eshteTekstVonese = (tekst: string): boolean => tekst.includes(SHENJA_E_VONESES);

// ---------- 3. Hyr përsëri ----------

export const HYR_PERSERI: Mesazhi & { buton: string } = {
  titulli: "Hyr përsëri",
  cfare: "Ke qenë gjatë jashtë aplikacionit, prandaj për sigurinë tënde të nxorëm nga llogaria.",
  bere: 'Prek "Hyr" dhe vazhdo. CV-ja dhe punët e tua janë ruajtur.',
  buton: "Hyr",
};
