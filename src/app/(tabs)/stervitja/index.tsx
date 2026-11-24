import { SegmentedControl } from "@expo/ui/community/segmented-control";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import Prekshme from "@/components/Prekshme";
import { hapetVecoria } from "@/components/RreshtiVecorise";
import { TabScroll } from "@/components/TabEkrani";
import { IKONAT, Ikona, Karta, T } from "@/components/ui";
import { lexoHistorikun } from "@/lib/intervista/klienti";
import { useDridhja } from "@/lib/levizja";
import { rrugaPraktikes } from "@/lib/praktika";
import { prekja } from "@/lib/prekja";
import { KOHA_E_LEXIMIT, meKohe } from "@/lib/rrjeti";
import { useSesioni } from "@/lib/sesioni";
import { useTema } from "@/lib/tema";
import { tekstiIGjendjes, VECORITE } from "@/lib/vecorite";

// Gjuhët e intervistës (AGENTS.md, "Native feel" #6: kontroll i segmentuar për 2–4 zgjedhje ekskluzive).
const GJUHET = [
  { kodi: "sq", etiketa: "SQ", emri: "shqip" },
  { kodi: "en", etiketa: "EN", emri: "anglisht" },
  { kodi: "de", etiketa: "DE", emri: "gjermanisht" },
] as const;

// Stërvitja (bordi, ekrani 44): hyrja te intervista. Zgjedh gjuhën dhe nis.
export default function Stervitja() {
  const t = useTema();
  const router = useRouter();
  const { profili } = useSesioni();
  const { stili, dridhu } = useDridhja();
  // true vetëm kur leximi (i njëjti si te "Intervistat e tua") thotë se s'ka asnjë intervistë të mbaruar.
  const [paIntervista, setPaIntervista] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let aktiv = true;
      meKohe(lexoHistorikun(1), KOHA_E_LEXIMIT)
        .then((rreshtat) => {
          if (aktiv) setPaIntervista(rreshtat.length === 0);
        })
        // Pa lexim s'dihet: karta mbetet siç ishte (në hapjen e parë, e fshehur).
        .catch(() => {});
      return () => {
        aktiv = false;
      };
    }, []),
  );
  // Fillon me gjuhën e profilit; përdoruesi mund ta ndryshojë për këtë intervistë.
  const [iGjuhes, setIGjuhes] = useState(() => Math.max(0, GJUHET.findIndex((g) => g.kodi === profili?.gjuha)));
  const gjuha = GJUHET[iGjuhes];

  const intervista = VECORITE.find((v) => v.celesi === "intervista");
  // Rruga /intervista ekziston (WP4, intervista me tekst). Butoni hapet kur veçoria ka href dhe është gati
  // (`hapetVecoria`); me `href: null` ose "në ndërtim" mbetet i mbyllur, kështu s'ka prekje që të çon në "ekran që s'ekziston".
  const hapet = intervista !== undefined && hapetVecoria(intervista);

  function nis() {
    if (!hapet) {
      prekja.lehte();
      dridhu();
      return;
    }
    prekja.zgjedhje();
    // Rruga s'është ende te tipet e rrugëve (typedRoutes), prandaj `as unknown as Href` derisa të vijë ekrani i WP4.
    router.push({ pathname: "/intervista", params: { gjuha: gjuha.kodi } } as unknown as Href);
  }

  return (
    <TabScroll>
      <Karta style={styles.hero}>
        <View style={styles.rresht}>
          <View style={[styles.ikona, { backgroundColor: t.theksiButë }]}>
            <Ikona emri={IKONAT.mikrofoni} madhesia={20} ngjyra={t.theksi} />
          </View>
          <View style={styles.flex}>
            <T pesha="trashe" madhesia={18}>
              Intervista me AI
            </T>
            <T zbehur madhesia={13.5}>
              Pyetje për një punë konkrete dhe feedback për çdo përgjigje.
            </T>
          </View>
        </View>

        <View style={styles.gjuha}>
          <T zbehur madhesia={13}>
            Gjuha e intervistës
          </T>
          <SegmentedControl
            values={GJUHET.map((g) => g.etiketa)}
            selectedIndex={iGjuhes}
            onChange={(e) => {
              prekja.zgjedhje();
              setIGjuhes(e.nativeEvent.selectedSegmentIndex);
            }}
            appearance={t.errët ? "dark" : "light"}
            accessibilityLabel="Gjuha e intervistës"
          />
          <T zbehur madhesia={13}>
            Pyetjet dhe përgjigjet në {gjuha.emri}.
          </T>
        </View>

        <Animated.View style={stili}>
          <Prekshme
            onPress={nis}
            accessibilityRole="button"
            accessibilityLabel={hapet ? `Fillo intervistën në ${gjuha.emri}` : `Fillo intervistën, ${tekstiIGjendjes(intervista?.gjendja ?? { lloji: "vjen", kur: "së shpejti" })}`}
            accessibilityState={{ disabled: !hapet }}
            style={StyleSheet.flatten([styles.butoni, { backgroundColor: t.teksti }, !hapet && styles.iKycur])}
          >
            {!hapet && <Ikona emri={IKONAT.kycja} madhesia={14} ngjyra={t.sfondi} />}
            <T pesha="trashe" madhesia={15} ngjyra={t.sfondi}>
              Fillo intervistën
            </T>
          </Prekshme>
        </Animated.View>
        {!hapet && intervista && (
          <T zbehur madhesia={13} style={styles.shenimi}>
            {tekstiIGjendjes(intervista.gjendja)}
          </T>
        )}
      </Karta>

      {/* Praktika pa internet: pyetje, karta dhe këshilla të paketuara në app (src/app/praktika). */}
      <Prekshme
        onPress={() => {
          prekja.zgjedhje();
          router.push(rrugaPraktikes("/praktika"));
        }}
        accessibilityRole="button"
        accessibilityLabel="Praktiko pa internet: pyetje, karta dhe këshilla që hapen edhe pa lidhje"
      >
        <Karta style={styles.rresht}>
          <View style={[styles.ikona, { backgroundColor: t.karta2 }]}>
            <Ikona emri={IKONAT.shkolla} madhesia={20} ngjyra={t.teksti} />
          </View>
          <View style={styles.flex}>
            <T pesha="trashe" madhesia={16}>
              Praktiko pa internet
            </T>
            <T zbehur madhesia={13.5}>
              Pyetje, karta dhe këshilla që hapen edhe pa lidhje.
            </T>
          </View>
          <Ikona emri={IKONAT.shigjeta} madhesia={14} ngjyra={t.zbehur} />
        </Karta>
      </Prekshme>

      {/* Vetëm kur dihet se s'ka asnjë intervistë të mbaruar. Kompetencat veç e veç s'maten ende, prandaj pas të parës s'ka çka të tregohet. */}
      {paIntervista && (
        <Karta style={styles.kompetencat}>
          <View style={styles.rresht}>
            <Ikona emri={IKONAT.grafiku} madhesia={18} ngjyra={t.theksi} />
            <T pesha="trashe" madhesia={16} style={styles.flex}>
              Kompetencat e tua
            </T>
          </View>
          <T zbehur madhesia={13.5}>
            Bëj intervistën e parë dhe këtu shfaqen: zgjidhja e problemeve, komunikimi, njohuritë teknike, anglishtja.
          </T>
        </Karta>
      )}
    </TabScroll>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { gap: 16 },
  rresht: { flexDirection: "row", alignItems: "center", gap: 12 },
  ikona: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  gjuha: { gap: 8 },
  butoni: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 26,
    minHeight: 48,
  },
  iKycur: { opacity: 0.55 },
  shenimi: { textAlign: "center", marginTop: -8 },
  kompetencat: { gap: 8 },
});
