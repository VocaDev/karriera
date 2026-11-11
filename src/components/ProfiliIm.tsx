// Profili (bordi, ekrani 18): kush je, lloji i llogarisë, dhe "Dil". Për kërkuesin edhe ⭐ të ruajturat:
// lista private që e kthen RLS-i, pa asnjë filtër në kod (dëshmia e J6 "secili sheh të vetat").
import { Link, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";

import ButoniDil from "@/components/ButoniDil";
import Prekshme from "@/components/Prekshme";
import { Faqja, IKONAT, Ikona, Karta, T, Titulli } from "@/components/ui";
import { EMRAT_E_LLOJEVE } from "@/lib/hyrja";
import { listoTeRuajturatMePune, type PunaERuajtur } from "@/lib/ruajtura";
import { useSesioni } from "@/lib/sesioni";
import { useTema } from "@/lib/tema";

export default function ProfiliIm() {
  const t = useTema();
  const { sesioni, profili } = useSesioni();
  const kerkues = profili?.lloji === "kerkues";
  const [teRuajturat, setTeRuajturat] = useState<PunaERuajtur[] | null>(null);
  const [gabimi, setGabimi] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!kerkues) return;
      let aktiv = true;
      listoTeRuajturatMePune()
        .then((lista) => {
          if (!aktiv) return;
          setTeRuajturat(lista);
          setGabimi(null);
        })
        .catch((e: unknown) => aktiv && setGabimi(e instanceof Error ? e.message : "Gabim i panjohur"));
      return () => {
        aktiv = false;
      };
    }, [kerkues]),
  );

  if (!profili) return null;
  const ikona = profili.lloji === "kerkues" ? IKONAT.personi : profili.lloji === "qender" ? IKONAT.shkolla : IKONAT.canta;

  return (
    <Faqja>
      <Titulli>Profili</Titulli>

      <Karta style={styles.koka}>
        <View style={[styles.avatari, { backgroundColor: t.teksti }]}>
          <Ikona emri={ikona} madhesia={26} ngjyra={t.sfondi} />
        </View>
        <View style={styles.flex}>
          <T pesha="trashe" madhesia={17}>
            {profili.emri || "Pa emër"}
          </T>
          <T zbehur madhesia={13.5}>
            {sesioni?.user.email}
          </T>
          <View style={[styles.lloji, { backgroundColor: t.theksiButë }]}>
            <T pesha="gjysme" madhesia={12} ngjyra={t.theksi}>
              {EMRAT_E_LLOJEVE[profili.lloji]}
              {profili.organizata ? ` · ${profili.organizata}` : ""}
            </T>
          </View>
        </View>
      </Karta>

      {kerkues && (
        <Karta style={styles.teRuajturat}>
          <View style={styles.rreshti}>
            <Ikona emri={IKONAT.ylli} madhesia={18} ngjyra={t.theksi} />
            <T pesha="trashe" madhesia={16}>
              Të ruajturat{teRuajturat ? ` (${teRuajturat.length})` : ""}
            </T>
          </View>
          {gabimi ? (
            <T madhesia={13.5} ngjyra={t.keq}>
              {gabimi}
            </T>
          ) : teRuajturat === null ? (
            <T zbehur madhesia={13.5}>
              Po lexohen…
            </T>
          ) : teRuajturat.length === 0 ? (
            <T zbehur madhesia={13.5}>
              Prek ☆ te një punë për ta ruajtur këtu. I sheh vetëm ti.
            </T>
          ) : (
            teRuajturat.map((p) => (
              <Link key={p.puna_id} href={`/pune/${p.puna_id}`} asChild>
                <Prekshme style={StyleSheet.flatten([styles.puna, { borderTopColor: t.vija }])} accessibilityRole="button">
                  <View style={styles.flex}>
                    <T pesha="gjysme" madhesia={15}>
                      {p.titulli}
                    </T>
                    <T zbehur madhesia={13}>
                      {p.kompania}, {p.qyteti}
                    </T>
                  </View>
                  <Ikona emri={IKONAT.shigjeta} madhesia={14} ngjyra={t.zbehur} />
                </Prekshme>
              </Link>
            ))
          )}
        </Karta>
      )}

      <ButoniDil />
    </Faqja>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 3 },
  koka: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatari: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  lloji: { alignSelf: "flex-start", borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
  teRuajturat: { gap: 10 },
  rreshti: { flexDirection: "row", alignItems: "center", gap: 8 },
  puna: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 10,
    minHeight: 44,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
