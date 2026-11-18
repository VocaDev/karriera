import { SegmentedControl } from "@expo/ui/community/segmented-control";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, View } from "react-native";
import Animated, { LinearTransition, useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import KartaSugjerimit, { type PergjigjjaEPranimit } from "@/components/KartaSugjerimit";
import { useNjoftim } from "@/components/Njoftimet";
import Prekshme from "@/components/Prekshme";
import ShiritiPaInternet from "@/components/ShiritiPaInternet";
import { Chip, Faqja, Ikona, IKONAT, Karta, Progresi, T, Titulli } from "@/components/ui";
import { analizaPerCV, analizoCV, listoVersionet, type AnalizaERuajtur, type SugjerimCV } from "@/lib/cv";
import { KOHA, LEHTESIMI } from "@/lib/levizja";
import { prekja } from "@/lib/prekja";
import { ruajCv } from "@/lib/snapshot";
import { paInternet as mesazhiPaInternet, PA_INTERNET_SHKURT, tekstiIPlote, VONON } from "@/lib/mesazhet";
import { eshteGabimKohe, eshteGabimRrjeti, KOHA_E_AI, KOHA_E_LEXIMIT, meKohe, useRrjeti } from "@/lib/rrjeti";
import {
  celesiVleres,
  EMRAT_E_SEKSIONEVE,
  ku,
  mundTeZbatohet,
  numerimi,
  placeholderat,
  RENDI_I_SEKSIONEVE,
  vleratQeMungojne,
  zbatohetVete,
  type Zgjedhjet,
} from "@/lib/rindertimi";
import { useTema } from "@/lib/tema";
import { CV_PAS_DEMO_DAY_HAPUR } from "@/lib/vecorite";
import { useZgjedhjet } from "@/lib/zgjedhjet";

// Çka bën AI-ja gjatë analizës (tregohet si listë, që pritja të mos jetë një rrotë pa shpjegim).
const HAPAT = [
  "Po e lexoj CV-në",
  "Po i gjej aftësitë dhe përvojën",
  "Po i vlerësoj seksionet",
  "Po i shkruaj sugjerimet",
];

const LEVIZJA = LinearTransition.duration(KOHA.mesme).easing(LEHTESIMI.levizje);

type Gjendja =
  | { lloji: "duke"; ePare: boolean } // ePare: s'ka analizë të ruajtur, AI-ja po punon
  | { lloji: "gati"; ruajtur: AnalizaERuajtur }
  | { lloji: "gabim"; mesazhi: string };

// Analiza e CV-së (bordi): nota, seksionet, sugjerimet me "Shtoje në CV", pikat e forta.
// Nëse kjo CV është analizuar më parë, shfaqet ajo analizë (pa e thirrur AI-në sërish).
// Sugjerimet e pranuara shkojnë te "Rindërto CV-në" (cv/rindertoje), ku zbatohen pa AI.
export default function Analiza() {
  const t = useTema();
  const router = useRouter();
  const njofto = useNjoftim();
  const kufijte = useSafeAreaInsets();
  const qetesi = useReducedMotion();
  const { kaInternet } = useRrjeti();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [gjendja, setGjendja] = useState<Gjendja>({ lloji: "duke", ePare: false });
  const [hapiAktual, setHapiAktual] = useState(0);
  const [emriSkedarit, setEmriSkedarit] = useState("CV-ja jote");
  const [roast, setRoast] = useState(false);
  const [provimi, setProvimi] = useState(0); // rritet vetëm te "Analizo përsëri": kërkon një analizë të re (përdor AI)
  const [rilexo, setRilexo] = useState(0); // rritet te "Provo përsëri" pas një gabimi: rilexon analizën e ruajtur para se të thërrasë AI-në
  const [grupiIFundit, setGrupiIFundit] = useState<string[] | null>(null); // "Rregullo të gjitha gabimet", për "Zhbëj"

  useEffect(() => {
    if (!id) return;
    const cvId = id;
    let aktiv = true;

    async function nis() {
      try {
        const versionet = await meKohe(listoVersionet(), KOHA_E_LEXIMIT);
        const cv = versionet.find((v) => v.id === cvId);
        if (!aktiv) return;
        if (!cv) {
          setGjendja({ lloji: "gabim", mesazhi: "Kjo CV nuk u gjet." });
          return;
        }
        setEmriSkedarit(cv.emri_skedarit ?? `CV e krijuar · v${cv.versioni}`);

        const eRuajtur = provimi === 0 ? await meKohe(analizaPerCV(cvId), KOHA_E_LEXIMIT) : null;
        if (!aktiv) return;
        if (eRuajtur) {
          // Përmbledhja ime pa internet: vetëm versioni më i ri (analiza e një versioni të vjetër s'e zëvendëson "të fundit").
          if (versionet[0]?.id === cvId) void ruajCv(eRuajtur.analiza, cv);
          setGjendja({ lloji: "gati", ruajtur: eRuajtur });
          return;
        }

        setGjendja({ lloji: "duke", ePare: true });
        // Ruajtësi i kohës: një lidhje që varet bëhet gabim me "Provo përsëri", jo rrotë pa fund.
        const ruajtur = await meKohe(analizoCV(cvId), KOHA_E_AI, VONON.analiza);
        if (!aktiv) return;
        if (versionet[0]?.id === cvId) void ruajCv(ruajtur.analiza, cv);
        prekja.sukses();
        setGjendja({ lloji: "gati", ruajtur });
      } catch (e) {
        if (!aktiv) return;
        prekja.gabim();
        setGjendja({ lloji: "gabim", mesazhi: e instanceof Error ? e.message : "Analiza e CV-së dështoi." });
      }
    }

    nis();
    return () => {
      aktiv = false;
    };
  }, [id, provimi, rilexo]);

  // Hapat e listës ecin ndërsa AI-ja punon (vetëm për pritjen e parë; i fundit pret përgjigjen).
  const dukeAnalizuar = gjendja.lloji === "duke" && gjendja.ePare;
  useEffect(() => {
    if (!dukeAnalizuar) return;
    const intervali = setInterval(() => setHapiAktual((h) => Math.min(h + 1, HAPAT.length - 1)), 4000);
    return () => clearInterval(intervali);
  }, [dukeAnalizuar]);

  const ruajtur = gjendja.lloji === "gati" ? gjendja.ruajtur : null;
  const analiza = ruajtur?.analiza ?? null;
  const origjinali = analiza?.cv ?? null;
  const sugjerimet = useMemo(() => analiza?.sugjerimet ?? [], [analiza]);
  const meRindertim = !!origjinali && sugjerimet.length > 0;

  const { zgjedhjet, gati: zgjedhjetGati, ndrysho } = useZgjedhjet(meRindertim && ruajtur ? ruajtur.reviewId : null);

  // Cilat sugjerime gjenden saktë në CV (të tjerat mbeten këshilla, pa "Shtoje në CV").
  const zbatohen = useMemo(() => {
    const m = new Map<string, boolean>();
    if (origjinali) for (const s of sugjerimet) m.set(s.id, zbatohetVete(origjinali, s));
    return m;
  }, [origjinali, sugjerimet]);

  const n = numerimi(sugjerimet, zgjedhjet);

  // Momenti i vetëm "i madh": kur shqyrtohet sugjerimi i fundit (jo kur hapet një analizë e shqyrtuar).
  const mbetenPara = useRef<number | null>(null);
  useEffect(() => {
    if (!meRindertim || !zgjedhjetGati) return;
    if (mbetenPara.current !== null && mbetenPara.current > 0 && n.mbeten === 0) {
      prekja.sukses();
      njofto(n.pranuar > 0 ? "Gati! Tani rindërtoje CV-në" : "Të gjitha sugjerimet u shqyrtuan", "sukses");
    }
    mbetenPara.current = n.mbeten;
  }, [n.mbeten, n.pranuar, meRindertim, zgjedhjetGati, njofto]);

  // Pas një gabimi (p.sh. pa internet): rilexon dhe, vetëm nëse s'ka analizë të ruajtur, e thërret AI-në.
  // Para kësaj, "Provo përsëri" harxhonte një analizë të re edhe kur gabimi ishte vetëm leximi.
  function provoPerseri() {
    if (!kaInternet) {
      prekja.gabim();
      njofto(PA_INTERNET_SHKURT, "info");
      return;
    }
    setHapiAktual(0);
    setGjendja({ lloji: "duke", ePare: false });
    setRilexo((v) => v + 1);
  }

  function analizoPerseri() {
    if (!kaInternet) {
      prekja.gabim();
      njofto(PA_INTERNET_SHKURT, "gabim");
      return;
    }
    Alert.alert(
      "Ta analizoj përsëri?",
      "Analiza e re përdor një nga 5 analizat e tua të sotme. Kjo analizë dhe zgjedhjet e saja mbeten të ruajtura.",
      [
        { text: "Anulo", style: "cancel" },
        {
          text: "Analizo",
          onPress: () => {
            setHapiAktual(0);
            setGrupiIFundit(null);
            setGjendja({ lloji: "duke", ePare: true });
            setProvimi((v) => v + 1);
          },
        },
      ],
    );
  }

  // ---------- Vendimet ----------

  const vendos = (sId: string, vendimi: "pranuar" | "kaluar" | null) =>
    ndrysho((z) => {
      const vendimet = { ...z.vendimet };
      if (vendimi) vendimet[sId] = vendimi;
      else delete vendimet[sId];
      return { ...z, vendimet };
    });

  function prano(s: SugjerimCV): PergjigjjaEPranimit {
    if (!origjinali) return "perplasje";
    if (vleratQeMungojne(s, zgjedhjet.vlerat).length > 0) {
      prekja.gabim();
      return "mungojne";
    }
    if (!mundTeZbatohet(origjinali, sugjerimet, zgjedhjet, s.id)) {
      prekja.gabim();
      njofto("Ky rresht ka ndryshuar nga një sugjerim tjetër. Zhbëje atë, ose ndryshoje vetë te Rindërto.", "info");
      return "perplasje";
    }
    prekja.zgjedhje();
    vendos(s.id, "pranuar");
    return "ok";
  }

  // Gabimet drejtshkrimore: një prekje i rregullon të gjitha (ato pa vlera për t'u plotësuar).
  const gabimetEHapura = sugjerimet.filter(
    (s) => s.lloji === "gabim" && !zgjedhjet.vendimet[s.id] && zbatohen.get(s.id) && placeholderat(s).length === 0,
  );

  function rregulloGabimet() {
    if (!origjinali) return;
    let z: Zgjedhjet = zgjedhjet;
    const pranuara: string[] = [];
    for (const s of gabimetEHapura) {
      if (mundTeZbatohet(origjinali, sugjerimet, z, s.id)) {
        z = { ...z, vendimet: { ...z.vendimet, [s.id]: "pranuar" } };
        pranuara.push(s.id);
      }
    }
    if (pranuara.length === 0) return;
    ndrysho(() => z);
    setGrupiIFundit(pranuara);
    prekja.sukses();
    njofto(pranuara.length === 1 ? "U rregullua 1 gabim" : `U rregulluan ${pranuara.length} gabime`, "sukses");
  }

  function zhbejGrupin() {
    const grupi = grupiIFundit;
    if (!grupi) return;
    ndrysho((z) => {
      const vendimet = { ...z.vendimet };
      for (const sId of grupi) delete vendimet[sId];
      return { ...z, vendimet };
    });
    setGrupiIFundit(null);
    prekja.zgjedhje();
  }

  // ---------- Gjendjet: gabim, duke pritur ----------

  if (!id || gjendja.lloji === "gabim") {
    const paInternet = gjendja.lloji === "gabim" && eshteGabimRrjeti(gjendja.mesazhi);
    const vonon = gjendja.lloji === "gabim" && !paInternet && eshteGabimKohe(gjendja.mesazhi);
    return (
      <Faqja>
        <View style={styles.qender}>
          <Ikona emri={IKONAT.alarm} madhesia={34} ngjyra={t.keq} />
          <Titulli>{paInternet ? "Pa internet" : vonon ? VONON.titulli : "Analiza nuk u bë"}</Titulli>
          <T zbehur style={styles.qenderTekst} accessibilityLiveRegion="polite">
            {paInternet
              ? tekstiIPlote(mesazhiPaInternet("analiza nuk u mbaroi", false))
              : gjendja.lloji === "gabim"
                ? vonon
                  ? `${gjendja.mesazhi} ${VONON.bere}`
                  : gjendja.mesazhi
                : "Mungon CV-ja që duhet analizuar."}
          </T>
          {id && (
            <Prekshme onPress={provoPerseri} accessibilityRole="button" style={[styles.buton, { backgroundColor: t.teksti }]}>
              <T ngjyra={t.sfondi} pesha="trashe">
                Provo përsëri
              </T>
            </Prekshme>
          )}
          <Prekshme
            onPress={() => router.back()}
            accessibilityRole="button"
            style={[styles.buton, styles.butonDyte, { borderColor: t.vija }]}
          >
            <T pesha="trashe">Kthehu te CV-ja</T>
          </Prekshme>
        </View>
      </Faqja>
    );
  }

  if (gjendja.lloji === "duke" || !analiza) {
    const ePare = gjendja.lloji === "duke" && gjendja.ePare;
    return (
      <Faqja>
        <ShiritiPaInternet teksti={mesazhiPaInternet("analiza mund të dështojë", false).cfare} />
        <View style={styles.ngarkimi} accessibilityLiveRegion="polite">
          <ActivityIndicator size="large" color={t.zbehur} />
          <Titulli>{ePare ? "Po e analizoj CV-në tënde" : "Po e hap analizën"}</Titulli>
          <T zbehur numberOfLines={1}>
            {emriSkedarit}
          </T>

          {ePare && (
            <>
              <Karta style={styles.hapat}>
                {HAPAT.map((hapi, index) => {
                  const perfunduar = index < hapiAktual;
                  return (
                    <View key={hapi} style={styles.rreshtiHapit}>
                      <View style={[styles.rrethi, { backgroundColor: perfunduar ? t.ok : t.karta2 }]}>
                        {perfunduar ? (
                          <Ikona emri={IKONAT.check} madhesia={14} ngjyra={t.karta} />
                        ) : (
                          <T zbehur pesha="trashe" madhesia={13}>
                            {index + 1}
                          </T>
                        )}
                      </View>
                      <T ngjyra={perfunduar ? t.teksti : t.zbehur} pesha={perfunduar ? "trashe" : "normal"}>
                        {hapi}
                      </T>
                    </View>
                  );
                })}
              </Karta>
              <T zbehur madhesia={12}>
                Zakonisht zgjat 15–40 sekonda. Mos e mbyll ekranin.
              </T>
            </>
          )}
        </View>
      </Faqja>
    );
  }

  // ---------- Analiza ----------

  const grupet = RENDI_I_SEKSIONEVE.map((seksioni) => ({
    seksioni,
    lista: sugjerimet.filter((s) => s.seksioni === seksioni),
  })).filter((g) => g.lista.length > 0);

  return (
    <View style={styles.flex}>
      <Faqja me_fusha>
        <ShiritiPaInternet teksti={mesazhiPaInternet("po ta shfaqim analizën që e pe herën e fundit").cfare} />
        <View style={styles.krye}>
          <T zbehur pesha="gjysme" madhesia={12}>
            REZULTATI I ANALIZËS
          </T>
          <Titulli>CV-ja jote, e analizuar.</Titulli>
          <T zbehur numberOfLines={1}>
            {emriSkedarit}
          </T>
        </View>

        <Karta style={styles.notaKarta}>
          <T zbehur pesha="trashe" madhesia={12}>
            NOTA E CV-SË
          </T>
          <View style={styles.notaRreshti} accessible accessibilityLabel={`Nota ${analiza.nota} nga 100`}>
            <T ngjyra={t.theksi} pesha="shumeTrashe" madhesia={54} maxFontSizeMultiplier={1.2}>
              {analiza.nota}
            </T>
            <T zbehur madhesia={20} maxFontSizeMultiplier={1.2}>
              /100
            </T>
          </View>
          <Progresi vlera={analiza.nota / 100} />
          <T>{analiza.permbledhja}</T>
          <View style={styles.shenimi}>
            <Ikona emri={IKONAT.info} madhesia={14} ngjyra={t.zbehur} />
            <T zbehur madhesia={12} style={styles.flex}>
              Vlerësim i AI-së për cilësinë e CV-së (profili, rezultatet, projektet, formati), jo garanci punësimi. Mund të gabojë.
            </T>
          </View>
        </Karta>

        {/* ---------- Sugjerimet me një prekje ---------- */}
        {meRindertim && origjinali && (
          <View style={styles.blloku}>
            <View style={styles.gap6}>
              <T pesha="trashe" madhesia={20}>
                Përmirësoje me një prekje
              </T>
              <T zbehur madhesia={13}>
                {n.gjithsej} sugjerime për CV-në tënde. Shto ato që të pëlqejnë: CV-ja e re ndërtohet te &quot;Rindërto
                CV-në&quot;, ku mund ta ndryshosh çdo rresht para se ta ruash.
              </T>
            </View>

            {gabimetEHapura.length > 0 ? (
              <Prekshme
                onPress={rregulloGabimet}
                disabled={!zgjedhjetGati}
                accessibilityRole="button"
                accessibilityLabel={`Rregullo të gjitha gabimet drejtshkrimore, ${gabimetEHapura.length}`}
                style={[styles.rregullo, { backgroundColor: t.karta, borderColor: t.vija }]}
              >
                <Ikona emri={IKONAT.check} madhesia={18} ngjyra={t.ok} />
                <View style={styles.flex}>
                  <T pesha="trashe">Rregullo të gjitha gabimet</T>
                  <T zbehur madhesia={12}>
                    {gabimetEHapura.length === 1 ? "1 gabim drejtshkrimor" : `${gabimetEHapura.length} gabime drejtshkrimore`} me
                    një prekje
                  </T>
                </View>
                <Chip teksti={String(gabimetEHapura.length)} />
              </Prekshme>
            ) : grupiIFundit ? (
              <View style={styles.rreshti}>
                <Ikona emri={IKONAT.check} madhesia={15} ngjyra={t.ok} />
                <T zbehur madhesia={13} style={styles.flex}>
                  {grupiIFundit.length === 1 ? "1 gabim u rregullua" : `${grupiIFundit.length} gabime u rregulluan`}
                </T>
                <Prekshme onPress={zhbejGrupin} accessibilityRole="button" hitSlop={8} style={styles.zhbej}>
                  <T pesha="gjysme" madhesia={13} zbehur>
                    Zhbëj
                  </T>
                </Prekshme>
              </View>
            ) : null}

            {!zgjedhjetGati ? (
              <ActivityIndicator color={t.zbehur} />
            ) : (
              grupet.map((g) => {
                const vendosur = g.lista.filter((s) => zgjedhjet.vendimet[s.id]).length;
                const gati = vendosur === g.lista.length;
                return (
                  <View key={g.seksioni} style={styles.grupi}>
                    <View style={styles.rreshti} accessible accessibilityLabel={`${EMRAT_E_SEKSIONEVE[g.seksioni]}, ${vendosur} nga ${g.lista.length} të shqyrtuara`}>
                      <T pesha="trashe" madhesia={16} style={styles.flex}>
                        {EMRAT_E_SEKSIONEVE[g.seksioni]}
                      </T>
                      <Chip teksti={gati ? "✓ Gati" : `${vendosur} nga ${g.lista.length}`} theks={gati} />
                    </View>
                    {g.lista.map((s) => (
                      <Animated.View key={s.id} layout={qetesi ? undefined : LEVIZJA}>
                        <KartaSugjerimit
                          sugjerimi={s}
                          ku={ku(origjinali, s)}
                          vendimi={zgjedhjet.vendimet[s.id]}
                          zbatohet={zbatohen.get(s.id) ?? false}
                          vlerat={zgjedhjet.vlerat}
                          onVlera={(p, v) =>
                            ndrysho((z) => ({ ...z, vlerat: { ...z.vlerat, [celesiVleres(s.id, p)]: v } }))
                          }
                          onPrano={() => prano(s)}
                          onKalo={() => {
                            prekja.zgjedhje();
                            vendos(s.id, "kaluar");
                          }}
                          onZhbej={() => {
                            prekja.zgjedhje();
                            vendos(s.id, null);
                          }}
                        />
                      </Animated.View>
                    ))}
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* Analizë e vjetër (para "Shtoje në CV"): rishkrimet si më parë + ftesa për një analizë të re. */}
        {!meRindertim && (
          <Karta style={styles.ftesa}>
            <T pesha="trashe">Sugjerimet me një prekje vijnë me një analizë të re</T>
            <T zbehur madhesia={13}>
              Kjo analizë u bë para se të vinte &quot;Shtoje në CV&quot;. Një analizë e re të jep sugjerime që i shton në CV me
              një prekje dhe një CV të rindërtuar si PDF.
            </T>
            <Prekshme
              onPress={analizoPerseri}
              accessibilityRole="button"
              style={[styles.butoniIVogel, { backgroundColor: t.teksti }]}
            >
              <T pesha="trashe" madhesia={14} ngjyra={t.sfondi}>
                Analizo përsëri
              </T>
            </Prekshme>
          </Karta>
        )}

        <View style={styles.seksionKrye}>
          <T pesha="trashe" madhesia={20}>
            Seksionet e CV-së
          </T>
          <SegmentedControl
            values={["Këshilla", "Roast 🔥"]}
            selectedIndex={roast ? 1 : 0}
            onChange={(e) => {
              prekja.zgjedhje();
              setRoast(e.nativeEvent.selectedSegmentIndex === 1);
            }}
            appearance={t.errët ? "dark" : "light"}
            accessibilityLabel="Mënyra e komenteve"
            style={styles.segmentet}
          />
        </View>

        {analiza.seksionet.map((seksioni, index) => {
          const mire = seksioni.gjendja === "mire";
          return (
            <Karta key={`${seksioni.emri}-${index}`} style={styles.seksionKarta}>
              <View style={styles.rreshti}>
                <T pesha="trashe" madhesia={16} style={styles.flex}>
                  {seksioni.emri}
                </T>
                {mire && <Ikona emri={IKONAT.check} madhesia={14} ngjyra={t.ok} />}
                <Chip teksti={mire ? "Mirë" : "Përmirëso"} />
              </View>
              <T zbehur>{roast ? seksioni.roast : seksioni.komenti}</T>
            </Karta>
          );
        })}

        {!meRindertim && analiza.rishkrimet.length > 0 && (
          <View style={styles.blloku}>
            <T pesha="trashe" madhesia={20}>
              Si mund të shkruhet më mirë?
            </T>
            {analiza.rishkrimet.map((rishkrimi, index) => (
              <Karta key={index} style={styles.rishkrimKarta}>
                <T zbehur madhesia={11} pesha="trashe">
                  PARA
                </T>
                <T zbehur style={styles.para}>
                  {rishkrimi.para}
                </T>
                <View style={[styles.ndaresi, { backgroundColor: t.vija }]} />
                <T ngjyra={t.ok} madhesia={11} pesha="trashe">
                  PAS
                </T>
                <T pesha="mesme">{rishkrimi.pas}</T>
              </Karta>
            ))}
          </View>
        )}

        {analiza.pikat_e_forta.length > 0 && (
          <View style={styles.blloku}>
            <T pesha="trashe" madhesia={20}>
              Pikat e tua të forta
            </T>
            <Karta style={styles.pikatKarta}>
              {analiza.pikat_e_forta.map((pika, index) => (
                <View key={index} style={styles.pika}>
                  <Ikona emri={IKONAT.check} madhesia={16} ngjyra={t.ok} />
                  <T style={styles.flex}>{pika}</T>
                </View>
              ))}
            </Karta>
          </View>
        )}

        <View style={styles.veprimet}>
          {meRindertim && (
            <Prekshme
              onPress={analizoPerseri}
              accessibilityRole="button"
              accessibilityHint="Përdor një nga 5 analizat e sotme"
              style={[styles.buton, styles.butonDyte, { borderColor: t.vija }]}
            >
              <T pesha="trashe">Analizo përsëri</T>
            </Prekshme>
          )}
          <Prekshme
            onPress={() => router.navigate("/cv")}
            accessibilityRole="button"
            style={[styles.buton, styles.butonDyte, { borderColor: t.vija }]}
          >
            <T pesha="trashe">Ngarko version të ri</T>
          </Prekshme>

          {/* Pas Demo Day-t (HARTA): karta "Ndaje". */}
          {CV_PAS_DEMO_DAY_HAPUR && (
            <Prekshme
              onPress={() => router.push("/cv/ndaje")}
              accessibilityRole="button"
              style={[styles.buton, styles.butonDyte, { borderColor: t.vija }]}
            >
              <T pesha="trashe">Ndaje</T>
            </Prekshme>
          )}
        </View>

        {meRindertim && <View style={styles.hapesiraPerShiritin} />}
      </Faqja>

      {/* Shiriti poshtë: sa ke shqyrtuar dhe veprimi kryesor, aty ku arrin gishti. */}
      {meRindertim && (
        <View
          style={[
            styles.shiriti,
            { backgroundColor: t.karta, borderTopColor: t.vija, shadowColor: t.hija, paddingBottom: kufijte.bottom + 10 },
          ]}
        >
          <View style={styles.rreshti} accessible accessibilityLiveRegion="polite" accessibilityLabel={`Shtove ${n.pranuar}, kalove ${n.kaluar}, mbeten ${n.mbeten}`}>
            <T pesha="gjysme" madhesia={13} style={styles.flex}>
              Shtove {n.pranuar} · Kalove {n.kaluar}
            </T>
            <T zbehur madhesia={13}>
              {n.mbeten === 0 ? "Të gjitha u shqyrtuan" : `Mbeten ${n.mbeten}`}
            </T>
          </View>
          <Progresi vlera={n.gjithsej ? (n.pranuar + n.kaluar) / n.gjithsej : 0} />
          <Prekshme
            onPress={() => router.push({ pathname: "/cv/rindertoje", params: { id } })}
            accessibilityRole="button"
            accessibilityLabel={`Rindërto CV-në me ${n.pranuar} ndryshime`}
            style={[styles.buton, styles.butonShiritit, { backgroundColor: t.teksti }]}
          >
            <T ngjyra={t.sfondi} pesha="trashe">
              {n.pranuar > 0 ? `Rindërto CV-në · ${n.pranuar}` : "Rindërto CV-në"}
            </T>
            <Ikona emri={IKONAT.shigjeta} madhesia={14} ngjyra={t.sfondi} />
          </Prekshme>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap6: { gap: 6 },
  qender: { flex: 1, justifyContent: "center", alignItems: "center", gap: 14, paddingTop: 60 },
  qenderTekst: { textAlign: "center" },
  ngarkimi: { alignItems: "center", gap: 16, paddingTop: 40 },
  hapat: { width: "100%", gap: 16, padding: 20 },
  rreshtiHapit: { flexDirection: "row", alignItems: "center", gap: 12 },
  rrethi: { width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  krye: { gap: 6, marginBottom: 18 },
  notaKarta: { gap: 12, padding: 20 },
  notaRreshti: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  shenimi: { flexDirection: "row", gap: 7, alignItems: "flex-start" },
  rreshti: { flexDirection: "row", alignItems: "center", gap: 8 },
  rregullo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  zhbej: { minHeight: 44, justifyContent: "center", paddingHorizontal: 6 },
  grupi: { gap: 10, marginTop: 8 },
  ftesa: { gap: 8, marginTop: 24 },
  butoniIVogel: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 20,
    minHeight: 44,
    justifyContent: "center",
    marginTop: 4,
  },
  seksionKrye: { gap: 12, marginTop: 28, marginBottom: 12 },
  segmentet: { minHeight: 32 },
  seksionKarta: { gap: 10, marginBottom: 10, padding: 16 },
  blloku: { gap: 12, marginTop: 24 },
  rishkrimKarta: { gap: 8, padding: 16 },
  para: { textDecorationLine: "line-through" },
  ndaresi: { height: StyleSheet.hairlineWidth, marginVertical: 5 },
  pikatKarta: { gap: 14, padding: 16 },
  pika: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  veprimet: { gap: 10, marginTop: 28, marginBottom: 30 },
  buton: { minHeight: 52, borderRadius: 28, justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
  butonDyte: { borderWidth: StyleSheet.hairlineWidth },
  hapesiraPerShiritin: { height: 70 },
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
  butonShiritit: { flexDirection: "row", gap: 8 },
});
