import { StyleSheet, View } from "react-native";

import { Faqja, IKONAT, Ikona, Karta, T, Titulli } from "@/components/ui";
import { useTema } from "@/lib/tema";

// Profili (bordi, ekrani 18): llogaria, roli dhe gjuha vijnë me hyrjen (J6, 11.11).
export default function Profili() {
  const t = useTema();
  return (
    <Faqja>
      <Titulli>Profili</Titulli>

      <Karta style={styles.koka}>
        <View style={[styles.avatari, { backgroundColor: t.teksti }]}>
          <Ikona emri={IKONAT.personi} madhesia={26} ngjyra={t.sfondi} />
        </View>
        <View style={styles.flex}>
          <T pesha="trashe" madhesia={17}>
            Ende pa llogari
          </T>
          <T zbehur madhesia={13.5}>
            Hyrja me email, roli (SWE ose Asistent/PR) dhe gjuha e intervistës vijnë më 11.11.
          </T>
        </View>
      </Karta>
    </Faqja>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 4 },
  koka: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatari: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
});
