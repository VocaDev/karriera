import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View, type TextInputInstance } from "react-native";
import Animated from "react-native-reanimated";

import { ButoniKryesor, Etiketa, Fusha, Udhezimi } from "@/components/Forma";
import { useNjoftim } from "@/components/Njoftimet";
import Prekshme from "@/components/Prekshme";
import ShiritiPaInternet from "@/components/ShiritiPaInternet";
import { IKONAT, Ikona, T } from "@/components/ui";
import { useDridhja } from "@/lib/levizja";
import { paInternet, VONON } from "@/lib/mesazhet";
import { prekja } from "@/lib/prekja";
import {
  KUFIJTE_E_LINKUT,
  kontrolloLinkun,
  lexoShpalljenNgaLinku,
  shenoPunenERe,
  shtoPunenNgaLinku,
  type ShpalljaELexuar,
} from "@/lib/punet";
import { eshteGabimKohe, eshteGabimRrjeti, KOHA_E_NGARKIMIT, meKohe, useRrjeti } from "@/lib/rrjeti";
import { useSesioni } from "@/lib/sesioni";
import { useTema } from "@/lib/tema";

// "Sill linkun tënd" (J7, bordi: fleta e Punëve): kërkuesi ngjit linkun e një shpalljeje që e gjeti diku tjetër.
// Bëhet punë private (e sheh vetëm ai) dhe hapet menjëherë, gati për "A jam gati?" dhe intervistën.
// Fletë (formSheet) me dorezë dhe X të rrumbullakët (AGENTS.md, Native feel #2). Gabimet dalin te fusha pas prekjes së parë.
// Sapo linku është i vlefshëm, serveri e lexon shpalljen (lexo-linkun) dhe i plotëson fushat; përdoruesi i ndryshon lirshëm.
// Kur faqja s'lexohet (LinkedIn dhe faqe të tjera me hyrje, bllokim, s'u përgjigj), një fjali e thotë, dhe fushat me dorë
// + teksti i ngjitur mbeten rruga: shtimi s'bllokohet kurrë nga leximi.
type Leximi =
  | { gjendja: "bosh" }
  | { gjendja: "duke_lexuar" }
  | { gjendja: "lexuar"; shpallja: ShpalljaELexuar }
  | { gjendja: "deshtoi"; mesazhi: string };

type Fushat = { titulli: string; kompania: string; qyteti: string; teksti: string };
const PA_FUSHA: Fushat = { titulli: "", kompania: "", qyteti: "", teksti: "" };
const PRITJA_PARA_LEXIMIT = 600; // ms pas ngjitjes/shkrimit të fundit
const KOHA_E_LEXIMIT_TE_LINKUT = 30_000;

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
  const [leximi, setLeximi] = useState<Leximi>({ gjendja: "bosh" });
  // Linku i fundit që u dërgua për lexim (pa riprovime automatike për të njëjtin link) dhe vlerat që i vendosi leximi:
  // një fushë mbishkruhet vetëm kur është bosh ose ka ende vlerën e leximit të mëparshëm (s'prekim çka shkroi përdoruesi).
  const iLexuari = useRef<string | null>(null);
  const iPlotesuar = useRef<Fushat>(PA_FUSHA);
  // Pas një "s'mbaroi në kohë", prova e dytë mund ta gjejë punën që e para e shtoi tashmë: s'është "e shtuar më parë".
  const dergoi = useRef(false);
  // Interneti u kthye: mesazhi "pa internet" ose "po vonon" largohet; përdoruesi e provon kur të dojë.
  useRrjeti(() => {
    setGabimi((g) => (g !== null && (eshteGabimRrjeti(g) || eshteGabimKohe(g)) ? null : g));
  });
  const eRrjetit = gabimi !== null && (eshteGabimRrjeti(gabimi) || eshteGabimKohe(gabimi));

  // Të njëjtat kufij si në bazë (migrimi 20261118100000), që gabimi të dalë para se të dërgohet.
  const kontrolliILinkut = kontrolloLinkun(linku);
  const mungon = {
    linku: !kontrolliILinkut.ok,
    titulli: titulli.trim().length < 3,
    kompania: kompania.trim().length < 2,
    qyteti: qyteti.trim().length === 1,
  };
  const valide = !mungon.linku && !mungon.titulli && !mungon.kompania && !mungon.qyteti;
  const linkuKanonik = kontrolliILinkut.ok ? kontrolliILinkut.linku : null;

  useEffect(() => {
    if (!linkuKanonik || linkuKanonik === iLexuari.current) return;
    let anuluar = false;
    let mbaroi = false;
    const vendos = (setter: (f: (aktuale: string) => string) => void, para: string, pas: string) =>
      setter((aktuale) => (aktuale.trim() === "" || aktuale === para ? pas : aktuale));
    const ora = setTimeout(async () => {
      iLexuari.current = linkuKanonik;
      // Linku ndryshoi: vlerat e leximit të mëparshëm (që përdoruesi s'i preku) s'i përkasin më këtij linku.
      const para = iPlotesuar.current;
      vendos(setTitulli, para.titulli, "");
      vendos(setKompania, para.kompania, "");
      vendos(setQyteti, para.qyteti, "");
      vendos(setTeksti, para.teksti, "");
      iPlotesuar.current = PA_FUSHA;
      setLeximi({ gjendja: "duke_lexuar" });
      try {
        const shpallja = await meKohe(
          lexoShpalljenNgaLinku(linkuKanonik, roli_synuar),
          KOHA_E_LEXIMIT_TE_LINKUT,
          "Leximi i faqes po zgjat shumë.",
        );
        if (anuluar) return;
        const te: Fushat = {
          titulli: shpallja.titulli ?? "",
          kompania: shpallja.kompania ?? "",
          qyteti: shpallja.qyteti ?? "",
          teksti: shpallja.pershkrimi,
        };
        if (te.titulli) vendos(setTitulli, "", te.titulli);
        if (te.kompania) vendos(setKompania, "", te.kompania);
        if (te.qyteti) vendos(setQyteti, "", te.qyteti);
        if (te.teksti) vendos(setTeksti, "", te.teksti);
        iPlotesuar.current = te;
        setLeximi({ gjendja: "lexuar", shpallja });
      } catch (e) {
        if (anuluar) return;
        setLeximi({ gjendja: "deshtoi", mesazhi: e instanceof Error ? e.message : "S'arritëm ta lexojmë këtë faqe." });
      } finally {
        mbaroi = true;
      }
    }, PRITJA_PARA_LEXIMIT);
    return () => {
      anuluar = true;
      clearTimeout(ora);
      // Leximi u ndërpre para se të mbaronte: i njëjti link lexohet përsëri nëse kthehet.
      if (!mbaroi && iLexuari.current === linkuKanonik) iLexuari.current = null;
    };
  }, [linkuKanonik, roli_synuar]);

  // Kërkesat dhe aftësitë e leximit shkojnë te puna vetëm nëse linku është ende ai që u lexua.
  const shpalljaELexuar = leximi.gjendja === "lexuar" && leximi.shpallja.linku === linkuKanonik ? leximi.shpallja : null;
  const tekstiNgaLeximi = teksti !== "" && shpalljaELexuar !== null && teksti === shpalljaELexuar.pershkrimi;

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
      const provaEDyte = dergoi.current;
      dergoi.current = true;
      const { puna, ekzistonte } = await meKohe(
        shtoPunenNgaLinku(
          {
            linku,
            titulli,
            kompania,
            qyteti,
            pershkrimi: teksti,
            kerkesat: shpalljaELexuar?.kerkesat ?? null,
            aftesite: shpalljaELexuar?.aftesite ?? [],
          },
          roli_synuar ?? "Tjetër",
        ),
        KOHA_E_NGARKIMIT,
        VONON.shtimi,
      );
      if (ekzistonte && !(provaEDyte && puna.private)) {
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
        Ke gjetur një punë diku tjetër? Ngjit linkun e shpalljes: e lexojmë vetë dhe i plotësojmë fushat. Puna shihet vetëm
        nga ti.
      </T>
      <ShiritiPaInternet teksti={paInternet("të dhënat e formularit mbeten aty", false).cfare} />

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
      {linkuKanonik && leximi.gjendja !== "bosh" && (
        <View style={styles.leximi} accessibilityLiveRegion="polite">
          {leximi.gjendja === "duke_lexuar" && <ActivityIndicator size="small" color={t.zbehur} />}
          <T madhesia={13} zbehur={leximi.gjendja !== "deshtoi"} style={styles.leximiTeksti}>
            {leximi.gjendja === "duke_lexuar"
              ? "Po e lexojmë shpalljen..."
              : leximi.gjendja === "deshtoi"
                ? `${leximi.mesazhi} Plotëso fushat vetë dhe ngjit tekstin e shpalljes më poshtë.`
                : leximi.shpallja.kerkesat
                  ? "E lexuam shpalljen dhe i plotësuam fushat. Kontrolloji para se ta shtosh."
                  : "E lexuam faqen, por s'i nxorëm dot kërkesat. Ngjit tekstin e shpalljes më poshtë."}
          </T>
        </View>
      )}

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
        {tekstiNgaLeximi
          ? "E përmblodhëm nga shpallja me fjalët tona. Mund ta ndryshosh ose ta zëvendësosh me tekstin e plotë."
          : "Kopjo tekstin nga shpallja dhe ngjite këtu. Me të, “A jam gati?” e di saktë çka kërkon puna."}
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
        <T ngjyra={eRrjetit ? t.teksti : t.keq} style={styles.gabimi} accessibilityLiveRegion="polite">
          {eRrjetit
            ? eshteGabimKohe(gabimi) && !eshteGabimRrjeti(gabimi)
              ? `${VONON.titulli}. ${gabimi} ${VONON.bere}`
              : gabimi
            : `S'u shtua: ${gabimi}`}
        </T>
      )}

      <Animated.View style={stiliIButonit}>
        <ButoniKryesor
          teksti={eRrjetit ? "Provo përsëri" : "Shto punën"}
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
  leximi: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  leximiTeksti: { flex: 1 },
});
