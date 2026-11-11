// Karta "Ndaje" (roast-i i CV-së për shokët). HARTA: ndarja në rrjete sociale vjen PAS Demo Day-t.
// Ekrani është i mbyllur në _layout.tsx (CV_PAS_DEMO_DAY_HAPUR = false); kodi mbetet gati për atëherë.
import { useEffect, useState } from "react";
import { ActivityIndicator, Share, StyleSheet, View } from "react-native";

import { useNjoftim } from "@/components/Njoftimet";
import Prekshme from "@/components/Prekshme";
import { Karta, Faqja, T, Titulli } from "@/components/ui";
import { analizaEFundit, type AnalizaCV } from "@/lib/cv";
import { prekja } from "@/lib/prekja";
import { useTema } from "@/lib/tema";

// Karta është "poster" i errët në të dy temat (si në bord): ngjyrat e saj janë fikse,
// përveç portokallisë që vjen nga tema.
const KARTA = { sfondi: "#141414", teksti: "#FFFFFF", zbehur: "#D6D3D1", vija: "#44403C", fundi: "#A8A29E" };

type Gjendja = { lloji: "duke" } | { lloji: "gati"; analiza: AnalizaCV | null } | { lloji: "gabim"; mesazhi: string };

export default function NdajeCV() {
  const t = useTema();
  const njofto = useNjoftim();
  const [gjendja, setGjendja] = useState<Gjendja>({ lloji: "duke" });
  const [dukeNdare, setDukeNdare] = useState(false);

  useEffect(() => {
    let aktiv = true;
    analizaEFundit()
      .then((r) => {
        if (aktiv) setGjendja({ lloji: "gati", analiza: r?.analiza ?? null });
      })
      .catch((e: unknown) => {
        if (aktiv) setGjendja({ lloji: "gabim", mesazhi: e instanceof Error ? e.message : "S'u lexua analiza." });
      });
    return () => {
      aktiv = false;
    };
  }, []);

  async function ndaj(analiza: AnalizaCV) {
    setDukeNdare(true);
    try {
      const rezultati = await Share.share({
        title: "Roast i CV-së sime",
        message:
          `Karriera i bëri roast CV-së sime 🔥\n\n` +
          `Nota: ${analiza.nota}/100\n\n` +
          `${analiza.fjalia_roast}\n\n` +
          `Sa e bën CV-ja jote?`,
      });
      if (rezultati.action === Share.sharedAction) prekja.sukses();
    } catch {
      prekja.gabim();
      njofto("S'u nda karta. Provo përsëri.", "gabim");
    } finally {
      setDukeNdare(false);
    }
  }

  if (gjendja.lloji === "duke") {
    return (
      <Faqja>
        <View style={styles.qender}>
          <ActivityIndicator size="large" color={t.zbehur} />
          <T zbehur>Po përgatitet karta…</T>
        </View>
      </Faqja>
    );
  }

  if (gjendja.lloji === "gabim" || gjendja.analiza === null) {
    return (
      <Faqja>
        <Titulli>Ndaje roast-in</Titulli>
        <Karta style={styles.bosh}>
          <T>{gjendja.lloji === "gabim" ? gjendja.mesazhi : "Ende s'ke asnjë analizë. Ngarko CV-në dhe analizoje."}</T>
        </Karta>
      </Faqja>
    );
  }

  const { analiza } = gjendja;

  return (
    <Faqja>
      <Titulli>Ndaje roast-in</Titulli>
      <T zbehur>Tregoja shokëve çfarë mendon AI-ja për CV-në tënde.</T>

      <View style={styles.kartaJashtme}>
        <View style={[styles.karta, { backgroundColor: KARTA.sfondi }]}>
          <View style={styles.kryeKartes}>
            <T ngjyra={KARTA.teksti} pesha="trashe" madhesia={12}>
              KARRIERA
            </T>
            <T ngjyra={t.theksi} pesha="trashe" madhesia={12}>
              CV ROAST 🔥
            </T>
          </View>

          <View style={styles.nota}>
            <T ngjyra={t.theksi} pesha="shumeTrashe" madhesia={64} maxFontSizeMultiplier={1.2}>
              {analiza.nota}
            </T>
            <T ngjyra={KARTA.teksti} pesha="mesme" madhesia={13}>
              / 100
            </T>
          </View>

          <View style={[styles.vija, { backgroundColor: KARTA.vija }]} />

          <T ngjyra={KARTA.teksti} pesha="trashe" madhesia={23}>
            Karriera i bëri roast CV-së sime.
          </T>

          <T ngjyra={KARTA.zbehur} madhesia={15} style={styles.roast}>
            “{analiza.fjalia_roast}”
          </T>

          <T ngjyra={KARTA.fundi} madhesia={11}>
            Sa e bën CV-ja jote?
          </T>
        </View>
      </View>

      <Prekshme
        onPress={() => ndaj(analiza)}
        disabled={dukeNdare}
        accessibilityRole="button"
        style={[styles.buton, { backgroundColor: t.teksti }]}
      >
        {dukeNdare ? (
          <ActivityIndicator color={t.sfondi} />
        ) : (
          <T ngjyra={t.sfondi} pesha="trashe">
            Ndaje kartën
          </T>
        )}
      </Prekshme>

      <T zbehur madhesia={12} style={styles.privatesia}>
        Karta përmban vetëm notën dhe roast-in, jo emrin ose përmbajtjen e CV-së.
      </T>
    </Faqja>
  );
}

const styles = StyleSheet.create({
  qender: { alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 60 },
  bosh: { marginTop: 16 },
  kartaJashtme: { width: "100%", aspectRatio: 9 / 16, marginTop: 24, marginBottom: 22 },
  karta: { flex: 1, borderRadius: 28, padding: 24, justifyContent: "space-between", overflow: "hidden" },
  kryeKartes: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  nota: { alignItems: "center", justifyContent: "center" },
  vija: { height: StyleSheet.hairlineWidth, width: "100%" },
  roast: { lineHeight: 24 },
  buton: { minHeight: 54, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  privatesia: { textAlign: "center", marginTop: 12 },
});
