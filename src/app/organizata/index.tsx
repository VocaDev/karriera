import { Link, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn, LinearTransition, useReducedMotion } from "react-native-reanimated";

import { useNjoftim } from "@/components/Njoftimet";
import Prekshme from "@/components/Prekshme";
import { KartaSkelet } from "@/components/Skeleti";
import { Chip, Faqja, IKONAT, Ikona, Karta, T, Titulli } from "@/components/ui";
import { merrNumratEQendres, type NumratEQendres } from "@/lib/hyrja";
import { KOHA, LEHTESIMI } from "@/lib/levizja";
import { prekja } from "@/lib/prekja";
import { fshiPunen, listoPunetEMia, merrPunenERe, type Puna } from "@/lib/punet";
import { useSesioni } from "@/lib/sesioni";
import { useTema } from "@/lib/tema";

const LEVIZJA = LinearTransition.duration(KOHA.mesme).easing(LEHTESIMI.levizje);
const HYRJA = FadeIn.duration(320).easing(LEHTESIMI.hyrje);

// Kreu i punëdhënësit dhe i qendrës: "Punët e mia" + "Shto një punë". Qendra sheh edhe numrat (vetëm totale).
export default function PunetEMia() {
  const t = useTema();
  const qetesi = useReducedMotion();
  const njofto = useNjoftim();
  const { profili } = useSesioni();
  const qender = profili?.lloji === "qender";
  const [punet, setPunet] = useState<Puna[] | null>(null);
  const [numrat, setNumrat] = useState<NumratEQendres | null>(null);
  const [gabimi, setGabimi] = useState<string | null>(null);
  const [rifreskim, setRifreskim] = useState(false);
  const [ePunesSeRe, setEPunesSeRe] = useState<string | null>(null);

  const ngarko = useCallback(async () => {
    if (!profili) return false;
    try {
      const [teMiat, n] = await Promise.all([
        listoPunetEMia(profili.id),
        profili.lloji === "qender" ? merrNumratEQendres() : Promise.resolve(null),
      ]);
      const iRi = merrPunenERe();
      setPunet(teMiat);
      setNumrat(n);
      setGabimi(null);
      if (iRi) setEPunesSeRe(iRi);
      return true;
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

  async function rifresko() {
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
    <Faqja pa_scroll>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.faqja}
        refreshControl={<RefreshControl refreshing={rifreskim} onRefresh={rifresko} tintColor={t.zbehur} />}
      >
        <View style={styles.koka}>
          <T zbehur madhesia={14}>
            {profili?.organizata || profili?.emri || ""}
          </T>
          <Titulli>{qender ? "Qendra e karrierës" : "Punët e mia"}</Titulli>
        </View>

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

        <Link href="/pune/shto" asChild>
          <Prekshme accessibilityRole="button" style={StyleSheet.flatten([styles.shto, { backgroundColor: t.teksti }])}>
            <Ikona emri={IKONAT.plus} madhesia={18} ngjyra={t.sfondi} />
            <T pesha="trashe" madhesia={16} ngjyra={t.sfondi}>
              Shto një punë
            </T>
          </Prekshme>
        </Link>

        {qender && (
          <T pesha="trashe" madhesia={17} style={styles.nentitulli}>
            Punët e mia
          </T>
        )}

        {punet === null ? (
          gabimi ? (
            <View style={styles.qender}>
              <T pesha="trashe" madhesia={16}>
                S&apos;u lexuan punët
              </T>
              <T zbehur madhesia={14} style={styles.tekstNeQender}>
                {gabimi}
              </T>
              <Prekshme
                onPress={rifresko}
                accessibilityRole="button"
                style={[styles.provo, { backgroundColor: t.teksti }]}
              >
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
              Shtoje të parën: kandidatët e shohin menjëherë te lista e tyre.
            </T>
          </View>
        ) : (
          <View style={styles.lista}>
            {punet.map((puna) => (
              <Animated.View
                key={puna.id}
                layout={qetesi ? undefined : LEVIZJA}
                entering={puna.id === ePunesSeRe && !qetesi ? HYRJA : undefined}
              >
                <Link href={`/pune/${puna.id}`} asChild>
                  <Prekshme
                    accessibilityRole="button"
                    style={StyleSheet.flatten([styles.karta, { backgroundColor: t.karta, shadowColor: t.hija }])}
                  >
                    <View style={styles.flex}>
                      <Chip teksti={puna.roli === "Asistent/PR" ? "ZYRË" : puna.roli === "Tjetër" ? "TJETËR" : "SWE"} />
                      <T pesha="trashe" madhesia={16} style={styles.titulli}>
                        {puna.titulli}
                      </T>
                      <T zbehur madhesia={13.5}>
                        {puna.kompania}, {puna.qyteti}
                      </T>
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
            ))}
          </View>
        )}
      </ScrollView>
    </Faqja>
  );
}

const styles = StyleSheet.create({
  faqja: { padding: 18, gap: 12, paddingBottom: 120 },
  koka: { gap: 2, marginBottom: 2 },
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
  flex: { flex: 1, gap: 3 },
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
