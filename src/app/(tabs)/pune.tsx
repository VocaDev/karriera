import { Link, useFocusEffect } from "expo-router";
import SegmentedControl from "@expo/ui/community/segmented-control";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import Animated, { FadeIn, LinearTransition, useReducedMotion } from "react-native-reanimated";

import KartaPunes from "@/components/KartaPunes";
import { useNjoftim } from "@/components/Njoftimet";
import Prekshme from "@/components/Prekshme";
import { KartaSkelet } from "@/components/Skeleti";
import { Faqja, IKONAT, Ikona, T, Titulli } from "@/components/ui";
import { KOHA, LEHTESIMI } from "@/lib/levizja";
import { prekja } from "@/lib/prekja";
import { degjoPunetERe, listoPunet, merrPunenERe, type Puna } from "@/lib/punet";
import { hiqeNgaTeRuajturat, listoTeRuajturat, ruajPunen } from "@/lib/ruajtura";
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

// Kërkimi pa shenja: "prishtine" gjen "Prishtinë", "zyre" gjen "Zyrë".
function normalizo(teksti: string): string {
  return teksti
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Punët (bordi, ekrani 09), vetëm për kërkuesin: lexon, ruan me ⭐, s'poston (këtë e bën punëdhënësi).
// Kërkimi dhe filtri i rolit: Edoniku.
export default function Punet() {
  const t = useTema();
  const qetesi = useReducedMotion();
  const njofto = useNjoftim();
  const [punet, setPunet] = useState<Puna[] | null>(null); // null = ende pa ardhur
  const [gabimi, setGabimi] = useState<string | null>(null);
  const [rifreskim, setRifreskim] = useState(false);
  const [ePunesSeRe, setEPunesSeRe] = useState<string | null>(null);
  const [teRuajturat, setTeRuajturat] = useState<Set<string>>(() => new Set());
  const [kerkimi, setKerkimi] = useState("");
  const [iRolit, setIRolit] = useState(0); // indeksi te ROLET

  const punetEFiltruara = useMemo(() => {
    if (punet === null) return null;
    const fjala = normalizo(kerkimi);
    const roli = ROLET[iRolit].roli;
    return punet.filter(
      (p) =>
        (roli === null || p.roli === roli) &&
        (fjala === "" || normalizo(`${p.titulli} ${p.kompania} ${p.qyteti}`).includes(fjala)),
    );
  }, [punet, kerkimi, iRolit]);
  const kaFiltra = kerkimi.trim() !== "" || iRolit !== 0;

  function pastroFiltrat() {
    prekja.zgjedhje();
    setKerkimi("");
    setIRolit(0);
  }

  const ngarko = useCallback(async (ngaPerdoruesi: boolean) => {
    try {
      const [teReja, yjet] = await Promise.all([listoPunet(), listoTeRuajturat()]);
      const iRi = merrPunenERe();
      setPunet(teReja);
      setTeRuajturat(yjet);
      setGabimi(null);
      if (iRi) setEPunesSeRe(iRi);
      return true;
    } catch (e) {
      setGabimi(e instanceof Error ? e.message : "Gabim i panjohur");
      if (ngaPerdoruesi) prekja.gabim();
      return false;
    }
  }, []);

  // Rilexon sa herë që ekrani shfaqet (p.sh. pasi kthehesh nga "Shto punë").
  useFocusEffect(
    useCallback(() => {
      ngarko(false);
    }, [ngarko]),
  );

  // Një punëdhënës sapo postoi: puna hyn lart në listë, pa rifreskim (Supabase Realtime).
  useEffect(
    () =>
      degjoPunetERe("lista-e-puneve", (puna) => {
        setPunet((lista) => (lista === null || lista.some((p) => p.id === puna.id) ? lista : [puna, ...lista]));
        setEPunesSeRe(puna.id);
      }),
    [],
  );

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
    setRifreskim(true);
    const ok = await ngarko(true);
    setRifreskim(false);
    if (!ok && punet !== null) njofto("S'u rifreskuan punët. Provo përsëri.", "gabim");
  }

  async function provoPerseri() {
    setGabimi(null); // shfaqen sërish skeletet gjatë leximit
    await ngarko(true);
  }

  // Koka: në tab-a s'ka header, prandaj titulli është këtu (si në bord). Pa "+": kërkuesi s'poston punë.
  const koka = (
    <View style={styles.kokaEPlote}>
      <View style={styles.koka}>
        <Titulli>Punët</Titulli>
      </View>
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
    </View>
  );

  const kurSkaPune =
    punet === null ? (
      gabimi ? (
        <View style={styles.gabimi}>
          <T pesha="trashe" madhesia={16}>
            S&apos;u lexuan punët
          </T>
          <T zbehur madhesia={14} style={styles.qendroj}>
            {gabimi}
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
          Asnjë punë s&apos;përputhet
        </T>
        <T zbehur madhesia={14} style={styles.qendroj}>
          Provo një fjalë tjetër ose një rol tjetër.
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
    <Faqja pa_scroll>
      <Animated.FlatList
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
                kurNdryshonRuajtja={(ruaje) => ndryshoRuajtjen(item.id, ruaje)}
              />
            </Link>
          </Animated.View>
        )}
      />
    </Faqja>
  );
}

const styles = StyleSheet.create({
  kokaEPlote: { gap: 12, marginBottom: 4 },
  koka: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
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
  lista: { padding: 18, gap: 10, paddingBottom: 120 },
  skeletet: { gap: 10 },
  gabimi: { alignItems: "center", gap: 8, paddingTop: 40, paddingHorizontal: 12 },
  bosh: { alignItems: "center", gap: 6, paddingTop: 48 },
  qendroj: { textAlign: "center" },
  butoni: { marginTop: 8, borderRadius: 999, paddingVertical: 13, paddingHorizontal: 26, minHeight: 44, justifyContent: "center" },
});
