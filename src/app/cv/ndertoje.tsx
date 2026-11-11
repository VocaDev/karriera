// Ndërto CV-në me AI (pa CV). HARTA: vjen PAS Demo Day-t. Ekrani është i mbyllur në _layout.tsx
// (CV_PAS_DEMO_DAY_HAPUR = false); kodi mbetet gati për atëherë.
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, TextInput, View } from "react-native";
import Animated from "react-native-reanimated";

import { useNjoftim } from "@/components/Njoftimet";
import Prekshme from "@/components/Prekshme";
import { Faqja, Karta, Progresi, T, Titulli } from "@/components/ui";
import { krijoCV, ruajCV } from "@/lib/cv";
import { useDridhja } from "@/lib/levizja";
import { prekja } from "@/lib/prekja";
import { SHKRONJAT, useTema } from "@/lib/tema";

const PYETJET = [
  { titulli: "Çka studion dhe në cilin vit je?", ndihma: "Shembull: Inxhinieri Kompjuterike, UMIB, viti i tretë." },
  { titulli: "Çka ke ndërtuar që je krenar?", ndihma: "Projekt shkollor, personal ose në punë. Edhe i vogël vlen." },
  {
    titulli: "Ku ke punuar ose praktikuar?",
    ndihma: "Edhe punë studentore, vullnetarizëm ose ndihmë në biznesin e familjes.",
  },
  { titulli: "Cilat vegla dhe gjuhë i njeh?", ndihma: "Programim, programe zyre, gjuhë të huaja." },
  { titulli: "Çka do të bësh pas dy vjetësh?", ndihma: "Një fjali mjafton. Shkon te profili i CV-së." },
];

export default function NdertojeCV() {
  const t = useTema();
  const router = useRouter();
  const njofto = useNjoftim();
  const { stili: stiliIDridhjes, dridhu } = useDridhja();

  const [hapi, setHapi] = useState(0);
  const [pergjigjet, setPergjigjet] = useState<string[]>(["", "", "", "", ""]);
  const [provoi, setProvoi] = useState(false); // shenja nën fushë del vetëm pas provës së parë
  const [dukeKrijuar, setDukeKrijuar] = useState(false);

  const pyetja = PYETJET[hapi];
  const pergjigjja = pergjigjet[hapi];
  const eZbrazet = !pergjigjja.trim();

  function ndryshoPergjigjen(teksti: string) {
    setPergjigjet((vjetra) => vjetra.map((v, i) => (i === hapi ? teksti : v)));
  }

  async function vazhdo() {
    if (eZbrazet) {
      setProvoi(true);
      prekja.gabim();
      dridhu();
      return;
    }
    setProvoi(false);

    if (hapi < PYETJET.length - 1) {
      setHapi((h) => h + 1);
      return;
    }

    setDukeKrijuar(true);
    try {
      const cv = await krijoCV({ pergjigjet }, "ks", "sq");
      await ruajCV(cv, "ks", "sq");
      prekja.sukses();
      njofto("CV-ja u krijua", "sukses");
      router.replace("/cv/dokumenti");
    } catch (e) {
      prekja.gabim();
      njofto(e instanceof Error ? e.message : "Krijimi i CV-së dështoi.", "gabim");
    } finally {
      setDukeKrijuar(false);
    }
  }

  return (
    <Faqja>
      <View style={styles.krye}>
        <T zbehur pesha="gjysme" madhesia={12}>
          NDËRTO CV-NË · HAPI {hapi + 1} NGA {PYETJET.length}
        </T>
        <Progresi vlera={(hapi + 1) / PYETJET.length} />
      </View>

      <View style={styles.permbajtja}>
        <Titulli>{pyetja.titulli}</Titulli>
        <T zbehur>{pyetja.ndihma}</T>

        <Karta style={styles.karta}>
          <TextInput
            value={pergjigjja}
            onChangeText={ndryshoPergjigjen}
            placeholder="Shkruaj përgjigjen këtu…"
            placeholderTextColor={t.zbehur}
            multiline
            maxLength={2000}
            textAlignVertical="top"
            editable={!dukeKrijuar}
            accessibilityLabel={pyetja.titulli}
            style={[styles.input, { color: t.teksti }]}
          />
        </Karta>

        {provoi && eZbrazet ? (
          <T ngjyra={t.keq} madhesia={13}>
            Shkruaj një përgjigje para se të vazhdosh.
          </T>
        ) : (
          <T zbehur madhesia={12}>
            Nuk ka përgjigje të gabuar. AI-ja i kthen në fjali profesionale, pa shtuar fakte.
          </T>
        )}
      </View>

      <View style={styles.poshte}>
        {hapi > 0 && (
          <Prekshme
            disabled={dukeKrijuar}
            onPress={() => setHapi((h) => h - 1)}
            accessibilityRole="button"
            style={[styles.buton, styles.butonDyte, { borderColor: t.vija }]}
          >
            <T pesha="trashe">Prapa</T>
          </Prekshme>
        )}

        <Animated.View style={[styles.flex, stiliIDridhjes]}>
          <Prekshme
            disabled={dukeKrijuar}
            onPress={vazhdo}
            accessibilityRole="button"
            accessibilityState={{ busy: dukeKrijuar }}
            style={[styles.buton, { backgroundColor: t.teksti, opacity: dukeKrijuar ? 0.7 : 1 }]}
          >
            {dukeKrijuar ? (
              <ActivityIndicator color={t.sfondi} />
            ) : (
              <T ngjyra={t.sfondi} pesha="trashe">
                {hapi === PYETJET.length - 1 ? "Krijo CV-në" : "Vazhdo"}
              </T>
            )}
          </Prekshme>
        </Animated.View>
      </View>
    </Faqja>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  krye: { gap: 14, marginBottom: 32 },
  permbajtja: { gap: 16 },
  karta: { minHeight: 190, padding: 16 },
  input: { minHeight: 155, fontSize: 15, lineHeight: 24, padding: 0, fontFamily: SHKRONJAT.normal },
  poshte: { flexDirection: "row", gap: 10, paddingTop: 20 },
  buton: {
    minHeight: 52,
    flex: 1,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  butonDyte: { borderWidth: StyleSheet.hairlineWidth },
});
