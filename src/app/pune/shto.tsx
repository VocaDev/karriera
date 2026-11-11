import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type TextInputInstance,
} from "react-native";
import Animated from "react-native-reanimated";

import { Fusha, Udhezimi } from "@/components/Forma";
import { useNjoftim } from "@/components/Njoftimet";
import Prekshme from "@/components/Prekshme";
import { T } from "@/components/ui";
import { useDridhja } from "@/lib/levizja";
import { prekja } from "@/lib/prekja";
import { shenoPunenERe, shtoPunen, type Puna } from "@/lib/punet";
import { useSesioni } from "@/lib/sesioni";
import { useTema } from "@/lib/tema";

const ROLET: Puna["roli"][] = ["SWE", "Asistent/PR", "Tjetër"];

export default function ShtoPunen() {
  const t = useTema();
  const njofto = useNjoftim();
  const { stili: stiliIButonit, dridhu } = useDridhja();
  const kompaniaRef = useRef<TextInputInstance>(null);
  const qytetiRef = useRef<TextInputInstance>(null);
  const pershkrimiRef = useRef<TextInputInstance>(null);
  const [titulli, setTitulli] = useState("");
  const { profili } = useSesioni();
  const [kompania, setKompania] = useState(profili?.organizata ?? ""); // punëdhënësi: kompania e tij
  const [qyteti, setQyteti] = useState("");
  const [roli, setRoli] = useState<Puna["roli"]>("SWE");
  const [pershkrimi, setPershkrimi] = useState("");
  const [duke_ruajtur, setDukeRuajtur] = useState(false);
  const [gabimi, setGabimi] = useState<string | null>(null);
  const [provoi, setProvoi] = useState(false);

  // Të njëjtat kufij si në bazë (check constraints), që gabimi të dalë para se të dërgohet.
  const mungon = {
    titulli: titulli.trim().length < 3,
    kompania: kompania.trim().length < 2,
    qyteti: qyteti.trim().length < 2,
  };
  const valide = !mungon.titulli && !mungon.kompania && !mungon.qyteti;

  async function shto() {
    if (duke_ruajtur) return; // pa dërgime të dyfishta
    if (!valide) {
      // Butoni s'është i fikur pa arsye: prekja tregon çka mungon.
      setProvoi(true);
      prekja.gabim();
      dridhu();
      return;
    }
    setDukeRuajtur(true);
    setGabimi(null);
    try {
      const puna = await shtoPunen({
        titulli: titulli.trim(),
        kompania: kompania.trim(),
        qyteti: qyteti.trim(),
        roli,
        pershkrimi: pershkrimi.trim(),
      });
      prekja.sukses();
      shenoPunenERe(puna.id); // lista e shfaq me animacion hyrjeje
      njofto("Puna u shtua", "sukses");
      router.back();
    } catch (e) {
      prekja.gabim();
      setGabimi(e instanceof Error ? e.message : "Gabim i panjohur");
      setDukeRuajtur(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: t.sfondi }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.faqja}
        keyboardShouldPersistTaps="handled"
      >
        <T pesha="gjysme" madhesia={14} style={styles.etiketa}>
          Titulli i pozitës *
        </T>
        <Fusha
          value={titulli}
          onChangeText={setTitulli}
          placeholder="p.sh. Junior Developer"
          maxLength={120}
          editable={!duke_ruajtur}
          gabim={provoi && mungon.titulli}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => kompaniaRef.current?.focus()}
        />
        <Udhezimi shfaq={provoi && mungon.titulli}>Shkruaj titullin e pozitës, të paktën 3 shkronja.</Udhezimi>

        <T pesha="gjysme" madhesia={14} style={styles.etiketa}>
          Kompania *
        </T>
        <Fusha
          ref={kompaniaRef}
          value={kompania}
          onChangeText={setKompania}
          placeholder="p.sh. Kodi Studio"
          maxLength={80}
          editable={!duke_ruajtur}
          gabim={provoi && mungon.kompania}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => qytetiRef.current?.focus()}
        />
        <Udhezimi shfaq={provoi && mungon.kompania}>Shkruaj emrin e kompanisë, të paktën 2 shkronja.</Udhezimi>

        <T pesha="gjysme" madhesia={14} style={styles.etiketa}>
          Qyteti *
        </T>
        <Fusha
          ref={qytetiRef}
          value={qyteti}
          onChangeText={setQyteti}
          placeholder="p.sh. Mitrovicë ose Remote"
          maxLength={60}
          editable={!duke_ruajtur}
          gabim={provoi && mungon.qyteti}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => pershkrimiRef.current?.focus()}
        />
        <Udhezimi shfaq={provoi && mungon.qyteti}>Shkruaj qytetin ose “Remote”, të paktën 2 shkronja.</Udhezimi>

        <T pesha="gjysme" madhesia={14} style={styles.etiketa}>
          Roli
        </T>
        <View style={styles.rolet}>
          {ROLET.map((r) => {
            const zgjedhur = roli === r;
            return (
              <Prekshme
                key={r}
                onPress={() => {
                  if (zgjedhur) return;
                  prekja.zgjedhje();
                  setRoli(r);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: zgjedhur }}
                style={[styles.chip, { backgroundColor: zgjedhur ? t.teksti : t.karta, shadowColor: t.hija }]}
              >
                <T pesha="gjysme" madhesia={14} ngjyra={zgjedhur ? t.sfondi : t.teksti}>
                  {r}
                </T>
              </Prekshme>
            );
          })}
        </View>

        <T pesha="gjysme" madhesia={14} style={styles.etiketa}>
          Përshkrimi
        </T>
        <Fusha
          ref={pershkrimiRef}
          style={styles.shumeRreshta}
          value={pershkrimi}
          onChangeText={setPershkrimi}
          placeholder="Çka bën kjo punë?"
          multiline
          maxLength={1000}
          editable={!duke_ruajtur}
        />

        {gabimi && (
          <T ngjyra={t.keq} style={styles.etiketa}>
            S&apos;u shtua: {gabimi}
          </T>
        )}

        <Animated.View style={stiliIButonit}>
          <Prekshme
            onPress={shto}
            disabled={duke_ruajtur}
            accessibilityRole="button"
            accessibilityHint={valide ? undefined : "Plotëso titullin, kompaninë dhe qytetin"}
            style={[styles.butoni, { backgroundColor: t.teksti }, !valide && styles.joAktiv]}
          >
            {duke_ruajtur ? (
              <ActivityIndicator color={t.sfondi} />
            ) : (
              <T pesha="trashe" madhesia={16} ngjyra={t.sfondi}>
                Shto punën
              </T>
            )}
          </Prekshme>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  faqja: { padding: 20, gap: 6 },
  etiketa: { marginTop: 10 },
  shumeRreshta: { minHeight: 100, textAlignVertical: "top" },
  rolet: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: {
    borderRadius: 999,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 16,
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  butoni: { marginTop: 22, borderRadius: 999, padding: 16, minHeight: 52, alignItems: "center", justifyContent: "center" },
  joAktiv: { opacity: 0.45 },
});
