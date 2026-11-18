import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import Prekshme from "@/components/Prekshme";
import { Faqja, Karta, T, Titulli } from "@/components/ui";
import { gjejKeshillen } from "@/data/keshillat";
import { prekja } from "@/lib/prekja";
import { useTema } from "@/lib/tema";

// Një këshillë e plotë: titulli, pikat kryesore dhe (kur ka) një model që mund ta përshtatësh.
export default function Keshilla() {
  const t = useTema();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const k = gjejKeshillen(id);

  if (!k) {
    return (
      <Faqja>
        <Stack.Screen options={{ title: "" }} />
        <Titulli>Këshilla s&apos;u gjet</Titulli>
        <T zbehur madhesia={14}>
          Kjo kartë nuk ekziston. Kthehu te lista dhe zgjidh një tjetër.
        </T>
        <Prekshme
          onPress={() => {
            prekja.zgjedhje();
            router.back();
          }}
          accessibilityRole="button"
          style={StyleSheet.flatten([styles.butoni, { backgroundColor: t.teksti }])}
        >
          <T pesha="trashe" madhesia={15} ngjyra={t.sfondi}>
            Mbrapa
          </T>
        </Prekshme>
      </Faqja>
    );
  }

  return (
    <Faqja>
      <Stack.Screen options={{ title: "" }} />
      <Titulli>{k.titulli}</Titulli>
      <T zbehur madhesia={14.5}>
        {k.permbledhja}
      </T>
      <Karta style={styles.pikat}>
        {k.pikat.map((p) => (
          <View key={p} style={styles.pika}>
            <View style={[styles.pikaShenja, { backgroundColor: t.teksti }]} />
            <T madhesia={15.5} style={styles.teksti}>
              {p}
            </T>
          </View>
        ))}
      </Karta>
      {k.shembulli && (
        <Karta style={[styles.shembulli, { backgroundColor: t.karta2 }]}>
          <T pesha="gjysme" madhesia={12.5} zbehur>
            {k.shembulli.etiketa}
          </T>
          <T madhesia={15} selectable style={styles.teksti}>
            {k.shembulli.teksti}
          </T>
        </Karta>
      )}
    </Faqja>
  );
}

const styles = StyleSheet.create({
  pikat: { gap: 14 },
  pika: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  pikaShenja: { width: 6, height: 6, borderRadius: 3, marginTop: 9 },
  teksti: { flex: 1, lineHeight: 22 },
  shembulli: { gap: 8, shadowOpacity: 0 },
  butoni: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 26,
    minHeight: 48,
    marginTop: 8,
  },
});
