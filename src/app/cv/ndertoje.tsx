
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { Faqja, Karta, T, Titulli } from "@/components/ui";
import { useTema } from "@/lib/tema";
import { krijoCV, ruajCV } from "@/lib/cv";

const PYETJET = [
  {
    titulli: "Çka studion dhe në cilin vit je?",
    ndihma: "Shembull: Inxhinieri Kompjuterike, UMIB, viti i tretë.",
  },
  {
    titulli: "Çka ke ndërtuar që je krenar?",
    ndihma: "Projekt shkollor, personal ose në punë. Edhe i vogël vlen.",
  },
  {
    titulli: "Ku ke punuar ose praktikuar?",
    ndihma:
      "Edhe punë studentore, vullnetarizëm ose ndihmë në biznesin e familjes.",
  },
  {
    titulli: "Cilat vegla dhe gjuhë i njeh?",
    ndihma: "Programim, programe zyre, gjuhë të huaja.",
  },
  {
    titulli: "Çka do të bësh pas dy vjetësh?",
    ndihma: "Një fjali mjafton. Shkon te profili i CV-së.",
  },
];

export default function NdertojeCV() {
  const t = useTema();
  const router = useRouter();

  const [hapi, setHapi] = useState(0);
  const [pergjigjet, setPergjigjet] = useState<string[]>([
    "",
    "",
    "",
    "",
    "",
  ]);
  const [dukeKrijuar, setDukeKrijuar] = useState(false);

  const pyetja = PYETJET[hapi];
  const pergjigjja = pergjigjet[hapi];

  function ndryshoPergjigjen(teksti: string) {
    setPergjigjet((vjetra) =>
      vjetra.map((v, index) => (index === hapi ? teksti : v)),
    );
  }

  async function vazhdo() {
    if (!pergjigjja.trim()) {
      Alert.alert("Plotëso përgjigjen", "Shkruaj një përgjigje para se të vazhdosh.");
      return;
    }

    if (hapi < PYETJET.length - 1) {
      setHapi((v) => v + 1);
      return;
    }

    try {
      setDukeKrijuar(true);

      const cv = await krijoCV({ pergjigjet }, "ks", "sq");
      await ruajCV(cv, "ks");

      router.replace("/cv/dokumenti");
    } catch {
      Alert.alert(
        "Nuk u krijua CV-ja",
        "Pati një problem gjatë krijimit. Provo përsëri.",
      );
    } finally {
      setDukeKrijuar(false);
    }
  }

  return (
    <Faqja>
      <View style={styles.krye}>
        <T zbehur madhesia={12}>
          NDËRTO CV-NË · HAPI {hapi + 1} NGA {PYETJET.length}
        </T>

        <View style={[styles.progresi, { backgroundColor: t.karta2 }]}>
          <View
            style={[
              styles.progresiMbushur,
              {
                width: `${((hapi + 1) / PYETJET.length) * 100}%`,
                backgroundColor: t.theksi,
              },
            ]}
          />
        </View>
      </View>

      <View style={styles.permbajtja}>
        <Titulli>{pyetja.titulli}</Titulli>

        <T zbehur>{pyetja.ndihma}</T>

        <Karta style={styles.karta}>
          <TextInput
            value={pergjigjja}
            onChangeText={ndryshoPergjigjen}
            placeholder="Shkruaj përgjigjen këtu..."
            placeholderTextColor={t.zbehur}
            multiline
            textAlignVertical="top"
            editable={!dukeKrijuar}
            style={[
              styles.input,
              {
                color: t.teksti,
                fontFamily: "PlusJakartaSans",
              },
            ]}
          />
        </Karta>

        <T zbehur madhesia={12}>
          Nuk ka përgjigje të gabuar. AI-ja i kthen në fjali profesionale.
        </T>
      </View>

      <View style={styles.poshte}>
        {hapi > 0 && (
          <Pressable
            disabled={dukeKrijuar}
            onPress={() => setHapi((v) => v - 1)}
            style={[styles.buton, { borderColor: t.vija, borderWidth: 1 }]}
          >
            <T ngjyra={t.teksti} pesha="trashe">
              Prapa
            </T>
          </Pressable>
        )}

        <Pressable
          disabled={dukeKrijuar}
          onPress={vazhdo}
          style={[
            styles.buton,
            styles.butonKryesor,
            {
              backgroundColor: t.teksti,
              opacity: dukeKrijuar ? 0.7 : 1,
            },
          ]}
        >
          {dukeKrijuar ? (
            <ActivityIndicator color={t.karta} />
          ) : (
            <T ngjyra={t.karta} pesha="trashe">
              {hapi === PYETJET.length - 1
                ? "Krijo CV-në"
                : "Vazhdo"}
            </T>
          )}
        </Pressable>
      </View>
    </Faqja>
  );
}

const styles = StyleSheet.create({
  krye: {
    gap: 14,
    marginBottom: 42,
  },
  progresi: {
    height: 6,
    borderRadius: 10,
    overflow: "hidden",
  },
  progresiMbushur: {
    height: "100%",
    borderRadius: 10,
  },
  permbajtja: {
    flex: 1,
    gap: 18,
  },
  karta: {
    minHeight: 190,
    padding: 16,
  },
  input: {
    minHeight: 155,
    fontSize: 15,
    lineHeight: 24,
    padding: 0,
  },
  poshte: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 20,
  },
  buton: {
    minHeight: 52,
    flex: 1,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  butonKryesor: {
    borderWidth: 0,
  },
});
