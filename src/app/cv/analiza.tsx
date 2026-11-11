
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Faqja, Karta, T, Titulli } from "@/components/ui";
import { useTema } from "@/lib/tema";
import {
  analizoCV,
  listoVersionet,
  type AnalizaCV,
} from "@/lib/cv";

const HAPAT = [
  "Po e lexoj tekstin",
  "Po i gjej aftÃ«sitÃ« dhe pÃ«rvojÃ«n",
  "Po e krahasoj me shpalljet",
  "Po i shkruaj sugjerimet",
];

export default function Analiza() {
  const t = useTema();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [analiza, setAnaliza] = useState<AnalizaCV | null>(null);
  const [hapiAktual, setHapiAktual] = useState(0);
  const [emriSkedarit, setEmriSkedarit] = useState("CV-ja jote");
  const [roast, setRoast] = useState(false);
  const [gabim, setGabim] = useState(false);

  useEffect(() => {
    let aktiv = true;

    if (!id) {
      setGabim(true);
      return;
    }

    const intervali = setInterval(() => {
      setHapiAktual((hapi) => Math.min(hapi + 1, 3));
    }, 1200);

    async function nisAnalizen() {
      try {
        const versionet = await listoVersionet();
        const cv = versionet.find((v) => v.id === id);

        if (aktiv && cv?.emri_skedarit) {
          setEmriSkedarit(cv.emri_skedarit);
        }

        const rezultati = await analizoCV(id);

        if (aktiv) {
          setAnaliza(rezultati);
          setHapiAktual(4);
        }
      } catch {
        if (aktiv) setGabim(true);
      } finally {
        clearInterval(intervali);
      }
    }

    nisAnalizen();

    return () => {
      aktiv = false;
      clearInterval(intervali);
    };
  }, [id]);

  if (gabim) {
    return (
      <Faqja>
        <View style={styles.qender}>
          <Titulli>Analiza nuk u realizua</Titulli>
          <T zbehur style={styles.qenderTekst}>
            Pati njÃ« problem gjatÃ« analizimit tÃ« CV-sÃ«. Provo pÃ«rsÃ«ri.
          </T>
          <Pressable
            onPress={() => router.replace("/cv")}
            style={[styles.buton, { backgroundColor: t.teksti }]}
          >
            <T ngjyra={t.karta} pesha="trashe">
              Kthehu te CV-ja
            </T>
          </Pressable>
        </View>
      </Faqja>
    );
  }

  if (!analiza) {
    return (
      <Faqja>
        <View style={styles.ngarkimi}>
          <ActivityIndicator size="large" color={t.theksi} />
          <Titulli>Po e analizoj CV-nÃ« tÃ«nde</Titulli>
          <T zbehur>{emriSkedarit}</T>

          <Karta style={styles.hapat}>
            {HAPAT.map((hapi, index) => {
              const perfunduar = index < hapiAktual;

              return (
                <View key={hapi} style={styles.rreshtiHapit}>
                  <View
                    style={[
                      styles.rrethi,
                      {
                        backgroundColor: perfunduar
                          ? t.ok
                          : t.karta2,
                      },
                    ]}
                  >
                    <T
                      ngjyra={perfunduar ? "#FFFFFF" : t.zbehur}
                      pesha="trashe"
                    >
                      {perfunduar ? "âœ“" : `${index + 1}`}
                    </T>
                  </View>
                  <T
                    ngjyra={perfunduar ? t.teksti : t.zbehur}
                    pesha={perfunduar ? "trashe" : "normal"}
                  >
                    {hapi}
                  </T>
                </View>
              );
            })}
          </Karta>

          <T zbehur madhesia={12}>
            Kjo mund tÃ« zgjasÃ« disa sekonda.
          </T>
        </View>
      </Faqja>
    );
  }

  return (
    <Faqja>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.krye}>
          <T zbehur madhesia={12}>REZULTATI I ANALIZÃ‹S</T>
          <Titulli>CV-ja jote, e analizuar.</Titulli>
          <T zbehur>{emriSkedarit}</T>
        </View>

        <Karta style={styles.notaKarta}>
          <T zbehur pesha="trashe">NOTA E CV-SÃ‹</T>
          <View style={styles.notaRreshti}>
            <T ngjyra={t.theksi} pesha="trashe" madhesia={54}>
              {analiza.nota}
            </T>
            <T zbehur madhesia={20}>/100</T>
          </View>
          <View style={[styles.shiriti, { backgroundColor: t.karta2 }]}>
            <View
              style={[
                styles.progresi,
                {
                  width: `${Math.max(0, Math.min(100, analiza.nota))}%`,
                  backgroundColor: t.theksi,
                },
              ]}
            />
          </View>
          <T zbehur>{analiza.permbledhja}</T>
        </Karta>

        <View style={styles.seksionKrye}>
          <Titulli>Seksionet e CV-sÃ«</Titulli>
          <Pressable
            onPress={() => setRoast((v) => !v)}
            style={[
              styles.roastButon,
              {
                backgroundColor: roast ? t.theksi : t.karta,
                borderColor: t.vija,
              },
            ]}
          >
            <T
              ngjyra={roast ? "#FFFFFF" : t.teksti}
              pesha="trashe"
              madhesia={12}
            >
              {roast ? "ðŸ”¥ Roast ON" : "ðŸ”¥ Roast"}
            </T>
          </Pressable>
        </View>

        {analiza.seksionet.map((seksioni, index) => {
          const mire = seksioni.gjendja === "mire";

          return (
            <Karta key={`${seksioni.emri}-${index}`} style={styles.seksionKarta}>
              <View style={styles.seksionTitulli}>
                <View style={{ flex: 1 }}>
                  <T pesha="trashe" madhesia={16}>
                    {seksioni.emri}
                  </T>
                </View>
                <View
                  style={[
                    styles.statusi,
                    {
                      backgroundColor: mire
                        ? t.karta2
                        : `${t.theksi}18`,
                    },
                  ]}
                >
                  <T
                    ngjyra={mire ? t.teksti : t.theksi}
                    madhesia={11}
                    pesha="trashe"
                  >
                    {mire ? "MIRÃ‹" : "PÃ‹RMIRÃ‹SO"}
                  </T>
                </View>
              </View>

              <T zbehur>
                {roast ? seksioni.roast : seksioni.komenti}
              </T>
            </Karta>
          );
        })}

        {analiza.rishkrimet.length > 0 && (
          <View style={styles.blloku}>
            <Titulli>Si mund tÃ« shkruhet mÃ« mirÃ«?</Titulli>

            {analiza.rishkrimet.map((rishkrimi, index) => (
              <Karta key={index} style={styles.rishkrimKarta}>
                <T zbehur madhesia={11} pesha="trashe">
                  PARA
                </T>
               <T style={[styles.para, { textDecorationLine: "line-through" }]}>
  {rishkrimi.para}
</T>

                <View style={[styles.ndaresi, { backgroundColor: t.vija }]} />

                <T ngjyra={t.theksi} madhesia={11} pesha="trashe">
                  PAS
                </T>
                <T pesha="mesme">{rishkrimi.pas}</T>
              </Karta>
            ))}
          </View>
        )}

        {analiza.pikat_e_forta.length > 0 && (
          <View style={styles.blloku}>
            <Titulli>Pikat e tua tÃ« forta</Titulli>
            <Karta style={styles.pikatKarta}>
              {analiza.pikat_e_forta.map((pika, index) => (
                <View key={index} style={styles.pika}>
                  <T ngjyra={t.ok} pesha="trashe">
                    âœ“
                  </T>
                  <View style={{ flex: 1 }}>
                    <T>{pika}</T>
                  </View>
                </View>
              ))}
            </Karta>
          </View>
        )}

        <View style={styles.veprimet}>
          <Pressable
            onPress={() => router.push("/cv/dokumenti")}
            style={[styles.buton, { backgroundColor: t.teksti }]}
          >
            <T ngjyra={t.karta} pesha="trashe">
              Shiko CV-nÃ«
            </T>
          </Pressable>

          <Pressable
            onPress={() => router.push("/cv/ndaje")}
            style={[
              styles.buton,
              {
                backgroundColor: t.karta,
                borderWidth: 1,
                borderColor: t.vija,
              },
            ]}
          >
            <T ngjyra={t.teksti} pesha="trashe">
              Ndaje
            </T>
          </Pressable>
        </View>
      </ScrollView>
    </Faqja>
  );
}

const styles = StyleSheet.create({
  qender: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
    padding: 24,
  },
  qenderTekst: {
    textAlign: "center",
  },
  ngarkimi: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 18,
    padding: 20,
  },
  hapat: {
    width: "100%",
    gap: 18,
    padding: 20,
  },
  rreshtiHapit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rrethi: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  krye: {
    gap: 7,
    marginBottom: 20,
  },
  notaKarta: {
    gap: 10,
    padding: 20,
  },
  notaRreshti: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 5,
  },
  shiriti: {
    height: 8,
    borderRadius: 10,
    overflow: "hidden",
  },
  progresi: {
    height: "100%",
    borderRadius: 10,
  },
  seksionKrye: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 28,
    marginBottom: 12,
  },
  roastButon: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  seksionKarta: {
    gap: 12,
    marginBottom: 10,
    padding: 16,
  },
  seksionTitulli: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statusi: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  blloku: {
    gap: 12,
    marginTop: 24,
  },
  rishkrimKarta: {
    gap: 9,
    padding: 16,
  },
  para: {
    opacity: 0.65,
  },
  ndaresi: {
    height: 1,
    marginVertical: 5,
  },
  pikatKarta: {
    gap: 14,
    padding: 16,
  },
  pika: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  veprimet: {
    gap: 10,
    marginTop: 28,
    marginBottom: 30,
  },
  buton: {
    minHeight: 52,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
});

