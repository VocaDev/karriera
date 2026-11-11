import * as DocumentPicker from "expo-document-picker";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useNjoftim } from "@/components/Njoftimet";
import Prekshme from "@/components/Prekshme";
import { Pulsi, Vije } from "@/components/Skeleti";
import { Chip, Faqja, Ikona, IKONAT, Karta, T, Titulli } from "@/components/ui";
import { analizaEFundit, listoVersionet, MADHESIA_MAKS_CV, ngarkoCV, type AnalizaCV, type CvRresht } from "@/lib/cv";
import { prekja } from "@/lib/prekja";
import { useTema } from "@/lib/tema";

type TeDhenat = { versionet: CvRresht[]; eFundit: { cv: CvRresht; analiza: AnalizaCV } | null };

// CV-ja ime (bordi, ekrani i CV-së): ngarko PDF-në, shiko analizën e fundit dhe versionet.
export default function CvIndex() {
  const t = useTema();
  const router = useRouter();
  const njofto = useNjoftim();

  const [teDhenat, setTeDhenat] = useState<TeDhenat | null>(null); // null = ende pa ardhur
  const [gabimi, setGabimi] = useState<string | null>(null);
  const [ngarkohet, setNgarkohet] = useState(false);

  const lexo = useCallback(async () => {
    try {
      const [versionet, eFundit] = await Promise.all([listoVersionet(), analizaEFundit()]);
      setTeDhenat({ versionet, eFundit });
      setGabimi(null);
    } catch (e) {
      setGabimi(e instanceof Error ? e.message : "S'u lexuan të dhënat e CV-së.");
    }
  }, []);

  // Rilexon sa herë që ekrani shfaqet (p.sh. pas një analize të re).
  useFocusEffect(
    useCallback(() => {
      lexo();
    }, [lexo]),
  );

  async function zgjidhPDF() {
    if (ngarkohet) return;
    let rezultati: DocumentPicker.DocumentPickerResult;
    try {
      rezultati = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
        multiple: false,
      });
    } catch {
      prekja.gabim();
      njofto("S'u hap zgjedhja e skedarit.", "gabim");
      return;
    }
    if (rezultati.canceled) return;
    const skedari = rezultati.assets[0];
    if (!skedari) return;

    if (skedari.size != null && skedari.size > MADHESIA_MAKS_CV) {
      prekja.gabim();
      njofto("CV-ja duhet të jetë deri në 5 MB.", "gabim");
      return;
    }

    setNgarkohet(true);
    try {
      const cv = await ngarkoCV({
        uri: skedari.uri,
        name: skedari.name,
        size: skedari.size ?? null,
        mimeType: skedari.mimeType ?? null,
      });
      prekja.sukses();
      njofto("CV-ja u ngarkua", "sukses");
      router.push({ pathname: "/cv/analiza", params: { id: cv.id } });
    } catch (e) {
      prekja.gabim();
      njofto(e instanceof Error ? e.message : "Ngarkimi i CV-së dështoi.", "gabim");
    } finally {
      setNgarkohet(false);
    }
  }

  const eFundit = teDhenat?.eFundit ?? null;

  return (
    <Faqja>
      <View style={styles.kreu}>
        <Titulli>CV-ja ime</Titulli>
        <T zbehur>Ngarko CV-në ose ndërtoje me AI. AI-ja të thotë çka është mirë dhe çka duhet përmirësuar.</T>
      </View>

      <Prekshme
        onPress={zgjidhPDF}
        disabled={ngarkohet}
        accessibilityRole="button"
        accessibilityLabel="Ngarko CV-në si PDF, deri në 5 MB"
        accessibilityState={{ busy: ngarkohet }}
        style={[styles.veprimi, { backgroundColor: t.teksti, opacity: ngarkohet ? 0.7 : 1 }]}
      >
        {ngarkohet ? (
          <ActivityIndicator color={t.sfondi} />
        ) : (
          <Ikona emri={IKONAT.dokumenti} madhesia={24} ngjyra={t.sfondi} />
        )}
        <View style={styles.veprimiTeksti}>
          <T pesha="trashe" ngjyra={t.sfondi}>
            {ngarkohet ? "Duke ngarkuar…" : "Ngarko CV-në (PDF)"}
          </T>
          <T madhesia={12} ngjyra={t.sfondi}>
            Deri në 5 MB
          </T>
        </View>
        {!ngarkohet && <Ikona emri={IKONAT.shigjeta} ngjyra={t.sfondi} />}
      </Prekshme>

      <Prekshme
        onPress={() => router.push("/cv/ndertoje")}
        accessibilityRole="button"
        accessibilityLabel="Nuk kam CV, ndërtoje me AI. Përgjigju në 5 pyetje të shkurtra."
        style={[styles.veprimi, styles.veprimiSekondar, { backgroundColor: t.karta, borderColor: t.vija }]}
      >
        <Ikona emri={IKONAT.grafiku} madhesia={24} ngjyra={t.teksti} />
        <View style={styles.veprimiTeksti}>
          <T pesha="trashe">Nuk kam CV · Ndërtoje me AI</T>
          <T madhesia={12} zbehur>
            Përgjigju në 5 pyetje të shkurtra
          </T>
        </View>
        <Ikona emri={IKONAT.shigjeta} madhesia={14} ngjyra={t.zbehur} />
      </Prekshme>

      <View style={styles.privatesia}>
        <Ikona emri={IKONAT.kycja} madhesia={14} ngjyra={t.zbehur} />
        <T madhesia={12} zbehur>
          CV-ja jote shihet vetëm nga ti.
        </T>
      </View>

      {gabimi && teDhenat === null ? (
        <Karta style={styles.gabimi}>
          <T pesha="trashe">S&apos;u lexuan CV-të e tua</T>
          <T zbehur madhesia={13}>
            {gabimi}
          </T>
          <Prekshme
            onPress={() => {
              setGabimi(null);
              lexo();
            }}
            accessibilityRole="button"
            style={[styles.butoniIVogel, { backgroundColor: t.teksti }]}
          >
            <T pesha="trashe" madhesia={14} ngjyra={t.sfondi}>
              Provo përsëri
            </T>
          </Prekshme>
        </Karta>
      ) : null}

      {eFundit && (
        <View style={styles.seksioni}>
          <T pesha="trashe" madhesia={19}>
            Analiza e fundit
          </T>
          <Prekshme
            onPress={() => router.push({ pathname: "/cv/analiza", params: { id: eFundit.cv.id } })}
            accessibilityRole="button"
            accessibilityLabel={`Analiza e fundit, nota ${eFundit.analiza.nota} nga 100. Hape.`}
          >
            <Karta style={styles.kartaAnalizes}>
              <View style={styles.rreshti}>
                <View style={styles.flex}>
                  <T pesha="trashe" numberOfLines={1}>
                    {eFundit.cv.emri_skedarit ?? "CV-ja ime"}
                  </T>
                  <T madhesia={12} zbehur>
                    Versioni v{eFundit.cv.versioni}
                  </T>
                </View>
                <T pesha="trashe" madhesia={28} ngjyra={t.theksi} maxFontSizeMultiplier={1.2}>
                  {eFundit.analiza.nota}
                  <T zbehur madhesia={14}>
                    /100
                  </T>
                </T>
              </View>
              <T madhesia={13} zbehur>
                {eFundit.analiza.permbledhja}
              </T>
              <T pesha="gjysme" madhesia={12} zbehur>
                Shiko analizën →
              </T>
            </Karta>
          </Prekshme>
        </View>
      )}

      <View style={styles.seksioni}>
        <View style={styles.rreshti}>
          <T pesha="trashe" madhesia={19} style={styles.flex}>
            Versionet e CV-së
          </T>
          {teDhenat && <Chip teksti={`${teDhenat.versionet.length} gjithsej`} />}
        </View>

        {teDhenat === null ? (
          gabimi ? null : (
            <Pulsi>
              <View style={styles.skeletet} accessibilityLabel="Po ngarkohen versionet">
                {[0, 1].map((i) => (
                  <Karta key={i} style={styles.kartaVersionit}>
                    <Vije gjeresia="55%" />
                    <Vije gjeresia="30%" lartesia={10} />
                  </Karta>
                ))}
              </View>
            </Pulsi>
          )
        ) : teDhenat.versionet.length === 0 ? (
          <Karta>
            <T zbehur madhesia={13}>
              Ende s&apos;ke asnjë CV. Ngarko PDF-në tënde ose ndërtoje me AI më lart.
            </T>
          </Karta>
        ) : (
          teDhenat.versionet.map((versioni) => {
            const ngarkuar = versioni.burimi === "ngarkuar";
            const permbajtja = (
              <Karta style={styles.kartaVersionit}>
                <View style={styles.rreshti}>
                  <Ikona emri={IKONAT.dokumenti} madhesia={21} ngjyra={t.zbehur} />
                  <View style={styles.flex}>
                    <T pesha="gjysme" numberOfLines={1}>
                      v{versioni.versioni} · {versioni.emri_skedarit ?? "CV e krijuar me AI"}
                    </T>
                    <T madhesia={12} zbehur>
                      {ngarkuar ? (versioni.nota === null ? "E ngarkuar · pa analizë" : "E ngarkuar") : "E krijuar"}
                    </T>
                  </View>
                  {versioni.nota !== null && <Chip teksti={`${versioni.nota}/100`} />}
                </View>
              </Karta>
            );
            // Versioni i ngarkuar hap analizën e vet (ose e nis, nëse s'është analizuar ende);
            // versioni i krijuar me AI hap dokumentin e vet.
            return (
              <Prekshme
                key={versioni.id}
                onPress={() =>
                  ngarkuar
                    ? router.push({ pathname: "/cv/analiza", params: { id: versioni.id } })
                    : router.push({ pathname: "/cv/dokumenti", params: { id: versioni.id } })
                }
                accessibilityRole="button"
                accessibilityLabel={`Versioni ${versioni.versioni}. ${
                  ngarkuar ? (versioni.nota === null ? "Analizoje" : "Shiko analizën") : "Hap CV-në"
                }`}
              >
                {permbajtja}
              </Prekshme>
            );
          })
        )}
      </View>
    </Faqja>
  );
}

const styles = StyleSheet.create({
  kreu: { gap: 8, marginBottom: 14 },
  veprimi: {
    minHeight: 78,
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    marginBottom: 10,
  },
  veprimiSekondar: { borderWidth: StyleSheet.hairlineWidth },
  veprimiTeksti: { flex: 1, gap: 4 },
  privatesia: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 2 },
  seksioni: { gap: 12, marginTop: 22 },
  rreshti: { flexDirection: "row", alignItems: "center", gap: 12 },
  flex: { flex: 1 },
  kartaAnalizes: { gap: 10 },
  kartaVersionit: { paddingVertical: 13, gap: 8 },
  skeletet: { gap: 10 },
  gabimi: { gap: 8, marginTop: 18 },
  butoniIVogel: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 20,
    minHeight: 44,
    justifyContent: "center",
    marginTop: 4,
  },
});
