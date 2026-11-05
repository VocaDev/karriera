import { Link, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import KartaPunes from "@/components/KartaPunes";
import { listoPunet, type Puna } from "@/lib/punet";
import { useTema } from "@/lib/tema";

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

  // Koka e listës: në tab-a s'ka header, prandaj titulli dhe "+ Shto" janë këtu.
  const koka = (
    <View style={styles.koka}>
      <Text style={[styles.titulli, { color: t.teksti }]}>Punët</Text>
      <Link href="/pune/shto" asChild>
        <Pressable hitSlop={10} accessibilityRole="button">
          <Text style={[styles.shto, { color: t.theksi }]}>+ Shto</Text>
        </Pressable>
      </Link>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: t.sfondi }]}>
      {duke_ngarkuar ? (
        <ActivityIndicator style={styles.qendra} />
      ) : gabimi ? (
        <View style={styles.qendra}>
          <Text style={{ color: t.teksti }}>S&apos;u lexuan punët: {gabimi}</Text>
          <Pressable onPress={ngarko} accessibilityRole="button">
            <Text style={[styles.shto, { color: t.theksi }]}>Provo përsëri</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          contentInsetAdjustmentBehavior="automatic"
          data={punet}
          keyExtractor={(item) => item.id}
          refreshing={false}
          onRefresh={ngarko}
          ListHeaderComponent={koka}
          ListEmptyComponent={
            <Text style={[styles.bosh, { color: t.zbehur }]}>Ende s&apos;ka shpallje.</Text>
          }
          renderItem={({ item }) => (
            <Link href={`/pune/${item.id}`} asChild>
              <KartaPunes titulli={item.titulli} kompania={item.kompania} qyteti={item.qyteti} />
            </Link>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  koka: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  titulli: { fontSize: 34, fontWeight: "800" },
  qendra: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  shto: { fontSize: 17, fontWeight: "600" },
  bosh: { textAlign: "center", marginTop: 40 },
});
