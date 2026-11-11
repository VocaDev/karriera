
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from "react-native";
import { Link, useFocusEffect, useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";

import { Chip, Faqja, Ikona, IKONAT, Karta, T, Titulli } from "@/components/ui";
import { useTema } from "@/lib/tema";
import {
  analizaEFundit,
  listoVersionet,
  ngarkoCV,
  type CvRresht,
} from "@/lib/cv";

export default function CvIndex() {
  const t = useTema();
  const router = useRouter();

  const [ngarkohet, setNgarkohet] = useState(false);
  const [dukeLexuar, setDukeLexuar] = useState(true);
  const [versionet, setVersionet] = useState<CvRresht[]>([]);
  const [analiza, setAnaliza] = useState<Awaited<ReturnType<typeof analizaEFundit>>>(null);

  const rifresko = useCallback(async () => {
    try {
      const [versionetEGjetura, analizaEGjetur] = await Promise.all([
        listoVersionet(),
        analizaEFundit(),
      ]);

      setVersionet(versionetEGjetura);
      setAnaliza(analizaEGjetur);
    } catch {
      Alert.alert("Gabim", "Nuk u arritën të lexohen të dhënat e CV-së.");
    } finally {
      setDukeLexuar(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void rifresko();
    }, [rifresko]),
  );

  async function zgjidhPDF() {
    try {
      const rezultati = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (rezultati.canceled) return;

      const skedari = rezultati.assets[0];

      if (!skedari) return;

      if (skedari.size != null && skedari.size > 5 * 1024 * 1024) {
        Alert.alert("Skedari është shumë i madh", "CV-ja duhet të jetë deri në 5 MB.");
        return;
      }

      if (
        skedari.mimeType &&
        skedari.mimeType !== "application/pdf"
      ) {
        Alert.alert("Format i pasaktë", "Ju lutem zgjidhni një dokument PDF.");
        return;
      }

      setNgarkohet(true);

      const cv = await ngarkoCV({
        uri: skedari.uri,
        name: skedari.name,
        size: skedari.size ?? null,
        mimeType: skedari.mimeType ?? null,
      });

      router.push({
        pathname: "/cv/analiza",
        params: { id: cv.id },
      });
    } catch (gabimi) {
      const mesazhi =
        gabimi instanceof Error
          ? gabimi.message
          : "Ngarkimi i CV-së dështoi.";

      Alert.alert("Nuk u ngarkua CV-ja", mesazhi);
    } finally {
      setNgarkohet(false);
    }
  }

  return (
    <Faqja>
      <View style={styles.kreu}>
        <Chip teksti="PROFILI YT" theks />
        <Titulli>CV-ja ime</Titulli>
        <T zbehur>
          Krijo një CV që tregon çfarë di dhe çfarë mund të bësh.
        </T>
      </View>

      <Pressable
        onPress={zgjidhPDF}
        disabled={ngarkohet}
        style={({ pressed }) => [
          styles.veprimi,
          { backgroundColor: t.teksti, opacity: pressed || ngarkohet ? 0.7 : 1 },
        ]}
      >
        {ngarkohet ? (
          <ActivityIndicator color={t.sfondi} />
        ) : (
          <Ikona emri={IKONAT.dokumenti} madhesia={24} ngjyra={t.sfondi} />
        )}

        <View style={styles.veprimiTeksti}>
          <T pesha="trashe" ngjyra={t.sfondi}>
            {ngarkohet ? "Duke ngarkuar..." : "Ngarko CV-në (PDF)"}
          </T>
          <T madhesia={12} ngjyra={t.sfondi}>
            Deri në 5 MB
          </T>
        </View>

        {!ngarkohet && (
          <Ikona emri={IKONAT.shigjeta} ngjyra={t.sfondi} />
        )}
      </Pressable>

      <Link href="/cv/ndertoje" asChild>
        <Pressable
          style={({ pressed }) => [
            styles.veprimi,
            styles.veprimiSekondar,
            {
              backgroundColor: t.karta,
              borderColor: t.vija,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Ikona emri={IKONAT.grafiku} madhesia={24} ngjyra={t.theksi} />
          <View style={styles.veprimiTeksti}>
            <T pesha="trashe">Nuk kam CV · Ndërtoje me AI</T>
            <T madhesia={12} zbehur>
              Përgjigju në 5 pyetje të shkurtra
            </T>
          </View>
          <Ikona emri={IKONAT.shigjeta} ngjyra={t.zbehur} />
        </Pressable>
      </Link>

      <View style={styles.privatesia}>
        <Ikona emri={IKONAT.kycja} madhesia={15} ngjyra={t.zbehur} />
        <T madhesia={12} zbehur>
          CV-ja jote shihet vetëm nga ti.
        </T>
      </View>

      {analiza && (
        <View style={styles.seksioni}>
          <T pesha="trashe" madhesia={19}>
            Analiza e fundit
          </T>

          <Pressable
            onPress={() =>
              router.push({
                pathname: "/cv/analiza",
                params: { id: analiza.cv.id },
              })
            }
          >
            <Karta style={styles.kartaAnalizes}>
              <View style={styles.rreshti}>
                <View style={styles.flex}>
                  <T pesha="trashe">{analiza.cv.emri_skedarit ?? "CV-ja ime"}</T>
                  <T madhesia={12} zbehur>
                    Versioni v{analiza.cv.versioni}
                  </T>
                </View>

                <T pesha="trashe" madhesia={28} ngjyra={t.theksi}>
                  {analiza.analiza.nota}/100
                </T>
              </View>

              <T madhesia={13} zbehur>
                {analiza.analiza.permbledhja}
              </T>

              <T pesha="gjysme" madhesia={12} ngjyra={t.theksi}>
                Shiko analizën →
              </T>
            </Karta>
          </Pressable>
        </View>
      )}

      <View style={styles.seksioni}>
        <View style={styles.rreshti}>
          <T pesha="trashe" madhesia={19}>
            Versionet e CV-së
          </T>
          <View style={styles.flex} />
          <Chip teksti={`${versionet.length} gjithsej`} />
        </View>

        {dukeLexuar ? (
          <ActivityIndicator color={t.theksi} />
        ) : versionet.length === 0 ? (
          <Karta>
            <T zbehur madhesia={13}>
              Ende nuk ke ruajtur asnjë CV. Ngarko një PDF ose ndërtoje me AI.
            </T>
          </Karta>
        ) : (
          versionet.map((versioni) => (
            <Karta key={versioni.id} style={styles.kartaVersionit}>
              <View style={styles.rreshti}>
                <Ikona
                  emri={IKONAT.dokumenti}
                  madhesia={21}
                  ngjyra={t.zbehur}
                />
                <View style={styles.flex}>
                  <T pesha="gjysme">
                    v{versioni.versioni} ·{" "}
                    {versioni.emri_skedarit ?? "CV e krijuar me AI"}
                  </T>
                  <T madhesia={12} zbehur>
                    {versioni.burimi === "ngarkuar" ? "E ngarkuar" : "E krijuar"}
                  </T>
                </View>
                {versioni.nota !== null && (
                  <Chip teksti={`${versioni.nota}/100`} theks />
                )}
              </View>
            </Karta>
          ))
        )}
      </View>
    </Faqja>
  );
}

const styles = StyleSheet.create({
  kreu: {
    gap: 9,
    marginBottom: 10,
  },
  veprimi: {
    minHeight: 78,
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  veprimiSekondar: {
    borderWidth: 1,
  },
  veprimiTeksti: {
    flex: 1,
    gap: 4,
  },
  privatesia: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 3,
  },
  seksioni: {
    gap: 12,
    marginTop: 18,
  },
  rreshti: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  kartaAnalizes: {
    gap: 12,
  },
  kartaVersionit: {
    paddingVertical: 13,
  },
});
