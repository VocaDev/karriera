// Profili (bordi, ekrani 18): kush je, lloji i llogarisë, dhe "Dil". Për kërkuesin edhe ⭐ të ruajturat:
// lista private që e kthen RLS-i, pa asnjë filtër në kod (dëshmia e J6 "secili sheh të vetat").
import { LinearGradient } from "expo-linear-gradient";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import ButoniDil from "@/components/ButoniDil";
import Prekshme from "@/components/Prekshme";
import ShiritiPaInternet from "@/components/ShiritiPaInternet";
import { Pulsi, Vije } from "@/components/Skeleti";
import { IKONAT, Ikona, Karta, T, Titulli } from "@/components/ui";
import { EMRAT_E_GJUHEVE, EMRAT_E_LLOJEVE, EMRAT_E_ROLEVE } from "@/lib/hyrja";
import { paInternet } from "@/lib/mesazhet";
import { KOHA_E_LEXIMIT, meKohe, pamjaEGabimit, useRrjeti } from "@/lib/rrjeti";
import { listoTeRuajturatMePune, type PunaERuajtur } from "@/lib/ruajtura";
import { useSesioni } from "@/lib/sesioni";
import { useTema } from "@/lib/tema";

type EmriIkones = { ios: string; android: string };

/** Rresht i listës (stili iOS): sfondi ndryshon kur prekesh, pa zmadhim. */
function RreshtiLista({
  ikona,
  titulli,
  nentitulli,
  kufi = false,
  onPress,
}: {
  ikona: EmriIkones;
  titulli: string;
  nentitulli?: string;
  kufi?: boolean;
  onPress: () => void;
}) {
  const t = useTema();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={nentitulli ? `${titulli}. ${nentitulli}` : titulli}
      android_ripple={{ color: t.vija }}
      style={({ pressed }) => [
        styles.rreshtiLista,
        { backgroundColor: pressed ? t.karta2 : "transparent" },
        kufi && { borderTopColor: t.vija, borderTopWidth: StyleSheet.hairlineWidth },
      ]}
    >
      <Ikona emri={ikona} madhesia={18} ngjyra={t.theksi} />
      <View style={styles.flex}>
        <T pesha="gjysme" madhesia={15.5}>
          {titulli}
        </T>
        {nentitulli ? (
          <T zbehur madhesia={13}>
            {nentitulli}
          </T>
        ) : null}
      </View>
      <Ikona emri={IKONAT.shigjeta} madhesia={14} ngjyra={t.zbehur} />
    </Pressable>
  );
}

/** Skeleti i listës së ruajtur: i njëjti formë si rreshtat e vërtetë (titulli + kompania, qyteti). */
function SkeletiITeRuajturave() {
  return (
    <Pulsi>
      <View style={styles.skeleti} accessibilityLabel="Po lexohen punët e ruajtura" accessible>
        {[0, 1].map((i) => (
          <View key={i} style={styles.skeletiRreshti}>
            <Vije gjeresia={i === 0 ? "62%" : "48%"} lartesia={15} />
            <Vije gjeresia={i === 0 ? "40%" : "34%"} lartesia={12} />
          </View>
        ))}
      </View>
    </Pulsi>
  );
}

export default function ProfiliIm() {
  const t = useTema();
  const router = useRouter();
  const { sesioni, profili } = useSesioni();
  const kerkues = profili?.lloji === "kerkues";
  const [teRuajturat, setTeRuajturat] = useState<PunaERuajtur[] | null>(null);
  const [gabimi, setGabimi] = useState<string | null>(null);
  // Lexon të ruajturat; kthen funksionin që e injoron përgjigjen nëse ekrani u largua.
  const lexo = useCallback(() => {
    if (!kerkues) return undefined;
    let aktiv = true;
    meKohe(listoTeRuajturatMePune(), KOHA_E_LEXIMIT)
      .then((lista) => {
        if (!aktiv) return;
        setTeRuajturat(lista);
        setGabimi(null);
      })
      .catch((e: unknown) => aktiv && setGabimi(e instanceof Error ? e.message : "Gabim i panjohur"));
    return () => {
      aktiv = false;
    };
  }, [kerkues]);

  useFocusEffect(lexo);
  // Interneti u kthye: të ruajturat rilexohen vetë (lista e fundit mbetet në ekran nëse leximi dështon).
  useRrjeti(() => {
    lexo();
  });

  if (!profili) return null;
  const ikona = profili.lloji === "kerkues" ? IKONAT.personi : profili.lloji === "qender" ? IKONAT.shkolla : IKONAT.canta;

  return (
    // Rrënja është ScrollView me contentInsetAdjustmentBehavior="automatic": kërkuesi e ka titullin e madh të sistemit
    // (Stack-u i tab-it "Profili"), prandaj palos kur rrëshqet përmbajtja. Gradienti rri brenda përmbajtjes.
    <ScrollView
      style={[styles.flex, { backgroundColor: t.sfondi }]}
      contentContainerStyle={styles.faqja}
      contentInsetAdjustmentBehavior="automatic"
    >
      <LinearGradient colors={[t.theksiButë, t.sfondi]} locations={[0, 1]} style={styles.gradienti} pointerEvents="none" />
      {teRuajturat !== null && <ShiritiPaInternet teksti={paInternet("po t'i shfaqim punët e ruajtura që i pe herën e fundit").cfare} />}
      {/* Punëdhënësi dhe qendra s'kanë kokë të sistemit (tab-at e tyre janë pa Stack): titulli mbetet në faqe. */}
      {!kerkues && <Titulli>Profili</Titulli>}

      <Karta style={styles.koka}>
        <View style={[styles.avatari, { backgroundColor: t.teksti }]}>
          <Ikona emri={ikona} madhesia={26} ngjyra={t.sfondi} />
        </View>
        <View style={styles.flex}>
          <T pesha="trashe" madhesia={17}>
            {profili.emri || "Pa emër"}
          </T>
          <T zbehur madhesia={13.5}>
            {sesioni?.user.email}
          </T>
          <View style={[styles.lloji, { backgroundColor: t.theksiButë }]}>
            <T pesha="gjysme" madhesia={12} ngjyra={t.theksi}>
              {EMRAT_E_LLOJEVE[profili.lloji]}
              {profili.organizata ? ` · ${profili.organizata}` : ""}
            </T>
          </View>
          {/* Roli dhe gjuha: vetëm për kërkuesin (punëdhënësi dhe qendra s'i kanë). */}
          {kerkues && profili.roli_synuar && (
            <T zbehur madhesia={13} style={styles.roli}>
              {EMRAT_E_ROLEVE[profili.roli_synuar].titulli}, intervista në {EMRAT_E_GJUHEVE[profili.gjuha]}
            </T>
          )}
        </View>
      </Karta>

      {kerkues && (
        <Karta style={styles.lista}>
          {/* Brendësia e rrumbullakosur: fonduk i prekur s'del jashtë qosheve (hija e kartës mbetet e padukur-prerë). */}
          <View style={styles.listaBrenda}>
            <RreshtiLista
              ikona={IKONAT.dokumenti}
              titulli="CV-ja ime"
              nentitulli="Ngarko, analizo dhe ndërto CV-në"
              onPress={() => router.push("/cv")}
            />
            <RreshtiLista kufi ikona={IKONAT.personi} titulli="Cilësimet" nentitulli="Roli, gjuha e intervistës, privatësia" onPress={() => router.push("/cilesimet")} />
          </View>
        </Karta>
      )}

      {kerkues && (
        <Karta style={styles.teRuajturat}>
          <View style={styles.rreshti}>
            <Ikona emri={IKONAT.ylli} madhesia={18} ngjyra={t.theksi} />
            <T pesha="trashe" madhesia={16}>
              Të ruajturat{teRuajturat ? ` (${teRuajturat.length})` : ""}
            </T>
          </View>
          {gabimi && teRuajturat === null ? (
            <>
              <T madhesia={13.5} accessibilityLiveRegion="polite">
                {pamjaEGabimit(gabimi, "S'u lexuan të ruajturat", "s'kemi ende punë të ruajtura për t'i shfaqur").teksti}
              </T>
              <Prekshme
                accessibilityRole="button"
                onPress={() => {
                  setGabimi(null);
                  lexo();
                }}
                style={styles.provo}
              >
                <T pesha="trashe" madhesia={14} ngjyra={t.theksi}>
                  Provo përsëri
                </T>
              </Prekshme>
            </>
          ) : teRuajturat === null ? (
            <SkeletiITeRuajturave />
          ) : teRuajturat.length === 0 ? (
            <T zbehur madhesia={13.5}>
              Prek ☆ te një punë për ta ruajtur këtu. I sheh vetëm ti.
            </T>
          ) : (
            teRuajturat.map((p) => (
              <Link key={p.puna_id} href={`/pune/${p.puna_id}`} asChild>
                <Prekshme style={StyleSheet.flatten([styles.puna, { borderTopColor: t.vija }])} accessibilityRole="button">
                  <View style={styles.flex}>
                    <T pesha="gjysme" madhesia={15}>
                      {p.titulli}
                    </T>
                    <T zbehur madhesia={13}>
                      {p.kompania}, {p.qyteti}
                    </T>
                  </View>
                  <Ikona emri={IKONAT.shigjeta} madhesia={14} ngjyra={t.zbehur} />
                </Prekshme>
              </Link>
            ))
          )}
        </Karta>
      )}

      <ButoniDil />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 3 },
  koka: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatari: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  lloji: { alignSelf: "flex-start", borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
  roli: { marginTop: 2 },
  faqja: { padding: 18, gap: 12, paddingBottom: 120 },
  gradienti: { position: "absolute", left: 0, right: 0, top: 0, height: 320 },
  lista: { padding: 0 },
  listaBrenda: { borderRadius: 22, overflow: "hidden" },
  rreshtiLista: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: 56 },
  provo: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  skeleti: { gap: 16, paddingTop: 4 },
  skeletiRreshti: { gap: 7 },
  teRuajturat: { gap: 10 },
  rreshti: { flexDirection: "row", alignItems: "center", gap: 8 },
  puna: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 10,
    minHeight: 44,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
