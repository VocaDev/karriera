// Kreu i punëdhënësit (bordi, ekrani 59): numrat që i duhen HR-it, veprimi kryesor (shto një pozitë)
// dhe "Më të mirët" për një pozitë. Të gjitha nga të dhëna të vërteta; ku s'ka, e thotë.
import { Link, useRouter } from "expo-router";
import { useMemo } from "react";
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
import { useSesioni } from "@/lib/sesioni";
import { useTema } from "@/lib/tema";

export default function KreuIPunedhenesit() {
  const t = useTema();
  const router = useRouter();
  const { profili } = useSesioni();
  const te_dhenat = useKandidatet();
  const { punet, kandidatet, rifreskim, rifresko } = te_dhenat;

  // Pozita që shfaqet: më e reja që ka të paktën një kandidat (punet vjen nga më e reja).
  const pozita = useMemo(() => {
    if (!punet || !kandidatet) return null;
    return punet.find((p) => kandidatet.some((k) => k.puna_id === p.id)) ?? null;
  }, [punet, kandidatet]);
  const top3 = useMemo(
    () => (pozita && kandidatet ? kandidatet.filter((k) => k.puna_id === pozita.id).slice(0, 3) : []),
    [pozita, kandidatet],
  );
  // Vetëm numra nga kandidatë me pëlqim (kandidatura = kandidat × pozitë; serveri s'i lidh mes pozitave).
  const teGatshem = kandidatet?.length ?? null;
  const meIntervisten = useMemo(
    () => (kandidatet ? kandidatet.filter((k) => k.intervista_nota !== null).length : null),
    [kandidatet],
  );

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
      {!!(profili?.organizata || profili?.emri) && (
        <T zbehur madhesia={14}>
          {profili?.organizata || profili?.emri}
        </T>
      )}

      <Karta style={styles.numrat}>
        <View style={styles.rrjeta}>
          {(
            [
              ["pozita", punet?.length ?? null],
              ["kandidatura gati", teGatshem],
              ["me intervistë", meIntervisten],
            ] as const
          ).map(([emri, vlera]) => (
            <View key={emri} style={styles.numri} accessible accessibilityLabel={`${vlera ?? "pa të dhëna"} ${emri}`}>
              <T pesha="shumeTrashe" madhesia={26} maxFontSizeMultiplier={1.3}>
                {vlera ?? "–"}
              </T>
              <T zbehur madhesia={12.5}>
                {emri}
              </T>
            </View>
          ))}
        </View>
      </Karta>

      <Link href="/pune/shto" asChild>
        <Prekshme
          accessibilityRole="button"
          style={StyleSheet.flatten([styles.veprimi, { backgroundColor: t.karta, borderColor: t.theksi }])}
        >
          <View style={styles.flexGap}>
            <T pesha="trashe" madhesia={16}>
              Shto një pozitë
            </T>
            <T zbehur madhesia={13}>
              Kandidatët e shohin menjëherë dhe e kontrollojnë sa janë gati për të.
            </T>
          </View>
          <Ikona emri={IKONAT.plus} madhesia={20} ngjyra={t.theksi} />
        </Prekshme>
      </Link>

      <View style={styles.koka}>
        <T pesha="trashe" madhesia={17} style={styles.flex} accessibilityRole="header">
          {pozita ? `Më të mirët për ${pozita.titulli}` : "Më të mirët"}
        </T>
        {top3.length > 0 && (
          <Prekshme
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => router.navigate("/organizata/kandidatet")}
            style={styles.lidhja}
          >
            <T pesha="gjysme" madhesia={14} ngjyra={t.theksi}>
              Renditja
            </T>
          </Prekshme>
        )}
      </View>

      {gabimi ??
        (kandidatet === null ? (
          <SkeletiIKandidateve />
        ) : punet?.length === 0 ? (
          <MesazhiNeQender
            titulli="Ende s'keni asnjë pozitë"
            teksti="Shtoni të parën. Kandidatët që janë gati për të dhe kanë zgjedhur të duken shfaqen këtu, pa emër."
          />
        ) : top3.length === 0 ? (
          <MesazhiNeQender titulli="Ende asnjë kandidat i dukshëm" teksti={TEKSTI_PA_KANDIDATE} />
        ) : (
          <View style={styles.lista}>
            {top3.map((k, i) => (
              <KartaEKandidatit key={k.kodi} kandidati={k} renditja={i + 1} meAftesi={false} />
            ))}
          </View>
        ))}

      <ShenimiIPrivatesise />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexGap: { flex: 1, gap: 3 },
  faqja: { padding: 18, gap: 12, paddingBottom: 120 },
  numrat: { paddingVertical: 14 },
  rrjeta: { flexDirection: "row", gap: 8 },
  numri: { flex: 1, gap: 2, alignItems: "center" },
  veprimi: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 22,
    borderWidth: 2,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 64,
  },
  koka: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  lidhja: { minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "flex-end" },
  lista: { gap: 10 },
});
