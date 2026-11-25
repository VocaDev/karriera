// Pëlqimi i kërkuesit: "Lejo punëdhënësit të më shohin anonimisht kur jam gati për punët e tyre".
// I fikur si parazgjedhje. Ruhet në server (dukshmeria, vetëm përmes vendos_dukshmerine); serveri e zbaton.
// Çelësi është i sistemit (i gjelbër, AGENTS.md "Native feel" #13). Nëse ruajtja dështon, kthehet vlera e vjetër.
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Switch, View } from "react-native";

import { useNjoftim } from "@/components/Njoftimet";
import { T } from "@/components/ui";
import { GabimPaAktivizim, merrDukshmerine, vendosDukshmerine } from "@/lib/kandidatet";
import { paInternet, VONON } from "@/lib/mesazhet";
import { prekja } from "@/lib/prekja";
import { KOHA_E_LEXIMIT, KOHA_E_NGARKIMIT, meKohe, useRrjeti } from "@/lib/rrjeti";
import { useTema } from "@/lib/tema";

export const TEKSTI_I_DUKSHMERISE = "Lejo punëdhënësit të më shohin anonimisht kur jam gati për punët e tyre";

type Gjendja =
  | { lloji: "ngarkim" }
  | { lloji: "gati"; anonim: boolean }
  | { lloji: "pa_aktivizim" }
  | { lloji: "gabim"; mesazhi: string };

export default function DukshmeriaRreshti() {
  const t = useTema();
  const njofto = useNjoftim();
  const [gjendja, setGjendja] = useState<Gjendja>({ lloji: "ngarkim" });
  const [duke_ruajtur, setDukeRuajtur] = useState(false);

  const lexo = useCallback(() => {
    let aktiv = true;
    meKohe(merrDukshmerine(), KOHA_E_LEXIMIT)
      .then((anonim) => aktiv && setGjendja({ lloji: "gati", anonim }))
      .catch((e: unknown) => {
        if (!aktiv) return;
        if (e instanceof GabimPaAktivizim) setGjendja({ lloji: "pa_aktivizim" });
        else setGjendja({ lloji: "gabim", mesazhi: e instanceof Error ? e.message : "S'u lexua zgjedhja." });
      });
    return () => {
      aktiv = false;
    };
  }, []);

  useEffect(lexo, [lexo]);
  // Interneti u kthye: rilexon nëse leximi i parë dështoi.
  const { kaInternet } = useRrjeti(() => {
    if (gjendja.lloji === "gabim") lexo();
  });

  async function ndrysho(vlera: boolean) {
    if (gjendja.lloji !== "gati" || duke_ruajtur) return;
    const i_vjeter = gjendja.anonim;
    if (!kaInternet) {
      prekja.gabim();
      njofto(paInternet("ndryshimi s'u ruajt", false).cfare, "gabim");
      return;
    }
    prekja.zgjedhje();
    setGjendja({ lloji: "gati", anonim: vlera });
    setDukeRuajtur(true);
    try {
      const ruajtur = await meKohe(vendosDukshmerine(vlera), KOHA_E_NGARKIMIT, VONON.profili);
      setGjendja({ lloji: "gati", anonim: ruajtur });
      prekja.sukses();
      njofto(ruajtur ? "Punëdhënësit të shohin anonimisht kur je gati" : "Punëdhënësit s'të shohin më", "sukses");
    } catch (e) {
      prekja.gabim();
      setGjendja({ lloji: "gati", anonim: i_vjeter });
      njofto(e instanceof Error ? e.message : "S'u ruajt. Provo përsëri.", "gabim");
    } finally {
      setDukeRuajtur(false);
    }
  }

  const ndezur = gjendja.lloji === "gati" && gjendja.anonim;
  const shenimi =
    gjendja.lloji === "pa_aktivizim"
      ? "Kjo zgjedhje s'është aktivizuar ende në server. Deri atëherë s'të sheh asnjë punëdhënës."
      : gjendja.lloji === "gabim"
        ? gjendja.mesazhi
        : null;

  return (
    <View style={styles.rreshti}>
      <View style={styles.teksti}>
        <T pesha="gjysme" madhesia={15} nativeID="dukshmeria-etiketa">
          {TEKSTI_I_DUKSHMERISE}
        </T>
        {shenimi && (
          <T zbehur madhesia={13} accessibilityLiveRegion="polite">
            {shenimi}
          </T>
        )}
      </View>
      {gjendja.lloji === "ngarkim" ? (
        <ActivityIndicator color={t.zbehur} accessibilityLabel="Po lexohet zgjedhja" />
      ) : (
        <Switch
          value={ndezur}
          onValueChange={ndrysho}
          disabled={gjendja.lloji !== "gati" || duke_ruajtur}
          accessibilityLabel={TEKSTI_I_DUKSHMERISE}
          accessibilityLabelledBy="dukshmeria-etiketa"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rreshti: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 56 },
  teksti: { flex: 1, gap: 4 },
});
