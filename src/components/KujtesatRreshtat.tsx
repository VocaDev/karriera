// Cilësimet → Njoftimet (J10): "Praktiko sot" me orën, dhe "Punë të reja për rolin tënd". Të dyja të fikura si
// parazgjedhje; leja e sistemit kërkohet vetëm kur ndez njërën. Çelësat janë të sistemit (AGENTS.md "Native feel" #13).
// Ora: zgjedhësi i sistemit (@expo/ui): kompakt në iPhone, dritare në Android.
import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { useEffect, useRef, useState } from "react";
import { Linking, Platform, StyleSheet, Switch, View } from "react-native";

import { useNjoftim } from "@/components/Njoftimet";
import Prekshme from "@/components/Prekshme";
import { T } from "@/components/ui";
import {
  fikKujtesenDitore,
  fikPunetERe,
  lejaEshteDhene,
  MBESHTETEN_NJOFTIMET,
  ndizKujtesenDitore,
  ndizPunetERe,
  ndryshoOrenEKujteses,
  useCilesimetEKujtesave,
  type LejaENjoftimeve,
} from "@/lib/kujtesat";
import { prekja } from "@/lib/prekja";
import { useTema } from "@/lib/tema";

const dyShifra = (n: number) => String(n).padStart(2, "0");
const ora = (o: number, m: number) => `${dyShifra(o)}:${dyShifra(m)}`;

export default function KujtesatRreshtat({ emriIRolit }: { emriIRolit: string }) {
  const t = useTema();
  const njofto = useNjoftim();
  const c = useCilesimetEKujtesave();
  const [duke_ndryshuar, setDukeNdryshuar] = useState(false);
  const [refuzuar, setRefuzuar] = useState(false);
  const [zgjedhesiHapur, setZgjedhesiHapur] = useState(false); // vetëm Android: dritarja e orës
  const vonesa = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Një kujtesë e ndezur, por leja u hoq te cilësimet e telefonit: e themi, që të mos presë diçka që s'vjen.
  const kaTeNdezura = c.ditore || c.punetERe;
  useEffect(() => {
    if (!kaTeNdezura) return;
    let aktiv = true;
    lejaEshteDhene().then((dhene) => aktiv && setRefuzuar(!dhene));
    return () => {
      aktiv = false;
    };
  }, [kaTeNdezura]);

  useEffect(
    () => () => {
      if (vonesa.current) clearTimeout(vonesa.current);
    },
    [],
  );

  if (!MBESHTETEN_NJOFTIMET) {
    return (
      <View style={styles.rreshti}>
        <T zbehur madhesia={14}>
          Kujtesat punojnë vetëm në telefon (iPhone ose Android).
        </T>
      </View>
    );
  }

  function pasLejes(leja: LejaENjoftimeve, mesazhi: string) {
    if (leja === "dhene") {
      setRefuzuar(false);
      prekja.sukses();
      njofto(mesazhi, "sukses");
      return;
    }
    prekja.gabim();
    if (leja === "refuzuar") {
      setRefuzuar(true);
      njofto("Njoftimet janë të fikura për Karrierën te telefoni.", "gabim");
    } else {
      njofto("S'u ndez kujtesa. Provo përsëri.", "gabim");
    }
  }

  async function ndryshoDitoren(vlera: boolean) {
    if (duke_ndryshuar) return;
    prekja.zgjedhje();
    setDukeNdryshuar(true);
    if (vlera) pasLejes(await ndizKujtesenDitore(), `Kujtesa çdo ditë në ${ora(c.ora, c.minuta)}`);
    else await fikKujtesenDitore();
    setDukeNdryshuar(false);
  }

  async function ndryshoPunet(vlera: boolean) {
    if (duke_ndryshuar) return;
    prekja.zgjedhje();
    setDukeNdryshuar(true);
    if (vlera) pasLejes(await ndizPunetERe(), "Do të të njoftojmë për punë të reja");
    else await fikPunetERe();
    setDukeNdryshuar(false);
  }

  // iPhone: zgjedhësi raporton çdo lëvizje; planifikimi bëhet pasi ndalet (pa njoftim për çdo minutë).
  function zgjidhOren(data: Date) {
    const o = data.getHours();
    const m = data.getMinutes();
    if (o === c.ora && m === c.minuta) return;
    if (vonesa.current) clearTimeout(vonesa.current);
    vonesa.current = setTimeout(() => {
      ndryshoOrenEKujteses(o, m).then((ok) => {
        if (!ok) njofto("Ora s'u ndryshua. Provo përsëri.", "gabim");
      });
    }, 500);
  }

  const vleraEOres = new Date();
  vleraEOres.setHours(c.ora, c.minuta, 0, 0);
  const vija = { borderTopColor: t.vija, borderTopWidth: StyleSheet.hairlineWidth };

  return (
    <View>
      <View style={styles.rreshti}>
        <View style={styles.teksti}>
          <T pesha="gjysme" madhesia={15} nativeID="kujtesa-ditore">
            Praktiko sot
          </T>
          <T zbehur madhesia={13}>
            Një kujtesë në ditë për një intervistë praktike.
          </T>
        </View>
        <Switch
          value={c.ditore}
          onValueChange={ndryshoDitoren}
          disabled={duke_ndryshuar}
          accessibilityLabel="Praktiko sot, kujtesë çdo ditë"
          accessibilityLabelledBy="kujtesa-ditore"
        />
      </View>

      {c.ditore && (
        <View style={[styles.rreshti, vija]}>
          <T pesha="gjysme" madhesia={15} style={styles.teksti}>
            Ora
          </T>
          {Platform.OS === "ios" ? (
            <DateTimePicker
              value={vleraEOres}
              mode="time"
              display="compact"
              locale="sq-AL"
              themeVariant={t.errët ? "dark" : "light"}
              onValueChange={(_, data) => zgjidhOren(data)}
            />
          ) : (
            <Prekshme
              accessibilityRole="button"
              accessibilityLabel={`Ora e kujtesës ${ora(c.ora, c.minuta)}. Ndrysho`}
              hitSlop={6}
              onPress={() => setZgjedhesiHapur(true)}
              style={[styles.ora, { backgroundColor: t.karta2 }]}
            >
              <T pesha="gjysme" madhesia={15}>
                {ora(c.ora, c.minuta)}
              </T>
            </Prekshme>
          )}
          {Platform.OS === "android" && zgjedhesiHapur && (
            <DateTimePicker
              value={vleraEOres}
              mode="time"
              presentation="dialog"
              is24Hour
              positiveButton={{ label: "Ruaj" }}
              negativeButton={{ label: "Anulo" }}
              onChange={(ngjarja, data) => {
                setZgjedhesiHapur(false);
                if (ngjarja.type === "set" && data) zgjidhOren(data);
              }}
            />
          )}
        </View>
      )}

      <View style={[styles.rreshti, vija]}>
        <View style={styles.teksti}>
          <T pesha="gjysme" madhesia={15} nativeID="kujtesa-punet">
            Punë të reja për rolin tënd
          </T>
          <T zbehur madhesia={13}>
            Kur dalin punë për {emriIRolit} që s&apos;i ke parë, pasi e lë app-in.
          </T>
        </View>
        <Switch
          value={c.punetERe}
          onValueChange={ndryshoPunet}
          disabled={duke_ndryshuar}
          accessibilityLabel="Njoftim për punë të reja për rolin tënd"
          accessibilityLabelledBy="kujtesa-punet"
        />
      </View>

      {refuzuar && (
        <View style={[styles.rreshti, vija]}>
          <T zbehur madhesia={13} style={styles.teksti} accessibilityLiveRegion="polite">
            Njoftimet janë të fikura për Karrierën te cilësimet e telefonit. Pa to, kujtesat s&apos;dalin.
          </T>
          <Prekshme
            accessibilityRole="button"
            hitSlop={6}
            onPress={() => Linking.openSettings().catch(() => {})}
            style={[styles.ora, { backgroundColor: t.karta2 }]}
          >
            <T pesha="gjysme" madhesia={14}>
              Hap cilësimet
            </T>
          </Prekshme>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rreshti: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 56 },
  teksti: { flex: 1, gap: 2 },
  ora: { borderRadius: 10, paddingHorizontal: 12, minHeight: 36, justifyContent: "center" },
});
