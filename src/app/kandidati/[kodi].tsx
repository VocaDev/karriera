// Raporti anonim i kandidatit (bordi, ekrani 63), vetëm me të dhënat që kthen serveri (kandidatet_anonim):
// përqindja, çka ka, çka i mungon, intervista praktike. Pa emër, CV, kontakt.
// Ftesa (pëlqimi i dyfishtë) s'është ndërtuar ende: ekrani e thotë, s'ka buton që bën sikur dërgon.
import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import {
  EtiketaEAftesise,
  gjendjaEGabimit,
  MesazhiNeQender,
  PA_INTERNET_KANDIDATET,
  useKandidatet,
} from "@/components/Kandidatet";
import ShiritiPaInternet from "@/components/ShiritiPaInternet";
import { Pulsi, Vije } from "@/components/Skeleti";
import { GradientiSiper } from "@/components/TabEkrani";
import { IKONAT, Ikona, Karta, Progresi, T } from "@/components/ui";
import { dataShqip } from "@/lib/kandidatet";
import { useTema } from "@/lib/tema";

export default function RaportiIKandidatit() {
  const t = useTema();
  const { kodi, puna } = useLocalSearchParams<{ kodi: string; puna?: string }>();
  const te_dhenat = useKandidatet();
  const { kandidatet, rifreskim, rifresko, titulliIPunes } = te_dhenat;

  // I njëjti kandidat (i njëjti kod) mund të jetë gati për disa pozita: kjo e zgjedhur, pastaj të tjerat.
  const rreshtat = useMemo(() => (kandidatet ?? []).filter((k) => k.kodi === kodi), [kandidatet, kodi]);
  const kandidati = rreshtat.find((k) => k.puna_id === puna) ?? rreshtat[0] ?? null;
  const tjerat = rreshtat.filter((k) => k !== kandidati);
  const gabimi = gjendjaEGabimit(te_dhenat);

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: t.sfondi }]}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.faqja}
      refreshControl={<RefreshControl refreshing={rifreskim} onRefresh={rifresko} tintColor={t.zbehur} />}
    >
      <GradientiSiper />
      {kandidatet !== null && <ShiritiPaInternet teksti={PA_INTERNET_KANDIDATET.cfare} />}

      {gabimi ??
        (kandidatet === null ? (
          <Karta>
            <Pulsi>
              <View style={styles.skeleti} accessible accessibilityLabel="Po lexohet raporti">
                <Vije gjeresia="55%" lartesia={14} />
                <Vije gjeresia="30%" lartesia={40} rrezja={10} />
                <Vije gjeresia="100%" lartesia={10} rrezja={5} />
              </View>
            </Pulsi>
          </Karta>
        ) : kandidati === null ? (
          <MesazhiNeQender
            titulli="Ky kandidat s'shfaqet më"
            teksti="Ndoshta e ka fikur dukshmërinë, gatishmëria i ka rënë nën pragun, ose kontrolli i tij është më i vjetër se 90 ditë."
          />
        ) : (
          <>
            <Karta style={styles.koka}>
              <T zbehur madhesia={13.5}>
                {kandidati.etiketa} · {titulliIPunes(kandidati.puna_id)}
              </T>
              <View style={styles.perqindja} accessible accessibilityLabel={`${kandidati.perqindja} për qind gati`}>
                <T pesha="shumeTrashe" madhesia={44} maxFontSizeMultiplier={1.2} style={styles.numri}>
                  {kandidati.perqindja}
                </T>
                <T pesha="trashe" madhesia={20} zbehur maxFontSizeMultiplier={1.2}>
                  % gati
                </T>
              </View>
              <Progresi vlera={kandidati.perqindja / 100} />
              <T zbehur madhesia={12.5}>
                {`Vlerësim i AI-së nga ${kandidati.burimi === "intervista" ? "intervista praktike" : "CV-ja"} e kandidatit, më ${dataShqip(kandidati.llogaritur_me)}. Jo garanci.`}
              </T>
            </Karta>

            <Karta style={styles.grupi}>
              <T pesha="trashe" madhesia={16} accessibilityRole="header">
                Çka ka për këtë pozitë
              </T>
              {kandidati.ke.length === 0 ? (
                <T zbehur madhesia={13.5}>
                  Asnjë aftësi e shënuar.
                </T>
              ) : (
                <View style={styles.aftesite}>
                  {kandidati.ke.map((a) => (
                    <EtiketaEAftesise key={a} teksti={a} ka />
                  ))}
                </View>
              )}
              <T pesha="trashe" madhesia={16} style={styles.nentitulli} accessibilityRole="header">
                Çka i mungon
              </T>
              {kandidati.mungon.length === 0 ? (
                <T zbehur madhesia={13.5}>
                  Asgjë e rëndësishme sipas kontrollit të fundit.
                </T>
              ) : (
                <View style={styles.aftesite}>
                  {kandidati.mungon.map((a) => (
                    <EtiketaEAftesise key={a} teksti={a} ka={false} />
                  ))}
                </View>
              )}
            </Karta>

            <Karta style={styles.rreshti}>
              <Ikona emri={IKONAT.mikrofoni} madhesia={18} ngjyra={kandidati.intervista_nota !== null ? t.theksi : t.zbehur} />
              <View style={styles.flexGap}>
                <T pesha="gjysme" madhesia={15}>
                  {kandidati.intervista_nota !== null
                    ? `Intervista praktike: ${kandidati.intervista_nota}/100`
                    : "Ende pa intervistë praktike për këtë pozitë"}
                </T>
                <T zbehur madhesia={13}>
                  {kandidati.intervista_nota !== null
                    ? `Nota e fundit, nga ${kandidati.intervista_nr} ${kandidati.intervista_nr === 1 ? "intervistë" : "intervista"} me intervistuesin AI për këtë pozitë.`
                    : "Kur kandidati praktikon intervistën për këtë pozitë, nota e fundit shfaqet këtu."}
                </T>
              </View>
            </Karta>

            {tjerat.length > 0 && (
              <Karta style={styles.grupi}>
                <T pesha="trashe" madhesia={16} accessibilityRole="header">
                  Gati edhe për
                </T>
                {tjerat.map((k) => (
                  <T key={k.puna_id} madhesia={14}>
                    {titulliIPunes(k.puna_id)} · {k.perqindja}%
                  </T>
                ))}
              </Karta>
            )}

            <Karta style={styles.rreshti}>
              <Ikona emri={IKONAT.kycja} madhesia={18} ngjyra={t.zbehur} />
              <View style={styles.flexGap}>
                <T pesha="gjysme" madhesia={15}>
                  Nuk e shihni: emrin, CV-në, kontaktin
                </T>
                <T zbehur madhesia={13}>
                  Kandidati ka zgjedhur të duket vetëm anonimisht. Ftesat, ku emri ndahet vetëm kur kandidati pranon, s&apos;janë ndërtuar ende.
                </T>
              </View>
            </Karta>
          </>
        ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexGap: { flex: 1, gap: 3 },
  faqja: { padding: 18, gap: 12, paddingBottom: 60 },
  skeleti: { gap: 12 },
  koka: { gap: 8 },
  perqindja: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  numri: { letterSpacing: -1 },
  grupi: { gap: 8 },
  nentitulli: { marginTop: 6 },
  aftesite: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  rreshti: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
});
