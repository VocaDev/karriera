// Rindërto CV-në: CV-ja origjinale (nga analiza) me sugjerimet e pranuara, të zbatuara këtu pa AI
// (src/lib/rindertimi.ts). Para/pas, çdo rresht ndryshohet me një prekje, pastaj ruhet si version i ri
// (ruajCV) → dokumenti → PDF. Nota s'ndryshon këtu: nota e re vjen vetëm nga një analizë e re e vërtetë.
//
// Vetëm për kërkuesin (_layout.tsx). Lidhja me një punë nga Punët ("Përshtate për këtë punë") vjen me
// "A jam gati?" (02.12): atëherë ky ekran merr `puna` si parametër dhe sugjerimet e asaj pune.
import { SegmentedControl } from "@expo/ui/community/segmented-control";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, TextInput, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useNjoftim } from "@/components/Njoftimet";
import Prekshme from "@/components/Prekshme";
import ShiritiPaInternet from "@/components/ShiritiPaInternet";
import { Chip, Faqja, Ikona, IKONAT, Karta, T, Titulli } from "@/components/ui";
import {
  analizaPerCV,
  listoVersionet,
  ruajCV,
  type AnalizaERuajtur,
  type CvRresht,
  type CvStrukturuar,
  type SugjerimCV,
} from "@/lib/cv";
import { useDridhja } from "@/lib/levizja";
import { prekja } from "@/lib/prekja";
import { paInternet, VONON } from "@/lib/mesazhet";
import { KOHA_E_LEXIMIT, KOHA_E_NGARKIMIT, meKohe, pamjaEGabimit, useRrjeti } from "@/lib/rrjeti";
import {
  celesiAftesiseSeRe,
  celesiFushes,
  lexo,
  numerimi,
  placeholderat,
  rindertoCV,
  type Rezultati,
  type Shenja,
  type Zgjedhjet,
} from "@/lib/rindertimi";
import { SHKRONJAT, useTema } from "@/lib/tema";
import { useZgjedhjet } from "@/lib/zgjedhjet";

type Gjendja =
  | { lloji: "duke" }
  | { lloji: "gati"; ruajtur: AnalizaERuajtur; versioni: CvRresht }
  | { lloji: "gabim"; mesazhi: string };

type Pamja = "pas" | "para";

// Një "[placeholder]" i një sugjerimi të pranuar që ka mbetur në tekst do të dilte në PDF:
// s'ruhet derisa të plotësohet (kllapat që ishin vetë në CV s'e ndalojnë ruajtjen).
function kaPlaceholder(cv: CvStrukturuar, sugjerimet: SugjerimCV[], z: Zgjedhjet): boolean {
  const teksti = JSON.stringify(cv);
  return sugjerimet.some((s) => z.vendimet[s.id] === "pranuar" && placeholderat(s).some((p) => teksti.includes(p)));
}

export default function RindertojeCV() {
  const t = useTema();
  const router = useRouter();
  const njofto = useNjoftim();
  const kufijte = useSafeAreaInsets();
  const { stili: stiliIDridhjes, dridhu } = useDridhja();
  const { stili: stiliIKycjes, dridhu: dridhuKycjen } = useDridhja();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [gjendja, setGjendja] = useState<Gjendja>({ lloji: "duke" });
  const [provimi, setProvimi] = useState(0);
  const [pamja, setPamja] = useState<Pamja>("pas");
  const [duke, setDuke] = useState<string | null>(null); // çelësi i rreshtit që po ndryshohet
  const [dukeRuajtur, setDukeRuajtur] = useState(false);
  const [provoiRuajtjen, setProvoiRuajtjen] = useState(false);
  // Interneti u kthye pas një leximi të dështuar: rilexohet vetë.
  const { kaInternet } = useRrjeti(() => {
    if (gjendja.lloji === "gabim") {
      setGjendja({ lloji: "duke" });
      setProvimi((v) => v + 1);
    }
  });

  useEffect(() => {
    if (!id) return; // pa id: ekrani i gabimit më poshtë
    const cvId = id;
    let aktiv = true;
    meKohe(Promise.all([analizaPerCV(cvId), listoVersionet()]), KOHA_E_LEXIMIT)
      .then(([ruajtur, versionet]) => {
        if (!aktiv) return;
        const versioni = versionet.find((v) => v.id === cvId);
        if (!ruajtur || !versioni) {
          setGjendja({ lloji: "gabim", mesazhi: "Kjo CV s'është analizuar ende. Analizoje më parë." });
          return;
        }
        setGjendja({ lloji: "gati", ruajtur, versioni });
      })
      .catch((e: unknown) => {
        if (aktiv) setGjendja({ lloji: "gabim", mesazhi: e instanceof Error ? e.message : "S'u hap CV-ja." });
      });
    return () => {
      aktiv = false;
    };
  }, [id, provimi]);

  const ruajtur = gjendja.lloji === "gati" ? gjendja.ruajtur : null;
  const origjinali = ruajtur?.analiza.cv ?? null;
  const sugjerimet = useMemo(() => ruajtur?.analiza.sugjerimet ?? [], [ruajtur]);
  const { zgjedhjet, gati: zgjedhjetGati, ndrysho } = useZgjedhjet(origjinali && ruajtur ? ruajtur.reviewId : null);

  const rezultati: Rezultati | null = useMemo(
    () => (origjinali ? rindertoCV(origjinali, sugjerimet, zgjedhjet) : null),
    [origjinali, sugjerimet, zgjedhjet],
  );

  // ---------- Gjendjet: duke, gabim, pa CV të strukturuar ----------

  if (id && (gjendja.lloji === "duke" || (origjinali && !zgjedhjetGati))) {
    return (
      <Faqja>
        <View style={styles.qender} accessibilityLiveRegion="polite">
          <ActivityIndicator size="large" color={t.zbehur} />
          <T zbehur>Po e rindërtoj CV-në…</T>
        </View>
      </Faqja>
    );
  }

  if (!id || gjendja.lloji !== "gati" || !origjinali || !rezultati || !ruajtur) {
    return (
      <Faqja>
        <View style={styles.qender}>
          <Ikona emri={IKONAT.alarm} madhesia={34} ngjyra={t.keq} />
          <Titulli>
            {gjendja.lloji === "gabim"
              ? pamjaEGabimit(gjendja.mesazhi, "S'u hap rindërtimi", "s'kemi ende CV për ta rindërtuar", true, "ekrani").titulli
              : "S'u hap rindërtimi"}
          </Titulli>
          <T zbehur style={styles.qenderTekst} accessibilityLiveRegion="polite">
            {!id
              ? "Mungon CV-ja që duhet rindërtuar."
              : gjendja.lloji === "gabim"
                ? pamjaEGabimit(gjendja.mesazhi, "S'u hap rindërtimi", "s'kemi ende CV për ta rindërtuar", true, "ekrani").teksti
                : "Kjo analizë u bë para se të vinte \"Shtoje në CV\". Analizoje përsëri për ta rindërtuar CV-në."}
          </T>
          {gjendja.lloji === "gabim" && id ? (
            <Prekshme
              onPress={() => {
                setGjendja({ lloji: "duke" });
                setProvimi((v) => v + 1);
              }}
              accessibilityRole="button"
              style={[styles.buton, { backgroundColor: t.teksti }]}
            >
              <T ngjyra={t.sfondi} pesha="trashe">
                Provo përsëri
              </T>
            </Prekshme>
          ) : null}
          <Prekshme
            onPress={() => router.back()}
            accessibilityRole="button"
            style={[styles.buton, styles.butonDyte, { borderColor: t.vija }]}
          >
            <T pesha="trashe">Kthehu te analiza</T>
          </Prekshme>
        </View>
      </Faqja>
    );
  }

  const { analiza } = ruajtur;
  const { versioni } = gjendja;
  const cvOrigjinal = origjinali; // e ngushtuar (jo null) edhe brenda funksioneve më poshtë
  const rez = rezultati;
  const n = numerimi(sugjerimet, zgjedhjet);
  const meDore = Object.keys(zgjedhjet.ndryshimet).length;
  const mbetenPlaceholder = kaPlaceholder(rezultati.cv, sugjerimet, zgjedhjet);
  const kaEmer = rezultati.cv.emri.trim().length > 0;

  function ndryshoRreshtin(celesi: string, teksti: string | null) {
    ndrysho((z) => {
      const ndryshimet = { ...z.ndryshimet };
      if (teksti === null) delete ndryshimet[celesi];
      else ndryshimet[celesi] = teksti;
      return { ...z, ndryshimet };
    });
  }

  async function ruaje() {
    if (dukeRuajtur || !rezultati) return;
    if (!kaInternet) {
      // Ndryshimet e tua mbeten në telefon (zgjedhjet ruhen aty); ruajtja si version i ri kërkon internet.
      prekja.gabim();
      njofto(paInternet("ndryshimet e tua mbeten këtu", false).cfare, "gabim");
      return;
    }
    if (mbetenPlaceholder || !kaEmer) {
      setProvoiRuajtjen(true);
      prekja.gabim();
      dridhu();
      return;
    }
    setDukeRuajtur(true);
    try {
      const gjuha = analiza.gjuha_e_cv === "en" ? "en" : "sq";
      const emri = `Rindërtuar nga ${versioni.emri_skedarit ?? `v${versioni.versioni}`}`;
      const iRi = await meKohe(ruajCV(rezultati.cv, "ks", gjuha, emri), KOHA_E_NGARKIMIT, VONON.ruajtja);
      prekja.sukses();
      njofto(`Versioni v${iRi.versioni} u ruajt`, "sukses");
      router.replace({ pathname: "/cv/dokumenti", params: { id: iRi.id } });
    } catch (e) {
      prekja.gabim();
      njofto(e instanceof Error ? e.message : "S'u ruajt CV-ja. Provo përsëri.", "gabim");
    } finally {
      setDukeRuajtur(false);
    }
  }

  // Një rresht i CV-së: në "Pas" tregon tekstin e ri (dhe të vjetrin të vizatuar, nëse ndryshoi)
  // dhe hapet për ndryshim me një prekje; në "Para" tregon origjinalin.
  function rresht(sh: Shenja, etiketa: string, opsione: { madhesia?: number; pesha?: "normal" | "mesme" | "trashe" | "shumeTrashe"; zbehur?: boolean; trego_bosh?: boolean } = {}) {
    const celesi = celesiFushes(sh);
    const vjeter = lexo(cvOrigjinal, sh) ?? "";
    const iRi = lexo(rez.pune, sh) ?? "";
    return (
      <Rreshti
        key={celesi}
        celesi={celesi}
        etiketa={etiketa}
        vjeter={vjeter}
        iRi={iRi}
        pamja={pamja}
        ngaAI={rez.ndryshuar.has(celesi)}
        meDore={celesi in zgjedhjet.ndryshimet}
        dukeNdryshuar={duke === celesi}
        hape={() => setDuke(celesi)}
        mbyll={() => setDuke(null)}
        ruaj={(teksti) => {
          if (teksti !== iRi) ndryshoRreshtin(celesi, teksti);
          setDuke(null);
        }}
        rikthe={() => {
          ndryshoRreshtin(celesi, null);
          setDuke(null);
        }}
        {...opsione}
      />
    );
  }

  const fshire = (seksioni: string, i: number) => rezultati.fshire.has(`${seksioni}/${i}`);

  function elementi(seksioni: string, i: number, permbajtja: ReactNode) {
    const hiqet = fshire(seksioni, i);
    return (
      <View key={`${seksioni}-${i}`} style={[styles.elementi, hiqet && pamja === "pas" ? styles.hequr : null]}>
        {hiqet && pamja === "pas" ? (
          <View style={styles.rreshtiMini}>
            <Chip teksti="Hiqet" />
            <T zbehur madhesia={12}>
              Nga sugjerimet që pranove
            </T>
          </View>
        ) : null}
        {permbajtja}
      </View>
    );
  }

  const titulliSeksionit = (teksti: string) => (
    <T pesha="trashe" madhesia={12} zbehur style={styles.titulliSeksionit}>
      {teksti}
    </T>
  );

  const cvPune = rezultati.pune;

  return (
    <View style={styles.flex}>
      <Faqja me_fusha>
        <ShiritiPaInternet teksti={paInternet("ndryshimet e tua mbeten këtu", false).cfare} />
        <View style={styles.krye}>
          <T zbehur pesha="gjysme" madhesia={12}>
            RINDËRTO CV-NË
          </T>
          <Titulli>CV-ja jote, e përmirësuar.</Titulli>
          <T zbehur>
            {n.pranuar === 1 ? "1 ndryshim nga analiza" : `${n.pranuar} ndryshime nga analiza`}
            {meDore > 0 ? ` · ${meDore} me dorë` : ""}. Prek çdo rresht për ta ndryshuar.
          </T>
        </View>

        {/* Nota e ndershme: këtu s'llogaritet asnjë notë e re. */}
        <Karta style={styles.nota}>
          <View style={styles.rreshtiMini}>
            <T pesha="shumeTrashe" madhesia={26} ngjyra={t.theksi} maxFontSizeMultiplier={1.2}>
              {analiza.nota}
            </T>
            <T zbehur madhesia={14} maxFontSizeMultiplier={1.2}>
              /100 · nota e CV-së origjinale
            </T>
          </View>
          <T zbehur madhesia={12}>
            Nota e re vjen vetëm nga një analizë e re. Ruaje këtë version, pastaj prek &quot;Analizo këtë version&quot;.
          </T>
        </Karta>

        {rezultati.deshtuan.length > 0 ? (
          <Karta style={styles.nota}>
            <T pesha="trashe">
              {rezultati.deshtuan.length === 1 ? "1 ndryshim s'u zbatua" : `${rezultati.deshtuan.length} ndryshime s'u zbatuan`}
            </T>
            <T zbehur madhesia={13}>
              Teksti që synonin ka ndryshuar. Zhbëji te analiza, ose ndryshoje rreshtin vetë këtu.
            </T>
          </Karta>
        ) : null}

        <SegmentedControl
          values={["Me ndryshimet", "Origjinali"]}
          selectedIndex={pamja === "pas" ? 0 : 1}
          onChange={(e) => {
            prekja.zgjedhje();
            setDuke(null);
            setPamja(e.nativeEvent.selectedSegmentIndex === 0 ? "pas" : "para");
          }}
          appearance={t.errët ? "dark" : "light"}
          accessibilityLabel="Pamja e CV-së: me ndryshimet ose origjinali"
        />

        <Karta style={styles.flete}>
          <View style={[styles.koka, { borderBottomColor: t.teksti }]}>
            {rresht({ seksioni: "emri", indeksi: null, fusha: null }, "Emri", { madhesia: 22, pesha: "shumeTrashe" })}
            {rresht({ seksioni: "titulli", indeksi: null, fusha: null }, "Titulli", { pesha: "mesme", zbehur: true, trego_bosh: true })}
            {rresht({ seksioni: "email", indeksi: null, fusha: null }, "Email-i", { madhesia: 13, zbehur: true })}
            {rresht({ seksioni: "telefoni", indeksi: null, fusha: null }, "Telefoni", { madhesia: 13, zbehur: true, trego_bosh: true })}
            {rresht({ seksioni: "qyteti", indeksi: null, fusha: null }, "Qyteti", { madhesia: 13, zbehur: true })}
          </View>

          {titulliSeksionit("PROFILI")}
          {rresht({ seksioni: "profili", indeksi: null, fusha: null }, "Profili", { trego_bosh: true })}

          {cvPune.pervoja.length > 0 && titulliSeksionit("PËRVOJA")}
          {cvPune.pervoja.map((_, i) =>
            elementi(
              "pervoja",
              i,
              <>
                {rresht({ seksioni: "pervoja", indeksi: i, fusha: "roli" }, "Roli", { pesha: "trashe" })}
                {rresht({ seksioni: "pervoja", indeksi: i, fusha: "vendi" }, "Vendi", { madhesia: 13, zbehur: true })}
                {rresht({ seksioni: "pervoja", indeksi: i, fusha: "periudha" }, "Periudha", { madhesia: 13, zbehur: true })}
                {rresht({ seksioni: "pervoja", indeksi: i, fusha: "pershkrimi" }, "Përshkrimi", { trego_bosh: true })}
              </>,
            ),
          )}

          {cvPune.projektet.length > 0 && titulliSeksionit("PROJEKTET")}
          {cvPune.projektet.map((_, i) =>
            elementi(
              "projektet",
              i,
              <>
                {rresht({ seksioni: "projektet", indeksi: i, fusha: "titulli" }, "Titulli", { pesha: "trashe" })}
                {rresht({ seksioni: "projektet", indeksi: i, fusha: "pershkrimi" }, "Përshkrimi", { trego_bosh: true })}
                {rresht({ seksioni: "projektet", indeksi: i, fusha: "linku" }, "Linku", { madhesia: 13, zbehur: true, trego_bosh: true })}
              </>,
            ),
          )}

          {cvPune.arsimi.length > 0 && titulliSeksionit("ARSIMI")}
          {cvPune.arsimi.map((_, i) =>
            elementi(
              "arsimi",
              i,
              <>
                {rresht({ seksioni: "arsimi", indeksi: i, fusha: "programi" }, "Programi", { pesha: "trashe" })}
                {rresht({ seksioni: "arsimi", indeksi: i, fusha: "institucioni" }, "Institucioni", { madhesia: 13, zbehur: true })}
                {rresht({ seksioni: "arsimi", indeksi: i, fusha: "periudha" }, "Periudha", { madhesia: 13, zbehur: true })}
              </>,
            ),
          )}

          {(cvPune.aftesite.length > 0 || rezultati.shtuara.length > 0) && titulliSeksionit("AFTËSITË")}
          {cvPune.aftesite.map((_, i) =>
            elementi("aftesite", i, rresht({ seksioni: "aftesite", indeksi: i, fusha: null }, "Aftësia")),
          )}
          {pamja === "pas" &&
            rezultati.shtuara.map((a) => {
              const celesi = celesiAftesiseSeRe(a.id);
              return (
                <Rreshti
                  key={celesi}
                  celesi={celesi}
                  etiketa="Aftësia e re"
                  vjeter=""
                  iRi={a.teksti}
                  pamja={pamja}
                  ngaAI
                  meDore={celesi in zgjedhjet.ndryshimet}
                  dukeNdryshuar={duke === celesi}
                  hape={() => setDuke(celesi)}
                  mbyll={() => setDuke(null)}
                  ruaj={(teksti) => {
                    if (teksti !== a.teksti) ndryshoRreshtin(celesi, teksti);
                    setDuke(null);
                  }}
                  rikthe={() => {
                    ndryshoRreshtin(celesi, null);
                    setDuke(null);
                  }}
                />
              );
            })}

          {cvPune.gjuhet.length > 0 && titulliSeksionit("GJUHËT")}
          {cvPune.gjuhet.map((_, i) =>
            elementi(
              "gjuhet",
              i,
              <View style={styles.rreshtiMini}>
                <View style={styles.flex}>{rresht({ seksioni: "gjuhet", indeksi: i, fusha: "gjuha" }, "Gjuha")}</View>
                <View style={styles.flex}>
                  {rresht({ seksioni: "gjuhet", indeksi: i, fusha: "niveli" }, "Niveli", { zbehur: true })}
                </View>
              </View>,
            ),
          )}
        </Karta>

        {/* Lidhja e ardhshme: përshtatja e CV-së për një punë konkrete nga Punët (me "A jam gati?", 02.12). */}
        <Animated.View style={stiliIKycjes}>
          <Prekshme
            onPress={() => {
              prekja.lehte();
              dridhuKycjen();
            }}
            accessibilityRole="button"
            accessibilityState={{ disabled: true }}
            accessibilityLabel="Përshtate për një punë nga Punët. Vjen më 2 dhjetor."
            style={[styles.kycur, { backgroundColor: t.karta, borderColor: t.vija }]}
          >
            <Ikona emri={IKONAT.canta} madhesia={20} ngjyra={t.zbehur} />
            <View style={styles.flex}>
              <T pesha="trashe">Përshtate për një punë</T>
              <T zbehur madhesia={12}>
                Zgjidh një punë nga Punët dhe CV-ja merr sugjerimet e asaj pune.
              </T>
            </View>
            <View style={styles.rreshtiMini}>
              <Ikona emri={IKONAT.kycja} madhesia={13} ngjyra={t.zbehur} />
              <T zbehur madhesia={12} pesha="gjysme">
                02.12
              </T>
            </View>
          </Prekshme>
        </Animated.View>

        <View style={styles.hapesiraPerShiritin} />
      </Faqja>

      <View
        style={[
          styles.shiriti,
          { backgroundColor: t.karta, borderTopColor: t.vija, shadowColor: t.hija, paddingBottom: kufijte.bottom + 10 },
        ]}
      >
        {provoiRuajtjen && (mbetenPlaceholder || !kaEmer) ? (
          <T ngjyra={t.keq} madhesia={13}>
            {mbetenPlaceholder
              ? "Një rresht ka ende [kllapa] për t'u plotësuar. Shkruaj vlerën e vërtetë para se ta ruash."
              : "Shkruaj emrin tënd te koka e CV-së."}
          </T>
        ) : (
          <T zbehur madhesia={12}>
            Ruhet si version i ri. CV-ja origjinale mbetet siç është.
          </T>
        )}
        <Animated.View style={stiliIDridhjes}>
          <Prekshme
            onPress={ruaje}
            disabled={dukeRuajtur}
            accessibilityRole="button"
            accessibilityState={{ busy: dukeRuajtur }}
            style={[styles.buton, { backgroundColor: t.teksti, opacity: dukeRuajtur ? 0.7 : 1 }]}
          >
            {dukeRuajtur ? (
              <ActivityIndicator color={t.sfondi} />
            ) : (
              <T ngjyra={t.sfondi} pesha="trashe">
                Ruaje dhe shiko PDF-në
              </T>
            )}
          </Prekshme>
        </Animated.View>
      </View>
    </View>
  );
}

// ---------- Një rresht i ndryshueshëm ----------

type PropsRreshti = {
  celesi: string;
  etiketa: string;
  vjeter: string;
  iRi: string;
  pamja: Pamja;
  ngaAI: boolean;
  meDore: boolean;
  dukeNdryshuar: boolean;
  hape: () => void;
  mbyll: () => void;
  ruaj: (teksti: string) => void;
  rikthe: () => void;
  madhesia?: number;
  pesha?: "normal" | "mesme" | "trashe" | "shumeTrashe";
  zbehur?: boolean;
  trego_bosh?: boolean; // fushë bosh që ia vlen të plotësohet (profili, linku…)
};

function Rreshti({
  etiketa,
  vjeter,
  iRi,
  pamja,
  ngaAI,
  meDore,
  dukeNdryshuar,
  hape,
  mbyll,
  ruaj,
  rikthe,
  madhesia = 15,
  pesha = "normal",
  zbehur = false,
  trego_bosh = false,
}: PropsRreshti) {
  const t = useTema();

  if (pamja === "para") {
    if (!vjeter.trim()) return null;
    return (
      <T madhesia={madhesia} pesha={pesha} zbehur={zbehur} style={styles.lartesia}>
        {vjeter}
      </T>
    );
  }

  const ndryshuar = iRi !== vjeter;
  const iHequr = !iRi.trim() && !!vjeter.trim();

  if (dukeNdryshuar) {
    return <Redaktuesi etiketa={etiketa} iRi={iRi} meDore={meDore} mbyll={mbyll} ruaj={ruaj} rikthe={rikthe} />;
  }

  if (!iRi.trim() && !vjeter.trim() && !trego_bosh) return null;

  return (
    <Prekshme
      onPress={hape}
      shkalla={0.99}
      accessibilityRole="button"
      accessibilityLabel={`${etiketa}: ${iRi || "bosh"}${ndryshuar ? ", e ndryshuar" : ""}. Prek për ta ndryshuar.`}
      style={[styles.rreshti, ndryshuar ? { borderLeftColor: meDore ? t.teksti : t.ok } : null, ndryshuar ? styles.rreshtiINdryshuar : null]}
    >
      {iRi.trim() ? (
        <T madhesia={madhesia} pesha={pesha} zbehur={zbehur} style={styles.lartesia}>
          {iRi}
        </T>
      ) : iHequr ? null : (
        <T madhesia={13} zbehur style={styles.bosh}>
          + Shto {etiketa.toLowerCase()}
        </T>
      )}
      {ndryshuar && vjeter.trim() ? (
        <T zbehur madhesia={12} style={styles.vize} numberOfLines={iHequr ? undefined : 3}>
          {vjeter}
        </T>
      ) : null}
      {ndryshuar ? (
        <T madhesia={10} pesha="trashe" ngjyra={meDore ? t.teksti : t.ok}>
          {iHequr ? "HIQET" : meDore ? "NDRYSHUAR NGA TI" : ngaAI ? "NGA SUGJERIMET" : "NDRYSHUAR"}
        </T>
      ) : null}
    </Prekshme>
  );
}

// Fusha e hapur për ndryshim: teksti mbahet këtu derisa "Gati", që "Anulo" ta lërë CV-në siç ishte.
function Redaktuesi({
  etiketa,
  iRi,
  meDore,
  mbyll,
  ruaj,
  rikthe,
}: Pick<PropsRreshti, "etiketa" | "iRi" | "meDore" | "mbyll" | "ruaj" | "rikthe">) {
  const t = useTema();
  const [teksti, setTeksti] = useState(iRi);
  const iGjate = iRi.length > 60 || iRi.includes("\n");
    return (
      <View style={[styles.redaktimi, { backgroundColor: t.karta2 }]}>
        <T zbehur madhesia={11} pesha="trashe">
          {etiketa.toUpperCase()}
        </T>
        <TextInput
          value={teksti}
          onChangeText={setTeksti}
          autoFocus
          multiline={iGjate}
          maxLength={2000}
          textAlignVertical="top"
          accessibilityLabel={`Ndrysho: ${etiketa}`}
          style={[styles.input, iGjate ? styles.inputIGjate : null, { color: t.teksti, borderColor: t.vija, backgroundColor: t.karta }]}
        />
        <View style={styles.butonatERedaktimit}>
          {meDore ? (
            <Prekshme onPress={rikthe} accessibilityRole="button" style={styles.butonTekst}>
              <T pesha="gjysme" madhesia={13} zbehur>
                Rikthe
              </T>
            </Prekshme>
          ) : null}
          <View style={styles.flex} />
          <Prekshme onPress={mbyll} accessibilityRole="button" style={styles.butonTekst}>
            <T pesha="gjysme" madhesia={13} zbehur>
              Anulo
            </T>
          </Prekshme>
          <Prekshme
            onPress={() => ruaj(teksti)}
            accessibilityRole="button"
            style={[styles.butonIVogel, { backgroundColor: t.teksti }]}
          >
            <T pesha="trashe" madhesia={13} ngjyra={t.sfondi}>
              Gati
            </T>
          </Prekshme>
        </View>
      </View>
    );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  qender: { flex: 1, justifyContent: "center", alignItems: "center", gap: 14, paddingTop: 60 },
  qenderTekst: { textAlign: "center" },
  krye: { gap: 6, marginBottom: 6 },
  nota: { gap: 6 },
  rreshtiMini: { flexDirection: "row", alignItems: "center", gap: 6 },
  flete: { padding: 18, gap: 2 },
  koka: { paddingBottom: 12, borderBottomWidth: 2, gap: 1, marginBottom: 6 },
  titulliSeksionit: { marginTop: 16, marginBottom: 4, letterSpacing: 0.5 },
  elementi: { gap: 1, marginBottom: 10 },
  hequr: { opacity: 0.55 },
  rreshti: { paddingVertical: 4, minHeight: 32, justifyContent: "center", gap: 2 },
  rreshtiINdryshuar: { borderLeftWidth: 2, paddingLeft: 10 },
  lartesia: { lineHeight: 22 },
  vize: { textDecorationLine: "line-through" },
  bosh: { fontStyle: "italic" },
  redaktimi: { borderRadius: 14, padding: 10, gap: 8, marginVertical: 4 },
  input: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: SHKRONJAT.normal,
  },
  inputIGjate: { minHeight: 120 },
  butonatERedaktimit: { flexDirection: "row", alignItems: "center", gap: 6 },
  butonTekst: { minHeight: 44, justifyContent: "center", paddingHorizontal: 10 },
  butonIVogel: { minHeight: 44, borderRadius: 22, justifyContent: "center", paddingHorizontal: 18 },
  kycur: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginTop: 8,
  },
  hapesiraPerShiritin: { height: 90 },
  shiriti: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    gap: 10,
    paddingTop: 12,
    paddingHorizontal: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  buton: { minHeight: 52, borderRadius: 28, justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
  butonDyte: { borderWidth: StyleSheet.hairlineWidth },
});
