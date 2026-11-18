// "A jam gati?" (WP3, bordi: ekrani 25 pritja, ekrani 12 rezultati). Hapet nga detajet e punës: /gati/<puna_id>.
// Nëse kjo punë është llogaritur më parë, tregohet rezultati i fundit pa e thirrur AI-në; përndryshe AI-ja nis
// menjëherë (vetëm nëse ka CV). Rezultati ka historinë (+12 nga herë e kaluar), Çka ke / Çka të mungon dhe hapat si
// veprime të vërteta. Numrat vijnë vetëm nga rreshtat e vërtetë të tabelës gatishmeria.
import * as WebBrowser from "expo-web-browser";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import {
  Butoni,
  dataEPlote,
  HistoriaERreshtit,
  NdryshimiChip,
  Pritja,
  Qendra,
  RreshtiIHapit,
  SkeletiILeximit,
  UnazaEGatishmerise,
  type VeprimiNeRresht,
} from "@/components/GatiPjeset";
import { useNjoftim } from "@/components/Njoftimet";
import ShiritiPaInternet from "@/components/ShiritiPaInternet";
import { Chip, Faqja, IKONAT, Ikona, Karta, Rruga, T } from "@/components/ui";
import {
  cvEFundit,
  GabimKufiri,
  GabimPaCV,
  gatishmeriaEFundit,
  gjykimiIPerqindjes,
  historiaEPunes,
  KUFIRI_DITOR_GATI,
  kohaERivendosjes,
  lexoKufirin,
  llogaritGatishmerine,
  ndryshimiKundrejtParaprakut,
  veprimiIHapit,
  type CvEFundit,
  type Gatishmeria,
  type Kufiri,
  type Prova,
} from "@/lib/gati";
import { lexoShenjat, ruajShenjat } from "@/lib/gati-hapat";
import { useDridhja } from "@/lib/levizja";
import { prekja } from "@/lib/prekja";
import { gjePunen, type Puna } from "@/lib/punet";
import { eshteGabimRrjeti, KOHA_E_AI, KOHA_E_LEXIMIT, meKohe, useRrjeti } from "@/lib/rrjeti";
import { useTema } from "@/lib/tema";

type Gjendja =
  | { lloji: "duke_lexuar" }
  | { lloji: "gabim_leximi"; mesazhi: string }
  | { lloji: "pa_pune" }
  | { lloji: "pa_cv"; puna: Puna }
  | { lloji: "llogarit"; puna: Puna; cv: CvEFundit }
  | { lloji: "gabim_ai"; puna: Puna; cv: CvEFundit; mesazhi: string; iFundit: Gatishmeria | null }
  | { lloji: "kufiri"; puna: Puna; cv: CvEFundit; kufiri: Kufiri | null; iFundit: Gatishmeria | null }
  | { lloji: "rezultati"; puna: Puna; cv: CvEFundit | null; rezultati: Gatishmeria };

const eProva = (r: Gatishmeria): Prova => ({ id: r.id, perqindja: r.perqindja, burimi: r.burimi, krijuar_me: r.krijuar_me });

export default function GatiEkrani() {
  const t = useTema();
  const router = useRouter();
  const njofto = useNjoftim();
  const { kaInternet, sapuKthye } = useRrjeti();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [gjendja, setGjendja] = useState<Gjendja>({ lloji: "duke_lexuar" });
  const [historia, setHistoria] = useState<Prova[]>([]); // kontrollet e kësaj pune, më i riu i pari
  const [kufiri, setKufiri] = useState<Kufiri | null>(null); // null = s'dihet (funksioni i vjetër ose pa internet)
  const aktiv = useRef(true);
  const gjendjaRef = useRef(gjendja);
  // Një thirrje e AI-së në të njëjtën kohë: prekja e dyfishtë ose efekti i dyfishtë s'e harxhojnë kufirin dy herë.
  const dukeLlogaritur = useRef(false);
  // Kufiri lexohet një herë kur del rezultati (pa AI); pas një llogaritjeje e jep vetë përgjigjja.
  const kufiriIPyetur = useRef(false);

  useEffect(() => {
    gjendjaRef.current = gjendja;
  }, [gjendja]);

  useEffect(() => {
    aktiv.current = true;
    return () => {
      aktiv.current = false;
    };
  }, []);

  // Thërret AI-në (numërohet te kufiri ditor). iFundit: rezultati që kthehet nëse kjo provë dështon.
  const llogarit = useCallback(async (puna: Puna, cv: CvEFundit, iFundit: Gatishmeria | null) => {
    if (dukeLlogaritur.current) return;
    dukeLlogaritur.current = true;
    setGjendja({ lloji: "llogarit", puna, cv });
    try {
      // Ruajtësi i kohës: një lidhje që varet bëhet gabim me "Provo përsëri", jo rrotë pa fund.
      const { rezultati, kufiri: kufiriRi } = await meKohe(llogaritGatishmerine(puna.id), KOHA_E_AI);
      if (!aktiv.current) return;
      prekja.sukses();
      kufiriIPyetur.current = kufiriRi !== null;
      if (kufiriRi) setKufiri(kufiriRi);
      setHistoria((h) => [eProva(rezultati), ...h.filter((p) => p.id !== rezultati.id)]);
      setGjendja({ lloji: "rezultati", puna, cv, rezultati });
    } catch (e) {
      if (!aktiv.current) return;
      prekja.gabim();
      if (e instanceof GabimPaCV) {
        setGjendja({ lloji: "pa_cv", puna });
        return;
      }
      if (e instanceof GabimKufiri) {
        if (e.kufiri) setKufiri(e.kufiri);
        setGjendja({ lloji: "kufiri", puna, cv, kufiri: e.kufiri, iFundit });
        return;
      }
      const mesazhi = e instanceof Error ? e.message : "Llogaritja dështoi. Provo përsëri.";
      setGjendja({ lloji: "gabim_ai", puna, cv, mesazhi, iFundit });
    } finally {
      dukeLlogaritur.current = false;
    }
  }, []);

  // Lexon punën, rezultatin e fundit, historinë dhe CV-në (pa AI). Pa rezultat dhe me CV: nis AI-në vetë.
  const lexo = useCallback(() => {
    meKohe(
      Promise.all([
        gjePunen(id),
        gatishmeriaEFundit(id),
        cvEFundit(),
        // historia është shtesë: nëse dështon, rezultati shfaqet pa të
        historiaEPunes(id).catch((): Prova[] => []),
      ]),
      KOHA_E_LEXIMIT,
    )
      .then(([puna, rezultati, cv, kaluara]) => {
        if (!aktiv.current) return;
        setHistoria(kaluara);
        if (!puna) setGjendja({ lloji: "pa_pune" });
        else if (rezultati) setGjendja({ lloji: "rezultati", puna, cv, rezultati });
        else if (!cv) setGjendja({ lloji: "pa_cv", puna });
        else llogarit(puna, cv, null);
      })
      .catch((e: unknown) => {
        if (!aktiv.current) return;
        setGjendja({ lloji: "gabim_leximi", mesazhi: e instanceof Error ? e.message : "Gabim i panjohur." });
      });
  }, [id, llogarit]);

  useEffect(() => {
    lexo();
  }, [lexo]);

  // Interneti u kthye pas një leximi të dështuar: rilexon vetë (leximi s'përdor AI, s'ha nga kufiri).
  // Llogaritja e AI-së s'niset vetë: e nis përdoruesi me "Provo përsëri".
  useEffect(() => {
    if (!sapuKthye) return;
    const g = gjendjaRef.current;
    if (g.lloji === "gabim_leximi" && eshteGabimRrjeti(g.mesazhi)) {
      setGjendja({ lloji: "duke_lexuar" });
      lexo();
    }
  }, [sapuKthye, lexo]);

  // Sa kontrolle kanë mbetur: një pyetje pa AI sa del rezultati (nëse funksioni e njeh; përndryshe mbetet null).
  useEffect(() => {
    if (gjendja.lloji !== "rezultati" || kufiriIPyetur.current) return;
    kufiriIPyetur.current = true;
    lexoKufirin().then((k) => {
      if (aktiv.current && k) setKufiri(k);
    });
  }, [gjendja.lloji]);

  // Kur kthehesh këtu (nga CV-ja ose nga intervista), rilexo pa AI: CV-ja e re ose gatishmëria e re
  // që shkroi intervista (burimi "intervista") duken menjëherë.
  useFocusEffect(
    useCallback(() => {
      const g = gjendjaRef.current;
      if (g.lloji === "pa_cv") {
        lexo();
      } else if (g.lloji === "rezultati") {
        Promise.all([gatishmeriaEFundit(g.puna.id), cvEFundit(), historiaEPunes(g.puna.id)])
          .then(([rezultati, cv, kaluara]) => {
            if (!aktiv.current || gjendjaRef.current.lloji !== "rezultati") return;
            setHistoria(kaluara);
            setGjendja({ lloji: "rezultati", puna: g.puna, cv, rezultati: rezultati ?? g.rezultati });
          })
          .catch(() => {
            // rifreskim në heshtje: rezultati që shihet mbetet i vlefshëm
          });
      }
    }, [lexo]),
  );

  switch (gjendja.lloji) {
    case "duke_lexuar":
      return <SkeletiILeximit />;

    case "gabim_leximi": {
      const paInternet = eshteGabimRrjeti(gjendja.mesazhi);
      return (
        <Qendra>
          <T pesha="trashe" madhesia={17}>
            {paInternet ? "Pa internet" : "S'u lexua \"A jam gati?\""}
          </T>
          <T zbehur madhesia={14} style={styles.qendroj} accessibilityLiveRegion="polite">
            {paInternet ? "Lidhu me internet dhe rezultati shfaqet vetë. Ose prek Provo përsëri." : gjendja.mesazhi}
          </T>
          <Butoni
            teksti="Provo përsëri"
            onPress={() => {
              setGjendja({ lloji: "duke_lexuar" });
              lexo();
            }}
          />
        </Qendra>
      );
    }

    case "pa_pune":
      return (
        <Qendra>
          <T pesha="trashe" madhesia={17}>
            Kjo punë nuk u gjet
          </T>
          <T zbehur madhesia={14} style={styles.qendroj}>
            Ndoshta shpallja është hequr. Zgjidh një punë tjetër nga lista.
          </T>
          <Butoni teksti="Te punët" onPress={() => router.replace("/pune")} />
        </Qendra>
      );

    case "pa_cv":
      return (
        <Qendra>
          <View style={[styles.ikonaEMadhe, { backgroundColor: t.karta2 }]}>
            <Ikona emri={IKONAT.dokumenti} madhesia={30} ngjyra={t.zbehur} />
          </View>
          <T pesha="trashe" madhesia={20} style={styles.qendroj}>
            Së pari, CV-ja jote
          </T>
          <T zbehur madhesia={14.5} style={styles.qendroj}>
            Që ta dish sa je gati për &quot;{gjendja.puna.titulli}&quot;, AI-ja duhet ta krahasojë CV-në tënde me
            shpalljen. Ngarko PDF-në ose ndërtoje me AI, pastaj kthehu këtu.
          </T>
          <Butoni teksti="Ngarko CV-në" onPress={() => router.push("/cv")} />
        </Qendra>
      );

    case "llogarit":
      return (
        <View style={styles.flex}>
          <View style={styles.shiriti}>
            <ShiritiPaInternet teksti="Pa internet · kontrolli mund të dështojë" style={styles.shiritiLart} />
          </View>
          <Pritja puna={gjendja.puna} cv={gjendja.cv} />
        </View>
      );

    case "kufiri": {
      const { puna, iFundit, kufiri: k } = gjendja;
      const kur = kohaERivendosjes(k?.rivendoset ?? null);
      return (
        <Qendra>
          <View style={[styles.ikonaEMadhe, { backgroundColor: t.karta2 }]}>
            <Ikona emri={IKONAT.alarm} madhesia={30} ngjyra={t.zbehur} />
          </View>
          <T pesha="trashe" madhesia={18} style={styles.qendroj}>
            Ke përdorur të gjitha kontrollet
          </T>
          <T zbehur madhesia={14} style={styles.qendroj} accessibilityLiveRegion="polite">
            {k ? `${k.perdorur} nga ${k.maks}` : `${KUFIRI_DITOR_GATI} nga ${KUFIRI_DITOR_GATI}`} kontrolle në 24 orët e
            fundit.{" "}
            {kur
              ? `Një vend lirohet ${kur}.`
              : "Një vend lirohet brenda 24 orësh nga kontrolli më i vjetër."}
          </T>
          {iFundit ? (
            <Butoni
              teksti="Shiko rezultatin e fundit"
              onPress={() => setGjendja({ lloji: "rezultati", puna, cv: gjendja.cv, rezultati: iFundit })}
            />
          ) : (
            <Butoni teksti="Te punët" dytesor onPress={() => router.replace("/pune")} />
          )}
        </Qendra>
      );
    }

    case "gabim_ai": {
      const { puna, cv, iFundit } = gjendja;
      const paInternet = eshteGabimRrjeti(gjendja.mesazhi);
      return (
        <Qendra>
          <View style={[styles.ikonaEMadhe, { backgroundColor: t.karta2 }]}>
            <Ikona emri={IKONAT.alarm} madhesia={30} ngjyra={t.keq} />
          </View>
          <T pesha="trashe" madhesia={18} style={styles.qendroj}>
            {paInternet ? "Pa internet" : "S'u llogarit gatishmëria"}
          </T>
          <T zbehur madhesia={14} style={styles.qendroj} accessibilityLiveRegion="polite">
            {paInternet ? "Kontrolli s'u mbaroi. Kur të lidhesh, prek Provo përsëri." : gjendja.mesazhi}
          </T>
          <Butoni
            teksti="Provo përsëri"
            jashtePune={paInternet && !kaInternet}
            hint={paInternet && !kaInternet ? "Pa internet" : undefined}
            onPress={() => {
              if (paInternet && !kaInternet) {
                prekja.lehte();
                njofto("Ende pa internet. Lidhu dhe provo përsëri.", "info");
                return;
              }
              llogarit(puna, cv, iFundit);
            }}
          />
          {iFundit && (
            <Butoni
              teksti="Shiko rezultatin e fundit"
              dytesor
              onPress={() => setGjendja({ lloji: "rezultati", puna, cv, rezultati: iFundit })}
            />
          )}
        </Qendra>
      );
    }

    case "rezultati": {
      const { puna, cv, rezultati } = gjendja;
      return (
        <Rezultati
          puna={puna}
          cv={cv}
          rezultati={rezultati}
          historia={historia}
          kufiri={kufiri}
          paInternet={!kaInternet}
          onRillogarit={() => (cv ? llogarit(puna, cv, rezultati) : setGjendja({ lloji: "pa_cv", puna }))}
        />
      );
    }
  }
}

// ---------- Rezultati (bordi 12) ----------

function Rezultati({
  puna,
  cv,
  rezultati,
  historia,
  kufiri,
  paInternet,
  onRillogarit,
}: {
  puna: Puna;
  cv: CvEFundit | null;
  rezultati: Gatishmeria;
  historia: Prova[];
  kufiri: Kufiri | null;
  paInternet: boolean;
  onRillogarit: () => void;
}) {
  const t = useTema();
  const router = useRouter();
  const njofto = useNjoftim();
  const { stili: stiliIDridhjes, dridhu } = useDridhja();
  const [bere, setBere] = useState<number[]>([]);

  const nga = rezultati.burimi === "intervista" ? "Pas intervistës" : "Nga CV-ja";
  const delta = ndryshimiKundrejtParaprakut(historia, rezultati);
  // CV-ja është ndërruar pas kësaj llogaritjeje: numri mund të mos jetë më i saktë.
  const cvMeERe =
    cv !== null &&
    (rezultati.cv_id === null || rezultati.cv_id !== cv.id) &&
    new Date(cv.krijuar_me).getTime() > new Date(rezultati.krijuar_me).getTime();

  // Shenjat "e bëra" janë të jotat: lexohen nga telefoni për këtë rezultat (hapat ndryshojnë me çdo llogaritje).
  useEffect(() => {
    let gjalle = true;
    lexoShenjat(puna.id, rezultati.id).then((b) => {
      if (gjalle) setBere(b);
    });
    return () => {
      gjalle = false;
    };
  }, [puna.id, rezultati.id]);

  function ndryshoShenjen(i: number) {
    prekja.zgjedhje();
    const tjeter = bere.includes(i) ? bere.filter((x) => x !== i) : [...bere, i];
    setBere(tjeter);
    ruajShenjat(puna.id, rezultati.id, tjeter);
  }

  const praktiko = () => router.push({ pathname: "/intervista", params: { puna: puna.id } });
  const linku = puna.linku && /^https?:\/\//i.test(puna.linku) ? puna.linku : null;

  function veprimiPer(hapi: string): VeprimiNeRresht | null {
    switch (veprimiIHapit(hapi)) {
      case "intervista":
        return { teksti: "Praktiko intervistën për këtë punë", ikona: IKONAT.mikrofoni, onPress: praktiko };
      case "cv":
        return { teksti: "Përmirëso CV-në", ikona: IKONAT.dokumenti, onPress: () => router.push("/cv") };
      case "apliko":
        if (!linku) return null; // pa lidhje të shpalljes s'ka çka të hapet: hapi mbetet tekst
        return {
          teksti: "Apliko",
          ikona: IKONAT.linku,
          onPress: () => {
            WebBrowser.openBrowserAsync(linku).catch(() => njofto("S'u hap shpallja. Provo përsëri.", "gabim"));
          },
        };
      default:
        return null;
    }
  }

  const veprimet = rezultati.hapat.map(veprimiPer);
  const interviste_te_hapat = rezultati.hapat.some((h) => veprimiIHapit(h) === "intervista");

  // Kufiri ditor: njohim vetëm çka na jep funksioni; pa të, tregojmë vetëm kufirin e përgjithshëm.
  const arritur = kufiri !== null && kufiri.perdorur >= kufiri.maks;
  const kur = kufiri ? kohaERivendosjes(kufiri.rivendoset) : null;
  const cvPaNdryshuar = !cvMeERe && rezultati.burimi === "cv";
  let nenButonin: string;
  if (paInternet) {
    nenButonin = "Pa internet: lidhu për ta kontrolluar përsëri. Rezultati i fundit mbetet këtu.";
  } else if (arritur) {
    nenButonin = `Ke përdorur ${kufiri.perdorur} nga ${kufiri.maks} kontrolle në 24 orët e fundit.${
      kur ? ` Një vend lirohet ${kur}.` : ""
    }`;
  } else if (kufiri) {
    nenButonin = `Ke përdorur ${kufiri.perdorur} nga ${kufiri.maks} kontrolle në 24 orët e fundit. Një kontroll i ri zgjat 10–40 sekonda.`;
  } else {
    nenButonin = `Kufiri: ${KUFIRI_DITOR_GATI} kontrolle në 24 orë. Një kontroll i ri zgjat 10–40 sekonda.`;
  }
  if (cvPaNdryshuar && !arritur && !paInternet) {
    nenButonin += " CV-ja s'ka ndryshuar që nga ky kontroll, prandaj numri do dalë afërsisht i njëjtë.";
  }

  return (
    <Faqja>
      <ShiritiPaInternet teksti="Pa internet · po shfaqim rezultatin e fundit" />
      <View style={styles.koka}>
        <UnazaEGatishmerise perqindja={rezultati.perqindja} />
        <T pesha="trashe" madhesia={18} style={[styles.qendroj, styles.gjykimi]} accessibilityRole="header">
          {gjykimiIPerqindjes(rezultati.perqindja)}
        </T>
        <T zbehur madhesia={14} style={styles.qendroj}>
          {puna.titulli}, {puna.kompania}
        </T>
        <View style={styles.chipat}>
          <Chip teksti={`${nga} · ${dataEPlote(rezultati.krijuar_me)}`} />
          {delta !== null && <NdryshimiChip delta={delta} />}
        </View>
      </View>
      <Rruga hapi={2} />
      <HistoriaERreshtit historia={historia} aktualiId={rezultati.id} />

      {cvMeERe && (
        <Karta style={styles.rreshtIkone}>
          <Ikona emri={IKONAT.info} madhesia={18} ngjyra={t.zbehur} />
          <T madhesia={13.5} style={styles.flex}>
            Ke një CV më të re se kjo llogaritje. Kontrollo përsëri për ta parë numrin me CV-në e re.
          </T>
        </Karta>
      )}

      <Karta style={styles.karta}>
        <T pesha="trashe" madhesia={15}>
          Pse ky numër
        </T>
        <T madhesia={14.5} style={styles.rreshtiGjate}>
          {rezultati.arsyeja}
        </T>
      </Karta>

      <Karta style={styles.karta}>
        <T pesha="trashe" madhesia={15}>
          Çka ke{rezultati.ke.length > 0 ? ` · ${rezultati.ke.length}` : ""}
        </T>
        {rezultati.ke.length === 0 ? (
          <T zbehur madhesia={13.5}>
            Asnjë nga kërkesat e kësaj pune s&apos;duket ende qartë në CV-në tënde.
          </T>
        ) : (
          rezultati.ke.map((k, i) => (
            <View
              key={`ke-${i}-${k.aftesia}`}
              style={styles.rreshtIkone}
              accessible
              accessibilityLabel={`E ke: ${k.aftesia}. ${k.deshmia}`}
            >
              <View style={[styles.shenja, { backgroundColor: t.ok }]}>
                <Ikona emri={IKONAT.check} madhesia={11} ngjyra="#FFFFFF" />
              </View>
              <View style={styles.flex}>
                <T pesha="gjysme" madhesia={14.5}>
                  {k.aftesia}
                </T>
                {k.deshmia ? (
                  <T zbehur madhesia={13}>
                    {k.deshmia}
                  </T>
                ) : null}
              </View>
            </View>
          ))
        )}
      </Karta>

      <Karta style={styles.karta}>
        <T pesha="trashe" madhesia={15}>
          Çka të mungon{rezultati.mungon.length > 0 ? ` · ${rezultati.mungon.length}` : ""}
        </T>
        {rezultati.mungon.length === 0 ? (
          <T zbehur madhesia={13.5}>
            Asgjë thelbësore nga shpallja s&apos;mungon në CV-në tënde.
          </T>
        ) : (
          rezultati.mungon.map((m, i) => (
            <View
              key={`mungon-${i}-${m.aftesia}`}
              style={styles.rreshtIkone}
              accessible
              accessibilityLabel={`Të mungon: ${m.aftesia}. ${m.pse} Si ta mbyllësh: ${m.si}`}
            >
              <View style={[styles.shenja, { borderWidth: 1.5, borderColor: t.keq }]}>
                <T pesha="trashe" madhesia={11} ngjyra={t.keq} style={styles.shenjaX}>
                  ✕
                </T>
              </View>
              <View style={[styles.flex, styles.mungon]}>
                <T pesha="gjysme" madhesia={14.5}>
                  {m.aftesia}
                </T>
                {m.pse ? (
                  <T zbehur madhesia={13}>
                    <T pesha="gjysme" madhesia={13} zbehur>
                      Pse ka rëndësi:{" "}
                    </T>
                    {m.pse}
                  </T>
                ) : null}
                {m.si ? (
                  <T madhesia={13}>
                    <T pesha="gjysme" madhesia={13}>
                      Si ta mbyllësh:{" "}
                    </T>
                    {m.si}
                  </T>
                ) : null}
              </View>
            </View>
          ))
        )}
      </Karta>

      {rezultati.hapat.length > 0 && (
        <Karta style={styles.karta}>
          <T pesha="trashe" madhesia={17}>
            Hapat e radhës
          </T>
          <T zbehur madhesia={12.5}>
            Shenja ✓ është e jotja dhe mbetet vetëm në këtë telefon: s&apos;e ndryshon përqindjen. Numri ndryshon kur
            kontrollon përsëri.
          </T>
          {rezultati.hapat.map((h, i) => (
            <RreshtiIHapit
              key={`hapi-${i}`}
              numri={i + 1}
              teksti={h}
              bere={bere.includes(i)}
              onNdrysho={() => ndryshoShenjen(i)}
              veprimi={veprimet[i]}
            />
          ))}
        </Karta>
      )}

      <T zbehur madhesia={12.5} style={styles.qendroj}>
        Vlerësim i AI-së nga CV-ja dhe shpallja, jo garanci punësimi. AI-ja mund të gabojë: krahasoje me shpalljen.
      </T>

      {!interviste_te_hapat && (
        <Butoni teksti="Praktiko intervistën për këtë punë" ikona={IKONAT.mikrofoni} onPress={praktiko} />
      )}
      <Animated.View style={stiliIDridhjes}>
        <Butoni
          teksti="Kontrollo përsëri"
          dytesor
          jashtePune={arritur || paInternet}
          onPress={() => {
            if (arritur || paInternet) {
              // si çdo gjë e kyçur: dridhje e lehtë, dhe teksti poshtë thotë pse (pa internet, ose kur lirohet kufiri)
              prekja.lehte();
              dridhu();
              return;
            }
            onRillogarit();
          }}
          hint={paInternet ? "Pa internet" : arritur ? "Kufiri ditor u arrit" : "Përdor një nga kontrollet e 24 orëve"}
        />
      </Animated.View>
      <T zbehur madhesia={12} style={styles.qendroj} accessibilityLiveRegion="polite">
        {nenButonin}
      </T>
    </Faqja>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shiriti: { paddingHorizontal: 18 },
  shiritiLart: { marginTop: 8, marginBottom: 0 },
  qendroj: { textAlign: "center" },
  ikonaEMadhe: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  koka: { alignItems: "center", gap: 10, paddingTop: 4 },
  gjykimi: { letterSpacing: -0.3 },
  chipat: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", alignItems: "center" },
  karta: { gap: 10 },
  rreshtIkone: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  shenja: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 1 },
  shenjaX: { lineHeight: 14 },
  mungon: { gap: 2 },
  rreshtiGjate: { lineHeight: 21 },
});
