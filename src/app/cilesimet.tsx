// Cilësimet e kërkuesit (bordi, ekrani 40): roli, gjuha e intervistës, çka ruajmë, dalja.
// Pamja e listës së grupuar të sistemit: kokat e vogla mbi kartat, rreshta të ndarë me vijë të hollë.
// Ndryshimet ruhen menjëherë (segmentet), me dridhje zgjedhjeje dhe njoftim; nëse dështon, kthehet vlera e vjetër.
import { SegmentedControl } from "@expo/ui/community/segmented-control";
import { useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import ButoniDil from "@/components/ButoniDil";
import { useNjoftim } from "@/components/Njoftimet";
import { Faqja, IKONAT, Ikona, T } from "@/components/ui";
import {
  EMRAT_E_GJUHEVE,
  EMRAT_E_ROLEVE,
  GJUHET,
  ndryshoProfilin,
  ROLET,
  type Gjuha,
  type RoliSynuar,
} from "@/lib/hyrja";
import { prekja } from "@/lib/prekja";
import { useSesioni } from "@/lib/sesioni";
import { useTema } from "@/lib/tema";

type EmriIkones = { ios: string; android: string };

/** Një grup: koka e vogël sipër, karta me rreshta brenda, shënimi poshtë (opsional). */
function Grupi({ titulli, shenimi, children }: { titulli: string; shenimi?: string; children: ReactNode }) {
  const t = useTema();
  return (
    <View style={styles.grupi}>
      <T pesha="gjysme" madhesia={13} zbehur style={styles.koka} accessibilityRole="header">
        {titulli}
      </T>
      <View
        style={[
          styles.karta,
          { backgroundColor: t.karta, borderColor: t.vija, borderWidth: t.errët ? StyleSheet.hairlineWidth : 0 },
        ]}
      >
        {children}
      </View>
      {shenimi ? (
        <T zbehur madhesia={12.5} style={styles.shenimi}>
          {shenimi}
        </T>
      ) : null}
    </View>
  );
}

/** Rresht informues (pa prekje): ikonë, titull, tekst. `kufi` vë vijën e hollë sipër. */
function Rreshti({ ikona, titulli, teksti, kufi = false }: { ikona: EmriIkones; titulli: string; teksti: string; kufi?: boolean }) {
  const t = useTema();
  return (
    <View
      style={[styles.rreshti, kufi && { borderTopColor: t.vija, borderTopWidth: StyleSheet.hairlineWidth }]}
      accessible
      accessibilityLabel={`${titulli}. ${teksti}`}
    >
      <Ikona emri={ikona} madhesia={18} ngjyra={t.theksi} />
      <View style={styles.rreshtiTeksti}>
        <T pesha="gjysme" madhesia={15}>
          {titulli}
        </T>
        <T zbehur madhesia={13.5}>
          {teksti}
        </T>
      </View>
    </View>
  );
}

export default function CilesimetEkrani() {
  const njofto = useNjoftim();
  const { sesioni, profili, rifreskoProfilin } = useSesioni();
  // Këtu hyn vetëm kërkuesi me rol të zgjedhur (rojet te _layout.tsx), prandaj roli s'është kurrë null.
  const [roli, setRoli] = useState<RoliSynuar | null>(profili?.roli_synuar ?? null);
  const [gjuha, setGjuha] = useState<Gjuha>(profili?.gjuha ?? "sq");
  const [duke_ruajtur, setDukeRuajtur] = useState(false);

  if (!profili || !roli) return null;

  async function ruaj(ndryshim: { roli_synuar?: RoliSynuar; gjuha?: Gjuha }, mesazhi: string, kthe: () => void) {
    if (duke_ruajtur || !profili) return;
    setDukeRuajtur(true);
    try {
      rifreskoProfilin(await ndryshoProfilin(ndryshim));
      prekja.sukses();
      njofto(mesazhi, "sukses");
    } catch (e) {
      kthe();
      prekja.gabim();
      njofto(e instanceof Error ? e.message : "S'u ruajt. Provo përsëri.", "gabim");
    } finally {
      setDukeRuajtur(false);
    }
  }

  return (
    <Faqja>
      <Grupi
        titulli="Roli për të cilin përgatitesh"
        shenimi={`${EMRAT_E_ROLEVE[roli].titulli}: ${EMRAT_E_ROLEVE[roli].pershkrimi}. Ndryshon pyetjet e intervistës dhe krahasimin me punët.`}
      >
        <View style={styles.kontrolli}>
          <SegmentedControl
            values={[...ROLET]}
            selectedIndex={ROLET.indexOf(roli)}
            onValueChange={(v) => {
              const i_ri = ROLET.find((r) => r === v);
              if (!i_ri || i_ri === roli) return;
              const i_vjeter = roli;
              prekja.zgjedhje();
              setRoli(i_ri);
              ruaj({ roli_synuar: i_ri }, "Roli u ruajt", () => setRoli(i_vjeter));
            }}
            enabled={!duke_ruajtur}
            style={styles.segmenti}
          />
        </View>
      </Grupi>

      <Grupi titulli="Gjuha e intervistës" shenimi="Intervista bëhet në këtë gjuhë. App-i mbetet në shqip.">
        <View style={styles.kontrolli}>
          <SegmentedControl
            values={GJUHET.map((g) => EMRAT_E_GJUHEVE[g])}
            selectedIndex={GJUHET.indexOf(gjuha)}
            onValueChange={(v) => {
              const i_ri = GJUHET.find((g) => EMRAT_E_GJUHEVE[g] === v);
              if (!i_ri || i_ri === gjuha) return;
              const i_vjeter = gjuha;
              prekja.zgjedhje();
              setGjuha(i_ri);
              ruaj({ gjuha: i_ri }, "Gjuha u ruajt", () => setGjuha(i_vjeter));
            }}
            enabled={!duke_ruajtur}
            style={styles.segmenti}
          />
        </View>
      </Grupi>

      <Grupi titulli="Privatësia: çka ruajmë">
        <Rreshti
          ikona={IKONAT.kycja}
          titulli="Vetëm ti i sheh të dhënat e tua"
          teksti="Emri, email-i, CV-ja dhe punët me ⭐ janë private: serveri i kthen çdo llogarie vetëm rreshtat e saj."
        />
        <Rreshti
          kufi
          ikona={IKONAT.dokumenti}
          titulli="Çka ruhet"
          teksti="Emri, email-i, lloji i llogarisë, roli dhe gjuha, CV-ja që ngarkon dhe punët që ruan me ⭐."
        />
        <Rreshti
          kufi
          ikona={IKONAT.mikrofoni}
          titulli="Çka nuk ruhet"
          teksti="Video dhe zëri i intervistës: vetëm notat dhe feedback-u. Teksti i plotë i shpalljeve nga portalet: vetëm faktet, një përmbledhje dhe linku."
        />
        <Rreshti
          kufi
          ikona={IKONAT.info}
          titulli="AI"
          teksti="Kur kërkon analizën e CV-së, teksti i saj shkon te shërbimi i AI-së nga serveri ynë. Çelësat s'janë kurrë në telefon."
        />
      </Grupi>

      <Grupi titulli="Llogaria">
        <Rreshti ikona={IKONAT.email} titulli={sesioni?.user.email ?? "Llogaria ime"} teksti="Ke hyrë me këtë email." />
      </Grupi>
      <ButoniDil />
    </Faqja>
  );
}

const styles = StyleSheet.create({
  grupi: { gap: 6 },
  koka: { paddingHorizontal: 6 },
  karta: { borderRadius: 18, overflow: "hidden" },
  shenimi: { paddingHorizontal: 6 },
  kontrolli: { padding: 12 },
  segmenti: { minHeight: 36 },
  rreshti: { flexDirection: "row", gap: 12, alignItems: "flex-start", paddingHorizontal: 14, paddingVertical: 12, minHeight: 56 },
  rreshtiTeksti: { flex: 1, gap: 2 },
});
