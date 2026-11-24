import { SegmentedControl } from "@expo/ui/community/segmented-control";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type ScrollViewInstance,
} from "react-native";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useNjoftim } from "@/components/Njoftimet";
import Prekshme from "@/components/Prekshme";
import ShiritiPaInternet from "@/components/ShiritiPaInternet";
import { Pulsi, Vije } from "@/components/Skeleti";
import { Chip, Ikona, Progresi, T } from "@/components/ui";
import { kushEkaRadhen, type Gjendja, type Mesazhi, type Paraqitja } from "@/lib/intervista/gjendja";
import { PaneliIZerit } from "@/lib/intervista/PaneliIZerit";
import {
  INTERVISTUESI_FILLESTAR,
  MAKS_PERGJIGJJA,
  PAMJA_E_INTERVISTUESIT,
  type Gjuha,
  type Intervistuesi,
} from "@/lib/intervista/tipet";
import { AvatariIntervistuesit, KartaEGabimit } from "@/lib/intervista/ui";
import { useIntervista } from "@/lib/intervista/useIntervista";
import { mbeshtetetZeri } from "@/lib/intervista/useRegjistruesi";
import { KOHA, LEHTESIMI } from "@/lib/levizja";
import { prekja } from "@/lib/prekja";
import { paInternet, tekstiIPlote, VONON } from "@/lib/mesazhet";
import { eshteGabimRrjeti, useRrjeti } from "@/lib/rrjeti";
import { SHKRONJAT, useTema } from "@/lib/tema";

// Intervista (bordi, ekrani 14): biseda si chat, me shkrim ose me zë ("Shkruaj · Fol", ?menyra=fol nga ekrani i nisjes).
// Me zë: PaneliIZerit (avatari, statusi, mikrofoni) rreth së njëjtës bisedë; "Shkruaj · Fol" ndërrohet në çdo çast.
// Lart gjithmonë shkruan kush e ka radhën.
// Pa kokën e Stack-ut (gjestet "mbrapa" fiken): dalja bëhet vetëm me "Dil", me konfirmim, që intervista të mos humbë
// nga një rrëshqitje e gabuar. Përgjigjet ruhen në server, ndaj "Dil" = pauzë: intervista vazhdon nga e njëjta punë.

const MBYLLJA: Record<Gjuha, string> = {
  sq: "Kaq ishte nga ana ime, ju faleminderit për kohën.",
  en: "That's all from my side, thank you for your time.",
  de: "Das war's von meiner Seite, vielen Dank für Ihre Zeit.",
};

// Mesazhet e rrjetit (mesazhet.ts): përgjigjja e shkruar nuk humbet kurrë.
const PA_INTERNET_PERGJIGJJA = paInternet("përgjigjja jote është ruajtur këtu", false);

const DERGO = { ios: "arrow.up", android: "arrow_upward" };
const MENYRAT: Paraqitja[] = ["tekst", "avatar"];
const MAJTAS = { ios: "chevron.left", android: "chevron_left" };

export default function IntervistaEkrani() {
  const t = useTema();
  const router = useRouter();
  const kufijte = useSafeAreaInsets();
  const njofto = useNjoftim();
  const { id, menyra } = useLocalSearchParams<{ id: string; menyra?: string }>();
  const { gjendja, dergo, dergoZerin, ndryshoParaqitjen, perfundo, riprovo, uPyet, kaPergjigje } = useIntervista(
    id,
    menyra === "fol" && mbeshtetetZeri ? "avatar" : "tekst",
  );
  // Interneti u kthye pas një leximi të dështuar (hapja e intervistës): rilexon NJË herë për çdo kthim; është vetëm lexim.
  // Dërgimi i përgjigjes s'bëhet vetë: e dërgon përdoruesi me "Provo përsëri".
  const { kaInternet } = useRrjeti(() => {
    if (gjendja.faza === "gabim" && gjendja.veprimi === "ngarko" && eshteGabimRrjeti(gjendja.gabimi)) riprovo();
  });
  const [teksti, setTeksti] = useState("");
  const lista = useRef<ScrollViewInstance>(null);
  const meZe = gjendja.paraqitja === "avatar";

  const radha = kushEkaRadhen(gjendja);
  const seanca = gjendja.faza === "gati" ? null : gjendja.seanca;
  const info = seanca?.info ?? null;
  // Emri vjen nga intervista (zgjedhja te nisja); gjatë hapjes, ose pa shënim, mbetet "Arta".
  const intervistuesi: Intervistuesi = info?.intervistuesi ?? INTERVISTUESI_FILLESTAR;
  const pamja = PAMJA_E_INTERVISTUESIT[intervistuesi];
  const mundTeDergoje = gjendja.faza === "pret_pergjigjen" && teksti.trim().length > 0;
  // Gabimi i fundit është mungesa e internetit (jo AI-ja, jo serveri): kartës i japim titullin "Pa internet".
  const paInternetGabim = gjendja.faza === "gabim" && eshteGabimRrjeti(gjendja.gabimi);
  const vononGabim = gjendja.faza === "gabim" && gjendja.gabimi.kodi === "vonese";

  // Çdo problem me zërin kalon te Shkruaj pa e humbur intervistën (përgjigjet janë në server).
  const kaloTeShkruaj = useCallback(
    (mesazhi: string | null) => {
      ndryshoParaqitjen("tekst");
      if (mesazhi) njofto(mesazhi, "info");
    },
    [ndryshoParaqitjen, njofto],
  );

  // Raporti gati → rezultatet (zëvendëson këtë ekran, që "mbrapa" të mos kthejë në një intervistë të mbaruar).
  // Me zë, PaneliIZerit e thërret pasi intervistuesi ta ketë mbaruar mbylljen.
  const hapRezultatet = useCallback(() => {
    router.replace({ pathname: "/intervista/rezultatet", params: { id } });
  }, [id, router]);
  useEffect(() => {
    if (gjendja.faza === "raporti" && !meZe) hapRezultatet();
  }, [gjendja.faza, hapRezultatet, meZe]);

  // VoiceOver: pyetja e re lexohet sapo vjen radha e kandidatit.
  const nrAktual = gjendja.faza === "pret_pergjigjen" ? (gjendja.seanca.kthesa?.nr ?? null) : null;
  const pyetjaAktuale = gjendja.faza === "pret_pergjigjen" ? (gjendja.seanca.kthesa?.pyetja ?? null) : null;
  useEffect(() => {
    if (nrAktual !== null && pyetjaAktuale) AccessibilityInfo.announceForAccessibility(`${pamja.emri} pyet: ${pyetjaAktuale}`);
  }, [nrAktual, pyetjaAktuale, pamja.emri]);

  function dil() {
    const largohu = () => (router.canGoBack() ? router.back() : router.replace("/"));
    if (!seanca || gjendja.faza === "perfundon" || gjendja.faza === "raporti") {
      largohu();
      return;
    }
    Alert.alert(
      "Të dalësh nga intervista?",
      "Përgjigjet e tua ruhen. Mund ta vazhdosh më vonë nga e njëjta punë (brenda 24 orësh).",
      [
        { text: "Vazhdo intervistën", style: "cancel" },
        ...(kaPergjigje && gjendja.faza === "pret_pergjigjen"
          ? [{ text: "Përfundo dhe shiko rezultatet", onPress: perfundo }]
          : []),
        { text: "Dil", style: "destructive" as const, onPress: largohu },
      ],
    );
  }

  // Android: butoni "mbrapa" i sistemit kalon nga i njëjti konfirmim.
  useEffect(() => {
    const abonimi = BackHandler.addEventListener("hardwareBackPress", () => {
      dil();
      return true;
    });
    return () => abonimi.remove();
  });

  function dergoTani() {
    if (!kaInternet) {
      // Pa internet përgjigjja s'niset dhe s'fshihet nga fusha: mbetet aty derisa të lidhesh.
      prekja.gabim();
      njofto(PA_INTERNET_PERGJIGJJA.cfare, "gabim");
      return;
    }
    if (dergo(teksti)) setTeksti("");
  }

  const pyetjaNr = info ? Math.min(seanca?.nrPyetjeve ?? 1, info.max) : 0;

  // Biseda (transkripti i të dyve): e njëjta me shkrim dhe me zë.
  const biseda = (
    <ScrollView
      ref={lista}
      style={styles.flex}
      contentContainerStyle={styles.biseda}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      onContentSizeChange={() => lista.current?.scrollToEnd({ animated: true })}
    >
      {gjendja.faza === "gati" && <SkeletiIBisedes />}
      {seanca?.biseda.map((m) => (
        <Flluska key={m.id} mesazhi={m} gjuha={info?.gjuha ?? "sq"} intervistuesi={intervistuesi} />
      ))}
      {gjendja.faza === "vlereson" && gjendja.pergjigja === "" && <TeDegjoj />}
      {(gjendja.faza === "vlereson" || (gjendja.faza === "perfundon" && gjendja.mbyllVete)) && <Mendon intervistuesi={intervistuesi} />}
      {gjendja.faza === "perfundon" && (
        <View style={styles.rezultatetVijne} accessibilityLiveRegion="polite">
          <Pulsi>
            <T pesha="gjysme" madhesia={14.5} style={styles.qendroj}>
              Po i përgatis rezultatet…
            </T>
          </Pulsi>
          <T zbehur madhesia={13} style={styles.qendroj}>
            Zakonisht 10–30 sekonda. Mos e mbyll app-in.
          </T>
        </View>
      )}
      {gjendja.faza === "gabim" && (
        <KartaEGabimit
          titulli={
            paInternetGabim
              ? PA_INTERNET_PERGJIGJJA.titulli
              : vononGabim
                ? VONON.titulli
                : gjendja.veprimi === "dergo"
                ? "Përgjigjja s'u dërgua"
                : gjendja.veprimi === "ngarko"
                  ? "Intervista s'u hap"
                  : "Rezultatet s'u përgatitën"
          }
          mesazhi={
            paInternetGabim
              ? gjendja.veprimi === "dergo" && gjendja.pergjigja
                ? tekstiIPlote(PA_INTERNET_PERGJIGJJA)
                : tekstiIPlote(paInternet("intervista nuk u hap", false))
              : vononGabim
                ? `${gjendja.gabimi.message} ${VONON.bere}`
                : gjendja.veprimi === "dergo" && gjendja.pergjigja
                ? `${gjendja.gabimi.message} Përgjigjja jote s'humbet.`
                : gjendja.gabimi.message
          }
          riprovo={gjendja.gabimi.riprovohet || gjendja.veprimi === "ngarko" ? riprovo : undefined}
        />
      )}
    </ScrollView>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: t.sfondi }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />

      {/* Koka: Dil · puna · progresi */}
      <View style={[styles.koka, { paddingTop: kufijte.top + 6, borderBottomColor: t.vija, backgroundColor: t.sfondi }]}>
        <View style={styles.kokaRresht}>
          <Prekshme
            accessibilityRole="button"
            accessibilityLabel="Dil nga intervista"
            accessibilityHint="Kërkon konfirmim; përgjigjet ruhen"
            onPress={dil}
            hitSlop={10}
            style={styles.dil}
          >
            <Ikona emri={MAJTAS} madhesia={17} />
            <T pesha="gjysme" madhesia={16}>
              Dil
            </T>
          </Prekshme>
          <View style={styles.kokaTitulli}>
            <T pesha="trashe" madhesia={15} numberOfLines={1} style={styles.qendroj}>
              {info?.puna?.titulli ?? "Intervista"}
            </T>
            {info && (
              <T zbehur madhesia={12.5} style={styles.qendroj}>
                {pamja.emri} · Pyetja {pyetjaNr} nga {info.min === info.max ? info.max : `${info.min}–${info.max}`}
              </T>
            )}
          </View>
          <View style={styles.dil} />
        </View>
        {info && <Progresi vlera={pyetjaNr / info.max} />}
        {mbeshtetetZeri && gjendja.faza !== "perfundon" && gjendja.faza !== "raporti" && (
          <SegmentedControl
            values={["Shkruaj", "Fol"]}
            selectedIndex={MENYRAT.indexOf(gjendja.paraqitja)}
            onChange={(e) => {
              const p = MENYRAT[e.nativeEvent.selectedSegmentIndex];
              if (p && p !== gjendja.paraqitja) {
                prekja.zgjedhje();
                ndryshoParaqitjen(p);
              }
            }}
            appearance={t.errët ? "dark" : "light"}
            accessibilityLabel="Përgjigju me shkrim ose me zë"
          />
        )}
        {!meZe && <Statusi gjendja={gjendja} radha={radha} emri={pamja.emri} paInternet={!kaInternet} />}
      </View>

      <View style={styles.shiriti}>
        <ShiritiPaInternet teksti={PA_INTERNET_PERGJIGJJA.cfare} style={styles.shiritiLart} />
      </View>

      {meZe ? (
        <PaneliIZerit
          intervistaId={id}
          gjendja={gjendja}
          intervistuesi={intervistuesi}
          kaInternet={kaInternet}
          dergoZerin={dergoZerin}
          uPyet={uPyet}
          kaloTeShkruaj={kaloTeShkruaj}
          njofto={njofto}
          onRaportiGati={hapRezultatet}
          poshte={Math.max(kufijte.bottom, 10)}
        >
          {biseda}
        </PaneliIZerit>
      ) : (
        biseda
      )}

      {/* Fusha e përgjigjes: gjithmonë e dukshme gjatë intervistës, "Dërgo" vetëm kur është radha jote. */}
      {!meZe && gjendja.faza !== "perfundon" && gjendja.faza !== "raporti" && (
        <View
          style={[
            styles.shkruaj,
            { paddingBottom: Math.max(kufijte.bottom, 10), borderTopColor: t.vija, backgroundColor: t.sfondi },
          ]}
        >
          <TextInput
            value={teksti}
            onChangeText={setTeksti}
            placeholder={radha === "ti" ? "Shkruaj përgjigjen tënde…" : `Prit pyetjen e ${pamja.gjenitivi}…`}
            placeholderTextColor={t.zbehur}
            multiline
            maxLength={MAKS_PERGJIGJJA}
            editable={gjendja.faza !== "gati"}
            style={[styles.fusha, { backgroundColor: t.karta, color: t.teksti, borderColor: t.vija }]}
            accessibilityLabel="Përgjigjja jote"
            accessibilityHint={radha === "ti" ? "Shkruaj dhe prek Dërgo" : `${pamja.emri} po mendon; prit pyetjen tjetër`}
          />
          <Prekshme
            accessibilityRole="button"
            accessibilityLabel="Dërgo përgjigjen"
            accessibilityState={{ disabled: !mundTeDergoje }}
            disabled={!mundTeDergoje}
            onPress={dergoTani}
            style={[styles.dergo, { backgroundColor: mundTeDergoje && kaInternet ? t.theksi : t.karta2 }]}
          >
            <Ikona emri={DERGO} madhesia={18} ngjyra={mundTeDergoje && kaInternet ? t.sfondi : t.zbehur} />
          </Prekshme>
        </View>
      )}
      {!meZe && teksti.length > MAKS_PERGJIGJJA - 400 && (
        <T zbehur madhesia={12} style={[styles.numeruesi, { bottom: Math.max(kufijte.bottom, 10) + 58 }]}>
          {teksti.length}/{MAKS_PERGJIGJJA}
        </T>
      )}
    </KeyboardAvoidingView>
  );
}

/** Flluska e kandidatit ndërsa zëri kthehet në tekst. */
function TeDegjoj() {
  const t = useTema();
  return (
    <View
      style={[styles.flluska, styles.eJotja, styles.mendon, { backgroundColor: t.karta2 }]}
      accessible
      accessibilityLabel="Përgjigjja jote po kthehet në tekst"
    >
      <Pulsi>
        <T madhesia={14} zbehur>
          Po e shkruaj atë që the…
        </T>
      </Pulsi>
    </View>
  );
}

/** Shiriti "kush e ka radhën": pika portokalli kur është radha jote, ndryshe tekst i qetë. */
function Statusi({
  gjendja,
  radha,
  emri,
  paInternet,
}: {
  gjendja: Gjendja;
  radha: "arta" | "ti" | "askush";
  emri: string;
  paInternet: boolean;
}) {
  const t = useTema();
  const teksti =
    gjendja.faza === "pret_pergjigjen" && paInternet
      ? "Pa internet: lidhu për ta dërguar përgjigjen"
      : gjendja.faza === "gati"
      ? "Po hapet intervista…"
      : gjendja.faza === "gabim"
        ? "U ndal: shiko mesazhin poshtë"
        : gjendja.faza === "perfundon" || gjendja.faza === "raporti"
          ? "Intervista mbaroi"
          : gjendja.faza === "vlereson"
            ? `${emri} po e lexon përgjigjen tënde…`
            : gjendja.faza === "pyet"
              ? `${emri} po pyet`
              : "Radha jote: shkruaj përgjigjen";
  return (
    <View style={styles.statusi} accessibilityLiveRegion="polite" accessibilityLabel={teksti}>
      <View style={[styles.pika, { backgroundColor: radha === "ti" ? t.theksi : radha === "arta" ? t.zbehur : t.vija }]} />
      <T pesha={radha === "ti" ? "trashe" : "gjysme"} madhesia={13.5} ngjyra={radha === "ti" ? t.teksti : t.zbehur}>
        {teksti}
      </T>
    </View>
  );
}

function Flluska({ mesazhi, gjuha, intervistuesi }: { mesazhi: Mesazhi; gjuha: Gjuha; intervistuesi: Intervistuesi }) {
  const t = useTema();
  const qetesi = useReducedMotion();
  const hyrja = qetesi ? undefined : FadeIn.duration(KOHA.mesme).easing(LEHTESIMI.hyrje);

  if (mesazhi.kush === "ti") {
    return (
      <Animated.View
        entering={hyrja}
        style={[styles.flluska, styles.eJotja, { backgroundColor: t.teksti }]}
        accessible
        accessibilityLabel={`Ti: ${mesazhi.teksti}`}
      >
        <T madhesia={15} ngjyra={t.sfondi} style={styles.rreshtat}>
          {mesazhi.teksti}
        </T>
      </Animated.View>
    );
  }

  const emri = PAMJA_E_INTERVISTUESIT[intervistuesi].emri;
  const reagimi = mesazhi.kush === "arta" ? mesazhi.reagimi : mesazhi.teksti;
  const pyetja = mesazhi.kush === "arta" ? mesazhi.pyetja : MBYLLJA[gjuha];
  return (
    <Animated.View
      entering={hyrja}
      style={[styles.flluska, styles.eArtes, { backgroundColor: t.karta, borderColor: t.vija }]}
      accessible
      accessibilityLabel={`${emri}: ${[reagimi, pyetja].filter(Boolean).join(" ")}`}
    >
      <View style={styles.emriRresht}>
        <AvatariIntervistuesit intervistuesi={intervistuesi} madhesia={22} />
        <T pesha="trashe" madhesia={12.5} zbehur>
          {emri}
        </T>
        {mesazhi.kush === "arta" && mesazhi.lloji === "vazhdim" && <Chip teksti="Pyetje vazhduese" />}
      </View>
      {reagimi ? (
        <T madhesia={15} style={styles.rreshtat}>
          {reagimi}
        </T>
      ) : null}
      <T pesha={mesazhi.kush === "arta" ? "gjysme" : "normal"} madhesia={15.5} style={styles.rreshtat}>
        {pyetja}
      </T>
    </Animated.View>
  );
}

function Mendon({ intervistuesi }: { intervistuesi: Intervistuesi }) {
  const t = useTema();
  return (
    <View
      style={[styles.flluska, styles.eArtes, styles.mendon, { backgroundColor: t.karta, borderColor: t.vija }]}
      accessible
      accessibilityLabel={`${PAMJA_E_INTERVISTUESIT[intervistuesi].emri} po mendon`}
    >
      <Pulsi>
        <View style={styles.pikat}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.pikaE, { backgroundColor: t.zbehur }]} />
          ))}
        </View>
      </Pulsi>
    </View>
  );
}

function SkeletiIBisedes() {
  const t = useTema();
  return (
    <Pulsi>
      <View
        style={[styles.flluska, styles.eArtes, { backgroundColor: t.karta, borderColor: t.vija, gap: 8 }]}
        accessibilityLabel="Po hapet intervista"
      >
        <Vije gjeresia={40} lartesia={11} />
        <Vije gjeresia={220} lartesia={14} />
        <Vije gjeresia={180} lartesia={14} />
      </View>
    </Pulsi>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  qendroj: { textAlign: "center" },
  koka: { paddingHorizontal: 16, paddingBottom: 10, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  kokaRresht: { flexDirection: "row", alignItems: "center" },
  kokaTitulli: { flex: 1, paddingHorizontal: 8 },
  dil: { flexDirection: "row", alignItems: "center", gap: 2, minWidth: 64, minHeight: 44 },
  statusi: { flexDirection: "row", alignItems: "center", gap: 8 },
  shiriti: { paddingHorizontal: 16 },
  shiritiLart: { marginTop: 10, marginBottom: 0 },
  pika: { width: 9, height: 9, borderRadius: 5 },
  biseda: { padding: 16, gap: 12, paddingBottom: 24 },
  flluska: { maxWidth: "88%", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 11, gap: 4 },
  eArtes: { alignSelf: "flex-start", borderTopLeftRadius: 6, borderWidth: StyleSheet.hairlineWidth },
  eJotja: { alignSelf: "flex-end", borderTopRightRadius: 6 },
  emriRresht: { flexDirection: "row", alignItems: "center", gap: 8 },
  rreshtat: { lineHeight: 21 },
  mendon: { paddingVertical: 15 },
  pikat: { flexDirection: "row", gap: 5 },
  pikaE: { width: 8, height: 8, borderRadius: 4 },
  rezultatetVijne: { alignItems: "center", gap: 4, marginTop: 8 },
  shkruaj: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  fusha: {
    flex: 1,
    minHeight: 44,
    maxHeight: 140,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: 15.5,
    fontFamily: SHKRONJAT.normal,
  },
  dergo: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  numeruesi: { position: "absolute", right: 72 },
});
