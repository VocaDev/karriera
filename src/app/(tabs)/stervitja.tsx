import { StyleSheet, View } from "react-native";

import RreshtiVecorise from "@/components/RreshtiVecorise";
import { Faqja, IKONAT, Ikona, Karta, T, Titulli } from "@/components/ui";
import { useTema } from "@/lib/tema";
import { VECORITE } from "@/lib/vecorite";

// Stërvitja (bordi, ekrani 44): kompetencat dalin pas intervistës së parë; poshtë mënyrat e stërvitjes.
export default function Stervitja() {
  const t = useTema();
  const stervitja = VECORITE.filter((v) => v.celesi === "intervista" || v.celesi === "cv");

  return (
    <Faqja>
      <Titulli>Stërvitja</Titulli>

      <Karta style={styles.kompetencat}>
        <View style={styles.rresht}>
          <Ikona emri={IKONAT.grafiku} madhesia={18} ngjyra={t.theksi} />
          <T pesha="trashe" madhesia={16}>
            Kompetencat e tua
          </T>
        </View>
        <T zbehur madhesia={13.5}>
          Bëj intervistën e parë dhe këtu shfaqen: zgjidhja e problemeve, komunikimi, njohuritë teknike,
          anglishtja.
        </T>
      </Karta>

      <Karta style={styles.lista}>
        {stervitja.map((v, i) => (
          <RreshtiVecorise key={v.celesi} vecoria={v} iFundit={i === stervitja.length - 1} />
        ))}
      </Karta>
    </Faqja>
  );
}

const styles = StyleSheet.create({
  kompetencat: { gap: 8 },
  rresht: { flexDirection: "row", alignItems: "center", gap: 8 },
  lista: { padding: 0, overflow: "hidden" },
});
