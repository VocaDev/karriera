// Kompania (bordi, ekrani 66): kush jeni, çka thonë kandidatët e dukshëm për pozitat tuaja, dhe llogaria.
// Analitika llogaritet vetëm nga të dhëna të vërteta (kandidatët anonimë + totalet e serverit).
// Plani me pagesë dhe ekipi s'janë pjesë e kursit (HARTA): s'shfaqen. Përmbledhja javore s'ekziston ende dhe e thotë.
import { useMemo } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import ButoniDil from "@/components/ButoniDil";
import { gjendjaEGabimit, PA_INTERNET_KANDIDATET, useKandidatet } from "@/components/Kandidatet";
import ShiritiPaInternet from "@/components/ShiritiPaInternet";
import { Pulsi, Vije } from "@/components/Skeleti";
import { GradientiSiper } from "@/components/TabEkrani";
import { IKONAT, Ikona, Karta, T } from "@/components/ui";
import { aftesiteMeTeShpeshta, MAS_PAK_SE_K, PRAGU_GATI } from "@/lib/kandidatet";
import { useSesioni } from "@/lib/sesioni";
import { useTema } from "@/lib/tema";

export default function Kompania() {
  const t = useTema();
  const { sesioni, profili } = useSesioni();
  const te_dhenat = useKandidatet();
  const { punet, kandidatet, numrat, rifreskim, rifresko } = te_dhenat;

  const analitika = useMemo(() => {
    if (!kandidatet) return null;
    // Kandidatura = kandidat × pozitë: serveri s'e lidh të njëjtin person mes pozitave, prandaj numërojmë kandidaturat.
    const mesatarja = kandidatet.length
      ? Math.round(kandidatet.reduce((s, k) => s + k.perqindja, 0) / kandidatet.length)
      : null;
    return {
      teGatshem: kandidatet.length,
      mesatarja,
      meIntervisten: kandidatet.filter((k) => k.intervista_nota !== null).length,
      mungojne: aftesiteMeTeShpeshta(kandidatet, "mungon"),
      kane: aftesiteMeTeShpeshta(kandidatet, "ke"),
    };
  }, [kandidatet]);
  // Kontrollet "A jam gati?" përfshijnë edhe kërkues pa pëlqim: serveri i jep vetëm kur një pozitë ka ≥ 5 (përndryshe null).
  // Mbledhim vetëm ato që erdhën; nëse disa pozita kanë më pak se 5, e themi "të paktën".
  const kontrolle = useMemo(() => {
    if (!numrat || numrat.size === 0) return null;
    const vlerat = [...numrat.values()].map((n) => n.kontrolluan);
    const teNjohura = vlerat.filter((v): v is number => v !== null);
    return { shuma: teNjohura.reduce((s, v) => s + v, 0), kaTeFshehura: teNjohura.length < vlerat.length };
  }, [numrat]);

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

      <Karta style={styles.kompania}>
        <View style={[styles.avatari, { backgroundColor: t.teksti }]}>
          <Ikona emri={IKONAT.canta} madhesia={24} ngjyra={t.sfondi} />
        </View>
        <View style={styles.flexGap}>
          <T pesha="trashe" madhesia={18}>
            {profili?.organizata || "Kompania juaj"}
          </T>
          <T zbehur madhesia={13.5}>
            {profili?.emri ? `${profili.emri} · ` : ""}
            {sesioni?.user.email}
          </T>
          <T zbehur madhesia={13}>
            {punet ? `${punet.length} ${punet.length === 1 ? "pozitë" : "pozita"} në Karriera` : " "}
          </T>
        </View>
      </Karta>

      <T pesha="gjysme" madhesia={13} zbehur style={styles.kokaEGrupit} accessibilityRole="header">
        Kandidatët për pozitat tuaja
      </T>
      {gabimi ?? (
        <Karta style={styles.analitika}>
          {analitika === null ? (
            <Pulsi>
              <View style={styles.skeleti} accessible accessibilityLabel="Po llogaritet analitika">
                <Vije gjeresia="70%" lartesia={22} />
                <Vije gjeresia="90%" lartesia={13} />
                <Vije gjeresia="60%" lartesia={13} />
              </View>
            </Pulsi>
          ) : (
            <>
              <View style={styles.rrjeta}>
                {(
                  [
                    [`kandidatura gati (≥ ${PRAGU_GATI}%)`, analitika.teGatshem],
                    ["gatishmëria mes.", analitika.mesatarja !== null ? `${analitika.mesatarja}%` : "–"],
                    ["me intervistë", analitika.meIntervisten],
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
              {analitika.teGatshem === 0 ? (
                <T zbehur madhesia={13.5}>
                  Ende asnjë kandidat i dukshëm: s&apos;ka çka të krahasohet. Analitika mbushet sapo kandidatët të zgjedhin të duken.
                </T>
              ) : (
                <>
                  {analitika.mungojne.length > 0 && (
                    <T madhesia={13.5}>
                      <T pesha="gjysme" madhesia={13.5}>
                        U mungon më shpesh:{" "}
                      </T>
                      {analitika.mungojne.map((a) => `${a.aftesia} (${a.numri})`).join(", ")}
                    </T>
                  )}
                  {analitika.kane.length > 0 && (
                    <T zbehur madhesia={13.5}>
                      E kanë më shpesh: {analitika.kane.map((a) => `${a.aftesia} (${a.numri})`).join(", ")}
                    </T>
                  )}
                </>
              )}
              {kontrolle !== null && (
                <T zbehur madhesia={12.5}>
                  {kontrolle.shuma === 0
                    ? `Kontrollet "A jam gati?" për pozitat tuaja: ${MAS_PAK_SE_K} për secilën pozitë (nën 5 s'tregojmë numër, që të mos dallohet askush).`
                    : `${kontrolle.kaTeFshehura ? "Të paktën " : ""}${kontrolle.shuma} kontrolle "A jam gati?" për pozitat tuaja (vetëm numri; pozitat me më pak se 5 s'numërohen).`}
                </T>
              )}
            </>
          )}
        </Karta>
      )}

      <Karta style={styles.rreshti}>
        <Ikona emri={IKONAT.email} madhesia={18} ngjyra={t.zbehur} />
        <View style={styles.flexGap}>
          <T pesha="gjysme" madhesia={15}>
            Përmbledhja javore
          </T>
          <T zbehur madhesia={13}>
            Ende nuk dërgohet. Kur të vijë: çdo të hënë, kandidatët e rinj të gatshëm për pozitat tuaja.
          </T>
        </View>
      </Karta>

      <ButoniDil />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexGap: { flex: 1, gap: 3 },
  faqja: { padding: 18, gap: 12, paddingBottom: 120 },
  kompania: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatari: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  kokaEGrupit: { paddingHorizontal: 6, marginTop: 6 },
  analitika: { gap: 10 },
  skeleti: { gap: 10 },
  rrjeta: { flexDirection: "row", gap: 8 },
  numri: { flex: 1, gap: 2, alignItems: "center" },
  qendra: { textAlign: "center" },
  rreshti: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
});
