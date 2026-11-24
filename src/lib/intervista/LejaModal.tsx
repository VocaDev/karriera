// Leja e mikrofonit (bordi, ekranet 38 dhe 39): fletë e sistemit para dritares së iOS që shpjegon pse, dhe ekrani "leja u
// refuzua" me rrugën për te Cilësimet ose Shkruaj. Hapet vetëm nga Fol (useZeri); asnjëherë në hapjen e parë të app-it.
import { Modal, Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Ikona, T } from "@/components/ui";
import { useTema } from "@/lib/tema";

import { Butoni } from "./ui";

export type FazaELejes = "shpjegim" | "refuzuar";

const MIKROFONI = { ios: "mic.fill", android: "mic" };
const MIKROFONI_I_FIKUR = { ios: "mic.slash.fill", android: "mic_off" };

export function LejaModal({
  faza,
  emri,
  onVazhdo,
  onJo,
  onHapCilesimet,
  onVazhdoMeShkrim,
}: {
  faza: FazaELejes | null;
  /** Emri i intervistuesit (Arta · Arbër). */
  emri: string;
  onVazhdo: () => void;
  onJo: () => void;
  onHapCilesimet: () => void;
  onVazhdoMeShkrim: () => void;
}) {
  const t = useTema();
  const kufijte = useSafeAreaInsets();
  const refuzuar = faza === "refuzuar";
  return (
    <Modal
      visible={faza !== null}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : undefined}
      onRequestClose={refuzuar ? onVazhdoMeShkrim : onJo}
    >
      <View style={[styles.faqja, { backgroundColor: t.sfondi, paddingBottom: Math.max(kufijte.bottom, 16) }]}>
        {refuzuar ? (
          <View style={styles.permbajtja}>
            <View style={[styles.rrethi, { backgroundColor: t.karta2 }]}>
              <Ikona emri={MIKROFONI_I_FIKUR} madhesia={30} ngjyra={t.keq} />
            </View>
            <T pesha="trashe" madhesia={26} style={styles.majtas} accessibilityRole="header">
              Mikrofoni është i fikur për Karriera
            </T>
            <T zbehur madhesia={15} style={styles.majtas}>
              Pa mikrofon intervista punon, por vetëm me shkrim. Për t&apos;iu përgjigjur {emri} me zë:
            </T>
            <View style={[styles.hapat, { backgroundColor: t.karta, borderColor: t.vija }]}>
              {["Hap Cilësimet e telefonit", "Gjej Karriera", "Aktivizo Mikrofonin"].map((h, i) => (
                <View key={h} style={styles.hapi}>
                  <View style={[styles.numri, { backgroundColor: t.karta2 }]}>
                    <T pesha="trashe" madhesia={13}>
                      {i + 1}
                    </T>
                  </View>
                  <T madhesia={15} style={styles.flex}>
                    {h}
                  </T>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.permbajtja}>
            <View style={[styles.rrethi, { backgroundColor: t.theksiButë }]}>
              <Ikona emri={MIKROFONI} madhesia={30} ngjyra={t.theksi} />
            </View>
            <T pesha="trashe" madhesia={26} style={styles.majtas} accessibilityRole="header">
              {emri} duhet të të dëgjojë
            </T>
            <T zbehur madhesia={15} style={styles.majtas}>
              {emri} të pyet me zë dhe ti përgjigjesh duke folur. Mikrofoni hapet vetëm kur prek butonin e tij. Zëri kthehet në
              tekst dhe nuk ruhet.
            </T>
            <T zbehur madhesia={13.5} style={styles.majtas}>
              Pastaj telefoni e kërkon lejen një herë.
            </T>
          </View>
        )}
        <View style={styles.butonat}>
          {refuzuar ? (
            <>
              <Butoni teksti="Hap Cilësimet" onPress={onHapCilesimet} />
              <Butoni teksti="Vazhdo me shkrim" lloji="dytesor" onPress={onVazhdoMeShkrim} />
            </>
          ) : (
            <>
              <Butoni teksti="Vazhdo" onPress={onVazhdo} />
              <Butoni teksti="Jo tani" lloji="dytesor" onPress={onJo} />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  faqja: { flex: 1, paddingHorizontal: 24, paddingTop: 36, justifyContent: "space-between" },
  permbajtja: { gap: 14 },
  rrethi: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  majtas: { textAlign: "left" },
  flex: { flex: 1 },
  hapat: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 12 },
  hapi: { flexDirection: "row", alignItems: "center", gap: 12 },
  numri: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  butonat: { gap: 10 },
});
