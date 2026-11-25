import { SegmentedControl } from "@expo/ui/community/segmented-control";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type TextInputInstance,
} from "react-native";
import Animated, { useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ButoniKryesor, Etiketa, Fusha, Udhezimi } from "@/components/Forma";
import Fillimi from "@/components/Fillimi";
import { useNjoftim } from "@/components/Njoftimet";
import Prekshme from "@/components/Prekshme";
import Unaza from "@/components/Unaza";
import { IKONAT, Ikona, Karta, T } from "@/components/ui";
import { dil, EMRAT_E_LLOJEVE, hyr, regjistrohu, type Lloji, type TeDhenatERegjistrimit } from "@/lib/hyrja";
import { LLOGARITE_DEMO, type LlogariaDemo } from "@/lib/hyrja-demo";
import { useDridhja } from "@/lib/levizja";
import { filloKthimin, kthehuISigurt, pastroKthimin, useKthimi, veprimiNgaParametri } from "@/lib/mysafiri";
import { prekja } from "@/lib/prekja";
import { HYR_PERSERI } from "@/lib/mesazhet";
import { ruajPunen } from "@/lib/ruajtura";
import { KOHA_E_LEXIMIT, meKohe, pamjaEGabimit } from "@/lib/rrjeti";
import { useSesioni } from "@/lib/sesioni";
import { useSesioniSkaduar } from "@/lib/sesioni-skaduar";
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

// Hyrja dhe regjistrimi (bordi: ekranet 01 dhe 57). Mysafiri e hap nga "Hyr" në kokë ose nga fleta "Krijo llogari që të …"
// (parametrat: menyra, kthehu, veprimi; src/lib/mysafiri.ts). Pas hyrjes si kërkues, ky ekran e kthen atje nga erdhi.
export default function Hyrja() {
  const t = useTema();
  const router = useRouter();
  const njofto = useNjoftim();
  const kufijte = useSafeAreaInsets();
  const { sesioni, mysafir, profili, profiliPaRol, gabimiIProfilit, rifreskoProfilin } = useSesioni();
  const params = useLocalSearchParams<{ menyra?: string; kthehu?: string; veprimi?: string }>();
  const { stili: stiliIButonit, dridhu } = useDridhja();
  const sesioniSkaduar = useSesioniSkaduar();
  const unaza = useSharedValue(0.78);
  const fjalekalimiRef = useRef<TextInputInstance>(null);
  const emailRef = useRef<TextInputInstance>(null);

  const [menyra, setMenyra] = useState<Menyra>(params.menyra === "regjistrohu" ? "regjistrohu" : "hyr");
  const [hapi, setHapi] = useState<1 | 2>(1);
  const [lloji, setLloji] = useState<LlojiIZgjedhur>("kerkues");
  const [emri, setEmri] = useState("");
  const [organizata, setOrganizata] = useState("");
  const [email, setEmail] = useState("");
  const [fjalekalimi, setFjalekalimi] = useState("");
  const [provoi, setProvoi] = useState(false);
  const [duke_punuar, setDukePunuar] = useState(false);
  const [gabimi, setGabimi] = useState<string | null>(null);
  // Cili buton demo po hyn (spinner vetëm te ai). Mbetet null kur hyrja demo është e fikur.
  const [demoNeHyrje, setDemoNeHyrje] = useState<Lloji | null>(null);

  // Mysafiri që e hapi këtë ekran mbi app (jo hyrja si ekrani i parë): ka ku të kthehet dhe sheh X-in.
  const [ngaMysafiri] = useState(mysafir);
  const kthimi = useKthimi();
  const uKthye = useRef(false);

  // Ku të kthehet pas hyrjes. Mbyllja e ekranit (me ose pa hyrje) e fshin.
  useEffect(() => {
    if (!ngaMysafiri) return;
    filloKthimin({ kthehu: kthehuISigurt(params.kthehu), veprimi: veprimiNgaParametri(params.veprimi) });
    return () => pastroKthimin();
  }, [ngaMysafiri, params.kthehu, params.veprimi]);

  // Profili i kërkuesit është gati (pas hyrjes, ose pas zgjedhjes së rolit te regjistrimi): veprimi që mysafiri kishte nisur
  // (⭐) kryhet, pastaj ky ekran mbyllet dhe hapet `kthehu`. Organizatat s'kalojnë këtu: rojet i çojnë te Punët e mia.
  useEffect(() => {
    if (!kthimi || profili?.lloji !== "kerkues" || uKthye.current) return;
    uKthye.current = true;
    const { kthehu, veprimi } = kthimi;
    (async () => {
      if (veprimi?.lloji === "ruaj") {
        try {
          await meKohe(ruajPunen(veprimi.punaId), KOHA_E_LEXIMIT);
          njofto("Puna u ruajt", "sukses");
        } catch {
          njofto("Puna s'u ruajt. Provoje përsëri te puna.", "gabim");
        }
      }
      if (router.canGoBack()) {
        router.back();
        if (kthehu) router.push(kthehu as Href);
      } else {
        router.replace((kthehu ?? "/") as Href);
      }
    })();
  }, [kthimi, profili, router, njofto]);

  const regjistrim = menyra === "regjistrohu";
  const mungon = {
    emri: regjistrim && emri.trim().length < 2,
    organizata: regjistrim && lloji === "punedhenes" && organizata.trim().length < 2,
    email: !EMAIL_I_SAKTE.test(email.trim()),
    // Rregulli i 6 shkronjave vlen vetëm kur krijohet fjalëkalimi; te hyrja mjafton që të mos jetë bosh
    // (llogaritë e vjetra mund të kenë fjalëkalim tjetër, dhe serveri e kontrollon vetë).
    fjalekalimi: regjistrim ? fjalekalimi.length < 6 : fjalekalimi.length === 0,
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

  // Hyrja demo me një prekje: i njëjti `hyr()` si forma, gabimet në të njëjtin vend.
  async function hyrSiDemo(l: LlogariaDemo) {
    if (duke_punuar) return;
    prekja.zgjedhje();
    setDukePunuar(true);
    setDemoNeHyrje(l.lloji);
    setGabimi(null);
    try {
      await hyr(l.email, l.fjalekalimi);
      prekja.sukses();
    } catch (e) {
      prekja.gabim();
      setGabimi(e instanceof Error ? e.message : "Diçka shkoi keq. Provo përsëri.");
      setDukePunuar(false);
      setDemoNeHyrje(null);
    }
  }

  // Kërkues i ri (ose i vjetër pa rol): zgjedh rolin dhe gjuhën e intervistës para se të hyjë në app.
  if (sesioni && profiliPaRol) return <Fillimi profili={profiliPaRol} />;

  // Ke hyrë, por profili s'u lexua (p.sh. pa internet) dhe s'ka asnjë të ruajtur në telefon: mos e ngec përdoruesin.
  const pamjaProfilit = pamjaEGabimit(gabimiIProfilit ?? "", "S'u lexua profili yt", "s'mund ta hapim profilin tënd tani", true, "ekrani");
  if (sesioni && gabimiIProfilit) {
    return (
      <View style={[styles.flex, styles.qender, { backgroundColor: t.sfondi }]}>
        <Karta style={styles.karta}>
          <T pesha="trashe" madhesia={17}>
            {pamjaProfilit.titulli}
          </T>
          <T zbehur madhesia={14} accessibilityLiveRegion="polite">
            {pamjaProfilit.teksti}
          </T>
          <ButoniKryesor teksti="Provo përsëri" onPress={() => rifreskoProfilin()} />
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
        {sesioniSkaduar && (
          <Karta style={styles.karta}>
            <T pesha="trashe" madhesia={17} accessibilityRole="header">
              {HYR_PERSERI.titulli}
            </T>
            <T zbehur madhesia={14} accessibilityLiveRegion="polite">
              {HYR_PERSERI.cfare}
            </T>
            <T madhesia={14}>{HYR_PERSERI.bere}</T>
            <ButoniKryesor
              teksti={HYR_PERSERI.buton}
              onPress={() => {
                prekja.zgjedhje();
                ndryshoMenyren("hyr");
                emailRef.current?.focus();
              }}
            />
          </Karta>
        )}

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
              : "Hyr për të ruajtur punët dhe për të parë sa je gati."}
          </T>
        </View>

        <SegmentedControl
          values={["Hyr", "Krijo llogari"]}
          selectedIndex={regjistrim ? 1 : 0}
          onValueChange={(v) => ndryshoMenyren(v === "Hyr" ? "hyr" : "regjistrohu")}
          enabled={!duke_punuar}
          style={styles.segmenti}
        />

        {!regjistrim && LLOGARITE_DEMO.length > 0 && (
          <View style={styles.demo}>
            <Etiketa>Demo · hyr me një prekje</Etiketa>
            {LLOGARITE_DEMO.map((l) => {
              const kjo = demoNeHyrje === l.lloji;
              return (
                <Prekshme
                  key={l.lloji}
                  onPress={() => hyrSiDemo(l)}
                  disabled={duke_punuar}
                  accessibilityRole="button"
                  accessibilityState={{ busy: kjo, disabled: duke_punuar }}
                  style={[
                    styles.opsioni,
                    styles.opsioniDemo,
                    { backgroundColor: t.karta, shadowColor: t.hija, opacity: duke_punuar && !kjo ? 0.45 : 1 },
                  ]}
                >
                  <View style={[styles.ikonaEOpsionit, { backgroundColor: t.karta2 }]}>
                    <Ikona
                      emri={l.lloji === "kerkues" ? IKONAT.personi : l.lloji === "punedhenes" ? IKONAT.canta : IKONAT.shkolla}
                      madhesia={18}
                      ngjyra={t.teksti}
                    />
                  </View>
                  <T pesha="trashe" madhesia={15.5} style={styles.flex}>
                    {l.teksti}
                  </T>
                  {kjo ? (
                    <ActivityIndicator color={t.teksti} />
                  ) : (
                    <Ikona emri={IKONAT.shigjeta} madhesia={14} ngjyra={t.zbehur} />
                  )}
                </Prekshme>
              );
            })}
          </View>
        )}

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
            <Udhezimi shfaq={provoi && mungon.fjalekalimi}>
              {regjistrim ? "Fjalëkalimi duhet të ketë të paktën 6 shkronja." : "Shkruaj fjalëkalimin."}
            </Udhezimi>

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
                duke_punuar={duke_punuar && demoNeHyrje === null}
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
      {/* Mysafiri mund të kthehet te app-i pa hyrë (edhe me gjestin "mbrapa" të sistemit). */}
      {ngaMysafiri && !sesioni && router.canGoBack() && (
        <Prekshme
          accessibilityRole="button"
          accessibilityLabel="Mbyll dhe vazhdo pa llogari"
          hitSlop={8}
          shkalla={0.9}
          onPress={() => router.back()}
          style={[styles.mbyll, { top: kufijte.top + 6 }]}
        >
          <Ikona emri={IKONAT.mbyll} madhesia={30} ngjyra={t.zbehur} />
        </Prekshme>
      )}
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
  demo: { gap: 8, marginTop: 4 },
  opsioniDemo: { minHeight: 56, borderColor: "transparent" },
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
  mbyll: { position: "absolute", left: 14, zIndex: 2, minWidth: 44, minHeight: 44, alignItems: "flex-start", justifyContent: "center" },
});
