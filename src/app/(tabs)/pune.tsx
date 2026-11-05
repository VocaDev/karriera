import { Link, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from "react-native";

import KartaPunes from "@/components/KartaPunes";
import { Faqja, IKONAT, Ikona, T, Titulli } from "@/components/ui";
import { listoPunet, type Puna } from "@/lib/punet";
import { useTema } from "@/lib/tema";

// Punët (bordi, ekrani 09). Kërkimi dhe chip-at e filtrave i shton Edoniku këtu.
export default function Punet() {
  const t = useTema();
  const [punet, setPunet] = useState<Puna[]>([]);
  const [duke_ngarkuar, setDukeNgarkuar] = useState(true);
  const [gabimi, setGabimi] = useState<string | null>(null);

  const ngarko = useCallback(async () => {
    setGabimi(null);
    try {
      setPunet(await listoPunet());
    } catch (e) {
      setGabimi(e instanceof Error ? e.message : "Gabim i panjohur");
    } finally {
      setDukeNgarkuar(false);
    }
  }, []);

  // Rilexon sa herë që ekrani shfaqet (p.sh. pasi kthehesh nga "Shto punë").
  useFocusEffect(
    useCallback(() => {
      ngarko();
    }, [ngarko]),
  );

  // Koka: në tab-a s'ka header, prandaj titulli dhe butoni "shto" janë këtu (si në bord).
  const koka = (
    <View style={styles.koka}>
      <Titulli>Punët</Titulli>
      <Link href="/pune/shto" asChild>
        <Pressable
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Shto një punë"
          style={({ pressed }) => [styles.butoniIkone, { backgroundColor: t.theksiButë, opacity: pressed ? 0.6 : 1 }]}
        >
          <Ikona emri={IKONAT.plus} madhesia={18} ngjyra={t.theksi} />
        </Pressable>
      </Link>
    </View>
  );

  return (
    <Faqja pa_scroll>
      {duke_ngarkuar ? (
        <ActivityIndicator style={styles.qendra} />
      ) : gabimi ? (
        <View style={styles.qendra}>
          <T>S&apos;u lexuan punët: {gabimi}</T>
          <Pressable onPress={ngarko} accessibilityRole="button">
            <T pesha="trashe" ngjyra={t.theksi}>
              Provo përsëri
            </T>
          </Pressable>
        </View>
      ) : (
        <FlatList
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.lista}
          data={punet}
          keyExtractor={(item) => item.id}
          refreshing={false}
          onRefresh={ngarko}
          ListHeaderComponent={koka}
          ListEmptyComponent={
            <T zbehur style={styles.bosh}>
              Ende s&apos;ka shpallje.
            </T>
          }
          renderItem={({ item }) => (
            <Link href={`/pune/${item.id}`} asChild>
              <KartaPunes puna={item} />
            </Link>
          )}
        />
      )}
    </Faqja>
  );
}

const styles = StyleSheet.create({
  koka: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  butoniIkone: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  lista: { padding: 18, gap: 10, paddingBottom: 120 },
  qendra: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  bosh: { textAlign: "center", marginTop: 40 },
});
