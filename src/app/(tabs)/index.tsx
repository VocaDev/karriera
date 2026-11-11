import { Link, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";

import Prekshme from "@/components/Prekshme";
import RreshtiVecorise from "@/components/RreshtiVecorise";
import { Pulsi, Vije } from "@/components/Skeleti";
import { Faqja, IKONAT, Ikona, Karta, Progresi, T, Titulli } from "@/components/ui";
import { listoPunet, type Puna } from "@/lib/punet";
import { useSesioni } from "@/lib/sesioni";
import { useTema } from "@/lib/tema";
import { VECORITE } from "@/lib/vecorite";

const DITET = ["E diel", "E hënë", "E martë", "E mërkurë", "E enjte", "E premte", "E shtunë"];
const MUAJT = ["janar", "shkurt", "mars", "prill", "maj", "qershor", "korrik", "gusht", "shtator", "tetor", "nëntor", "dhjetor"];

function dataSot(): string {
  const d = new Date();
  return `${DITET[d.getDay()]}, ${d.getDate()} ${MUAJT[d.getMonth()]}`;
}

// Kreu (bordi, ekrani 41): data, rruga e HARTA-s si listë hapash me gjendjen reale,
// dhe punët e fundit nga Supabase. Streak-u dhe plani ditor vijnë më vonë, prandaj tregojnë 0.
export default function Sot() {
  const { profili } = useSesioni();
  const t = useTema();
  const [punet, setPunet] = useState<Puna[] | null>(null);
  const [gabimi, setGabimi] = useState<string | null>(null);

  const ngarko = useCallback(async () => {
    setGabimi(null);
    try {
      setPunet(await listoPunet());
    } catch (e) {
      setGabimi(e instanceof Error ? e.message : "Gabim i panjohur");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      ngarko();
    }, [ngarko]),
  );

  const gati = VECORITE.filter((v) => v.gjendja.lloji === "gati").length;
  const iRadhes = VECORITE.find((v) => v.gjendja.lloji !== "gati");

  return (
    <Faqja>
      <View style={styles.koka}>
        <View>
          <T zbehur madhesia={14}>
            {dataSot()}
          </T>
          <Titulli>Sot</Titulli>
        </View>
        <View style={[styles.streak, { backgroundColor: t.karta }]} accessibilityLabel="Streak: 0 ditë">
          <Ikona emri={IKONAT.flaka} madhesia={15} ngjyra={t.theksi} />
          <T pesha="trashe" madhesia={15} ngjyra={t.theksi}>
            0
          </T>
        </View>
      </View>

      <Karta style={styles.qellimi}>
        <View style={styles.rresht}>
          <T zbehur madhesia={14} style={styles.flex}>
            Rruga drejt punës
          </T>
          <T pesha="trashe" madhesia={13} ngjyra={t.theksi}>
            {gati} nga {VECORITE.length} gati
          </T>
        </View>
        <Progresi vlera={gati / VECORITE.length} />
        <View style={styles.rresht}>
          <T zbehur madhesia={13} style={styles.flex}>
            Hapi tjetër: {iRadhes ? iRadhes.titulli : "asnjë"}
          </T>
          <T zbehur madhesia={13} numberOfLines={1}>
            {profili?.emri}
          </T>
        </View>
      </Karta>

      <Karta style={styles.lista}>
        {VECORITE.map((v, i) => (
          <RreshtiVecorise key={v.celesi} vecoria={v} iFundit={i === VECORITE.length - 1} />
        ))}
      </Karta>

      <Link href="/pune" asChild>
        <Prekshme accessibilityRole="button" accessibilityLabel="Hap listën e punëve">
          <Karta style={styles.rreshtKarte}>
            <Ikona emri={IKONAT.canta} madhesia={20} ngjyra={t.theksi} />
            <View style={styles.flex}>
              {gabimi ? (
                <>
                  <T pesha="trashe" madhesia={15.5}>
                    S&apos;u lexuan punët
                  </T>
                  <T zbehur madhesia={13}>
                    Hape listën për të provuar përsëri
                  </T>
                </>
              ) : punet === null ? (
                <Pulsi>
                  <View style={styles.skeleti} accessibilityLabel="Po ngarkohen punët">
                    <Vije gjeresia="55%" lartesia={16} />
                    <Vije gjeresia="85%" lartesia={12} />
                  </View>
                </Pulsi>
              ) : (
                <>
                  <T pesha="trashe" madhesia={15.5}>
                    {punet.length} punë në Karriera
                  </T>
                  <T zbehur madhesia={13} numberOfLines={1}>
                    {punet.length === 0
                      ? "Ende s'ka shpallje"
                      : punet
                          .slice(0, 2)
                          .map((p) => p.titulli)
                          .join(" · ")}
                  </T>
                </>
              )}
            </View>
            <Ikona emri={IKONAT.shigjeta} madhesia={14} ngjyra={t.zbehur} />
          </Karta>
        </Prekshme>
      </Link>
    </Faqja>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  koka: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 2 },
  streak: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  qellimi: { gap: 10 },
  rresht: { flexDirection: "row", alignItems: "center", gap: 8 },
  lista: { padding: 0, overflow: "hidden" },
  rreshtKarte: { flexDirection: "row", alignItems: "center", gap: 12 },
  skeleti: { gap: 7, paddingVertical: 2 },
});
