// "Dil": fshin sesionin nga telefoni. Rojet te _layout.tsx e kthejnë menjëherë te ekrani i hyrjes.
import { useState } from "react";
import { ActivityIndicator, StyleSheet } from "react-native";

import { useNjoftim } from "@/components/Njoftimet";
import Prekshme from "@/components/Prekshme";
import { IKONAT, Ikona, T } from "@/components/ui";
import { dil } from "@/lib/hyrja";
import { prekja } from "@/lib/prekja";
import { useTema } from "@/lib/tema";

export default function ButoniDil() {
  const t = useTema();
  const njofto = useNjoftim();
  const [duke_dale, setDukeDale] = useState(false);

  async function dalja() {
    if (duke_dale) return;
    prekja.lehte();
    setDukeDale(true);
    try {
      await dil();
    } catch (e) {
      prekja.gabim();
      njofto(e instanceof Error ? e.message : "S'u dol nga llogaria.", "gabim");
      setDukeDale(false);
    }
  }

  return (
    <Prekshme
      onPress={dalja}
      disabled={duke_dale}
      accessibilityRole="button"
      accessibilityLabel="Dil nga llogaria"
      style={[styles.butoni, { backgroundColor: t.karta, borderColor: t.vija }]}
    >
      {duke_dale ? (
        <ActivityIndicator color={t.keq} />
      ) : (
        <>
          <Ikona emri={IKONAT.dalja} madhesia={18} ngjyra={t.keq} />
          <T pesha="trashe" madhesia={16} ngjyra={t.keq}>
            Dil
          </T>
        </>
      )}
    </Prekshme>
  );
}

const styles = StyleSheet.create({
  butoni: {
    flexDirection: "row",
    gap: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
});
