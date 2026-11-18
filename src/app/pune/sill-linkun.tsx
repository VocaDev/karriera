import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { ScrollView, StyleSheet, View, type TextInputInstance } from "react-native";
import Animated from "react-native-reanimated";

import { ButoniKryesor, Etiketa, Fusha, Udhezimi } from "@/components/Forma";
import { useNjoftim } from "@/components/Njoftimet";
import Prekshme from "@/components/Prekshme";
import { IKONAT, Ikona, T } from "@/components/ui";
import { useDridhja } from "@/lib/levizja";
import { prekja } from "@/lib/prekja";
import { KUFIJTE_E_LINKUT, kontrolloLinkun, shenoPunenERe, shtoPunenNgaLinku } from "@/lib/punet";
import { useSesioni } from "@/lib/sesioni";
import { useTema } from "@/lib/tema";

// "Sill linkun tënd" (J7, bordi: fleta e Punëve): kërkuesi ngjit linkun e një shpalljeje që e gjeti diku tjetër.
// Bëhet punë private (e sheh vetëm ai) dhe hapet menjëherë, gati për "A jam gati?" dhe intervistën.
// Fletë (formSheet) me dorezë dhe X të rrumbullakët (AGENTS.md, Native feel #2). Gabimet dalin te fusha pas prekjes së parë.
export default function SillLinkun() {
  const t = useTema();
  const router = useRouter();
  const njofto = useNjoftim();
  const { roli_synuar } = useSesioni();
  const { stili: stiliIButonit, dridhu } = useDridhja();
  const titulliRef = useRef<TextInputInstance>(null);
  const kompaniaRef = useRef<TextInputInstance>(null);
  const qytetiRef = useRef<TextInputInstance>(null);
  const tekstiRef = useRef<TextInputInstance>(null);
  const [linku, setLinku] = useState("");
  const [titulli, setTitulli] = useState("");
  const [kompania, setKompania] = useState("");
  const [qyteti, setQyteti] = useState("");
  const [teksti, setTeksti] = useState("");
  const [provoi, setProvoi] = useState(false);
  const [duke_ruajtur, setDukeRuajtur] = useState(false);
  const [gabimi, setGabimi] = useState<string | null>(null);

  // Të njëjtat kufij si në bazë (migrimi 20261118100000), që gabimi të dalë para se të dërgohet.
  const kontrolliILinkut = kontrolloLinkun(linku);
  const mungon = {
    linku: !kontrolliILinkut.ok,
    titulli: titulli.trim().length < 3,
    kompania: kompania.trim().length < 2,
    qyteti: qyteti.trim().length === 1,
  };
  const valide = !mungon.linku && !mungon.titulli && !mungon.kompania && !mungon.qyteti;

  async function shto() {
    if (duke_ruajtur) return; // pa dërgime të dyfishta
    if (!valide) {
      setProvoi(true);
      prekja.gabim();
      dridhu();
      return;
    }
    setDukeRuajtur(true);
    setGabimi(null);
    try {
      const { puna, ekzistonte } = await shtoPunenNgaLinku(
        { linku, titulli, kompania, qyteti, pershkrimi: teksti },
        roli_synuar ?? "Tjetër",
      );
      if (ekzistonte) {
        prekja.lehte();
        njofto(puna.private ? "Këtë punë e ke shtuar më parë" : "Kjo shpallje është tashmë te Punët", "info");
      } else {
        prekja.sukses();
        shenoPunenERe(puna.id); // lista e shfaq me animacion hyrjeje kur kthehesh
        njofto("Puna u shtua", "sukses");
      }
      // Fleta mbyllet dhe hapet puna: hapi tjetër është "A jam gati për këtë?".
      router.replace({ pathname: "/pune/[id]", params: { id: puna.id } });
    } catch (e) {
      prekja.gabim();
      setGabimi(e instanceof Error ? e.message : "Diçka shkoi keq. Provo përsëri.");
      setDukeRuajtur(false);
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: t.sfondi }}
      contentContainerStyle={styles.faqja}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <View style={styles.koka}>
        <T pesha="trashe" madhesia={20} accessibilityRole="header" style={styles.titulli}>
          Sill linkun tënd
        </T>
        <Prekshme
          accessibilityRole="button"
          accessibilityLabel="Mbyll"
          hitSlop={8}
          shkalla={0.9}
          onPress={() => router.back()}
          style={styles.mbyll}
        >
          <Ikona emri={IKONAT.mbyll} madhesia={30} ngjyra={t.zbehur} />
        </Prekshme>
      </View>
      <T zbehur madhesia={14}>
        Ke gjetur një punë diku tjetër? Ngjit linkun e shpalljes. Puna shihet vetëm nga ti.
      </T>

      <Etiketa>Linku i shpalljes *</Etiketa>
      <Fusha
        value={linku}
        onChangeText={setLinku}
        placeholder="https://..."
        keyboardType="url"
        textContentType="URL"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={1000}
        editable={!duke_ruajtur}
        gabim={provoi && mungon.linku}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => titulliRef.current?.focus()}
        accessibilityHint="Mbaje gishtin te fusha dhe zgjidh Ngjit"
      />
      <Udhezimi shfaq={provoi && !kontrolliILinkut.ok}>{kontrolliILinkut.ok ? "" : kontrolliILinkut.gabimi}</Udhezimi>

      <Etiketa>Titulli i pozitës *</Etiketa>
      <Fusha
        ref={titulliRef}
        value={titulli}
        onChangeText={setTitulli}
        placeholder="p.sh. Junior Developer"
        maxLength={KUFIJTE_E_LINKUT.titulli}
        editable={!duke_ruajtur}
        gabim={provoi && mungon.titulli}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => kompaniaRef.current?.focus()}
      />
      <Udhezimi shfaq={provoi && mungon.titulli}>Shkruaj titullin e pozitës, të paktën 3 shkronja.</Udhezimi>

      <Etiketa>Kompania *</Etiketa>
      <Fusha
        ref={kompaniaRef}
        value={kompania}
        onChangeText={setKompania}
        placeholder="p.sh. Kodi Studio"
        maxLength={KUFIJTE_E_LINKUT.kompania}
        editable={!duke_ruajtur}
        gabim={provoi && mungon.kompania}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => qytetiRef.current?.focus()}
      />
      <Udhezimi shfaq={provoi && mungon.kompania}>Shkruaj emrin e kompanisë, të paktën 2 shkronja.</Udhezimi>

      <Etiketa>Qyteti</Etiketa>
      <Fusha
        ref={qytetiRef}
        value={qyteti}
        onChangeText={setQyteti}
        placeholder="p.sh. Prishtinë ose Remote"
        maxLength={KUFIJTE_E_LINKUT.qyteti}
        editable={!duke_ruajtur}
        gabim={provoi && mungon.qyteti}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => tekstiRef.current?.focus()}
      />
      <Udhezimi shfaq={provoi && mungon.qyteti}>Shkruaj qytetin të paktën me 2 shkronja, ose lëre bosh.</Udhezimi>

      <Etiketa>Teksti i shpalljes</Etiketa>
      <T zbehur madhesia={13}>
        Kopjo tekstin nga shpallja dhe ngjite këtu. Me të, “A jam gati?” e di saktë çka kërkon puna.
      </T>
      <Fusha
        ref={tekstiRef}
        style={styles.shumeRreshta}
        value={teksti}
        onChangeText={setTeksti}
        placeholder="Detyrat, kërkesat, përvoja..."
        multiline
        maxLength={KUFIJTE_E_LINKUT.pershkrimi}
        editable={!duke_ruajtur}
      />

      {gabimi && (
        <T ngjyra={t.keq} style={styles.gabimi} accessibilityLiveRegion="polite">
          S&apos;u shtua: {gabimi}
        </T>
      )}

      <Animated.View style={stiliIButonit}>
        <ButoniKryesor
          teksti="Shto punën"
          onPress={shto}
          duke_punuar={duke_ruajtur}
          joValid={!valide}
          accessibilityHint={valide ? undefined : "Plotëso linkun, titullin dhe kompaninë"}
        />
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  faqja: { padding: 20, paddingTop: 22, gap: 6, paddingBottom: 40 },
  koka: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  titulli: { flex: 1 },
  mbyll: { minWidth: 44, minHeight: 44, alignItems: "flex-end", justifyContent: "center" },
  shumeRreshta: { minHeight: 120, maxHeight: 220, textAlignVertical: "top" },
  gabimi: { marginTop: 10 },
});
