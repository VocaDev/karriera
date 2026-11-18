// Kartat e këshillave për intervistën (shqip). Të paketuara në app: hapen pa internet.

export type KeshillaPraktikes = {
  id: string;
  titulli: string;
  /** Një rresht që shfaqet te lista. */
  permbledhja: string;
  /** Pikat kryesore (3–5), të shkurtra. */
  pikat: readonly string[];
  /** Një shembull ose model që mund ta përshtatësh (opsional). */
  shembulli?: { etiketa: string; teksti: string };
};

export const KESHILLAT: readonly KeshillaPraktikes[] = [
  {
    id: "star",
    titulli: "Metoda STAR",
    permbledhja: "Si t'i përgjigjesh pyetjeve 'tregoni për një rast kur…'.",
    pikat: [
      "Situata: një ose dy fjali për kontekstin.",
      "Detyra: çfarë duhej bërë dhe çfarë ishte pjesa jote.",
      "Veprimi: çfarë bëre ti, hap pas hapi. Thuaj 'unë', jo 'ne'.",
      "Rezultati: çfarë dolën, mundësisht me një numër, dhe çfarë mësove.",
      "Përgatit 3 histori të tua; secila mund të përshtatet me disa pyetje.",
    ],
    shembulli: {
      etiketa: "Model",
      teksti:
        "Situata: në projektin e fakultetit, aplikacioni prishej kur hapej një listë e zbrazët. Detyra: ta gjeja shkakun para dorëzimit. Veprimi: e riprodhova gabimin, shtova log-e dhe gjeta që s'kontrollohej vlera bosh. Rezultati: u rregullua për një orë dhe shtova një test që e kap rastin.",
    },
  },
  {
    id: "paga",
    titulli: "Pyetja për pagën",
    permbledhja: "Si ta përgjigjesh 'sa pagë prisni?' pa u çmuar poshtë.",
    pikat: [
      "Hulumto para intervistës: shpalljet e ngjashme dhe njerëzit që punojnë në rol.",
      "Jep një diapazon, jo një shifër të vetme; fundi i poshtëm le të jetë ai që e pranon vërtet.",
      "Lidhe me detyrat dhe zhvillimin, jo me nevojat e tua.",
      "Nëse pyetja vjen shumë herët, mund të kërkosh të dish më shumë për rolin para se të japësh shifër.",
      "Mos thuaj 'çfarëdo'; e dobëson pozicionin tënd.",
    ],
    shembulli: {
      etiketa: "Model",
      teksti:
        "Bazuar në detyrat dhe në atë që shoh për pozita të ngjashme, prisja diçka mes [X] dhe [Y]. Jam i/e hapur për bisedë, sepse për mua rëndësi ka edhe zhvillimi dhe ekipi.",
    },
  },
  {
    id: "pse-ju",
    titulli: "Pse ju?",
    permbledhja: "Përgjigjja më e rëndësishme: pse të të zgjedhin ty.",
    pikat: [
      "Lexo shpalljen dhe nënvizo 2–3 kërkesat kryesore.",
      "Për secilën, një provë: projekt, praktikë, kurs ose punë.",
      "Shto një gjë që të bën të dallosh: sa shpejt mëson, një gjuhë, një projekt personal.",
      "Mbaro me atë që sjell për ekipin, jo me atë që do të marrësh.",
      "Mos u krahaso me kandidatë të tjerë; ti nuk i njeh.",
    ],
  },
  {
    id: "heshtja",
    titulli: "Heshtja dhe pauzat",
    permbledhja: "Të mendosh para se të flasësh është e lejuar.",
    pikat: [
      "Një pauzë prej 3–5 sekondash duket e qetë, jo e pasigurt.",
      "Mund të thuash: 'Më lejoni një çast të mendoj'.",
      "Nëse s'e dëgjove mirë pyetjen, kërko ta përsërisin.",
      "Nëse s'e di përgjigjen, thuaje sinqerisht dhe trego si do ta gjeje.",
      "Mos mbush heshtjen me fjalë pa kuptim; përgjigje më e shkurtër e qartë vlen më shumë.",
    ],
  },
  {
    id: "pyetje-per-ta",
    titulli: "Pyetje për intervistuesin",
    permbledhja: "Kur të pyesin 'keni pyetje?', mos thuaj jo.",
    pikat: [
      "Përgatit 3 pyetje; 1–2 mjaftojnë nëse bisedimi i ka përgjigjur të tjerat.",
      "Pyet për ekipin, ditën e zakonshme, si matet suksesi në tre muajt e parë.",
      "Pyet çfarë mësohet në muajt e parë dhe kush të mëson.",
      "Mos pyet për pagën, pushimet ose orarin si pyetjen e parë.",
      "Pyetja e mbylljes: 'Cili është hapi tjetër dhe kur të presim lajm?'",
    ],
  },
  {
    id: "trupi",
    titulli: "Gjuha e trupit",
    permbledhja: "Bazat që të bëjnë të duket i qetë dhe i besueshëm.",
    pikat: [
      "Shiko në sy (ose te kamera në intervistë online) dhe buzëqesh kur takohesh.",
      "Ulu drejt, me duar të lira; mos i kryqëzo para gjoksit.",
      "Fol ngadalë: kur je nervoz, flet më shpejt se zakonisht.",
      "Mos luaj me stilolaps, flokë ose telefon.",
      "Merr frymë thellë para përgjigjes së parë; ndihmon vërtet.",
    ],
  },
  {
    id: "online",
    titulli: "Intervista online",
    permbledhja: "Pajisja dhe vendi para se të nisë video-thirrja.",
    pikat: [
      "Testo internetin, kamerën dhe mikrofonin 15 minuta para; mbaje laptopin në rrymë.",
      "Drita para teje, jo prapa teje. Sfondi i pastër, pa zhurmë.",
      "Kamera në lartësinë e syve; shiko kamerën kur flet.",
      "Mbylle njoftimet dhe programet e tjera; mbaje në dorë një numër kontakti nëse ndërpritet lidhja.",
      "Mbaj pranë CV-në dhe pak shënime, por mos i lexo fjalë për fjalë.",
    ],
  },
  {
    id: "emaili",
    titulli: "Emaili pas intervistës",
    permbledhja: "Një mesazh i shkurtër brenda 24 orëve ndihmon të të mbajnë mend.",
    pikat: [
      "Dërgoje brenda një dite, jo më vonë se dy.",
      "Falënderoje për kohën, përmend një gjë konkrete që u fol.",
      "Përsërit shkurt pse je i përshtatshëm.",
      "Mbaje në 4–5 rreshta; pa shtesa të panevojshme.",
      "Kontrollo emrin dhe titullin e marrësit para se ta dërgosh.",
    ],
    shembulli: {
      etiketa: "Model emaili",
      teksti:
        "Përshëndetje [Emri],\n\nju falënderoj për kohën sot dhe për bisedën rreth [një temë konkrete]. Më bëri përshtypje [një gjë e vërtetë nga bisedimi].\n\nPas asaj që folëm, besoj se mund të sjell [një kontribut konkret]. Jam i/e interesuar për rolin dhe më vjen mirë të përgjigjem për çdo pyetje shtesë.\n\nMe respekt,\n[Emri yt]",
    },
  },
  {
    id: "dita-para",
    titulli: "Dita para intervistës",
    permbledhja: "Lista e shkurtër që të ul nervozizmin.",
    pikat: [
      "Lexo shpalljen dhe faqen e kompanisë; shkruaj 3 gjëra që i mbaje mend.",
      "Përgatit 3 histori STAR dhe prezantimin tënd 1-minutësh.",
      "Praktiko me zë të lartë; dëgjo si tingëllon.",
      "Gjej rrugën, parkimin ose lidhjen e thirrjes dhe llogarit kohën me rezervë.",
      "Fli mirë; një natë e qetë ndihmon më shumë se një orë përsëritje shtesë.",
    ],
  },
  {
    id: "nuk-e-di",
    titulli: "Kur nuk e di përgjigjen",
    permbledhja: "Si ta mbash veten kur pyetja është e papritur.",
    pikat: [
      "Mos shpik përgjigje; kuptohet menjëherë.",
      "Thuaj: 'Këtë nuk e di me siguri, por ja si do ta gjeja'.",
      "Trego mënyrën e të menduarit: çfarë di dhe si do ta provoje.",
      "Lidhe me diçka të ngjashme që e di.",
      "Pas kësaj, vazhdo qetësisht; një pyetje e pa përgjigjur s'e prish intervistën.",
    ],
  },
];

export function gjejKeshillen(id: string | undefined): KeshillaPraktikes | undefined {
  return KESHILLAT.find((k) => k.id === id);
}
