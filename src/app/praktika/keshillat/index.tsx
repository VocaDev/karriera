import { Stack, useRouter, type Href } from "expo-router";
import { StyleSheet, View } from "react-native";

import Prekshme from "@/components/Prekshme";
import { Faqja, IKONAT, Ikona, Karta, T, Titulli } from "@/components/ui";
import { KESHILLAT } from "@/data/keshillat";
import { prekja } from "@/lib/prekja";
import { useTema } from "@/lib/tema";

// Lista e këshillave për intervistën. Të paketuara në app: hapen pa internet.
export default function Keshillat() {
  const t = useTema();
  const router = useRouter();

  return (
    <Faqja>
      <Stack.Screen options={{ title: "" }} />
      <Titulli>Këshilla për intervistën</Titulli>
      <T zbehur madhesia={14}>
        {KESHILLAT.length} karta të shkurtra. Lexoji para intervistës, edhe pa lidhje.
      </T>
      {KESHILLAT.map((k) => (
        <Prekshme
          key={k.id}
          onPress={() => {
            prekja.zgjedhje();
            router.push({ pathname: "/praktika/keshillat/[id]", params: { id: k.id } } as unknown as Href);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${k.titulli}. ${k.permbledhja}`}
        >
          <Karta style={styles.rresht}>
            <View style={styles.flex}>
              <T pesha="trashe" madhesia={16}>
                {k.titulli}
              </T>
              <T zbehur madhesia={13.5}>
                {k.permbledhja}
              </T>
            </View>
            <Ikona emri={IKONAT.shigjeta} madhesia={14} ngjyra={t.zbehur} />
          </Karta>
        </Prekshme>
      ))}
    </Faqja>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  rresht: { flexDirection: "row", alignItems: "center", gap: 12 },
});
