// Pjesët e përbashkëta të "Kandidatëve" të punëdhënësit (bordi, ekranet 59, 61, 62): leximi i të dhënave,
// karta e kandidatit anonim, gjendjet (ngarkim, gabim, s'është aktivizuar, bosh) dhe shënimi i privatësisë.
import { Link, useFocusEffect } from "expo-router";
import { useCallback, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { useNjoftim } from "@/components/Njoftimet";
import Prekshme from "@/components/Prekshme";
import { KartaSkelet } from "@/components/Skeleti";
import { IKONAT, Ikona, Karta, T } from "@/components/ui";
import {
  DITET_E_DUKSHME,
  GabimPaAktivizim,
  merrKandidatet,
  merrNumratEPozitave,
  PRAGU_GATI,
  type Kandidati,
  type NumratEPozites,
} from "@/lib/kandidatet";
import { paInternet } from "@/lib/mesazhet";
import { prekja } from "@/lib/prekja";
import { listoPunetEMia, type Puna } from "@/lib/punet";
import { KOHA_E_LEXIMIT, meKohe, pamjaEGabimit, useRrjeti } from "@/lib/rrjeti";
import { useTema } from "@/lib/tema";

export const PA_INTERNET_KANDIDATET = paInternet("po t'i shfaqim kandidatët që i pe herën e fundit");

// ---------- Leximi ----------

export type TeDhenatEKandidateve = {
  punet: Puna[] | null;
  kandidatet: Kandidati[] | null;
  numrat: Map<string, NumratEPozites> | null;
  /** Migrimi s'është aplikuar në server: ekrani e thotë hapur, pa sajuar asgjë. */
  paAktivizim: boolean;
  gabimi: string | null;
  rifreskim: boolean;
  rifresko: () => void;
  provoPerseri: () => void;
  titulliIPunes: (id: string) => string;
};

/** Punët e mia + kandidatët anonimë (të gjithë, ose vetëm për `punaId`) + numrat. Rilexon kur hapet ekrani dhe kur kthehet interneti. */
export function useKandidatet(punaId?: string): TeDhenatEKandidateve {
  const njofto = useNjoftim();
  const [punet, setPunet] = useState<Puna[] | null>(null);
  const [kandidatet, setKandidatet] = useState<Kandidati[] | null>(null);
  const [numrat, setNumrat] = useState<Map<string, NumratEPozites> | null>(null);
  const [paAktivizim, setPaAktivizim] = useState(false);
  const [gabimi, setGabimi] = useState<string | null>(null);
  const [rifreskim, setRifreskim] = useState(false);

  const ngarko = useCallback(async () => {
    const [p, k, n] = await Promise.allSettled([
      meKohe(listoPunetEMia(), KOHA_E_LEXIMIT),
      meKohe(merrKandidatet(punaId), KOHA_E_LEXIMIT),
      meKohe(merrNumratEPozitave(), KOHA_E_LEXIMIT),
    ]);
    if (p.status === "fulfilled") setPunet(p.value);
    if (n.status === "fulfilled") setNumrat(n.value);
    if (k.status === "fulfilled") {
      setKandidatet(k.value);
      setPaAktivizim(false);
      setGabimi(p.status === "rejected" ? errorTekst(p.reason) : null);
      return p.status === "fulfilled";
    }
    if (k.reason instanceof GabimPaAktivizim) {
      setPaAktivizim(true);
      setGabimi(null);
      return false;
    }
    setGabimi(errorTekst(k.reason));
    return false;
  }, [punaId]);

  useFocusEffect(
    useCallback(() => {
      ngarko();
    }, [ngarko]),
  );

  const { kaInternet } = useRrjeti(() => {
    ngarko();
  });

  const rifresko = useCallback(async () => {
    if (!kaInternet) {
      prekja.gabim();
      njofto(PA_INTERNET_KANDIDATET.cfare, "gabim");
      return;
    }
    setRifreskim(true);
    const ok = await ngarko();
    setRifreskim(false);
    if (!ok) prekja.gabim();
  }, [kaInternet, ngarko, njofto]);

  const provoPerseri = useCallback(() => {
    setGabimi(null);
    ngarko();
  }, [ngarko]);

  const titulliIPunes = useCallback((id: string) => punet?.find((p) => p.id === id)?.titulli ?? "Pozita", [punet]);

  return { punet, kandidatet, numrat, paAktivizim, gabimi, rifreskim, rifresko, provoPerseri, titulliIPunes };
}

function errorTekst(e: unknown): string {
  return e instanceof Error ? e.message : "Gabim i panjohur";
}

// ---------- Karta e kandidatit ----------

/** Një kandidat anonim: renditja, etiketa, përqindja, aftësitë (✓ ka, – i mungon) dhe intervista. Prek → raporti. */
export function KartaEKandidatit({
  kandidati,
  renditja,
  nentitulli,
  meAftesi = true,
}: {
  kandidati: Kandidati;
  renditja: number;
  /** P.sh. titulli i pozitës kur lista ka disa pozita. */
  nentitulli?: string;
  meAftesi?: boolean;
}) {
  const t = useTema();
  const intervista =
    kandidati.intervista_nota !== null
      ? `intervistë praktike ${kandidati.intervista_nota}/100${kandidati.intervista_nr > 1 ? ` (${kandidati.intervista_nr})` : ""}`
      : "pa intervistë praktike ende";
  const pershkrimi = [nentitulli, intervista].filter(Boolean).join(" · ");
  return (
    <Link href={{ pathname: "/kandidati/[kodi]", params: { kodi: kandidati.kodi, puna: kandidati.puna_id } }} asChild>
      <Prekshme
        accessibilityRole="button"
        accessibilityLabel={`${renditja}. ${kandidati.etiketa}, ${kandidati.perqindja} për qind gati. ${pershkrimi}`}
        accessibilityHint="Hap raportin anonim"
        style={StyleSheet.flatten([styles.karta, { backgroundColor: t.karta, shadowColor: t.hija }])}
      >
        <View style={styles.rreshti}>
          <View style={[styles.renditja, { backgroundColor: renditja <= 3 ? t.theksiButë : t.karta2 }]}>
            <T pesha="trashe" madhesia={14} ngjyra={renditja <= 3 ? t.theksi : t.teksti}>
              {renditja}
            </T>
          </View>
          <View style={styles.flex}>
            <T pesha="trashe" madhesia={16}>
              {kandidati.etiketa}
            </T>
            <T zbehur madhesia={13} numberOfLines={2}>
              {pershkrimi}
            </T>
          </View>
          <T pesha="shumeTrashe" madhesia={22} maxFontSizeMultiplier={1.3}>
            {kandidati.perqindja}
            <T pesha="trashe" madhesia={13} zbehur>
              %
            </T>
          </T>
        </View>
        {meAftesi && (kandidati.ke.length > 0 || kandidati.mungon.length > 0) && (
          <View style={styles.aftesite}>
            {kandidati.ke.slice(0, 3).map((a) => (
              <EtiketaEAftesise key={`ke-${a}`} teksti={a} ka />
            ))}
            {kandidati.mungon.slice(0, 2).map((a) => (
              <EtiketaEAftesise key={`mungon-${a}`} teksti={a} ka={false} />
            ))}
          </View>
        )}
      </Prekshme>
    </Link>
  );
}

/** Aftësi që e ka (✓, e gjelbër) ose që i mungon (–, e zbehur). Kuptimi s'varet vetëm nga ngjyra: ka shenjë. */
export function EtiketaEAftesise({ teksti, ka }: { teksti: string; ka: boolean }) {
  const t = useTema();
  return (
    <View
      style={[styles.aftesia, { backgroundColor: t.karta2 }]}
      accessible
      accessibilityLabel={ka ? `E ka: ${teksti}` : `I mungon: ${teksti}`}
    >
      <T pesha="gjysme" madhesia={12} ngjyra={ka ? t.ok : t.zbehur}>
        {ka ? "✓ " : "– "}
        {teksti}
      </T>
    </View>
  );
}

// ---------- Gjendjet ----------

export function SkeletiIKandidateve() {
  return (
    <View style={styles.lista} accessible accessibilityLabel="Po lexohen kandidatët">
      <KartaSkelet />
      <KartaSkelet />
      <KartaSkelet />
    </View>
  );
}

/** Mesazh në qendër, me buton opsional. */
export function MesazhiNeQender({
  titulli,
  teksti,
  butoni,
  onPress,
}: {
  titulli: string;
  teksti: string;
  butoni?: string;
  onPress?: () => void;
}) {
  const t = useTema();
  return (
    <View style={styles.qender}>
      <T pesha="trashe" madhesia={16} style={styles.tekstNeQender}>
        {titulli}
      </T>
      <T zbehur madhesia={14} style={styles.tekstNeQender} accessibilityLiveRegion="polite">
        {teksti}
      </T>
      {butoni && onPress && (
        <Prekshme onPress={onPress} accessibilityRole="button" style={[styles.provo, { backgroundColor: t.teksti }]}>
          <T pesha="trashe" madhesia={15} ngjyra={t.sfondi}>
            {butoni}
          </T>
        </Prekshme>
      )}
    </View>
  );
}

/** Gabimi i leximit ose "s'është aktivizuar ende". Kthen null kur s'ka asnjërin. */
export function gjendjaEGabimit(te_dhenat: TeDhenatEKandidateve): ReactNode {
  if (te_dhenat.paAktivizim) {
    return (
      <MesazhiNeQender
        titulli="Kandidatët s'janë aktivizuar ende"
        teksti="Pjesa që i rendit kandidatët anonimë s'është ndezur ende në server. Sapo të ndizet, kandidatët e gatshëm për pozitat tuaja shfaqen këtu."
        butoni="Provo përsëri"
        onPress={te_dhenat.provoPerseri}
      />
    );
  }
  if (te_dhenat.gabimi && te_dhenat.kandidatet === null) {
    const pamja = pamjaEGabimit(te_dhenat.gabimi, "S'u lexuan kandidatët", "s'kemi ende kandidatë për t'i shfaqur");
    return <MesazhiNeQender titulli={pamja.titulli} teksti={pamja.teksti} butoni="Provo përsëri" onPress={te_dhenat.provoPerseri} />;
  }
  return null;
}

/** Kur s'ka asnjë kandidat të dukshëm: çka duhet të ndodhë që të shfaqen. */
export const TEKSTI_PA_KANDIDATE = `Kandidatët shfaqen këtu kur zgjedhin vetë të jenë të dukshëm dhe janë të paktën ${PRAGU_GATI}% gati për një nga pozitat tuaja.`;

/** Shënimi i privatësisë: çka shihni dhe çka jo. */
export function ShenimiIPrivatesise() {
  const t = useTema();
  return (
    <Karta style={styles.shenimi}>
      <View style={styles.rreshtiShenimit}>
        <Ikona emri={IKONAT.kycja} madhesia={16} ngjyra={t.zbehur} />
        <T pesha="gjysme" madhesia={13.5}>
          Si i shihni kandidatët
        </T>
      </View>
      <T zbehur madhesia={12.5}>
        {`Vetëm kandidatë që kanë zgjedhur të jenë të dukshëm, të paktën ${PRAGU_GATI}% gati sipas kontrollit të tyre të fundit "A jam gati?" (${DITET_E_DUKSHME} ditët e fundit). Pa emër, email, CV apo kontakt. Etiketa është tjetër te çdo pozitë, kështu që i njëjti person mund të dalë te dy pozita pa u lidhur. Përqindja është vlerësim i AI-së, jo garanci.`}
      </T>
    </Karta>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  lista: { gap: 10 },
  karta: {
    gap: 10,
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  rreshti: { flexDirection: "row", alignItems: "center", gap: 12 },
  renditja: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  aftesite: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  aftesia: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  qender: { alignItems: "center", gap: 8, paddingTop: 24, paddingHorizontal: 12 },
  tekstNeQender: { textAlign: "center" },
  provo: { marginTop: 8, borderRadius: 999, paddingVertical: 13, paddingHorizontal: 26, minHeight: 44, justifyContent: "center" },
  shenimi: { gap: 6 },
  rreshtiShenimit: { flexDirection: "row", alignItems: "center", gap: 8 },
});
