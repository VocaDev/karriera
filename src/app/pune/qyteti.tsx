import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ButoniKryesor } from "@/components/Forma";
import { useNjoftim } from "@/components/Njoftimet";
import Prekshme from "@/components/Prekshme";
import { IKONAT, Ikona, T } from "@/components/ui";
import {
  gjejQytetinTim,
  lejaEVendndodhjes,
  useQytetiIm,
  vendosAferMeje,
  vendosQytetin,
  type LejaEVendndodhjes,
} from "@/lib/afer-meje";
import { prekja } from "@/lib/prekja";
import { KOMUNAT_PER_ZGJEDHJE } from "@/lib/qytetet";
import { useTema } from "@/lib/tema";

// "Afër meje" (J10, bordi ekrani 38: leja shpjegohet para dritares së sistemit). Fleta hapet kur prek "Afër meje" pa
// qytet të ruajtur, ose "Ndrysho". Dy rrugë: vendndodhja një herë (qyteti gjendet në telefon), ose qyteti me dorë.
// Pa leje, me GPS të fikur ose jashtë Kosovës: lista mbetet rruga. E sheh edhe mysafiri: s'ka nevojë për llogari.
const MESAZHET = {
  refuzuar: "Pa leje vendndodhjeje. Zgjidh qytetin tënd më poshtë.",
  jashte: "Duket se s'je në Kosovë. Zgjidh qytetin ku kërkon punë.",
  gabim: "S'e gjetëm vendndodhjen (GPS i fikur ose pa sinjal). Zgjidh qytetin më poshtë.",
} as const;

export default function ZgjidhQytetin() {
  const t = useTema();
  const router = useRouter();
  const njofto = useNjoftim();
  const qytetiIm = useQytetiIm();
  const [leja, setLeja] = useState<LejaEVendndodhjes | null>(null);
  const [duke_kerkuar, setDukeKerkuar] = useState(false);
  const [mesazhi, setMesazhi] = useState<string | null>(null);

  useEffect(() => {
    let aktiv = true;
    lejaEVendndodhjes().then((l) => aktiv && setLeja(l));
    return () => {
      aktiv = false;
    };
  }, []);

  function mbaro(emri: string) {
    vendosQytetin(emri);
    vendosAferMeje(true);
    njofto(`Afër meje: ${emri}`, "sukses");
    router.back();
  }

  async function perdorVendndodhjen() {
    if (duke_kerkuar) return;
    // Leja u refuzua përgjithmonë: sistemi s'e pyet më; vetëm cilësimet e telefonit e ndryshojnë.
    if (leja === "refuzuar" && Platform.OS !== "web") {
      Linking.openSettings().catch(() => {});
      return;
    }
    setDukeKerkuar(true);
    setMesazhi(null);
    const gjetja = await gjejQytetinTim();
    setDukeKerkuar(false);
    if (gjetja.lloji === "gjetur") {
      prekja.sukses();
      mbaro(gjetja.qyteti);
      return;
    }
    prekja.gabim();
    setMesazhi(MESAZHET[gjetja.lloji]);
    if (gjetja.lloji === "refuzuar") setLeja(await lejaEVendndodhjes());
  }

  const refuzuarPergjithmone = leja === "refuzuar" && Platform.OS !== "web";

  return (
    <ScrollView
      style={{ backgroundColor: t.sfondi }}
      contentContainerStyle={styles.faqja}
      contentInsetAdjustmentBehavior="automatic"
    >
      <View style={styles.koka}>
        <Prekshme
          accessibilityRole="button"
          accessibilityLabel="Mbyll"
          hitSlop={8}
          shkalla={0.9}
          onPress={() => router.back()}
          style={styles.mbyll}
        >
          <Ikona emri={IKONAT.mbyll} madhesia={30} ngjyra={t.zbehur} />
        </Prekshme>
      </View>

      <View style={styles.hyrja}>
        <View style={[styles.ikona, { backgroundColor: t.theksiButë }]}>
          <Ikona emri={IKONAT.pin} madhesia={26} ngjyra={t.theksi} />
        </View>
        <T pesha="trashe" madhesia={22} accessibilityRole="header" style={styles.qendro}>
          Punë afër teje?
        </T>
        <T zbehur madhesia={14.5} style={styles.qendro}>
          Vendndodhja lexohet një herë, vetëm për të gjetur qytetin tënd. Koordinatat s&apos;dalin nga telefoni: ruajmë
          vetëm emrin e qytetit.
        </T>
      </View>

      <ButoniKryesor
        teksti={refuzuarPergjithmone ? "Lejoje te cilësimet e telefonit" : "Përdor vendndodhjen time"}
        duke_punuar={duke_kerkuar}
        onPress={perdorVendndodhjen}
        accessibilityLabel={refuzuarPergjithmone ? "Hap cilësimet e telefonit" : "Përdor vendndodhjen time"}
      />
      {(mesazhi || refuzuarPergjithmone) && (
        <T zbehur madhesia={13.5} style={styles.mesazhi} accessibilityLiveRegion="polite">
          {mesazhi ?? MESAZHET.refuzuar}
        </T>
      )}

      <T pesha="gjysme" madhesia={13} zbehur style={styles.titulliIListes} accessibilityRole="header">
        Ose zgjidh qytetin
      </T>
      <View
        style={[
          styles.lista,
          { backgroundColor: t.karta, borderColor: t.vija, borderWidth: t.errët ? StyleSheet.hairlineWidth : 0 },
        ]}
      >
        {KOMUNAT_PER_ZGJEDHJE.map((k, i) => {
          const zgjedhur = k.emri === qytetiIm;
          return (
            // Rreshtat e listës: sfondi karta2 kur shtypen, pa zvogëlim (AGENTS.md, "Motion and feedback").
            <Pressable
              key={k.emri}
              accessibilityRole="button"
              accessibilityState={{ selected: zgjedhur }}
              onPress={() => {
                prekja.zgjedhje();
                mbaro(k.emri);
              }}
              android_ripple={{ color: t.vija }}
              style={({ pressed }) => [
                styles.rreshti,
                i > 0 && { borderTopColor: t.vija, borderTopWidth: StyleSheet.hairlineWidth },
                pressed && Platform.OS !== "android" && { backgroundColor: t.karta2 },
              ]}
            >
              <T madhesia={15.5} pesha={zgjedhur ? "gjysme" : "normal"} style={styles.emri}>
                {k.emri}
              </T>
              {zgjedhur && <Ikona emri={IKONAT.check} madhesia={17} ngjyra={t.teksti} />}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  faqja: { padding: 22, paddingTop: 14, paddingBottom: 48 },
  koka: { flexDirection: "row", justifyContent: "flex-end", marginBottom: -12 },
  mbyll: { minWidth: 44, minHeight: 44, alignItems: "flex-end", justifyContent: "center", zIndex: 1 },
  hyrja: { alignItems: "center", gap: 8 },
  ikona: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  qendro: { textAlign: "center" },
  mesazhi: { marginTop: 12, textAlign: "center" },
  titulliIListes: { marginTop: 28, marginBottom: 6, paddingHorizontal: 6 },
  lista: { borderRadius: 18, overflow: "hidden" },
  rreshti: { flexDirection: "row", alignItems: "center", minHeight: 48, paddingHorizontal: 16 },
  emri: { flex: 1 },
});
