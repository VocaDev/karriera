import { Link, useFocusEffect, useRouter } from "expo-router";
import { SegmentedControl } from "@expo/ui/community/segmented-control";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, TextInput, View } from "react-native";
import Animated, { FadeIn, LinearTransition, useReducedMotion } from "react-native-reanimated";

import KartaPunes from "@/components/KartaPunes";
import { useNjoftim } from "@/components/Njoftimet";
import Prekshme from "@/components/Prekshme";
import ShiritiPaInternet from "@/components/ShiritiPaInternet";
import { KartaSkelet } from "@/components/Skeleti";
import { GradientiSiper } from "@/components/TabEkrani";
import { IKONAT, Ikona, T } from "@/components/ui";
import {
  gjejQytetinTim,
  lejaEVendndodhjes,
  useAferMejeAktiv,
  useQytetiIm,
  vendosAferMeje,
} from "@/lib/afer-meje";
import { cvEFundit, gatishmeriaPerPune } from "@/lib/gati";
import { KOHA, LEHTESIMI } from "@/lib/levizja";
import { useKycja } from "@/lib/mysafiri";
import { prekja } from "@/lib/prekja";
import { vendiIPunes } from "@/lib/qytetet";
import { degjoPunetERe, listoPunet, merrPunenERe, type Puna } from "@/lib/punet";
import { lexoListenEPunes, ruajListenEPunes } from "@/lib/punet-kesh";
import { hiqeNgaTeRuajturat, listoTeRuajturat, ruajPunen } from "@/lib/ruajtura";
import { paInternet, tekstiIPlote, VONON } from "@/lib/mesazhet";
import { eshteGabimKohe, eshteGabimRrjeti, KOHA_E_LEXIMIT, meKohe, useRrjeti } from "@/lib/rrjeti";
import { useSesioni } from "@/lib/sesioni";
import { SHKRONJAT, useTema } from "@/lib/tema";

// Kur lista ndryshon (p.sh. erdhi një punë e re lart), kartat e tjera rrëshqasin poshtë në vend që të kërcejnë.
const LEVIZJA_E_LISTES = LinearTransition.duration(KOHA.mesme).easing(LEHTESIMI.levizje);
const HYRJA_E_PUNES_SE_RE = FadeIn.duration(320).easing(LEHTESIMI.hyrje);

// Filtri i rolit (AGENTS.md, "Native feel" #6): kontrolli i segmentuar i sistemit, 3 zgjedhje.
// "Zyrë" = Asistent/PR. Punët "Tjetër" dalin vetëm te "Të gjitha".
const ROLET = [
  { emri: "Të gjitha", roli: null },
  { emri: "SWE", roli: "SWE" },
  { emri: "Zyrë", roli: "Asistent/PR" },
] as const satisfies readonly { emri: string; roli: Puna["roli"] | null }[];

/**
 * "Afër meje": 0 = qyteti yt, 1 = nga distanca ose për gjithë Kosovën (dalin gjithmonë, pas qytetit), null = jo afër.
 * Krahasimi bëhet në telefon me emrat e komunave (src/lib/qytetet.ts), pa koordinata.
 */
function renditjaAferMeje(qytetiIPunes: string, qytetiIm: string): 0 | 1 | null {
  const v = vendiIPunes(qytetiIPunes);
  if (v.qyteti === qytetiIm) return 0;
  return v.distance || v.gjitheKosova ? 1 : null;
}

// Kërkimi pa shenja: "prishtine" gjen "Prishtinë", "zyre" gjen "Zyrë".
function normalizo(teksti: string): string {
  return teksti
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Mesazhet e rrjetit (mesazhet.ts): lista që pe herën e fundit mbetet në ekran, ose s'ka ende asnjë të ruajtur.
const PA_INTERNET_ME_LISTE = paInternet("po t'i shfaqim punët që i pe herën e fundit");
const PA_INTERNET_PA_LISTE = paInternet("s'kemi ende punë të ruajtura për t'i shfaqur");

// Punët (bordi, ekrani 09), për kërkuesin dhe mysafirin: lexon, ruan me ⭐, s'poston (këtë e bën punëdhënësi).
// Mysafiri lexon punët publike aktive (RLS anon); ⭐ i tij hap fletën "Krijo llogari që të ruash punët".
// Kërkimi dhe filtri i rolit: Edoniku.
export default function Punet() {
  const t = useTema();
  const qetesi = useReducedMotion();
  const njofto = useNjoftim();
  const { mysafir } = useSesioni();
  const { kyc } = useKycja();
  const [punet, setPunet] = useState<Puna[] | null>(null); // null = ende pa ardhur
  const [gabimi, setGabimi] = useState<string | null>(null);
  const [rifreskim, setRifreskim] = useState(false);
  const [ePunesSeRe, setEPunesSeRe] = useState<string | null>(null);
  const [teRuajturat, setTeRuajturat] = useState<Set<string>>(() => new Set());
  const [kerkimi, setKerkimi] = useState("");
  const [iRolit, setIRolit] = useState(0); // indeksi te ROLET
  // "A jam gati?" te kartat: përqindja e fundit për çdo punë dhe a ka CV. Shtesë: pa internet kartat mbeten si më parë.
  const [gatiPerPune, setGatiPerPune] = useState<Map<string, number>>(() => new Map());
  const [kaCv, setKaCv] = useState(false);
  // "Afër meje" (J10): qyteti ruhet vetëm në telefon; filtri vlen derisa ta fikësh ose të mbyllet app-i.
  const router = useRouter();
  const qytetiIm = useQytetiIm();
  const aferMejeNdezur = useAferMejeAktiv();
  const aferMeje = aferMejeNdezur && qytetiIm !== null;
  const [dukeGjeturQytetin, setDukeGjeturQytetin] = useState(false);

  // Kërkimi dhe roli; "Afër meje" sipër tyre (numri te chip-i numëron punët afër me këta filtra).
  const punetPaVendin = useMemo(() => {
    if (punet === null) return null;
    const fjala = normalizo(kerkimi);
    const roli = ROLET[iRolit].roli;
    return punet.filter(
      (p) =>
        (roli === null || p.roli === roli) &&
        (fjala === "" || normalizo(`${p.titulli} ${p.kompania} ${p.qyteti}`).includes(fjala)),
    );
  }, [punet, kerkimi, iRolit]);
  const punetAferMeje = useMemo(() => {
    if (punetPaVendin === null || qytetiIm === null) return null;
    // Qyteti yt lart, pastaj punët nga distanca; brenda secilit grup mbetet renditja (më të rejat lart).
    return punetPaVendin
      .map((p) => ({ p, r: renditjaAferMeje(p.qyteti, qytetiIm) }))
      .filter((x) => x.r !== null)
      .sort((a, b) => (a.r ?? 0) - (b.r ?? 0))
      .map((x) => x.p);
  }, [punetPaVendin, qytetiIm]);
  const punetEFiltruara = aferMeje ? punetAferMeje : punetPaVendin;
  const kaFiltra = kerkimi.trim() !== "" || iRolit !== 0 || aferMeje;

  function pastroFiltrat() {
    prekja.zgjedhje();
    setKerkimi("");
    setIRolit(0);
    vendosAferMeje(false);
  }

  // Leja kërkohet vetëm këtu, kur prek chip-in. Me qytet të ruajtur: ndizet menjëherë. Pa qytet, me leje të dhënë
  // më parë: qyteti gjendet pa fletë. Përndryshe fleta shpjegon pse (një fjali), pastaj pyet sistemi, ose zgjedh me dorë.
  async function prekAferMeje() {
    if (dukeGjeturQytetin) return;
    prekja.zgjedhje();
    if (aferMeje) {
      vendosAferMeje(false);
      return;
    }
    if (qytetiIm) {
      vendosAferMeje(true);
      return;
    }
    if ((await lejaEVendndodhjes()) === "dhene") {
      setDukeGjeturQytetin(true);
      const gjetja = await gjejQytetinTim();
      setDukeGjeturQytetin(false);
      if (gjetja.lloji === "gjetur") {
        vendosAferMeje(true);
        njofto(`Afër meje: ${gjetja.qyteti}`, "sukses");
        return;
      }
    }
    router.push("/pune/qyteti");
  }

  // Kthen "ok", "rrjeti" (pa internet), "vonese" (s'u përgjigj në kohë; të dyja: lista e fundit mbetet në ekran) ose "gabim".
  const ngarko = useCallback(async (ngaPerdoruesi: boolean): Promise<"ok" | "rrjeti" | "vonese" | "gabim"> => {
    try {
      // Mysafiri s'ka ⭐ (tabela e të ruajturave s'lejon anon): bashkësi bosh, pa thirrje.
      const [teReja, yjet] = await meKohe(
        Promise.all([listoPunet(mysafir), mysafir ? Promise.resolve(new Set<string>()) : listoTeRuajturat()]),
        KOHA_E_LEXIMIT,
      );
      const iRi = merrPunenERe();
      setPunet(teReja);
      setTeRuajturat(yjet);
      setGabimi(null);
      if (iRi) setEPunesSeRe(iRi);
      ruajListenEPunes(teReja); // pa sesion s'ruan asgjë: lista e mysafirit s'përzihet me atë të një llogarie
      if (mysafir) {
        setGatiPerPune(new Map());
        setKaCv(false);
        return "ok";
      }
      Promise.all([gatishmeriaPerPune(), cvEFundit()])
        .then(([gati, cv]) => {
          setGatiPerPune(gati);
          setKaCv(cv !== null);
        })
        .catch(() => {
          // shtesë: kartat mbeten pa përqindje
        });
      return "ok";
    } catch (e) {
      setGabimi(e instanceof Error ? e.message : "Gabim i panjohur");
      if (ngaPerdoruesi) prekja.gabim();
      const rrjeti = eshteGabimRrjeti(e);
      const vonese = !rrjeti && eshteGabimKohe(e);
      // Pa internet (ose pa përgjigje në kohë) dhe pa listë në memorie (p.sh. app-i u hap offline): lista e fundit e ruajtur në telefon.
      if (rrjeti || vonese) {
        const ruajtur = await lexoListenEPunes();
        if (ruajtur) setPunet((lista) => lista ?? ruajtur);
      }
      return rrjeti ? "rrjeti" : vonese ? "vonese" : "gabim";
    }
  }, [mysafir]);

  // Rilexon sa herë që ekrani shfaqet (p.sh. pasi kthehesh nga "Shto punë").
  useFocusEffect(
    useCallback(() => {
      ngarko(false);
    }, [ngarko]),
  );

  // Interneti u kthye: rifreskon vetë, pa pritur që përdoruesi të tërheqë ose të prekë "Provo përsëri".
  const { kaInternet } = useRrjeti(() => {
    ngarko(false);
  });

  // Një punëdhënës sapo postoi: puna hyn lart në listë, pa rifreskim (Supabase Realtime). Vetëm me llogari.
  useEffect(() => {
    if (mysafir) return;
    return degjoPunetERe("lista-e-puneve", (puna) => {
      setPunet((lista) => (lista === null || lista.some((p) => p.id === puna.id) ? lista : [puna, ...lista]));
      setEPunesSeRe(puna.id);
    });
  }, [mysafir]);

  // ⭐ ndryshon menjëherë në ekran; nëse serveri refuzon, kthehet si ishte dhe del njoftimi.
  async function ndryshoRuajtjen(id: string, ruaje: boolean) {
    const ndrysho = (vendos: boolean) =>
      setTeRuajturat((yjet) => {
        const tjetra = new Set(yjet);
        if (vendos) tjetra.add(id);
        else tjetra.delete(id);
        return tjetra;
      });
    ndrysho(ruaje);
    try {
      if (ruaje) await ruajPunen(id);
      else await hiqeNgaTeRuajturat(id);
    } catch (e) {
      ndrysho(!ruaje);
      prekja.gabim();
      njofto(e instanceof Error ? e.message : "S'u ruajt.", "gabim");
    }
  }

  // Tërheqja poshtë: rrotullimi i sistemit qëndron sa zgjat leximi i vërtetë nga Supabase.
  async function rifresko() {
    if (!kaInternet) {
      // Pa internet s'ka çka të pritet: asnjë rrotë, vetëm njoftimi; lista e fundit mbetet në ekran.
      prekja.gabim();
      njofto(PA_INTERNET_ME_LISTE.cfare, "gabim");
      return;
    }
    setRifreskim(true);
    const rezultati = await ngarko(true);
    setRifreskim(false);
    if (rezultati === "rrjeti") njofto(PA_INTERNET_ME_LISTE.cfare, "gabim");
    else if (rezultati === "vonese") njofto(`${VONON.titulli}. ${VONON.bere}`, "gabim");
    else if (rezultati === "gabim" && punet !== null) njofto("S'u rifreskuan punët. Provo përsëri.", "gabim");
  }

  async function provoPerseri() {
    setGabimi(null); // shfaqen sërish skeletet gjatë leximit
    await ngarko(true);
  }

  // Koka e listës: titulli "Punët" është titulli i madh i Stack-ut të tab-it. Pa "+": kërkuesi s'poston punë.
  const koka = (
    <View style={styles.kokaEPlote}>
      <GradientiSiper brenda={18} />
      {punet !== null && (
        <ShiritiPaInternet teksti={tekstiIPlote(PA_INTERNET_ME_LISTE)} style={styles.shiritiNeListe} />
      )}
      <View style={[styles.kerkimi, { backgroundColor: t.karta, borderColor: t.vija }]}>
        <Ikona emri={IKONAT.kerko} madhesia={17} ngjyra={t.zbehur} />
        <TextInput
          value={kerkimi}
          onChangeText={setKerkimi}
          placeholder="Kërko punë, kompani ose qytet"
          placeholderTextColor={t.zbehur}
          style={[styles.fusha, { color: t.teksti }]}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
          accessibilityLabel="Kërko punë"
        />
      </View>
      <SegmentedControl
        values={ROLET.map((r) => r.emri)}
        selectedIndex={iRolit}
        onChange={(e) => {
          prekja.zgjedhje();
          setIRolit(e.nativeEvent.selectedSegmentIndex);
        }}
        appearance={t.errët ? "dark" : "light"}
        accessibilityLabel="Filtri i rolit"
      />
      <View style={styles.chipet}>
        <Prekshme
          onPress={prekAferMeje}
          accessibilityRole="button"
          accessibilityState={{ selected: aferMeje, busy: dukeGjeturQytetin }}
          accessibilityLabel={aferMeje ? `Afër meje, ${qytetiIm}, ndezur` : "Afër meje"}
          accessibilityHint={aferMeje ? "Fik filtrin" : "Shfaq punët në qytetin tënd dhe ato nga distanca"}
          hitSlop={{ top: 5, bottom: 5 }}
          style={[
            styles.chip,
            { backgroundColor: aferMeje ? t.teksti : t.karta, shadowColor: t.hija },
            !t.errët && !aferMeje && styles.chipHija,
          ]}
        >
          {dukeGjeturQytetin ? (
            <ActivityIndicator size="small" color={t.zbehur} />
          ) : (
            <Ikona emri={IKONAT.pin} madhesia={14} ngjyra={aferMeje ? t.sfondi : t.teksti} />
          )}
          <T pesha="gjysme" madhesia={14} ngjyra={aferMeje ? t.sfondi : t.teksti}>
            Afër meje
          </T>
          {punetAferMeje !== null && (
            <View style={[styles.numri, { backgroundColor: aferMeje ? t.zbehur : t.karta2 }]}>
              <T pesha="trashe" madhesia={11.5} ngjyra={aferMeje ? t.sfondi : t.teksti}>
                {punetAferMeje.length}
              </T>
            </View>
          )}
        </Prekshme>
        {aferMeje && (
          <Prekshme
            onPress={() => router.push("/pune/qyteti")}
            accessibilityRole="button"
            accessibilityLabel={`Qyteti: ${qytetiIm}, bashkë me punët nga distanca. Ndrysho`}
            hitSlop={{ top: 5, bottom: 5 }}
            style={styles.ndrysho}
          >
            <T zbehur madhesia={13.5} numberOfLines={1}>
              {qytetiIm} ·{" "}
              <T pesha="gjysme" madhesia={13.5}>
                Ndrysho
              </T>
            </T>
          </Prekshme>
        )}
      </View>
    </View>
  );

  const paInternetPaListe = punet === null && (!kaInternet || (gabimi !== null && eshteGabimRrjeti(gabimi)));

  const kurSkaPune =
    punet === null ? (
      paInternetPaListe ? (
        <View style={styles.gabimi}>
          <T pesha="trashe" madhesia={16}>
            {PA_INTERNET_PA_LISTE.titulli}
          </T>
          <T zbehur madhesia={14} style={styles.qendroj} accessibilityLiveRegion="polite">
            {tekstiIPlote(PA_INTERNET_PA_LISTE)}
          </T>
          <Prekshme onPress={provoPerseri} accessibilityRole="button" style={[styles.butoni, { backgroundColor: t.teksti }]}>
            <T pesha="trashe" madhesia={15} ngjyra={t.sfondi}>
              Provo përsëri
            </T>
          </Prekshme>
        </View>
      ) : gabimi ? (
        <View style={styles.gabimi}>
          <T pesha="trashe" madhesia={16}>
            {eshteGabimKohe(gabimi) ? VONON.titulli : "S'u lexuan punët"}
          </T>
          <T zbehur madhesia={14} style={styles.qendroj}>
            {eshteGabimKohe(gabimi) ? `${gabimi} ${VONON.bere}` : gabimi}
          </T>
          <Prekshme onPress={provoPerseri} accessibilityRole="button" style={[styles.butoni, { backgroundColor: t.teksti }]}>
            <T pesha="trashe" madhesia={15} ngjyra={t.sfondi}>
              Provo përsëri
            </T>
          </Prekshme>
        </View>
      ) : (
        <View style={styles.skeletet} accessibilityLabel="Po ngarkohen punët">
          {[0, 1, 2, 3].map((i) => (
            <KartaSkelet key={i} />
          ))}
        </View>
      )
    ) : kaFiltra && punet.length > 0 ? (
      <View style={styles.bosh}>
        <T pesha="trashe" madhesia={16}>
          {aferMeje ? `Asnjë punë në ${qytetiIm} ende` : "Asnjë punë s'përputhet"}
        </T>
        <T zbehur madhesia={14} style={styles.qendroj}>
          {aferMeje
            ? "Punët nga distanca dalin edhe këtu. Fik \"Afër meje\" ose ndrysho qytetin për të parë të tjerat."
            : "Provo një fjalë tjetër ose një rol tjetër."}
        </T>
        <Prekshme onPress={pastroFiltrat} accessibilityRole="button" style={[styles.butoni, { backgroundColor: t.teksti }]}>
          <T pesha="trashe" madhesia={15} ngjyra={t.sfondi}>
            Pastro filtrat
          </T>
        </Prekshme>
      </View>
    ) : (
      <View style={styles.bosh}>
        <T pesha="trashe" madhesia={16}>
          Ende s&apos;ka shpallje
        </T>
        <T zbehur madhesia={14} style={styles.qendroj}>
          Kur një punëdhënës poston, puna del këtu menjëherë.
        </T>
      </View>
    );

  return (
    <Animated.FlatList
      style={[styles.flex, { backgroundColor: t.sfondi }]}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.lista}
      data={punetEFiltruara ?? []}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      keyExtractor={(item) => item.id}
      refreshing={rifreskim}
      onRefresh={rifresko}
      itemLayoutAnimation={qetesi ? undefined : LEVIZJA_E_LISTES}
      ListHeaderComponent={koka}
      ListEmptyComponent={kurSkaPune}
      renderItem={({ item }) => (
        <Animated.View entering={item.id === ePunesSeRe && !qetesi ? HYRJA_E_PUNES_SE_RE : undefined}>
          <Link href={`/pune/${item.id}`} asChild>
            <KartaPunes
              puna={item}
              ruajtur={teRuajturat.has(item.id)}
              gatishmeria={gatiPerPune.get(item.id) ?? null}
              kaCv={kaCv}
              ylliIKycur={mysafir}
              kurNdryshonRuajtja={(ruaje) =>
                // Mysafiri: pas hyrjes puna ruhet vetë dhe ai kthehet te lista.
                mysafir ? kyc("ruaj", null, { lloji: "ruaj", punaId: item.id }) : ndryshoRuajtjen(item.id, ruaje)
              }
            />
          </Link>
        </Animated.View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  kokaEPlote: { gap: 12, marginBottom: 4 },
  shiritiNeListe: { marginBottom: 0 }, // hapësirën e jep "gap" i kokës
  flex: { flex: 1 },
  kerkimi: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  fusha: { flex: 1, fontFamily: SHKRONJAT.normal, fontSize: 15, paddingVertical: 10 },
  // Chip-i i bordit (drejtimi D): 34 pt i lartë, i rrumbullakët, hije shumë e lehtë në temën e çelët.
  chipet: { flexDirection: "row", alignItems: "center", gap: 10 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, height: 34, paddingHorizontal: 14, borderRadius: 999 },
  chipHija: { shadowOpacity: 0.06, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  numri: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  ndrysho: { flexShrink: 1, minHeight: 34, justifyContent: "center" },
  lista: { padding: 18, gap: 10, paddingBottom: 120 },
  skeletet: { gap: 10 },
  gabimi: { alignItems: "center", gap: 8, paddingTop: 40, paddingHorizontal: 12 },
  bosh: { alignItems: "center", gap: 6, paddingTop: 48 },
  qendroj: { textAlign: "center" },
  butoni: { marginTop: 8, borderRadius: 999, paddingVertical: 13, paddingHorizontal: 26, minHeight: 44, justifyContent: "center" },
});
