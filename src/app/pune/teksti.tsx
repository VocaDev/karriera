import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { ButoniKryesor, Fusha } from "@/components/Forma";
import { useNjoftim } from "@/components/Njoftimet";
import Prekshme from "@/components/Prekshme";
import ShiritiPaInternet from "@/components/ShiritiPaInternet";
import { Pulsi, Vije } from "@/components/Skeleti";
import { IKONAT, Ikona, T } from "@/components/ui";
import { paInternet, VONON } from "@/lib/mesazhet";
import { prekja } from "@/lib/prekja";
import { gjePunen, KUFIJTE_E_LINKUT, ruajTekstinEShpalljes, shenoPunenENdryshuar } from "@/lib/punet";
import { eshteGabimKohe, eshteGabimRrjeti, KOHA_E_LEXIMIT, meKohe, pamjaEGabimit, useRrjeti } from "@/lib/rrjeti";
import { useTema } from "@/lib/tema";

// "Teksti i shpalljes" (J7): fletë për një punë private. Përdoruesi e ngjit vetë tekstin nga shpallja (≤ 4000 shkronja),
// që "A jam gati?" ta dijë çka kërkon puna. Teksti është i tiji dhe e sheh vetëm ai (RLS: vetëm pronari).
export default function TekstiIShpalljes() {
  const t = useTema();
  const router = useRouter();
  const njofto = useNjoftim();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [teksti, setTeksti] = useState<string | null>(null); // null = duke ngarkuar
  const [titulli, setTitulli] = useState("");
  const [gabimiILeximit, setGabimiILeximit] = useState<unknown>(null);
  const [gabimi, setGabimi] = useState<unknown>(null);
  const [duke_ruajtur, setDukeRuajtur] = useState(false);

  const lexo = useCallback(() => {
    meKohe(gjePunen(id), KOHA_E_LEXIMIT)
      .then((p) => {
        if (!p || !p.private) {
          setGabimiILeximit(new Error("Ky tekst mund të ndryshohet vetëm te punët që i ke shtuar vetë me link."));
          return;
        }
        setGabimiILeximit(null);
        setTitulli(p.titulli);
        setTeksti(p.pershkrimi);
      })
      .catch((e: unknown) => setGabimiILeximit(e));
  }, [id]);

  useEffect(() => {
    lexo();
  }, [lexo]);

  function provoPerseri() {
    setGabimiILeximit(null);
    lexo();
  }

  // Interneti u kthye: leximi provohet sërish; mesazhi "pa internet" / "po vonon" i ruajtjes largohet.
  useRrjeti(() => {
    if (gabimiILeximit) provoPerseri();
    setGabimi((g: unknown) => (g !== null && (eshteGabimRrjeti(g) || eshteGabimKohe(g)) ? null : g));
  });

  async function ruaj() {
    if (duke_ruajtur || teksti === null) return;
    setDukeRuajtur(true);
    setGabimi(null);
    try {
      await meKohe(ruajTekstinEShpalljes(id, teksti), KOHA_E_LEXIMIT, VONON.pergjithshme);
      prekja.sukses();
      shenoPunenENdryshuar(id); // detajet e rilexojnë punën kur kthehen
      njofto("Teksti u ruajt", "sukses");
      router.back();
    } catch (e) {
      prekja.gabim();
      setGabimi(e);
      setDukeRuajtur(false);
    }
  }

  const pamjaERuajtjes = gabimi ? pamjaEGabimit(gabimi, "S'u ruajt", "teksti yt mbetet këtu", false) : null;
  const eRrjetit = gabimi !== null && (eshteGabimRrjeti(gabimi) || eshteGabimKohe(gabimi));

  return (
    <ScrollView
      style={{ backgroundColor: t.sfondi }}
      contentContainerStyle={styles.faqja}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <View style={styles.koka}>
        <T pesha="trashe" madhesia={20} accessibilityRole="header" style={styles.titulli}>
          Teksti i shpalljes
        </T>
        <Prekshme
          accessibilityRole="button"
          accessibilityLabel="Mbyll"
          hitSlop={8}
          shkalla={0.9}
          onPress={() => router.back()}
          style={styles.mbyll}
        >
          <Ikona emri={IKONAT.mbyll} madhesia={30} ngjyra={t.zbehur} />
        </Prekshme>
      </View>
      <ShiritiPaInternet teksti={paInternet("teksti yt mbetet këtu", false).cfare} />

      {gabimiILeximit ? (
        <View style={styles.gabimiILeximit}>
          <T pesha="trashe" madhesia={16}>
            {pamjaEGabimit(gabimiILeximit, "S'u lexua puna", "s'mund ta hapim tekstin tani", false).titulli}
          </T>
          <T zbehur madhesia={14} accessibilityLiveRegion="polite">
            {pamjaEGabimit(gabimiILeximit, "S'u lexua puna", "s'mund ta hapim tekstin tani", false).teksti}
          </T>
          <ButoniKryesor teksti="Provo përsëri" onPress={provoPerseri} />
        </View>
      ) : teksti === null ? (
        <Pulsi>
          <View style={styles.skeleti} accessibilityLabel="Po ngarkohet teksti">
            <Vije gjeresia="70%" lartesia={14} />
            <Vije gjeresia="100%" lartesia={160} rrezja={16} />
          </View>
        </Pulsi>
      ) : (
        <>
          <T zbehur madhesia={14}>
            {titulli ? `${titulli}. ` : ""}Kopjo tekstin nga shpallja dhe ngjite këtu. Me të, “A jam gati?” e di saktë çka
            kërkon puna. E sheh vetëm ti.
          </T>
          <Fusha
            style={styles.shumeRreshta}
            value={teksti}
            onChangeText={setTeksti}
            placeholder="Detyrat, kërkesat, përvoja..."
            multiline
            maxLength={KUFIJTE_E_LINKUT.pershkrimi}
            editable={!duke_ruajtur}
            accessibilityLabel="Teksti i shpalljes"
          />
          <T zbehur madhesia={12.5} style={styles.numri}>
            {teksti.length} / {KUFIJTE_E_LINKUT.pershkrimi}
          </T>

          {pamjaERuajtjes && (
            <T ngjyra={eRrjetit ? t.teksti : t.keq} accessibilityLiveRegion="polite">
              {eRrjetit ? `${pamjaERuajtjes.titulli}. ${pamjaERuajtjes.teksti}` : `S'u ruajt: ${pamjaERuajtjes.teksti}`}
            </T>
          )}

          <ButoniKryesor teksti={eRrjetit ? "Provo përsëri" : "Ruaje tekstin"} onPress={ruaj} duke_punuar={duke_ruajtur} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  faqja: { padding: 20, paddingTop: 22, gap: 8, paddingBottom: 40 },
  koka: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  titulli: { flex: 1 },
  mbyll: { minWidth: 44, minHeight: 44, alignItems: "flex-end", justifyContent: "center" },
  shumeRreshta: { minHeight: 200, maxHeight: 360, textAlignVertical: "top", marginTop: 6 },
  numri: { textAlign: "right" },
  skeleti: { gap: 12, marginTop: 8 },
  gabimiILeximit: { gap: 8, marginTop: 8 },
});
