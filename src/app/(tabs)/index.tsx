import { Link, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import RreshtiVecorise from "@/components/RreshtiVecorise";
import { listoPunet, type Puna } from "@/lib/punet";
import { useTema } from "@/lib/tema";
import { VECORITE } from "@/lib/vecorite";

// Kreu i Kërkuesit të punës: rrjedha e HARTA-s me gjendjen e çdo hapi + punët e reja nga Supabase.
export default function Sot() {
  const t = useTema();
  const [punet, setPunet] = useState<Puna[] | null>(null);
  const [gabimi, setGabimi] = useState<string | null>(null);

  const ngarko = useCallback(async () => {
    setGabimi(null);
    try {
      setPunet(await listoPunet());
    } catch (e) {
      setGabimi(e instanceof Error ? e.message : "Gabim i panjohur");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      ngarko();
    }, [ngarko]),
  );

  const gati = VECORITE.filter((v) => v.gjendja.lloji === "gati").length;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: t.sfondi }}
      contentContainerStyle={styles.faqja}
    >
      <Text style={[styles.marka, { color: t.zbehur }]}>Karriera</Text>
      <Text style={[styles.titulli, { color: t.teksti }]}>Sot</Text>

      <View style={[styles.karta, { backgroundColor: t.karta }]}>
        <View style={styles.kokaKartes}>
          <Text style={[styles.titulliKartes, { color: t.teksti }]}>Rruga drejt punës</Text>
          <Text style={[styles.numeruesi, { color: t.theksi }]}>
            {gati} nga {VECORITE.length} gati
          </Text>
        </View>
        <View style={[styles.shiriti, { backgroundColor: t.vija }]}>
          <View
            style={[
              styles.shiritiMbushur,
              { backgroundColor: t.theksi, width: `${(gati / VECORITE.length) * 100}%` },
            ]}
          />
        </View>
        {VECORITE.map((v, i) => (
          <RreshtiVecorise key={v.celesi} vecoria={v} numri={i + 1} />
        ))}
      </View>

      <View style={[styles.karta, { backgroundColor: t.karta }]}>
        <View style={styles.kokaKartes}>
          <Text style={[styles.titulliKartes, { color: t.teksti }]}>Punët e reja</Text>
          {punet && (
            <Text style={[styles.numeruesi, { color: t.zbehur }]}>{punet.length} shpallje</Text>
          )}
        </View>

        {gabimi ? (
          <View style={styles.qendra}>
            <Text style={{ color: t.teksti }}>S&apos;u lexuan punët: {gabimi}</Text>
            <Pressable onPress={ngarko} accessibilityRole="button">
              <Text style={[styles.lidhja, { color: t.theksi }]}>Provo përsëri</Text>
            </Pressable>
          </View>
        ) : punet === null ? (
          <ActivityIndicator style={styles.qendra} />
        ) : punet.length === 0 ? (
          <Text style={[styles.bosh, { color: t.zbehur }]}>Ende s&apos;ka shpallje.</Text>
        ) : (
          punet.slice(0, 3).map((p) => (
            <Link key={p.id} href={`/pune/${p.id}`} asChild>
              <Pressable style={({ pressed }) => [styles.puna, { opacity: pressed ? 0.6 : 1 }]}>
                <Text style={[styles.punaTitulli, { color: t.teksti }]}>{p.titulli}</Text>
                <Text style={[styles.punaDetajet, { color: t.zbehur }]}>
                  {p.kompania} · {p.qyteti}
                </Text>
              </Pressable>
            </Link>
          ))
        )}

        <Link href="/pune" asChild>
          <Pressable accessibilityRole="button">
            <Text style={[styles.lidhja, { color: t.theksi }]}>Shiko të gjitha punët →</Text>
          </Pressable>
        </Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  faqja: { padding: 20, gap: 16 },
  marka: { fontSize: 13, fontWeight: "600", letterSpacing: 0.5, textTransform: "uppercase" },
  titulli: { fontSize: 34, fontWeight: "800", marginTop: -8 },
  karta: { borderRadius: 20, padding: 16, gap: 4 },
  kokaKartes: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  titulliKartes: { fontSize: 18, fontWeight: "700" },
  numeruesi: { fontSize: 13, fontWeight: "600" },
  shiriti: { height: 6, borderRadius: 3, marginVertical: 8, overflow: "hidden" },
  shiritiMbushur: { height: 6, borderRadius: 3 },
  qendra: { paddingVertical: 16, alignItems: "center", gap: 8 },
  bosh: { paddingVertical: 12 },
  puna: { paddingVertical: 10, gap: 2 },
  punaTitulli: { fontSize: 16, fontWeight: "600" },
  punaDetajet: { fontSize: 13 },
  lidhja: { fontSize: 15, fontWeight: "600", paddingTop: 8 },
});
