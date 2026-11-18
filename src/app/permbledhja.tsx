import { Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Chip, Faqja, IKONAT, Ikona, Karta, Progresi, T, Titulli } from "@/components/ui";
import { gjykimiIPerqindjes } from "@/lib/gati";
import { lexoSnapshotin, type Hyrja, type Snapshot, type SnapshotCv, type SnapshotGati, type SnapshotIntervista } from "@/lib/snapshot";
import { useTema } from "@/lib/tema";

// "Përmbledhja ime": rezultatet e fundit të ruajtura në telefon. Lexon VETËM snapshot-in (AsyncStorage), kurrë rrjetin,
// prandaj hapet edhe në modalitetin e aeroplanit. Çdo bllok ka datën kur u ruajt, dhe një gjendje bosh të ndershme.
// Rezultatet i shkruajnë ekranet e tyre (cv/analiza, intervista/rezultatet, gati/[id]) kur i lexojnë me sukses.

const MAKS_HAPAT = 3;
const MAKS_KESHILLA = 3;
const MAKS_TE_FORTA = 3;
const MAKS_MUNGESA = 3;

/** "Përditësuar më 18.11, 09:05" nga një datë ISO; "" nëse data s'lexohet. */
function etiketaEKohes(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dy = (n: number) => String(n).padStart(2, "0");
  return `Përditësuar më ${dy(d.getDate())}.${dy(d.getMonth() + 1)}, ${dy(d.getHours())}:${dy(d.getMinutes())}`;
}

type Hapi = { teksti: string; burimi: string };

/**
 * Tri hapat e radhës, vetëm nga ajo që është ruajtur. Së pari çka të mungon për punët ku je më larg
 * (një nga çdo punë, pastaj e dyta e secilës), pastaj hapat e intervistës, të "A jam gati?" dhe këshillat e CV-së.
 * Pa përsëritje; nëse s'ka asgjë të ruajtur, lista është bosh.
 */
function hapatERadhes(s: Snapshot): Hapi[] {
  const sipasHapit = [...s.gati].sort((a, b) => a.te_dhenat.perqindja - b.te_dhenat.perqindja);
  const kandidatet: Hapi[] = [];

  const rreshta = Math.max(0, ...sipasHapit.map((g) => g.te_dhenat.mungon.length));
  for (let i = 0; i < rreshta; i++) {
    for (const g of sipasHapit) {
      const m = g.te_dhenat.mungon[i];
      if (m) kandidatet.push({ teksti: `${m.aftesia}: ${m.si}`, burimi: `Për ${g.te_dhenat.puna.titulli}` });
    }
  }
  for (const h of s.intervista?.te_dhenat.hapat ?? []) kandidatet.push({ teksti: h, burimi: "Nga intervista" });
  for (const g of sipasHapit) for (const h of g.te_dhenat.hapat) kandidatet.push({ teksti: h, burimi: `Për ${g.te_dhenat.puna.titulli}` });
  for (const k of s.cv?.te_dhenat.keshillat ?? []) kandidatet.push({ teksti: `${k.seksioni}: ${k.keshilla}`, burimi: "Nga CV-ja" });

  const pare = new Set<string>();
  return kandidatet
    .filter((h) => {
      const celesi = h.teksti.trim().toLowerCase();
      if (!celesi || pare.has(celesi)) return false;
      pare.add(celesi);
      return true;
    })
    .slice(0, MAKS_HAPAT);
}

/** Data më e re mes burimeve që u përdorën, për etiketën e bllokut të hapave. */
function dataEMeERe(s: Snapshot): string | null {
  const datat = [s.cv?.ruajtur_me, s.intervista?.ruajtur_me, ...s.gati.map((g) => g.ruajtur_me)].filter((d): d is string => !!d);
  return datat.length === 0 ? null : datat.reduce((a, b) => (Date.parse(a) >= Date.parse(b) ? a : b));
}

export default function Permbledhja() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  // Rilexon sa herë hapet ekrani (leximi është lokal): rezultati i sapo ruajtur shfaqet menjëherë.
  useFocusEffect(
    useCallback(() => {
      let aktiv = true;
      lexoSnapshotin().then((s) => {
        if (aktiv) setSnapshot(s);
      });
      return () => {
        aktiv = false;
      };
    }, []),
  );

  return (
    <Faqja>
      <Stack.Screen options={{ title: "" }} />
      <Titulli>Përmbledhja ime</Titulli>
      <T zbehur madhesia={14} style={styles.rreshtat}>
        Rezultatet e fundit, të ruajtura në këtë telefon. Hapen edhe pa internet.
      </T>
      {snapshot !== null && (
        <>
          <Pasqyra s={snapshot} />
          <HapatERadhes s={snapshot} />
          <BllokuCv hyrja={snapshot.cv} />
          <BllokuIntervista hyrja={snapshot.intervista} />
          <BllokuGati hyrjet={snapshot.gati} />
        </>
      )}
    </Faqja>
  );
}

/** Tri numrat kryesorë: nota e CV-së, gatishmëria e fundit, nota e intervistës. "—" kur s'ka të ruajtur. */
function Pasqyra({ s }: { s: Snapshot }) {
  const t = useTema();
  const gatiIFundit = s.gati[0]?.te_dhenat ?? null; // lexoGatite() i kthen më të rejat të para
  const numrat = [
    { etiketa: "Nota e CV-së", vlera: s.cv ? `${s.cv.te_dhenat.nota}` : "—", theks: false },
    { etiketa: "Gatishmëria", vlera: gatiIFundit ? `${gatiIFundit.perqindja}%` : "—", theks: true },
    { etiketa: "Nota e intervistës", vlera: s.intervista ? `${s.intervista.te_dhenat.nota}` : "—", theks: false },
  ];
  return (
    <Karta style={styles.pasqyra}>
      {numrat.map((n) => (
        <View key={n.etiketa} style={styles.numri} accessible accessibilityLabel={`${n.etiketa}: ${n.vlera === "—" ? "pa të dhëna" : n.vlera}`}>
          <T pesha="shumeTrashe" madhesia={28} maxFontSizeMultiplier={1.2} ngjyra={n.theks && n.vlera !== "—" ? t.theksi : undefined}>
            {n.vlera}
          </T>
          <T zbehur madhesia={12.5} style={styles.qendroj}>
            {n.etiketa}
          </T>
        </View>
      ))}
    </Karta>
  );
}

function Seksioni({ teksti }: { teksti: string }) {
  return (
    <T pesha="trashe" madhesia={18} style={styles.seksioni} accessibilityRole="header">
      {teksti}
    </T>
  );
}

function Data({ iso }: { iso: string }) {
  const etiketa = etiketaEKohes(iso);
  return etiketa ? (
    <T zbehur madhesia={12.5}>
      {etiketa}
    </T>
  ) : null;
}

function Bosh({ titulli, teksti }: { titulli: string; teksti: string }) {
  return (
    <Karta style={styles.karta}>
      <T pesha="trashe" madhesia={15.5}>
        {titulli}
      </T>
      <T zbehur madhesia={14} style={styles.rreshtat}>
        {teksti}
      </T>
    </Karta>
  );
}

function HapatERadhes({ s }: { s: Snapshot }) {
  const t = useTema();
  const hapat = hapatERadhes(s);
  const data = dataEMeERe(s);
  return (
    <>
      <Seksioni teksti="Hapat e radhës" />
      {hapat.length === 0 || !data ? (
        <Bosh
          titulli="Ende pa hapa"
          teksti="Pas një analize CV-je, një interviste ose “A jam gati?”, këtu shfaqen tri gjërat që ia vlen t'i bësh më pas."
        />
      ) : (
        <Karta style={styles.karta}>
          {hapat.map((h, i) => (
            <View key={`${i}-${h.teksti}`} style={styles.hapi}>
              <View style={[styles.nr, { backgroundColor: t.theksiButë }]}>
                <T pesha="trashe" madhesia={13} ngjyra={t.theksi}>
                  {i + 1}
                </T>
              </View>
              <View style={styles.flex}>
                <T madhesia={14.5} style={styles.rreshtat}>
                  {h.teksti}
                </T>
                <T zbehur madhesia={12.5}>
                  {h.burimi}
                </T>
              </View>
            </View>
          ))}
          <Data iso={data} />
        </Karta>
      )}
    </>
  );
}

function BllokuCv({ hyrja }: { hyrja: Hyrja<SnapshotCv> | null }) {
  const t = useTema();
  return (
    <>
      <Seksioni teksti="CV-ja" />
      {!hyrja ? (
        <Bosh titulli="S'ka analizë të ruajtur" teksti="Analizoje CV-në te “CV-ja ime” dhe rezultati ruhet këtu, që ta shohësh edhe pa internet." />
      ) : (
        <Karta style={styles.karta}>
          <View style={styles.rreshtiINumrave}>
            <T pesha="shumeTrashe" madhesia={34} maxFontSizeMultiplier={1.2} accessibilityLabel={`Nota ${hyrja.te_dhenat.nota} nga 100`}>
              {hyrja.te_dhenat.nota}
            </T>
            <T zbehur madhesia={15}>
              /100 · nota e CV-së
            </T>
            {hyrja.te_dhenat.versioni !== null && <Chip teksti={`v${hyrja.te_dhenat.versioni}`} />}
          </View>
          {hyrja.te_dhenat.emri_skedarit ? (
            <T zbehur madhesia={13} numberOfLines={1}>
              {hyrja.te_dhenat.emri_skedarit}
            </T>
          ) : null}
          <T madhesia={14.5} style={styles.rreshtat}>
            {hyrja.te_dhenat.permbledhja}
          </T>
          {hyrja.te_dhenat.pikat_e_forta.length > 0 && (
            <View style={styles.grupi}>
              <T pesha="trashe" madhesia={13} zbehur>
                Pikat e forta
              </T>
              {hyrja.te_dhenat.pikat_e_forta.slice(0, MAKS_TE_FORTA).map((p, i) => (
                <Pika key={`f${i}`} ngjyra={t.ok} teksti={p} />
              ))}
            </View>
          )}
          <View style={styles.grupi}>
            <T pesha="trashe" madhesia={13} zbehur>
              Për t&apos;u përmirësuar
            </T>
            {hyrja.te_dhenat.keshillat.length === 0 ? (
              <T zbehur madhesia={14}>
                AI-ja s&apos;gjeti seksion që duhet përmirësuar.
              </T>
            ) : (
              hyrja.te_dhenat.keshillat.slice(0, MAKS_KESHILLA).map((k, i) => (
                <Pika key={`k${i}`} ngjyra={t.theksi} etiketa={k.seksioni} teksti={k.keshilla} />
              ))
            )}
          </View>
          <Data iso={hyrja.ruajtur_me} />
        </Karta>
      )}
    </>
  );
}

function BllokuIntervista({ hyrja }: { hyrja: Hyrja<SnapshotIntervista> | null }) {
  return (
    <>
      <Seksioni teksti="Intervista e fundit" />
      {!hyrja ? (
        <Bosh titulli="S'ka intervistë të ruajtur" teksti="Pas një interviste, këtu mbeten pyetjet, përgjigjet e tua dhe feedback-u për secilën." />
      ) : (
        <>
          <Karta style={styles.karta}>
            <View style={styles.rreshtiINumrave}>
              <T pesha="shumeTrashe" madhesia={34} maxFontSizeMultiplier={1.2} accessibilityLabel={`Nota ${hyrja.te_dhenat.nota} nga 100`}>
                {hyrja.te_dhenat.nota}
              </T>
              <T zbehur madhesia={15}>
                /100 · nota e intervistës
              </T>
            </View>
            <T zbehur madhesia={13.5}>
              {hyrja.te_dhenat.puna.titulli} · {hyrja.te_dhenat.puna.kompania}
            </T>
            <T madhesia={14.5} style={styles.rreshtat}>
              {hyrja.te_dhenat.permbledhja}
            </T>
            <Data iso={hyrja.ruajtur_me} />
          </Karta>
          {hyrja.te_dhenat.pergjigjet.map((p) => (
            <PyetjaERuajtur key={p.nr} p={p} />
          ))}
        </>
      )}
    </>
  );
}

/** Një pyetje që hapet e mbyllet: e mbyllur shihet pyetja, e hapur përgjigjja jote dhe feedback-u. */
function PyetjaERuajtur({ p }: { p: SnapshotIntervista["pergjigjet"][number] }) {
  const t = useTema();
  const [hapur, setHapur] = useState(false);
  return (
    <Karta style={styles.pyetja}>
      <Pressable
        onPress={() => setHapur((h) => !h)}
        accessibilityRole="button"
        accessibilityState={{ expanded: hapur }}
        accessibilityLabel={`Pyetja ${p.nr}. ${p.pyetja}`}
        accessibilityHint={hapur ? "Mbyll feedback-un" : "Hap përgjigjen tënde dhe feedback-un"}
        android_ripple={{ color: t.vija }}
        style={({ pressed }) => [styles.pyetjaKoka, { backgroundColor: pressed ? t.karta2 : "transparent" }]}
      >
        <View style={styles.flex}>
          <View style={styles.rresht}>
            <T pesha="trashe" madhesia={14.5}>
              Pyetja {p.nr}
            </T>
            {p.lloji === "vazhdim" && <Chip teksti="Vazhduese" />}
          </View>
          <T zbehur madhesia={14} numberOfLines={hapur ? undefined : 2} style={styles.rreshtat}>
            {p.pyetja}
          </T>
        </View>
        <View style={{ transform: [{ rotate: hapur ? "90deg" : "0deg" }] }}>
          <Ikona emri={IKONAT.shigjeta} madhesia={14} ngjyra={t.zbehur} />
        </View>
      </Pressable>
      {hapur && (
        <View style={styles.pyetjaPermbajtja}>
          <View style={[styles.eJotja, { borderLeftColor: t.vija }]}>
            <T pesha="trashe" madhesia={12.5} zbehur>
              Përgjigjja jote
            </T>
            <T zbehur={!p.pergjigja} madhesia={13.5} style={styles.rreshtat}>
              {p.pergjigja ?? "S'u ruajt përgjigjja."}
            </T>
          </View>
          <Pika ngjyra={t.ok} etiketa="Mirë" teksti={p.cka_ishte_mire} />
          <Pika ngjyra={t.theksi} etiketa="Përmirëso" teksti={p.cka_te_permiresosh} />
          {p.shembull_me_i_mire !== "—" && (
            <View style={[styles.shembulli, { backgroundColor: t.karta2 }]}>
              <T pesha="trashe" madhesia={12.5} zbehur>
                Shembull më i mirë
              </T>
              <T madhesia={14.5} style={styles.rreshtat}>
                “{p.shembull_me_i_mire}”
              </T>
            </View>
          )}
        </View>
      )}
    </Karta>
  );
}

function BllokuGati({ hyrjet }: { hyrjet: Hyrja<SnapshotGati>[] }) {
  return (
    <>
      <Seksioni teksti="A jam gati?" />
      {hyrjet.length === 0 ? (
        <Bosh titulli="S'ka kontroll të ruajtur" teksti="Hap një punë dhe prek “A jam gati?”. Rezultati për secilën punë ruhet këtu." />
      ) : (
        hyrjet.map((h) => <KartaGati key={h.te_dhenat.puna.id} hyrja={h} />)
      )}
    </>
  );
}

function KartaGati({ hyrja }: { hyrja: Hyrja<SnapshotGati> }) {
  const g = hyrja.te_dhenat;
  return (
    <Karta style={styles.karta}>
      <T pesha="trashe" madhesia={15.5} numberOfLines={2}>
        {g.puna.titulli}
      </T>
      <T zbehur madhesia={13} numberOfLines={1}>
        {g.puna.kompania}
      </T>
      <View style={styles.rreshtiINumrave}>
        <T pesha="shumeTrashe" madhesia={34} maxFontSizeMultiplier={1.2} accessibilityLabel={`Gati ${g.perqindja} për qind`}>
          {g.perqindja}%
        </T>
        <T zbehur madhesia={14} style={styles.flex}>
          {gjykimiIPerqindjes(g.perqindja)}
        </T>
      </View>
      <Progresi vlera={g.perqindja / 100} />
      {g.mungon.length > 0 ? (
        <View style={styles.grupi}>
          <T pesha="trashe" madhesia={13} zbehur>
            Çka të mungon
          </T>
          {g.mungon.slice(0, MAKS_MUNGESA).map((m, i) => (
            <View key={`m${i}`} style={styles.mungon}>
              <T pesha="gjysme" madhesia={14.5}>
                {m.aftesia}
              </T>
              <T zbehur madhesia={13.5} style={styles.rreshtat}>
                {m.si}
              </T>
            </View>
          ))}
        </View>
      ) : (
        <T zbehur madhesia={14}>
          AI-ja s&apos;gjeti gjë që të mungon për këtë punë.
        </T>
      )}
      <Data iso={hyrja.ruajtur_me} />
    </Karta>
  );
}

function Pika({ ngjyra, etiketa, teksti }: { ngjyra: string; etiketa?: string; teksti: string }) {
  return (
    <View style={styles.pikaRresht} accessible accessibilityLabel={etiketa ? `${etiketa}: ${teksti}` : teksti}>
      <View style={[styles.pika, { backgroundColor: ngjyra }]} />
      <T madhesia={14} style={[styles.flex, styles.rreshtat]}>
        {etiketa ? (
          <T pesha="trashe" madhesia={14}>
            {etiketa}:{" "}
          </T>
        ) : null}
        {teksti}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  karta: { gap: 10 },
  rresht: { flexDirection: "row", alignItems: "center", gap: 8 },
  rreshtiINumrave: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  rreshtat: { lineHeight: 20 },
  qendroj: { textAlign: "center" },
  seksioni: { marginTop: 10 },
  pasqyra: { flexDirection: "row", gap: 8 },
  numri: { flex: 1, alignItems: "center", gap: 2 },
  grupi: { gap: 6 },
  hapi: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  nr: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  pikaRresht: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  pika: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
  mungon: { gap: 2 },
  pyetja: { padding: 0, overflow: "hidden" },
  pyetjaKoka: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16, minHeight: 56 },
  pyetjaPermbajtja: { gap: 10, paddingHorizontal: 16, paddingBottom: 16 },
  eJotja: { borderLeftWidth: 3, paddingLeft: 10, gap: 2 },
  shembulli: { borderRadius: 14, padding: 12, gap: 4 },
});
