import { Link, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn, LinearTransition, useReducedMotion } from "react-native-reanimated";

import { useNjoftim } from "@/components/Njoftimet";
import Prekshme from "@/components/Prekshme";
import ShiritiPaInternet from "@/components/ShiritiPaInternet";
import { KartaSkelet } from "@/components/Skeleti";
import { GradientiSiper } from "@/components/TabEkrani";
import { Chip, IKONAT, Ikona, Karta, T } from "@/components/ui";
import { merrNumratEQendres, type NumratEQendres } from "@/lib/hyrja";
import { GabimPaAktivizim, merrNumratEPozitave, type NumratEPozites } from "@/lib/kandidatet";
import { KOHA, LEHTESIMI } from "@/lib/levizja";
import { prekja } from "@/lib/prekja";
import { paInternet, PA_INTERNET_SHKURT } from "@/lib/mesazhet";
import { KOHA_E_LEXIMIT, meKohe, pamjaEGabimit, useRrjeti } from "@/lib/rrjeti";
import { fshiPunen, listoPunetEMia, merrPunenERe, type Puna } from "@/lib/punet";
import { useSesioni } from "@/lib/sesioni";
import { useTema } from "@/lib/tema";

const PA_INTERNET_ME_LISTE = paInternet("po t'i shfaqim punët që i pe herën e fundit");
const PA_INTERNET_PA_LISTE = "s'kemi ende punë të ruajtura për t'i shfaqur";

const LEVIZJA = LinearTransition.duration(KOHA.mesme).easing(LEHTESIMI.levizje);
const HYRJA = FadeIn.duration(320).easing(LEHTESIMI.hyrje);

/** "3 gati · ⭐ 2 · 5 kontrolle": vetëm totale nga serveri (numrat_e_pozitave). */
function rreshtiINumrave(n: NumratEPozites): string {
  const pjeset = [`${n.gati} ${n.gati === 1 ? "kandidat gati" : "kandidatë gati"}`];
  if (n.ruajtur > 0) pjeset.push(`⭐ ${n.ruajtur}`);
  if (n.kontrolluan > 0) pjeset.push(`${n.kontrolluan} ${n.kontrolluan === 1 ? "kontroll" : "kontrolle"} "A jam gati?"`);
  return pjeset.join(" · ");
}

// Lista e punëve të mia, me "Shto" dhe "Fshi".
// Punëdhënësi (tab-i "Pozitat"): te secila punë numrat e saj; prekja hap kandidatët e pozitës.
// Qendra (tab-i "Qendra"): numrat e Karrierës (vetëm totale) dhe prekja hap shpalljen.
// Titulli i madh është te koka e Stack-ut të tab-it; këtu vetëm emri i organizatës.
export default function PunetEMia() {
  const t = useTema();
  const qetesi = useReducedMotion();
  const njofto = useNjoftim();
  const { profili } = useSesioni();
  const qender = profili?.lloji === "qender";
  const [punet, setPunet] = useState<Puna[] | null>(null);
  const [numrat, setNumrat] = useState<NumratEQendres | null>(null);
  const [numratEPozitave, setNumratEPozitave] = useState<Map<string, NumratEPozites> | null>(null);
  const [gabimi, setGabimi] = useState<string | null>(null);
  const [rifreskim, setRifreskim] = useState(false);
  const [ePunesSeRe, setEPunesSeRe] = useState<string | null>(null);

  const ngarko = useCallback(async () => {
    if (!profili) return false;
    try {
      // allSettled: numrat që dështojnë (p.sh. migrimi s'është aplikuar) s'e rrëzojnë listën e punëve (dhe anasjelltas).
      const [teMiat, n, np] = await Promise.allSettled([
        meKohe(listoPunetEMia(), KOHA_E_LEXIMIT),
        profili.lloji === "qender" ? meKohe(merrNumratEQendres(), KOHA_E_LEXIMIT) : Promise.resolve(null),
        profili.lloji === "punedhenes" ? meKohe(merrNumratEPozitave(), KOHA_E_LEXIMIT) : Promise.resolve(null),
      ]);
      if (teMiat.status === "rejected") throw teMiat.reason;
      const iRi = merrPunenERe();
      setPunet(teMiat.value);
      if (n.status === "fulfilled") setNumrat(n.value); // numrat e vjetër mbeten nëse ky lexim dështoi
      if (np.status === "fulfilled") setNumratEPozitave(np.value);
      setGabimi(null);
      if (iRi) setEPunesSeRe(iRi);
      // Para se të aplikohet migrimi, numrat e pozitave mungojnë: lista punon, prandaj s'është dështim i rifreskimit.
      return n.status === "fulfilled" && (np.status === "fulfilled" || np.reason instanceof GabimPaAktivizim);
    } catch (e) {
      setGabimi(e instanceof Error ? e.message : "Gabim i panjohur");
      return false;
    }
  }, [profili]);

  useFocusEffect(
    useCallback(() => {
      ngarko();
    }, [ngarko]),
  );

  // Interneti u kthye: rifreskon vetë.
  const { kaInternet } = useRrjeti(() => {
    ngarko();
  });

  async function rifresko() {
    if (!kaInternet) {
      // Pa internet s'ka çka të pritet: asnjë rrotë, vetëm njoftimi; lista e fundit mbetet në ekran.
      prekja.gabim();
      njofto(PA_INTERNET_ME_LISTE.cfare, "gabim");
      return;
    }
    setRifreskim(true);
    const ok = await ngarko();
    setRifreskim(false);
    if (!ok) prekja.gabim();
  }

  function fshi(puna: Puna) {
    Alert.alert("Ta fshij këtë punë?", `"${puna.titulli}" hiqet për të gjithë kandidatët.`, [
      { text: "Anulo", style: "cancel" },
      {
        text: "Fshije",
        style: "destructive",
        onPress: async () => {
          try {
            await fshiPunen(puna.id);
            prekja.sukses();
            setPunet((lista) => (lista ?? []).filter((p) => p.id !== puna.id));
            njofto("Puna u fshi", "sukses");
          } catch (e) {
            prekja.gabim();
            njofto(e instanceof Error ? e.message : "S'u fshi puna.", "gabim");
          }
        },
      },
    ]);
  }

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: t.sfondi }]}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.faqja}
      refreshControl={<RefreshControl refreshing={rifreskim} onRefresh={rifresko} tintColor={t.zbehur} />}
    >
      <GradientiSiper />
      {punet !== null && <ShiritiPaInternet teksti={PA_INTERNET_ME_LISTE.cfare} />}
      {!!(profili?.organizata || profili?.emri) && (
        <T zbehur madhesia={14}>
          {profili?.organizata || profili?.emri}
        </T>
      )}

      {qender && (
        <Karta style={styles.numrat}>
          <T pesha="trashe" madhesia={16}>
            Numrat e Karrierës
          </T>
          <T zbehur madhesia={13}>
            Vetëm totale. Asnjë emër, asnjë rresht personal.
          </T>
          <View style={styles.rrjeta}>
            {(
              [
                ["Kërkues pune", numrat?.kerkues],
                ["Punëdhënës", numrat?.punedhenes],
                ["Shpallje", numrat?.punet],
                ["Punë të ruajtura", numrat?.ruajtje],
              ] as const
            ).map(([emri, vlera]) => (
              <View key={emri} style={[styles.numri, { backgroundColor: t.karta2 }]}>
                <T pesha="shumeTrashe" madhesia={26} maxFontSizeMultiplier={1.3}>
                  {vlera ?? "–"}
                </T>
                <T zbehur madhesia={12.5}>
                  {emri}
                </T>
              </View>
            ))}
          </View>
        </Karta>
      )}

      {/* Punëdhënësi e ka "+" te koka e tab-it "Pozitat"; qendra e ka këtu (tab-i i saj s'ka buton në kokë). */}
      {(qender || punet?.length === 0) && (
        <Link href="/pune/shto" asChild>
          <Prekshme accessibilityRole="button" style={StyleSheet.flatten([styles.shto, { backgroundColor: t.teksti }])}>
            <Ikona emri={IKONAT.plus} madhesia={18} ngjyra={t.sfondi} />
            <T pesha="trashe" madhesia={16} ngjyra={t.sfondi}>
              Shto një punë
            </T>
          </Prekshme>
        </Link>
      )}

      {qender && (
        <T pesha="trashe" madhesia={17} style={styles.nentitulli}>
          Punët e mia
        </T>
      )}

      {punet === null ? (
        gabimi || !kaInternet ? (
          <View style={styles.qender}>
            <T pesha="trashe" madhesia={16}>
              {pamjaEGabimit(gabimi ?? PA_INTERNET_SHKURT, "S'u lexuan punët", PA_INTERNET_PA_LISTE).titulli}
            </T>
            <T zbehur madhesia={14} style={styles.tekstNeQender} accessibilityLiveRegion="polite">
              {pamjaEGabimit(gabimi ?? PA_INTERNET_SHKURT, "S'u lexuan punët", PA_INTERNET_PA_LISTE).teksti}
            </T>
            <Prekshme onPress={rifresko} accessibilityRole="button" style={[styles.provo, { backgroundColor: t.teksti }]}>
              <T pesha="trashe" madhesia={15} ngjyra={t.sfondi}>
                Provo përsëri
              </T>
            </Prekshme>
          </View>
        ) : (
          <View style={styles.lista} accessibilityLabel="Po ngarkohen punët e tua">
            <KartaSkelet />
            <KartaSkelet />
          </View>
        )
      ) : punet.length === 0 ? (
        <View style={styles.qender}>
          <T pesha="trashe" madhesia={16}>
            Ende s&apos;ke postuar asnjë punë
          </T>
          <T zbehur madhesia={14} style={styles.tekstNeQender}>
            {qender
              ? "Shtoje të parën: kandidatët e shohin menjëherë te lista e tyre."
              : "Shtoje të parën: kandidatët e shohin menjëherë, dhe ata që janë gati dhe kanë zgjedhur të duken shfaqen këtu, pa emër."}
          </T>
        </View>
      ) : (
        <View style={styles.lista}>
          {punet.map((puna) => {
            const n = numratEPozitave?.get(puna.id);
            return (
              <Animated.View
                key={puna.id}
                layout={qetesi ? undefined : LEVIZJA}
                entering={puna.id === ePunesSeRe && !qetesi ? HYRJA : undefined}
              >
                <Link href={qender ? `/pune/${puna.id}` : `/organizata/pozitat/${puna.id}`} asChild>
                  <Prekshme
                    accessibilityRole="button"
                    accessibilityHint={qender ? "Hap shpalljen" : "Hap kandidatët për këtë pozitë"}
                    style={StyleSheet.flatten([styles.karta, { backgroundColor: t.karta, shadowColor: t.hija }])}
                  >
                    <View style={styles.flexGap}>
                      <Chip teksti={puna.roli === "Asistent/PR" ? "ZYRË" : puna.roli === "Tjetër" ? "TJETËR" : "SWE"} />
                      <T pesha="trashe" madhesia={16} style={styles.titulli}>
                        {puna.titulli}
                      </T>
                      <T zbehur madhesia={13.5}>
                        {puna.kompania}, {puna.qyteti}
                      </T>
                      {n && (
                        <T pesha="gjysme" madhesia={13} ngjyra={n.gati > 0 ? t.theksi : t.zbehur}>
                          {rreshtiINumrave(n)}
                        </T>
                      )}
                    </View>
                    <Prekshme
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Fshi ${puna.titulli}`}
                      onPress={(e) => {
                        e.stopPropagation();
                        fshi(puna);
                      }}
                      style={[styles.fshi, { backgroundColor: t.karta2 }]}
                    >
                      <Ikona emri={IKONAT.kosha} madhesia={17} ngjyra={t.keq} />
                    </Prekshme>
                  </Prekshme>
                </Link>
              </Animated.View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  faqja: { padding: 18, gap: 12, paddingBottom: 120 },
  numrat: { gap: 4 },
  rrjeta: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  numri: { flexBasis: "47%", flexGrow: 1, borderRadius: 16, padding: 12, gap: 2 },
  shto: {
    flexDirection: "row",
    gap: 8,
    borderRadius: 999,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  nentitulli: { marginTop: 6 },
  lista: { gap: 10 },
  karta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  flexGap: { flex: 1, gap: 3 },
  titulli: { marginTop: 4 },
  fshi: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  qender: { alignItems: "center", gap: 8, paddingTop: 28, paddingHorizontal: 12 },
  tekstNeQender: { textAlign: "center" },
  provo: {
    marginTop: 8,
    borderRadius: 999,
    paddingVertical: 13,
    paddingHorizontal: 26,
    minHeight: 44,
    justifyContent: "center",
  },
});
