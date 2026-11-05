import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

import { T } from "@/components/ui";
import { shtoPunen, type Puna } from "@/lib/punet";
import { SHKRONJAT, useTema } from "@/lib/tema";

const ROLET: Puna["roli"][] = ["SWE", "Asistent/PR", "Tjetër"];

// Fushë teksti në stilin D: e bardhë, pa kornizë, me qoshe të rrumbullakëta.
function Fusha(props: TextInputProps) {
  const t = useTema();
  return (
    <TextInput
      placeholderTextColor={t.zbehur}
      {...props}
      style={[
        styles.fusha,
        { backgroundColor: t.karta, color: t.teksti, shadowColor: t.hija, fontFamily: SHKRONJAT.normal },
        props.style,
      ]}
    />
  );
}

export default function ShtoPunen() {
  const t = useTema();
  const [titulli, setTitulli] = useState("");
  const [kompania, setKompania] = useState("");
  const [qyteti, setQyteti] = useState("");
  const [roli, setRoli] = useState<Puna["roli"]>("SWE");
  const [pershkrimi, setPershkrimi] = useState("");
  const [duke_ruajtur, setDukeRuajtur] = useState(false);
  const [gabimi, setGabimi] = useState<string | null>(null);

  // Të njëjtat kufij si në bazë (check constraints), që gabimi të dalë para se të dërgohet.
  const valide =
    titulli.trim().length >= 3 && kompania.trim().length >= 2 && qyteti.trim().length >= 2;

  async function ruaj() {
    if (!valide || duke_ruajtur) return; // pa dërgime të dyfishta
    setDukeRuajtur(true);
    setGabimi(null);
    try {
      await shtoPunen({
        titulli: titulli.trim(),
        kompania: kompania.trim(),
        qyteti: qyteti.trim(),
        roli,
        pershkrimi: pershkrimi.trim(),
      });
      router.back(); // lista rilexohet vetë (useFocusEffect) dhe puna e re del e para
    } catch (e) {
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
        <Fusha value={titulli} onChangeText={setTitulli} placeholder="p.sh. Junior Developer" maxLength={120} />

        <T pesha="gjysme" madhesia={14} style={styles.etiketa}>
          Kompania *
        </T>
        <Fusha value={kompania} onChangeText={setKompania} placeholder="p.sh. Kodi Studio" maxLength={80} />

        <T pesha="gjysme" madhesia={14} style={styles.etiketa}>
          Qyteti *
        </T>
        <Fusha value={qyteti} onChangeText={setQyteti} placeholder="p.sh. Mitrovicë ose Remote" maxLength={60} />

        <T pesha="gjysme" madhesia={14} style={styles.etiketa}>
          Roli
        </T>
        <View style={styles.rolet}>
          {ROLET.map((r) => {
            const zgjedhur = roli === r;
            return (
              <Pressable
                key={r}
                onPress={() => setRoli(r)}
                accessibilityRole="radio"
                accessibilityState={{ selected: zgjedhur }}
                style={[styles.chip, { backgroundColor: zgjedhur ? t.teksti : t.karta, shadowColor: t.hija }]}
              >
                <T pesha="gjysme" madhesia={14} ngjyra={zgjedhur ? t.sfondi : t.teksti}>
                  {r}
                </T>
              </Pressable>
            );
          })}
        </View>

        <T pesha="gjysme" madhesia={14} style={styles.etiketa}>
          Përshkrimi
        </T>
        <Fusha
          style={styles.shumeRreshta}
          value={pershkrimi}
          onChangeText={setPershkrimi}
          placeholder="Çka bën kjo punë?"
          multiline
          maxLength={1000}
        />

        {gabimi && (
          <T ngjyra={t.keq} style={styles.etiketa}>
            S&apos;u ruajt: {gabimi}
          </T>
        )}

        <Pressable
          onPress={ruaj}
          disabled={!valide || duke_ruajtur}
          accessibilityRole="button"
          style={[styles.butoni, { backgroundColor: t.teksti }, (!valide || duke_ruajtur) && styles.joAktiv]}
        >
          {duke_ruajtur ? (
            <ActivityIndicator color={t.sfondi} />
          ) : (
            <T pesha="trashe" madhesia={16} ngjyra={t.sfondi}>
              Ruaj në Supabase
            </T>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  faqja: { padding: 20, gap: 6 },
  etiketa: { marginTop: 10 },
  fusha: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  shumeRreshta: { minHeight: 100, textAlignVertical: "top" },
  rolet: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: {
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 16,
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  butoni: { marginTop: 22, borderRadius: 999, padding: 16, alignItems: "center" },
  joAktiv: { opacity: 0.35 },
});
