import { Stack, router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { shtoPunen, type Puna } from "@/lib/punet";

const ROLET: Puna["roli"][] = ["SWE", "Asistent/PR", "Tjetër"];

export default function ShtoPunen() {
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
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Stack.Screen options={{ title: "Shto një punë" }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.faqja} keyboardShouldPersistTaps="handled">
        <Text style={styles.etiketa}>Titulli i pozitës *</Text>
        <TextInput style={styles.fusha} value={titulli} onChangeText={setTitulli} placeholder="p.sh. Junior Developer" maxLength={120} />

        <Text style={styles.etiketa}>Kompania *</Text>
        <TextInput style={styles.fusha} value={kompania} onChangeText={setKompania} placeholder="p.sh. Kodi Studio" maxLength={80} />

        <Text style={styles.etiketa}>Qyteti *</Text>
        <TextInput style={styles.fusha} value={qyteti} onChangeText={setQyteti} placeholder="p.sh. Mitrovicë ose Remote" maxLength={60} />

        <Text style={styles.etiketa}>Roli</Text>
        <View style={styles.rolet}>
          {ROLET.map((r) => (
            <Pressable key={r} onPress={() => setRoli(r)} style={[styles.chip, roli === r && styles.chipZgjedhur]}>
              <Text style={roli === r ? styles.chipTekstZgjedhur : undefined}>{r}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.etiketa}>Përshkrimi</Text>
        <TextInput
          style={[styles.fusha, styles.shumeRreshta]}
          value={pershkrimi}
          onChangeText={setPershkrimi}
          placeholder="Çka bën kjo punë?"
          multiline
          maxLength={1000}
        />

        {gabimi && <Text style={styles.gabimi}>S&apos;u ruajt: {gabimi}</Text>}

        <Pressable onPress={ruaj} disabled={!valide || duke_ruajtur} style={[styles.butoni, (!valide || duke_ruajtur) && styles.joAktiv]}>
          {duke_ruajtur ? <ActivityIndicator color="#fff" /> : <Text style={styles.butoniTekst}>Ruaj në Supabase</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  faqja: { padding: 20, gap: 6 },
  etiketa: { fontSize: 14, fontWeight: "600", marginTop: 10 },
  fusha: { borderWidth: 1, borderColor: "#ccc", borderRadius: 10, padding: 12, fontSize: 16 },
  shumeRreshta: { minHeight: 90, textAlignVertical: "top" },
  rolet: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: { borderWidth: 1, borderColor: "#ccc", borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  chipZgjedhur: { backgroundColor: "#141414", borderColor: "#141414" },
  chipTekstZgjedhur: { color: "#fff" },
  gabimi: { color: "#C92A2A", marginTop: 10 },
  butoni: { marginTop: 20, backgroundColor: "#141414", borderRadius: 999, padding: 16, alignItems: "center" },
  joAktiv: { opacity: 0.4 },
  butoniTekst: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
