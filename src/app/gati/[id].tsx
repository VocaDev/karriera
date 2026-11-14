// "A jam gati?" (WP3, bordi: ekrani 25 pritja, ekrani 12 rezultati).
// Hapet nga detajet e punës: /gati/<puna_id>. Nëse kjo punë është llogaritur më parë, tregohet rezultati
// i fundit pa e thirrur AI-në; përndryshe AI-ja nis menjëherë (vetëm nëse ka CV).
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import Prekshme from "@/components/Prekshme";
import { Pulsi, Vije } from "@/components/Skeleti";
import { Chip, Faqja, IKONAT, Ikona, Karta, Rruga, T } from "@/components/ui";
import {
  cvEFundit,
  GabimPaCV,
  gatishmeriaEFundit,
  KUFIRI_DITOR_GATI,
  llogaritGatishmerine,
  type CvEFundit,
  type Gatishmeria,
} from "@/lib/gati";
import { KOHA, LEHTESIMI } from "@/lib/levizja";
import { prekja } from "@/lib/prekja";
import { gjePunen, type Puna } from "@/lib/punet";
import { useTema } from "@/lib/tema";

type Gjendja =
  | { lloji: "duke_lexuar" }
  | { lloji: "gabim_leximi"; mesazhi: string }
  | { lloji: "pa_pune" }
  | { lloji: "pa_cv"; puna: Puna }
  | { lloji: "llogarit"; puna: Puna; cv: CvEFundit }
  | { lloji: "gabim_ai"; puna: Puna; cv: CvEFundit; mesazhi: string; iFundit: Gatishmeria | null }
  | { lloji: "rezultati"; puna: Puna; cv: CvEFundit | null; rezultati: Gatishmeria };

export default function GatiEkrani() {
  const t = useTema();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [gjendja, setGjendja] = useState<Gjendja>({ lloji: "duke_lexuar" });
  const aktiv = useRef(true);
  const gjendjaRef = useRef(gjendja);
  // Një thirrje e AI-së në të njëjtën kohë: prekja e dyfishtë ose efekti i dyfishtë s'e harxhojnë kufirin dy herë.
  const dukeLlogaritur = useRef(false);

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
      const rezultati = await llogaritGatishmerine(puna.id);
      if (!aktiv.current) return;
      prekja.sukses();
      setGjendja({ lloji: "rezultati", puna, cv, rezultati });
    } catch (e) {
      if (!aktiv.current) return;
      prekja.gabim();
      if (e instanceof GabimPaCV) {
        setGjendja({ lloji: "pa_cv", puna });
        return;
      }
      const mesazhi = e instanceof Error ? e.message : "Llogaritja dështoi. Provo përsëri.";
      setGjendja({ lloji: "gabim_ai", puna, cv, mesazhi, iFundit });
    } finally {
      dukeLlogaritur.current = false;
    }
  }, []);

  // Lexon punën, rezultatin e fundit dhe CV-në (pa AI). Pa rezultat dhe me CV: nis AI-në vetë.
  const lexo = useCallback(() => {
    Promise.all([gjePunen(id), gatishmeriaEFundit(id), cvEFundit()])
      .then(([puna, rezultati, cv]) => {
        if (!aktiv.current) return;
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

  // Kur kthehesh këtu (nga CV-ja ose nga intervista), rilexo pa AI: CV-ja e re ose gatishmëria e re
  // që shkroi intervista (burimi "intervista") duken menjëherë.
  useFocusEffect(
    useCallback(() => {
      const g = gjendjaRef.current;
      if (g.lloji === "pa_cv") {
        lexo();
      } else if (g.lloji === "rezultati") {
        Promise.all([gatishmeriaEFundit(g.puna.id), cvEFundit()])
          .then(([rezultati, cv]) => {
            if (!aktiv.current || gjendjaRef.current.lloji !== "rezultati") return;
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
      return <Skeleti />;

    case "gabim_leximi":
      return (
        <Qendra>
          <T pesha="trashe" madhesia={17}>
            S&apos;u lexua &quot;A jam gati?&quot;
          </T>
          <T zbehur madhesia={14} style={styles.qendroj}>
            {gjendja.mesazhi}
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
          <Butoni teksti="Shko te CV-ja" onPress={() => router.push("/cv")} />
        </Qendra>
      );

    case "llogarit":
      return <Pritja puna={gjendja.puna} cv={gjendja.cv} />;

    case "gabim_ai": {
      const { puna, cv, iFundit } = gjendja;
      return (
        <Qendra>
          <View style={[styles.ikonaEMadhe, { backgroundColor: t.karta2 }]}>
            <Ikona emri={IKONAT.alarm} madhesia={30} ngjyra={t.keq} />
          </View>
          <T pesha="trashe" madhesia={18} style={styles.qendroj}>
            S&apos;u llogarit gatishmëria
          </T>
          <T zbehur madhesia={14} style={styles.qendroj} accessibilityLiveRegion="polite">
            {gjendja.mesazhi}
          </T>
          <Butoni teksti="Provo përsëri" onPress={() => llogarit(puna, cv, iFundit)} />
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
          onPraktiko={() => router.push({ pathname: "/intervista", params: { puna: puna.id } })}
          onRillogarit={() => (cv ? llogarit(puna, cv, rezultati) : setGjendja({ lloji: "pa_cv", puna }))}
        />
      );
    }
  }
}

// ---------- Pritja (bordi 25): hapat e vërtetë, jo një rrotë bosh ----------

function Pritja({ puna, cv }: { puna: Puna; cv: CvEFundit }) {
  const [sekondat, setSekondat] = useState(0);

  useEffect(() => {
    const ora = setInterval(() => setSekondat((s) => s + 1), 1000);
    return () => clearInterval(ora);
  }, []);

  const kerkesat =
    puna.aftesite.length > 0 ? `${puna.aftesite.length} aftësi të kërkuara` : "kërkesat nga përshkrimi";

  return (
    <Faqja>
      <View style={styles.pritja}>
        <Rruga hapi={1} />
        <T
          pesha="trashe"
          madhesia={24}
          style={[styles.qendroj, styles.titulliPritjes]}
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
        >
          Po e krahasoj CV-në tënde me shpalljen
        </T>
        <T zbehur madhesia={14} style={styles.qendroj}>
          {puna.titulli}, {puna.kompania}
        </T>

        {puna.aftesite.length > 0 && (
          <View style={[styles.aftesite, styles.qendroRreshtin]}>
            {puna.aftesite.map((a, i) => (
              <Animated.View key={`${a}-${i}`} entering={FadeIn.delay(i * 140).duration(KOHA.mesme)}>
                <Chip teksti={a} />
              </Animated.View>
            ))}
          </View>
        )}

        <Karta style={styles.hapatEPritjes}>
          <HapiIPritjes gjendja="kryer" teksti="Lexova shpalljen" detaji={kerkesat} />
          <HapiIPritjes gjendja="kryer" teksti="Gjeta CV-në tënde" detaji={`Versioni ${cv.versioni}`} />
          <HapiIPritjes
            gjendja="aktiv"
            teksti="AI-ja po i krahason"
            detaji={`${sekondat} s · zakonisht 10–40 sekonda`}
          />
          <HapiIPritjes gjendja="pret" teksti="Rezultati ruhet për këtë punë" />
        </Karta>

        <T zbehur madhesia={12.5} style={styles.qendroj}>
          Mund të dalësh nga ky ekran: rezultati ruhet dhe e gjen këtu herën tjetër.
        </T>
      </View>
    </Faqja>
  );
}

function HapiIPritjes({
  gjendja,
  teksti,
  detaji,
}: {
  gjendja: "kryer" | "aktiv" | "pret";
  teksti: string;
  detaji?: string;
}) {
  const t = useTema();
  const etiketa = gjendja === "kryer" ? "kryer" : gjendja === "aktiv" ? "në punë" : "në pritje";
  return (
    <View style={styles.hapiIPritjes} accessible accessibilityLabel={`${teksti}, ${etiketa}${detaji ? `, ${detaji}` : ""}`}>
      <View
        style={[
          styles.pikaEHapit,
          gjendja === "kryer"
            ? { backgroundColor: t.teksti }
            : { borderWidth: 2, borderColor: gjendja === "aktiv" ? t.theksi : t.vija },
        ]}
      >
        {gjendja === "kryer" && <Ikona emri={IKONAT.check} madhesia={12} ngjyra={t.sfondi} />}
        {gjendja === "aktiv" && <ActivityIndicator size="small" color={t.theksi} style={styles.rrota} />}
      </View>
      <View style={styles.flex}>
        <T pesha={gjendja === "pret" ? "normal" : "gjysme"} madhesia={14.5} zbehur={gjendja === "pret"}>
          {teksti}
        </T>
        {detaji ? (
          <T zbehur madhesia={12.5}>
            {detaji}
          </T>
        ) : null}
      </View>
    </View>
  );
}

// ---------- Rezultati (bordi 12) ----------

function Rezultati({
  puna,
  cv,
  rezultati,
  onPraktiko,
  onRillogarit,
}: {
  puna: Puna;
  cv: CvEFundit | null;
  rezultati: Gatishmeria;
  onPraktiko: () => void;
  onRillogarit: () => void;
}) {
  const t = useTema();
  const nga = rezultati.burimi === "intervista" ? "Pas intervistës" : "Nga CV-ja";
  // CV-ja është ndërruar pas kësaj llogaritjeje: numri mund të mos jetë më i saktë.
  const cvMeERe =
    cv !== null &&
    (rezultati.cv_id === null || rezultati.cv_id !== cv.id) &&
    new Date(cv.krijuar_me).getTime() > new Date(rezultati.krijuar_me).getTime();

  return (
    <Faqja>
      <View style={styles.koka}>
        <UnazaEGatishmerise perqindja={rezultati.perqindja} />
        <T zbehur madhesia={14} style={styles.qendroj}>
          {puna.titulli}, {puna.kompania}
        </T>
        <Chip teksti={`${nga} · ${data(rezultati.krijuar_me)}`} />
      </View>
      <Rruga hapi={2} />

      {cvMeERe && (
        <Karta style={styles.rreshtIkone}>
          <Ikona emri={IKONAT.info} madhesia={18} ngjyra={t.zbehur} />
          <T madhesia={13.5} style={styles.flex}>
            Ke një CV më të re se kjo llogaritje. Llogarit përsëri për ta parë numrin me CV-në e re.
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
          Çka ke
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

        <View style={[styles.ndarja, { backgroundColor: t.vija }]} />

        <T pesha="trashe" madhesia={15}>
          Çka të mungon
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
        <View style={styles.hapat}>
          <T pesha="trashe" madhesia={17}>
            Hapat e radhës
          </T>
          {rezultati.hapat.map((h, i) => (
            <View key={`hapi-${i}`} style={styles.rreshtIkone} accessible accessibilityLabel={`Hapi ${i + 1}: ${h}`}>
              <View style={[styles.numri, { backgroundColor: t.karta2 }]}>
                <T pesha="trashe" madhesia={12.5}>
                  {i + 1}
                </T>
              </View>
              <T madhesia={14.5} style={[styles.flex, styles.rreshtiGjate]}>
                {h}
              </T>
            </View>
          ))}
        </View>
      )}

      <T zbehur madhesia={12.5} style={styles.qendroj}>
        Vlerësim i AI-së nga CV-ja dhe shpallja, jo garanci punësimi. AI-ja mund të gabojë: krahasoje me shpalljen.
      </T>

      <Butoni teksti="Praktiko intervistën për këtë punë" ikona={IKONAT.mikrofoni} onPress={onPraktiko} />
      <Butoni
        teksti="Llogarit përsëri"
        dytesor
        onPress={onRillogarit}
        hint={`Përdor një nga ${KUFIRI_DITOR_GATI} llogaritjet që ke në 24 orë`}
      />
      <T zbehur madhesia={12} style={styles.qendroj}>
        Llogaritja e re zgjat 10–40 sekonda dhe numërohet te kufiri: {KUFIRI_DITOR_GATI} herë në 24 orë.
      </T>
    </Faqja>
  );
}

// Numri i madh (bordi: "rd lg"): harku portokalli mbushet një herë kur hapet; me Reduce Motion rri i plotë.
const R = 42;
const PERIMETRI = 2 * Math.PI * R;
const RrethiIAnimuar = Animated.createAnimatedComponent(Circle);

function UnazaEGatishmerise({ perqindja }: { perqindja: number }) {
  const t = useTema();
  const qetesi = useReducedMotion();
  const v = perqindja / 100;
  const progresi = useSharedValue(qetesi ? v : 0);

  useEffect(() => {
    progresi.set(qetesi ? v : withDelay(80, withTiming(v, { duration: KOHA.ngadale * 2, easing: LEHTESIMI.hyrje })));
  }, [v, qetesi, progresi]);

  const harku = useAnimatedProps(() => ({ strokeDashoffset: PERIMETRI * (1 - progresi.get()) }));

  return (
    <View
      style={styles.unaza}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Gati ${perqindja} për qind për këtë punë`}
      accessibilityValue={{ min: 0, max: 100, now: perqindja }}
    >
      <Svg width={176} height={176} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <Circle cx={50} cy={50} r={R} stroke={t.karta2} strokeWidth={7} fill="none" />
        <RrethiIAnimuar
          cx={50}
          cy={50}
          r={R}
          stroke={t.theksi}
          strokeWidth={7}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${PERIMETRI} ${PERIMETRI}`}
          animatedProps={harku}
          transform="rotate(-90 50 50)"
        />
      </Svg>
      <T pesha="shumeTrashe" madhesia={52} maxFontSizeMultiplier={1.15} style={styles.numriIMadh}>
        {perqindja}
        <T pesha="trashe" madhesia={22} maxFontSizeMultiplier={1.15}>
          %
        </T>
      </T>
      <T zbehur pesha="gjysme" madhesia={13}>
        gati
      </T>
    </View>
  );
}

// ---------- Pjesët e vogla ----------

function Qendra({ children }: { children: ReactNode }) {
  return (
    <Faqja>
      <View style={styles.qendra}>{children}</View>
    </Faqja>
  );
}

function Butoni({
  teksti,
  onPress,
  dytesor = false,
  ikona,
  hint,
}: {
  teksti: string;
  onPress: () => void;
  dytesor?: boolean;
  ikona?: { ios: string; android: string };
  hint?: string;
}) {
  const t = useTema();
  const ngjyra = dytesor ? t.teksti : t.sfondi;
  return (
    <Prekshme
      accessibilityRole="button"
      accessibilityLabel={teksti}
      accessibilityHint={hint}
      onPress={onPress}
      style={[
        styles.butoni,
        dytesor ? { borderWidth: 1.5, borderColor: t.vija, backgroundColor: t.karta } : { backgroundColor: t.teksti },
      ]}
    >
      {ikona && <Ikona emri={ikona} madhesia={16} ngjyra={ngjyra} />}
      <T pesha="trashe" madhesia={16} ngjyra={ngjyra}>
        {teksti}
      </T>
    </Prekshme>
  );
}

function Skeleti() {
  const t = useTema();
  return (
    <Faqja>
      <Pulsi>
        <View style={styles.skeleti} accessibilityLabel="Po ngarkohet">
          <View style={[styles.unazaSkelet, { borderColor: t.karta2 }]} />
          <Vije gjeresia="60%" lartesia={14} />
          <Vije gjeresia="100%" lartesia={10} rrezja={5} />
          <View style={[styles.kartaSkelet, { backgroundColor: t.karta }]}>
            <Vije gjeresia="35%" lartesia={14} />
            <Vije gjeresia="90%" lartesia={12} />
            <Vije gjeresia="70%" lartesia={12} />
          </View>
        </View>
      </Pulsi>
    </Faqja>
  );
}

function data(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dy = (n: number) => String(n).padStart(2, "0");
  return `${dy(d.getDate())}.${dy(d.getMonth() + 1)}.${d.getFullYear()}`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  qendroj: { textAlign: "center" },
  qendra: { alignItems: "center", gap: 12, paddingTop: 48, paddingHorizontal: 8 },
  ikonaEMadhe: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  butoni: {
    flexDirection: "row",
    gap: 8,
    alignSelf: "stretch",
    borderRadius: 999,
    paddingVertical: 15,
    paddingHorizontal: 20,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  pritja: { gap: 14, paddingTop: 12 },
  titulliPritjes: { letterSpacing: -0.5, marginTop: 10 },
  aftesite: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  qendroRreshtin: { justifyContent: "center" },
  hapatEPritjes: { gap: 14 },
  hapiIPritjes: { flexDirection: "row", gap: 12, alignItems: "center" },
  pikaEHapit: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  rrota: { transform: [{ scale: 0.7 }] },
  koka: { alignItems: "center", gap: 10, paddingTop: 4 },
  unaza: { width: 176, height: 176, alignItems: "center", justifyContent: "center" },
  numriIMadh: { letterSpacing: -1.5, lineHeight: 58 },
  karta: { gap: 10 },
  rreshtIkone: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  shenja: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 1 },
  shenjaX: { lineHeight: 14 },
  mungon: { gap: 2 },
  ndarja: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
  hapat: { gap: 10, marginTop: 4 },
  numri: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  rreshtiGjate: { lineHeight: 21 },
  skeleti: { gap: 12, alignItems: "center", paddingTop: 8 },
  unazaSkelet: { width: 176, height: 176, borderRadius: 88, borderWidth: 12 },
  kartaSkelet: { alignSelf: "stretch", borderRadius: 22, padding: 16, gap: 10, marginTop: 8 },
});
