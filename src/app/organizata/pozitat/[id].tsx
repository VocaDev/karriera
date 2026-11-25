// Lista e ngushtë për një pozitë (bordi, ekrani 61): kandidatët anonimë të renditur sipas "A jam gati?",
// me çka kanë (✓) dhe çka u mungon (–). Vetëm për punët e mia: serveri s'kthen asgjë për punët e të tjerëve.
import { Link, useLocalSearchParams } from "expo-router";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import {
  gjendjaEGabimit,
  KartaEKandidatit,
  MesazhiNeQender,
  PA_INTERNET_KANDIDATET,
  ShenimiIPrivatesise,
  SkeletiIKandidateve,
  TEKSTI_PA_KANDIDATE,
  useKandidatet,
} from "@/components/Kandidatet";
import Prekshme from "@/components/Prekshme";
import ShiritiPaInternet from "@/components/ShiritiPaInternet";
import { GradientiSiper } from "@/components/TabEkrani";
import { IKONAT, Ikona, Karta, T } from "@/components/ui";
import { useTema } from "@/lib/tema";

export default function KandidatetEPozites() {
  const t = useTema();
  const { id } = useLocalSearchParams<{ id: string }>();
  const te_dhenat = useKandidatet(id);
  const { punet, kandidatet, numrat, rifreskim, rifresko } = te_dhenat;
  const puna = punet?.find((p) => p.id === id) ?? null;
  const n = numrat?.get(id) ?? null;
  const gabimi = gjendjaEGabimit(te_dhenat);

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: t.sfondi }]}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.faqja}
      refreshControl={<RefreshControl refreshing={rifreskim} onRefresh={rifresko} tintColor={t.zbehur} />}
    >
      <GradientiSiper />
      {kandidatet !== null && <ShiritiPaInternet teksti={PA_INTERNET_KANDIDATET.cfare} />}

      <View style={styles.koka}>
        <T zbehur madhesia={13.5}>
          Pozita
        </T>
        <T pesha="trashe" madhesia={24} style={styles.titulli}>
          {puna?.titulli ?? " "}
        </T>
        {puna && (
          <T zbehur madhesia={13.5}>
            {puna.kompania}, {puna.qyteti}
          </T>
        )}
      </View>

      {n && (
        <Karta style={styles.numrat}>
          <View style={styles.rrjeta}>
            {(
              [
                ["gati", n.gati],
                ["⭐ të ruajtura", n.ruajtur],
                ['kontrolle "A jam gati?"', n.kontrolluan],
              ] as const
            ).map(([emri, vlera]) => (
              <View key={emri} style={styles.numri} accessible accessibilityLabel={`${vlera} ${emri}`}>
                <T pesha="shumeTrashe" madhesia={24} maxFontSizeMultiplier={1.3}>
                  {vlera}
                </T>
                <T zbehur madhesia={12} style={styles.qendra}>
                  {emri}
                </T>
              </View>
            ))}
          </View>
        </Karta>
      )}

      <Link href={`/pune/${id}`} asChild>
        <Prekshme accessibilityRole="button" style={StyleSheet.flatten([styles.shpallja, { backgroundColor: t.karta }])}>
          <Ikona emri={IKONAT.dokumenti} madhesia={18} ngjyra={t.zbehur} />
          <T pesha="gjysme" madhesia={15} style={styles.flex}>
            Shiko shpalljen
          </T>
          <Ikona emri={IKONAT.shigjeta} madhesia={14} ngjyra={t.zbehur} />
        </Prekshme>
      </Link>

      {gabimi ??
        (kandidatet === null ? (
          <SkeletiIKandidateve />
        ) : kandidatet.length === 0 ? (
          <MesazhiNeQender titulli="Ende asnjë kandidat i dukshëm për këtë pozitë" teksti={TEKSTI_PA_KANDIDATE} />
        ) : (
          <View style={styles.lista}>
            {kandidatet.map((k, i) => (
              <KartaEKandidatit key={k.kodi} kandidati={k} renditja={i + 1} />
            ))}
          </View>
        ))}

      <ShenimiIPrivatesise />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  faqja: { padding: 18, gap: 12, paddingBottom: 120 },
  koka: { gap: 2 },
  titulli: { letterSpacing: -0.5 },
  numrat: { paddingVertical: 14 },
  rrjeta: { flexDirection: "row", gap: 8 },
  numri: { flex: 1, gap: 2, alignItems: "center" },
  qendra: { textAlign: "center" },
  shpallja: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, paddingHorizontal: 16, minHeight: 52 },
  lista: { gap: 10 },
});
