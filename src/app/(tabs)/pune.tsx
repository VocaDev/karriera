import { Link, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, LinearTransition, useReducedMotion } from "react-native-reanimated";

import KartaPunes from "@/components/KartaPunes";
import { useNjoftim } from "@/components/Njoftimet";
import Prekshme from "@/components/Prekshme";
import { KartaSkelet } from "@/components/Skeleti";
import { Faqja, T, Titulli } from "@/components/ui";
import { KOHA, LEHTESIMI } from "@/lib/levizja";
import { prekja } from "@/lib/prekja";
import { degjoPunetERe, listoPunet, merrPunenERe, type Puna } from "@/lib/punet";
import { hiqeNgaTeRuajturat, listoTeRuajturat, ruajPunen } from "@/lib/ruajtura";
import { useTema } from "@/lib/tema";

// Kur lista ndryshon (p.sh. erdhi një punë e re lart), kartat e tjera rrëshqasin poshtë në vend që të kërcejnë.
const LEVIZJA_E_LISTES = LinearTransition.duration(KOHA.mesme).easing(LEHTESIMI.levizje);
const HYRJA_E_PUNES_SE_RE = FadeIn.duration(320).easing(LEHTESIMI.hyrje);

// Punët (bordi, ekrani 09), vetëm për kërkuesin: lexon, ruan me ⭐, s'poston (këtë e bën punëdhënësi).
// Kërkimi dhe chip-at e filtrave i shton Edoniku këtu.
export default function Punet() {
  const t = useTema();
  const qetesi = useReducedMotion();
  const njofto = useNjoftim();
  const [punet, setPunet] = useState<Puna[] | null>(null); // null = ende pa ardhur
  const [gabimi, setGabimi] = useState<string | null>(null);
  const [rifreskim, setRifreskim] = useState(false);
  const [ePunesSeRe, setEPunesSeRe] = useState<string | null>(null);
  const [teRuajturat, setTeRuajturat] = useState<Set<string>>(() => new Set());

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
    <View style={styles.koka}>
      <Titulli>Punët</Titulli>
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
        data={punet ?? []}
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
  koka: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  lista: { padding: 18, gap: 10, paddingBottom: 120 },
  skeletet: { gap: 10 },
  gabimi: { alignItems: "center", gap: 8, paddingTop: 40, paddingHorizontal: 12 },
  bosh: { alignItems: "center", gap: 6, paddingTop: 48 },
  qendroj: { textAlign: "center" },
  butoni: { marginTop: 8, borderRadius: 999, paddingVertical: 13, paddingHorizontal: 26, minHeight: 44, justifyContent: "center" },
});
