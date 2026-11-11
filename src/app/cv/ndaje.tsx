
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Share,
  StyleSheet,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { Faqja, Karta, T, Titulli } from "@/components/ui";
import { useTema } from "@/lib/tema";
import { analizaEFundit, type AnalizaCV } from "@/lib/cv";

export default function NdajeCV() {
  const t = useTema();
  const router = useRouter();

  const [analiza, setAnaliza] = useState<AnalizaCV | null>(null);
  const [dukeNgarkuar, setDukeNgarkuar] = useState(true);
  const [dukeNdarë, setDukeNdarë] = useState(false);

  useEffect(() => {
    let aktiv = true;

    async function ngarkoAnalizen() {
      try {
        const rezultati = await analizaEFundit();

        if (aktiv && rezultati) {
          setAnaliza(rezultati.analiza);
        }
      } catch {
        Alert.alert("Gabim", "Nuk mundëm ta ngarkojmë analizën.");
      } finally {
        if (aktiv) setDukeNgarkuar(false);
      }
    }

    void ngarkoAnalizen();

    return () => {
      aktiv = false;
    };
  }, []);

  async function ndaj() {
    if (!analiza) return;

    setDukeNdarë(true);

    try {
      await Share.share({
        title: "Roast i CV-së sime",
        message:
          `Karriera i bëri roast CV-së sime 🔥\n\n` +
          `Nota: ${analiza.nota}/100\n\n` +
          `${analiza.fjalia_roast}\n\n` +
          `Sa e bën CV-ja jote?`,
      });
    } catch {
      Alert.alert("Gabim", "Nuk mundëm ta ndajmë kartën.");
    } finally {
      setDukeNdarë(false);
    }
  }

  if (dukeNgarkuar) {
    return (
      <Faqja>
        <View style={styles.qender}>
          <ActivityIndicator size="large" color={t.theksi} />
          <T zbehur>Po përgatitet karta...</T>
        </View>
      </Faqja>
    );
  }

  if (!analiza) {
    return (
      <Faqja>
        <Titulli>Ndaje CV-në</Titulli>
        <Karta>
          <T>Nuk u gjet analiza e CV-së.</T>
          <Pressable onPress={() => router.replace("/cv")}>
            <T pesha="trashe">Kthehu te CV-ja</T>
          </Pressable>
        </Karta>
      </Faqja>
    );
  }

  return (
    <Faqja>
      <View style={styles.krye}>
        <Pressable onPress={() => router.back()} style={styles.kthim}>
          <T madhesia={20}>←</T>
        </Pressable>
        <T zbehur madhesia={12}>KARTA JOTE</T>
      </View>

      <Titulli>Ndaje roast-in</Titulli>
      <T zbehur>
        Tregoja shokëve çfarë mendon AI-ja për CV-në tënde.
      </T>

      <View style={styles.kartaJashtme}>
        <View style={styles.karta}>
          <View style={styles.kryeKartes}>
            <T ngjyra="#FFFFFF" pesha="trashe" madhesia={12}>
              KARRIERA
            </T>
            <T ngjyra="#E8590C" pesha="trashe" madhesia={12}>
              CV ROAST 🔥
            </T>
          </View>

          <View style={styles.nota}>
            <T ngjyra="#E8590C" pesha="shumeTrashe" madhesia={64}>
              {analiza.nota}
            </T>
            <T ngjyra="#FFFFFF" pesha="mesme" madhesia={13}>
              / 100
            </T>
          </View>

          <View style={styles.vija} />

          <T ngjyra="#FFFFFF" pesha="trashe" madhesia={23}>
            Karriera i bëri roast CV-së sime.
          </T>

          <T ngjyra="#D6D3D1" madhesia={15} style={styles.roast}>
            “{analiza.fjalia_roast}”
          </T>

          <View style={styles.fundiKartes}>
            <T ngjyra="#A8A29E" madhesia={11}>
              Sa e bën CV-ja jote?
            </T>
            <T ngjyra="#E8590C" pesha="trashe" madhesia={12}>
              KARRIERA.APP
            </T>
          </View>
        </View>
      </View>

      <Pressable
        onPress={() => void ndaj()}
        disabled={dukeNdarë}
        style={[styles.buton, { backgroundColor: t.teksti }]}
      >
        {dukeNdarë ? (
          <ActivityIndicator color={t.sfondi} />
        ) : (
          <T ngjyra={t.sfondi} pesha="trashe">
            Ndaje kartën
          </T>
        )}
      </Pressable>

      <T zbehur madhesia={12} style={styles.privatesia}>
        Karta përmban vetëm notën dhe roast-in, jo emrin ose përmbajtjen e CV-së.
      </T>
    </Faqja>
  );
}

const styles = StyleSheet.create({
  qender: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  krye: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  kthim: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  kartaJashtme: {
    width: "100%",
    aspectRatio: 9 / 16,
    marginTop: 24,
    marginBottom: 22,
  },
  karta: {
    flex: 1,
    backgroundColor: "#141414",
    borderRadius: 28,
    padding: 24,
    justifyContent: "space-between",
    overflow: "hidden",
  },
  kryeKartes: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  nota: {
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
  },
  vija: {
    height: 1,
    backgroundColor: "#44403C",
    width: "100%",
  },
  roast: {
    lineHeight: 24,
  },
  fundiKartes: {
    gap: 8,
  },
  buton: {
    minHeight: 54,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  privatesia: {
    textAlign: "center",
    marginTop: 12,
  },
});
