import { SegmentedControl } from "@expo/ui/community/segmented-control";
import { LinearGradient } from "expo-linear-gradient";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type TextInputInstance } from "react-native";
import Animated, { useSharedValue } from "react-native-reanimated";

import { ButoniKryesor, Etiketa, Fusha, Udhezimi } from "@/components/Forma";
import Prekshme from "@/components/Prekshme";
import Unaza from "@/components/Unaza";
import { IKONAT, Ikona, Karta, T } from "@/components/ui";
import { dil, EMRAT_E_LLOJEVE, hyr, regjistrohu, type TeDhenatERegjistrimit } from "@/lib/hyrja";
import { useDridhja } from "@/lib/levizja";
import { prekja } from "@/lib/prekja";
import { useSesioni } from "@/lib/sesioni";
import { useTema } from "@/lib/tema";

type Menyra = "hyr" | "regjistrohu";
type LlojiIZgjedhur = TeDhenatERegjistrimit["lloji"];

const EMAIL_I_SAKTE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Zgjedhja e llogarisë si në bord (ekrani 57): ikona, titulli, një rresht shpjegim, radio.
const LLOJET: {
  lloji: LlojiIZgjedhur;
  titulli: string;
  pershkrimi: string;
  ikona: { ios: string; android: string };
}[] = [
  {
    lloji: "kerkues",
    titulli: "Kërkoj punë",
    pershkrimi: "Shpalljet, ⭐ të ruajturat, gatishmëria",
    ikona: IKONAT.personi,
  },
  {
    lloji: "punedhenes",
    titulli: "Punëdhënës",
    pershkrimi: "Posto punë dhe menaxho shpalljet e tua",
    ikona: IKONAT.canta,
  },
];

// Regjistrimi hap pas hapi, si rruga e gatishmërisë: 1 Lloji · 2 Të dhënat · 3 Verifikimi · 4 Hyrja.
// Verifikimi me kod vjen kur ndizet "Confirm email" (java 10); hyrja me pyetjet e AI-së për kërkuesin vjen
// me AI-në (02.12). Deri atëherë të dy shfaqen si "së shpejti" dhe kapërcehen, pa u shtirur se punojnë.
const HAPAT = [
  { emri: "Lloji", seShpejti: false },
  { emri: "Të dhënat", seShpejti: false },
  { emri: "Verifikimi", seShpejti: true },
  { emri: "Hyrja", seShpejti: true },
] as const;

function HapatERegjistrimit({ hapi }: { hapi: 1 | 2 }) {
  const t = useTema();
  return (
    <View
      style={styles.hapat}
      accessible
      accessibilityLabel={`Hapi ${hapi} nga ${HAPAT.length}: ${HAPAT[hapi - 1].emri}`}
    >
      {HAPAT.map((h, i) => {
        const nr = i + 1;
        const kryer = nr < hapi;
        const tani = nr === hapi;
        return (
          <View key={h.emri} style={styles.hapiKolona}>
            <View style={styles.hapiRreshti}>
              <View
                style={[
                  styles.hapiPika,
                  { backgroundColor: kryer ? t.theksi : t.karta, borderColor: kryer || tani ? t.theksi : t.vija },
                ]}
              >
                {kryer ? (
                  <Ikona emri={IKONAT.check} madhesia={11} ngjyra="#fff" />
                ) : (
                  <T pesha="trashe" madhesia={11} ngjyra={tani ? t.theksi : t.zbehur}>
                    {nr}
                  </T>
                )}
              </View>
              {i < HAPAT.length - 1 && (
                <View
                  style={[
                    styles.hapiVija,
                    kryer
                      ? { borderColor: t.theksi, borderStyle: "solid" }
                      : { borderColor: t.vija, borderStyle: Platform.OS === "ios" ? "dotted" : "dashed" },
                  ]}
                />
              )}
            </View>
            <T pesha={tani ? "trashe" : "mesme"} madhesia={12} ngjyra={tani ? t.teksti : t.zbehur}>
              {h.emri}
            </T>
            {h.seShpejti && (
              <T madhesia={10.5} ngjyra={t.zbehur}>
                së shpejti
              </T>
            )}
          </View>
        );
      })}
    </View>
  );
}

// Hyrja dhe regjistrimi (bordi: ekranet 01 dhe 57). Ky është i vetmi ekran që sheh kush s'ka hyrë.
export default function Hyrja() {
  const t = useTema();
  const { sesioni, gabimiIProfilit, rifreskoProfilin } = useSesioni();
  const { stili: stiliIButonit, dridhu } = useDridhja();
  const unaza = useSharedValue(0.78);
  const fjalekalimiRef = useRef<TextInputInstance>(null);
  const emailRef = useRef<TextInputInstance>(null);

  const [menyra, setMenyra] = useState<Menyra>("hyr");
  const [hapi, setHapi] = useState<1 | 2>(1);
  const [lloji, setLloji] = useState<LlojiIZgjedhur>("kerkues");
  const [emri, setEmri] = useState("");
  const [organizata, setOrganizata] = useState("");
  const [email, setEmail] = useState("");
  const [fjalekalimi, setFjalekalimi] = useState("");
  const [provoi, setProvoi] = useState(false);
  const [duke_punuar, setDukePunuar] = useState(false);
  const [gabimi, setGabimi] = useState<string | null>(null);

  const regjistrim = menyra === "regjistrohu";
  const mungon = {
    emri: regjistrim && emri.trim().length < 2,
    organizata: regjistrim && lloji === "punedhenes" && organizata.trim().length < 2,
    email: !EMAIL_I_SAKTE.test(email.trim()),
    fjalekalimi: fjalekalimi.length < 6,
  };
  const valide = !mungon.emri && !mungon.organizata && !mungon.email && !mungon.fjalekalimi;

  function ndryshoMenyren(e: Menyra) {
    if (e === menyra) return;
    prekja.zgjedhje();
    setMenyra(e);
    setHapi(1);
    setProvoi(false);
    setGabimi(null);
  }

  async function dergo() {
    if (duke_punuar) return; // pa dërgime të dyfishta
    if (!valide) {
      setProvoi(true);
      prekja.gabim();
      dridhu();
      return;
    }
    setDukePunuar(true);
    setGabimi(null);
    try {
      if (regjistrim) {
        await regjistrohu({ email, fjalekalimi, emri, lloji, organizata });
      } else {
        await hyr(email, fjalekalimi);
      }
      prekja.sukses();
      // Rojet te _layout.tsx e çojnë llogarinë te ekranet e saj sapo të lexohet profili.
    } catch (e) {
      prekja.gabim();
      dridhu();
      setGabimi(e instanceof Error ? e.message : "Diçka shkoi keq. Provo përsëri.");
      setDukePunuar(false);
    }
  }

  // Ke hyrë, por profili s'u lexua (p.sh. pa internet): mos e ngec përdoruesin.
  if (sesioni && gabimiIProfilit) {
    return (
      <View style={[styles.flex, styles.qender, { backgroundColor: t.sfondi }]}>
        <Karta style={styles.karta}>
          <T pesha="trashe" madhesia={17}>
            S&apos;u lexua profili yt
          </T>
          <T zbehur madhesia={14}>
            {gabimiIProfilit}
          </T>
          <ButoniKryesor teksti="Provo përsëri" onPress={rifreskoProfilin} />
          <Prekshme onPress={() => dil().catch(() => {})} accessibilityRole="button" style={styles.lidhja}>
            <T pesha="gjysme" madhesia={15} ngjyra={t.keq}>
              Dil nga llogaria
            </T>
          </Prekshme>
        </Karta>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: t.sfondi }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <LinearGradient colors={[t.theksiButë, t.sfondi]} style={styles.gradienti} pointerEvents="none" />
      <ScrollView
        contentContainerStyle={styles.faqja}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.koka}>
          <View style={[styles.pllaka, { backgroundColor: t.karta, shadowColor: t.hija }]}>
            <Unaza madhesia={56} progresi={unaza} ngjyrat={{ gjurma: t.karta2, harku: t.theksi, shenja: t.teksti }} />
          </View>
          <T pesha="trashe" madhesia={28} style={styles.titulli}>
            {regjistrim ? (hapi === 1 ? "Krijo llogarinë" : "Të dhënat e tua") : "Mirë se u ktheve"}
          </T>
          <T zbehur madhesia={15} style={styles.qendroj}>
            {regjistrim
              ? hapi === 1
                ? "Zgjidh si do ta përdorësh Karrierën."
                : "Të dhënat e tua i sheh vetëm ti."
              : "Hyr për të parë punët dhe hapat e tu drejt “gati”."}
          </T>
        </View>

        <SegmentedControl
          values={["Hyr", "Krijo llogari"]}
          selectedIndex={regjistrim ? 1 : 0}
          onValueChange={(v) => ndryshoMenyren(v === "Hyr" ? "hyr" : "regjistrohu")}
          enabled={!duke_punuar}
          style={styles.segmenti}
        />

        {regjistrim && <HapatERegjistrimit hapi={hapi} />}

        {regjistrim && hapi === 1 && (
          <>
            <Etiketa>Si do ta përdorësh Karrierën?</Etiketa>
            <View style={styles.llojet} accessibilityRole="radiogroup">
              {LLOJET.map((l) => {
                const zgjedhur = lloji === l.lloji;
                return (
                  <Prekshme
                    key={l.lloji}
                    onPress={() => {
                      if (zgjedhur) return;
                      prekja.zgjedhje();
                      setLloji(l.lloji);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: zgjedhur }}
                    style={[
                      styles.opsioni,
                      {
                        backgroundColor: t.karta,
                        shadowColor: t.hija,
                        borderColor: zgjedhur ? t.teksti : "transparent",
                      },
                    ]}
                  >
                    <View style={[styles.ikonaEOpsionit, { backgroundColor: zgjedhur ? t.theksiButë : t.karta2 }]}>
                      <Ikona emri={l.ikona} madhesia={18} ngjyra={zgjedhur ? t.theksi : t.teksti} />
                    </View>
                    <View style={styles.flex}>
                      <T pesha="trashe" madhesia={15.5}>
                        {l.titulli}
                      </T>
                      <T zbehur madhesia={13}>
                        {l.pershkrimi}
                      </T>
                    </View>
                    <View style={[styles.radio, { borderColor: zgjedhur ? t.teksti : t.vija }]}>
                      {zgjedhur && <View style={[styles.radioPika, { backgroundColor: t.teksti }]} />}
                    </View>
                  </Prekshme>
                );
              })}
            </View>
            <T zbehur madhesia={12.5} style={styles.shenimi}>
              Qendrat e karrierës: llogarinë jua hap ekipi i Karrierës.
            </T>
            <ButoniKryesor
              teksti="Vazhdo"
              onPress={() => {
                prekja.zgjedhje();
                setHapi(2);
                setProvoi(false);
                setGabimi(null);
              }}
            />
          </>
        )}

        {regjistrim && hapi === 2 && (
          <>
            <Prekshme
              onPress={() => {
                prekja.zgjedhje();
                setHapi(1);
                setGabimi(null);
              }}
              disabled={duke_punuar}
              accessibilityRole="button"
              accessibilityLabel={`Lloji: ${EMRAT_E_LLOJEVE[lloji]}. Ndrysho`}
              style={[styles.zgjedhja, { backgroundColor: t.karta2 }]}
            >
              <Ikona emri={lloji === "kerkues" ? IKONAT.personi : IKONAT.canta} madhesia={16} ngjyra={t.teksti} />
              <T pesha="gjysme" madhesia={14} style={styles.flex}>
                {EMRAT_E_LLOJEVE[lloji]}
              </T>
              <T pesha="gjysme" madhesia={14} ngjyra={t.theksi}>
                Ndrysho
              </T>
            </Prekshme>

            <Etiketa>{lloji === "punedhenes" ? "Emri juaj (personi i kontaktit)" : "Emri juaj"}</Etiketa>
            <Fusha
              value={emri}
              onChangeText={setEmri}
              placeholder="p.sh. Arta Krasniqi"
              autoComplete="name"
              textContentType="name"
              maxLength={80}
              editable={!duke_punuar}
              gabim={provoi && mungon.emri}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => emailRef.current?.focus()}
            />
            <Udhezimi shfaq={provoi && mungon.emri}>Shkruaj emrin, të paktën 2 shkronja.</Udhezimi>

            {lloji === "punedhenes" && (
              <>
                <Etiketa>Kompania</Etiketa>
                <Fusha
                  value={organizata}
                  onChangeText={setOrganizata}
                  placeholder="p.sh. Dardania Soft"
                  autoComplete="organization"
                  textContentType="organizationName"
                  maxLength={80}
                  editable={!duke_punuar}
                  gabim={provoi && mungon.organizata}
                />
                <Udhezimi shfaq={provoi && mungon.organizata}>Shkruaj emrin e kompanisë.</Udhezimi>
              </>
            )}
          </>
        )}

        {(!regjistrim || hapi === 2) && (
          <>
            <Etiketa>Email</Etiketa>
            <Fusha
              ref={emailRef}
              value={email}
              onChangeText={setEmail}
              placeholder="emri@shembull.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType={regjistrim ? "username" : "emailAddress"}
              editable={!duke_punuar}
              gabim={provoi && mungon.email}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => fjalekalimiRef.current?.focus()}
            />
            <Udhezimi shfaq={provoi && mungon.email}>Shkruaj një email të saktë.</Udhezimi>

            <Etiketa>Fjalëkalimi</Etiketa>
            <Fusha
              ref={fjalekalimiRef}
              value={fjalekalimi}
              onChangeText={setFjalekalimi}
              placeholder={regjistrim ? "Të paktën 6 shkronja" : "Fjalëkalimi yt"}
              secureTextEntry
              autoCapitalize="none"
              autoComplete={regjistrim ? "new-password" : "current-password"}
              textContentType={regjistrim ? "newPassword" : "password"}
              editable={!duke_punuar}
              gabim={provoi && mungon.fjalekalimi}
              returnKeyType="go"
              onSubmitEditing={dergo}
            />
            <Udhezimi shfaq={provoi && mungon.fjalekalimi}>Fjalëkalimi duhet të ketë të paktën 6 shkronja.</Udhezimi>

            {gabimi && (
              <View style={[styles.gabimi, { backgroundColor: t.karta }]} accessibilityLiveRegion="polite">
                <Ikona emri={IKONAT.alarm} madhesia={18} ngjyra={t.keq} />
                <T madhesia={14} ngjyra={t.keq} style={styles.flex}>
                  {gabimi}
                </T>
              </View>
            )}

            <Animated.View style={stiliIButonit}>
              <ButoniKryesor
                teksti={regjistrim ? "Krijo llogarinë" : "Hyr"}
                onPress={dergo}
                duke_punuar={duke_punuar}
                joValid={!valide}
                accessibilityHint={valide ? undefined : "Plotëso fushat që mungojnë"}
              />
            </Animated.View>
          </>
        )}

        <Prekshme
          onPress={() => ndryshoMenyren(regjistrim ? "hyr" : "regjistrohu")}
          accessibilityRole="button"
          style={styles.lidhja}
        >
          <T zbehur madhesia={14}>
            {regjistrim ? "Ke llogari? " : "S'ke llogari? "}
            <T pesha="trashe" madhesia={14}>
              {regjistrim ? "Hyr" : "Krijo një"}
            </T>
          </T>
        </Prekshme>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  qender: { justifyContent: "center", padding: 20 },
  karta: { gap: 8 },
  gradienti: { position: "absolute", left: 0, right: 0, top: 0, height: 360 },
  faqja: { padding: 22, paddingTop: 48, gap: 6, paddingBottom: 60 },
  koka: { alignItems: "center", gap: 6, marginBottom: 14 },
  pllaka: {
    width: 72,
    height: 72,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    marginBottom: 8,
  },
  titulli: { letterSpacing: -0.6, textAlign: "center" },
  qendroj: { textAlign: "center" },
  segmenti: { marginBottom: 4, minHeight: 36 },
  llojet: { gap: 8 },
  opsioni: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 12,
    minHeight: 64,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  ikonaEOpsionit: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioPika: { width: 10, height: 10, borderRadius: 5 },
  shenimi: { marginTop: 2 },
  gabimi: { flexDirection: "row", gap: 8, alignItems: "center", borderRadius: 14, padding: 12, marginTop: 12 },
  hapat: { flexDirection: "row", marginTop: 14, marginBottom: 2 },
  hapiKolona: { flex: 1, gap: 3 },
  hapiRreshti: { flexDirection: "row", alignItems: "center", marginBottom: 2 },
  hapiPika: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  hapiVija: { flex: 1, borderTopWidth: 2, marginHorizontal: 4 },
  zgjedhja: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 12,
    minHeight: 44,
    marginTop: 10,
  },
  lidhja: { alignSelf: "center", minHeight: 44, justifyContent: "center", paddingHorizontal: 12, marginTop: 6 },
});
