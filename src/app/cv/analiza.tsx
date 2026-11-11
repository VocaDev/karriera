import { SegmentedControl } from "@expo/ui/community/segmented-control";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import Prekshme from "@/components/Prekshme";
import { Chip, Faqja, Ikona, IKONAT, Karta, Progresi, T, Titulli } from "@/components/ui";
import { analizaPerCV, analizoCV, listoVersionet, type AnalizaCV } from "@/lib/cv";
import { prekja } from "@/lib/prekja";
import { useTema } from "@/lib/tema";
import { CV_PAS_DEMO_DAY_HAPUR } from "@/lib/vecorite";

// Çka bën AI-ja gjatë analizës (tregohet si listë, që pritja të mos jetë një rrotë pa shpjegim).
const HAPAT = [
  "Po e lexoj PDF-në",
  "Po i gjej aftësitë dhe përvojën",
  "Po i vlerësoj seksionet",
  "Po i shkruaj sugjerimet",
];

type Gjendja =
  | { lloji: "duke"; ePare: boolean } // ePare: s'ka analizë të ruajtur, AI-ja po punon
  | { lloji: "gati"; analiza: AnalizaCV }
  | { lloji: "gabim"; mesazhi: string };

// Analiza e CV-së (bordi): nota, seksionet, rishkrimet, pikat e forta.
// Nëse kjo CV është analizuar më parë, shfaqet ajo analizë (pa e thirrur AI-në sërish).
export default function Analiza() {
  const t = useTema();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [gjendja, setGjendja] = useState<Gjendja>({ lloji: "duke", ePare: false });
  const [hapiAktual, setHapiAktual] = useState(0);
  const [emriSkedarit, setEmriSkedarit] = useState("CV-ja jote");
  const [roast, setRoast] = useState(false);
  const [provimi, setProvimi] = useState(0); // rritet te "Provo përsëri"

  useEffect(() => {
    if (!id) return;
    const cvId = id;
    let aktiv = true;

    async function nis() {
      try {
        const versionet = await listoVersionet();
        const cv = versionet.find((v) => v.id === cvId);
        if (!aktiv) return;
        if (!cv) {
          setGjendja({ lloji: "gabim", mesazhi: "Kjo CV nuk u gjet." });
          return;
        }
        if (cv.emri_skedarit) setEmriSkedarit(cv.emri_skedarit);

        const eRuajtur = provimi === 0 ? await analizaPerCV(cvId) : null;
        if (!aktiv) return;
        if (eRuajtur) {
          setGjendja({ lloji: "gati", analiza: eRuajtur });
          return;
        }

        setGjendja({ lloji: "duke", ePare: true });
        const analiza = await analizoCV(cvId);
        if (!aktiv) return;
        prekja.sukses();
        setGjendja({ lloji: "gati", analiza });
      } catch (e) {
        if (!aktiv) return;
        prekja.gabim();
        setGjendja({ lloji: "gabim", mesazhi: e instanceof Error ? e.message : "Analiza e CV-së dështoi." });
      }
    }

    nis();
    return () => {
      aktiv = false;
    };
  }, [id, provimi]);

  // Hapat e listës ecin ndërsa AI-ja punon (vetëm për pritjen e parë; i fundit pret përgjigjen).
  const dukeAnalizuar = gjendja.lloji === "duke" && gjendja.ePare;
  useEffect(() => {
    if (!dukeAnalizuar) return;
    const intervali = setInterval(() => setHapiAktual((h) => Math.min(h + 1, HAPAT.length - 1)), 4000);
    return () => clearInterval(intervali);
  }, [dukeAnalizuar]);

  function provoPerseri() {
    setHapiAktual(0);
    setGjendja({ lloji: "duke", ePare: true });
    setProvimi((n) => n + 1);
  }

  if (!id || gjendja.lloji === "gabim") {
    return (
      <Faqja>
        <View style={styles.qender}>
          <Ikona emri={IKONAT.alarm} madhesia={34} ngjyra={t.keq} />
          <Titulli>Analiza nuk u bë</Titulli>
          <T zbehur style={styles.qenderTekst}>
            {gjendja.lloji === "gabim" ? gjendja.mesazhi : "Mungon CV-ja që duhet analizuar."}
          </T>
          {id && (
            <Prekshme onPress={provoPerseri} accessibilityRole="button" style={[styles.buton, { backgroundColor: t.teksti }]}>
              <T ngjyra={t.sfondi} pesha="trashe">
                Provo përsëri
              </T>
            </Prekshme>
          )}
          <Prekshme
            onPress={() => router.back()}
            accessibilityRole="button"
            style={[styles.buton, styles.butonDyte, { borderColor: t.vija }]}
          >
            <T pesha="trashe">Kthehu te CV-ja</T>
          </Prekshme>
        </View>
      </Faqja>
    );
  }

  if (gjendja.lloji === "duke") {
    return (
      <Faqja>
        <View style={styles.ngarkimi} accessibilityLiveRegion="polite">
          <ActivityIndicator size="large" color={t.zbehur} />
          <Titulli>{gjendja.ePare ? "Po e analizoj CV-në tënde" : "Po e hap analizën"}</Titulli>
          <T zbehur numberOfLines={1}>
            {emriSkedarit}
          </T>

          {gjendja.ePare && (
            <>
              <Karta style={styles.hapat}>
                {HAPAT.map((hapi, index) => {
                  const perfunduar = index < hapiAktual;
                  return (
                    <View key={hapi} style={styles.rreshtiHapit}>
                      <View style={[styles.rrethi, { backgroundColor: perfunduar ? t.ok : t.karta2 }]}>
                        {perfunduar ? (
                          <Ikona emri={IKONAT.check} madhesia={14} ngjyra={t.karta} />
                        ) : (
                          <T zbehur pesha="trashe" madhesia={13}>
                            {index + 1}
                          </T>
                        )}
                      </View>
                      <T ngjyra={perfunduar ? t.teksti : t.zbehur} pesha={perfunduar ? "trashe" : "normal"}>
                        {hapi}
                      </T>
                    </View>
                  );
                })}
              </Karta>
              <T zbehur madhesia={12}>
                Zakonisht zgjat 15–40 sekonda. Mos e mbyll ekranin.
              </T>
            </>
          )}
        </View>
      </Faqja>
    );
  }

  const { analiza } = gjendja;

  return (
    <Faqja>
      <View style={styles.krye}>
        <T zbehur pesha="gjysme" madhesia={12}>
          REZULTATI I ANALIZËS
        </T>
        <Titulli>CV-ja jote, e analizuar.</Titulli>
        <T zbehur numberOfLines={1}>
          {emriSkedarit}
        </T>
      </View>

      <Karta style={styles.notaKarta}>
        <T zbehur pesha="trashe" madhesia={12}>
          NOTA E CV-SË
        </T>
        <View
          style={styles.notaRreshti}
          accessible
          accessibilityLabel={`Nota ${analiza.nota} nga 100`}
        >
          <T ngjyra={t.theksi} pesha="shumeTrashe" madhesia={54} maxFontSizeMultiplier={1.2}>
            {analiza.nota}
          </T>
          <T zbehur madhesia={20} maxFontSizeMultiplier={1.2}>
            /100
          </T>
        </View>
        <Progresi vlera={analiza.nota / 100} />
        <T>{analiza.permbledhja}</T>
        <View style={styles.shenimi}>
          <Ikona emri={IKONAT.info} madhesia={14} ngjyra={t.zbehur} />
          <T zbehur madhesia={12} style={styles.flex}>
            Vlerësim i AI-së për cilësinë e CV-së (profili, rezultatet, projektet, formati), jo garanci punësimi. Mund të gabojë.
          </T>
        </View>
      </Karta>

      <View style={styles.seksionKrye}>
        <T pesha="trashe" madhesia={20}>
          Seksionet e CV-së
        </T>
        <SegmentedControl
          values={["Këshilla", "Roast 🔥"]}
          selectedIndex={roast ? 1 : 0}
          onChange={(e) => {
            prekja.zgjedhje();
            setRoast(e.nativeEvent.selectedSegmentIndex === 1);
          }}
          appearance={t.errët ? "dark" : "light"}
          accessibilityLabel="Mënyra e komenteve"
          style={styles.segmentet}
        />
      </View>

      {analiza.seksionet.map((seksioni, index) => {
        const mire = seksioni.gjendja === "mire";
        return (
          <Karta key={`${seksioni.emri}-${index}`} style={styles.seksionKarta}>
            <View style={styles.seksionTitulli}>
              <T pesha="trashe" madhesia={16} style={styles.flex}>
                {seksioni.emri}
              </T>
              {mire && <Ikona emri={IKONAT.check} madhesia={14} ngjyra={t.ok} />}
              <Chip teksti={mire ? "Mirë" : "Përmirëso"} />
            </View>
            <T zbehur>{roast ? seksioni.roast : seksioni.komenti}</T>
          </Karta>
        );
      })}

      {analiza.rishkrimet.length > 0 && (
        <View style={styles.blloku}>
          <T pesha="trashe" madhesia={20}>
            Si mund të shkruhet më mirë?
          </T>
          {analiza.rishkrimet.map((rishkrimi, index) => (
            <Karta key={index} style={styles.rishkrimKarta}>
              <T zbehur madhesia={11} pesha="trashe">
                PARA
              </T>
              <T zbehur style={styles.para}>
                {rishkrimi.para}
              </T>
              <View style={[styles.ndaresi, { backgroundColor: t.vija }]} />
              <T ngjyra={t.ok} madhesia={11} pesha="trashe">
                PAS
              </T>
              <T pesha="mesme">{rishkrimi.pas}</T>
            </Karta>
          ))}
        </View>
      )}

      {analiza.pikat_e_forta.length > 0 && (
        <View style={styles.blloku}>
          <T pesha="trashe" madhesia={20}>
            Pikat e tua të forta
          </T>
          <Karta style={styles.pikatKarta}>
            {analiza.pikat_e_forta.map((pika, index) => (
              <View key={index} style={styles.pika}>
                <Ikona emri={IKONAT.check} madhesia={16} ngjyra={t.ok} />
                <T style={styles.flex}>{pika}</T>
              </View>
            ))}
          </Karta>
        </View>
      )}

      <View style={styles.veprimet}>
        <Prekshme
          onPress={() => router.back()}
          accessibilityRole="button"
          style={[styles.buton, { backgroundColor: t.teksti }]}
        >
          <T ngjyra={t.sfondi} pesha="trashe">
            Ngarko version të ri
          </T>
        </Prekshme>

        {/* Pas Demo Day-t (HARTA): dokumenti në formate dhe karta "Ndaje". */}
        {CV_PAS_DEMO_DAY_HAPUR && (
          <>
            <Prekshme
              onPress={() => router.push("/cv/dokumenti")}
              accessibilityRole="button"
              style={[styles.buton, styles.butonDyte, { borderColor: t.vija }]}
            >
              <T pesha="trashe">Shiko CV-në</T>
            </Prekshme>
            <Prekshme
              onPress={() => router.push("/cv/ndaje")}
              accessibilityRole="button"
              style={[styles.buton, styles.butonDyte, { borderColor: t.vija }]}
            >
              <T pesha="trashe">Ndaje</T>
            </Prekshme>
          </>
        )}
      </View>
    </Faqja>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  qender: { flex: 1, justifyContent: "center", alignItems: "center", gap: 14, paddingTop: 60 },
  qenderTekst: { textAlign: "center" },
  ngarkimi: { alignItems: "center", gap: 16, paddingTop: 40 },
  hapat: { width: "100%", gap: 16, padding: 20 },
  rreshtiHapit: { flexDirection: "row", alignItems: "center", gap: 12 },
  rrethi: { width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  krye: { gap: 6, marginBottom: 18 },
  notaKarta: { gap: 12, padding: 20 },
  notaRreshti: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  shenimi: { flexDirection: "row", gap: 7, alignItems: "flex-start" },
  seksionKrye: { gap: 12, marginTop: 28, marginBottom: 12 },
  segmentet: { minHeight: 32 },
  seksionKarta: { gap: 10, marginBottom: 10, padding: 16 },
  seksionTitulli: { flexDirection: "row", alignItems: "center", gap: 8 },
  blloku: { gap: 12, marginTop: 24 },
  rishkrimKarta: { gap: 8, padding: 16 },
  para: { textDecorationLine: "line-through" },
  ndaresi: { height: StyleSheet.hairlineWidth, marginVertical: 5 },
  pikatKarta: { gap: 14, padding: 16 },
  pika: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  veprimet: { gap: 10, marginTop: 28, marginBottom: 30 },
  buton: { minHeight: 52, borderRadius: 28, justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
  butonDyte: { borderWidth: StyleSheet.hairlineWidth },
});
