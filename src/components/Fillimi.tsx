// Onboarding i kërkuesit (bordi, ekrani 02): "Për çfarë pune po përgatitesh?" + gjuha e intervistës.
// Shfaqet te ekrani i hyrjes sa herë që një kërkues s'e ka zgjedhur ende rolin (pas regjistrimit ose në hyrjen e parë),
// sepse sesioni.tsx e mban atë llogari "pa profil të gatshëm" derisa roli të ruhet. Punëdhënësit dhe qendrat s'e shohin kurrë.
import { SegmentedControl } from "@expo/ui/community/segmented-control";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ButoniKryesor, Udhezimi } from "@/components/Forma";
import Prekshme from "@/components/Prekshme";
import { IKONAT, Ikona, T } from "@/components/ui";
import {
  dil,
  EMRAT_E_GJUHEVE,
  EMRAT_E_ROLEVE,
  GJUHET,
  ndryshoProfilin,
  ROLET,
  type Gjuha,
  type Profili,
  type RoliSynuar,
} from "@/lib/hyrja";
import { useDridhja } from "@/lib/levizja";
import { prekja } from "@/lib/prekja";
import { useSesioni } from "@/lib/sesioni";
import { useTema } from "@/lib/tema";

const IKONAT_E_ROLEVE: Record<RoliSynuar, { ios: string; android: string }> = {
  SWE: IKONAT.canta,
  "Asistent/PR": IKONAT.dokumenti,
};

export default function Fillimi({ profili }: { profili: Profili }) {
  const t = useTema();
  const kufijte = useSafeAreaInsets();
  const { rifreskoProfilin } = useSesioni();
  const { stili: stiliIButonit, dridhu } = useDridhja();

  const [roli, setRoli] = useState<RoliSynuar | null>(null);
  const [gjuha, setGjuha] = useState<Gjuha>(profili.gjuha);
  const [provoi, setProvoi] = useState(false);
  const [duke_ruajtur, setDukeRuajtur] = useState(false);
  const [gabimi, setGabimi] = useState<string | null>(null);

  async function vazhdo() {
    if (duke_ruajtur) return; // pa dërgime të dyfishta
    if (!roli) {
      setProvoi(true);
      prekja.gabim();
      dridhu();
      return;
    }
    setDukeRuajtur(true);
    setGabimi(null);
    try {
      const i_ri = await ndryshoProfilin({ roli_synuar: roli, gjuha });
      prekja.sukses();
      // Profili tani është i gatshëm: rojet te _layout.tsx e çojnë kërkuesin te tab-at.
      rifreskoProfilin(i_ri);
    } catch (e) {
      prekja.gabim();
      dridhu();
      setGabimi(e instanceof Error ? e.message : "Diçka shkoi keq. Provo përsëri.");
      setDukeRuajtur(false);
    }
  }

  return (
    <View style={[styles.flex, { backgroundColor: t.sfondi }]}>
      <LinearGradient colors={[t.theksiButë, t.sfondi]} style={styles.gradienti} pointerEvents="none" />
      <ScrollView
        contentContainerStyle={[styles.faqja, { paddingTop: kufijte.top + 28, paddingBottom: kufijte.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        <T zbehur madhesia={13.5}>
          Mirë se vjen{profili.emri ? `, ${profili.emri.split(" ")[0]}` : ""}
        </T>
        <T pesha="trashe" madhesia={28} style={styles.titulli} accessibilityRole="header">
          Për çfarë pune po përgatitesh?
        </T>
        <T zbehur madhesia={15}>
          Roli ndryshon pyetjet e intervistës dhe si krahasohesh me një punë. Mund ta ndryshosh te Cilësimet.
        </T>

        <View style={styles.rolet} accessibilityRole="radiogroup">
          {ROLET.map((r) => {
            const zgjedhur = roli === r;
            return (
              <Prekshme
                key={r}
                onPress={() => {
                  if (zgjedhur || duke_ruajtur) return;
                  prekja.zgjedhje();
                  setRoli(r);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: zgjedhur, disabled: duke_ruajtur }}
                accessibilityLabel={`${EMRAT_E_ROLEVE[r].titulli}. ${EMRAT_E_ROLEVE[r].pershkrimi}`}
                style={[
                  styles.opsioni,
                  {
                    backgroundColor: t.karta,
                    shadowColor: t.hija,
                    borderColor: zgjedhur ? t.teksti : provoi ? t.keq : "transparent",
                  },
                ]}
              >
                <View style={[styles.ikona, { backgroundColor: zgjedhur ? t.theksiButë : t.karta2 }]}>
                  <Ikona emri={IKONAT_E_ROLEVE[r]} madhesia={22} ngjyra={zgjedhur ? t.theksi : t.teksti} />
                </View>
                <View style={styles.flex}>
                  <T pesha="trashe" madhesia={16.5}>
                    {EMRAT_E_ROLEVE[r].titulli}
                  </T>
                  <T zbehur madhesia={13.5}>
                    {EMRAT_E_ROLEVE[r].pershkrimi}
                  </T>
                </View>
                <View style={[styles.radio, { borderColor: zgjedhur ? t.teksti : t.vija }]}>
                  {zgjedhur && <View style={[styles.radioPika, { backgroundColor: t.teksti }]} />}
                </View>
              </Prekshme>
            );
          })}
        </View>
        <Udhezimi shfaq={provoi && !roli}>Zgjidh një rol për të vazhduar.</Udhezimi>

        <T pesha="gjysme" madhesia={16} style={styles.nentitulli}>
          Në cilën gjuhë do ta bësh intervistën?
        </T>
        <SegmentedControl
          values={GJUHET.map((g) => EMRAT_E_GJUHEVE[g])}
          selectedIndex={GJUHET.indexOf(gjuha)}
          onValueChange={(v) => {
            const g = GJUHET.find((x) => EMRAT_E_GJUHEVE[x] === v);
            if (!g || g === gjuha) return;
            prekja.zgjedhje();
            setGjuha(g);
          }}
          enabled={!duke_ruajtur}
          style={styles.segmenti}
        />
        <T zbehur madhesia={12.5}>App-i mbetet në shqip.</T>

        {gabimi && (
          <View style={[styles.gabimi, { backgroundColor: t.karta }]} accessibilityLiveRegion="polite">
            <Ikona emri={IKONAT.alarm} madhesia={18} ngjyra={t.keq} />
            <T madhesia={14} ngjyra={t.keq} style={styles.flex}>
              {gabimi}
            </T>
          </View>
        )}

        <Animated.View style={stiliIButonit}>
          <ButoniKryesor teksti="Vazhdo" onPress={vazhdo} duke_punuar={duke_ruajtur} joValid={!roli} />
        </Animated.View>

        <Prekshme
          onPress={() => {
            if (!duke_ruajtur) dil().catch(() => {});
          }}
          accessibilityRole="button"
          accessibilityLabel="Dil nga llogaria"
          style={styles.lidhja}
        >
          <T zbehur madhesia={14}>
            Dil nga llogaria
          </T>
        </Prekshme>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gradienti: { position: "absolute", left: 0, right: 0, top: 0, height: 360 },
  faqja: { paddingHorizontal: 22, gap: 8 },
  titulli: { letterSpacing: -0.6 },
  rolet: { gap: 10, marginTop: 14 },
  opsioni: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 14,
    minHeight: 84,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  ikona: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioPika: { width: 10, height: 10, borderRadius: 5 },
  nentitulli: { marginTop: 22 },
  segmenti: { minHeight: 36 },
  gabimi: { flexDirection: "row", gap: 8, alignItems: "center", borderRadius: 14, padding: 12, marginTop: 8 },
  lidhja: { alignSelf: "center", minHeight: 44, justifyContent: "center", paddingHorizontal: 12, marginTop: 6 },
});
