import { Link, useFocusEffect, type Href } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";

import { useNjoftim } from "@/components/Njoftimet";
import Prekshme from "@/components/Prekshme";
import ShiritiPaInternet from "@/components/ShiritiPaInternet";
import RreshtiVecorise, { hapetVecoria } from "@/components/RreshtiVecorise";
import { Pulsi, Vije } from "@/components/Skeleti";
import { TabScroll } from "@/components/TabEkrani";
import { IKONAT, Ikona, Karta, Rruga, T } from "@/components/ui";
import { listoVersionet, type CvRresht } from "@/lib/cv";
import { kontrolletEFundit, type KontrollEFundit } from "@/lib/gati";
import { lexoHistorikun } from "@/lib/intervista/klienti";
import { prekja } from "@/lib/prekja";
import { paInternet, PA_INTERNET_SHKURT } from "@/lib/mesazhet";
import { KOHA_E_LEXIMIT, meKohe, useRrjeti } from "@/lib/rrjeti";
import { listoPunet, type Puna } from "@/lib/punet";
import { listoTeRuajturat } from "@/lib/ruajtura";
import { useSesioni } from "@/lib/sesioni";
import { useTema } from "@/lib/tema";
import { tekstiIGjendjes, VECORITE, type Vecoria } from "@/lib/vecorite";

const DITET = ["E diel", "E hënë", "E martë", "E mërkurë", "E enjte", "E premte", "E shtunë"];
const MUAJT = ["janar", "shkurt", "mars", "prill", "maj", "qershor", "korrik", "gusht", "shtator", "tetor", "nëntor", "dhjetor"];

function dataSot(): string {
  const d = new Date();
  return `${DITET[d.getDay()]}, ${d.getDate()} ${MUAJT[d.getMonth()]}`;
}

// Çdo burim lexohet vetë: null = ende pa ardhur, { ok: false } = dështoi, { ok: true } = ka të dhëna.
// Kështu një burim që dështon s'e mbyt gjithë ekranin.
type Burimi<T> = null | { ok: true; v: T } | { ok: false };

function veco(celesi: Vecoria["celesi"]): Vecoria {
  const v = VECORITE.find((x) => x.celesi === celesi);
  if (!v) throw new Error(`Mungon veçoria "${celesi}" te VECORITE`);
  return v;
}

type HapiTjeter = { titulli: string; pershkrimi: string; href: Href | null; butoni: string; shenim?: string };

/** Hapi tjetër për një veçori: me buton kur hapet, përndryshe me gjendjen e saj. */
function hapiIVecorise(v: Vecoria): HapiTjeter {
  const { titulli, pershkrimi } = v;
  return hapetVecoria(v)
    ? { titulli, pershkrimi, href: v.href, butoni: "Hape" }
    : { titulli, pershkrimi, href: null, butoni: "", shenim: tekstiIGjendjes(v.gjendja) };
}

// Kreu (bordi, ekrani 41): gjendja e vërtetë e përdoruesit te rruga CV → Përputhja → Intervista → Mëso → Gati,
// hapi tjetër, dhe punët e fundit.
// Pa streak dhe pa numra të shpikur: kur ka streak të vërtetë (Demo Day), vjen këtu.
export default function Sot() {
  const { profili } = useSesioni();
  const t = useTema();
  const njofto = useNjoftim();
  const [cvt, setCvt] = useState<Burimi<CvRresht[]>>(null);
  const [teRuajturat, setTeRuajturat] = useState<Burimi<number>>(null);
  const [punet, setPunet] = useState<Burimi<Puna[]>>(null);
  const [kontrollet, setKontrollet] = useState<Burimi<KontrollEFundit[]>>(null);
  const [intervistat, setIntervistat] = useState<Burimi<number>>(null); // 0 ose 1: a ka të paktën një të mbaruar
  const [rifreskim, setRifreskim] = useState(false);

  // Lexon burimet nga Supabase (RLS kthen vetëm të miat). Kthen true nëse të gjitha u lexuan.
  const ngarko = useCallback(async (): Promise<boolean> => {
    const [c, r, p, g, i] = await Promise.allSettled([
      meKohe(listoVersionet(), KOHA_E_LEXIMIT),
      meKohe(listoTeRuajturat(), KOHA_E_LEXIMIT),
      meKohe(listoPunet(), KOHA_E_LEXIMIT),
      meKohe(kontrolletEFundit(3), KOHA_E_LEXIMIT),
      meKohe(lexoHistorikun(1), KOHA_E_LEXIMIT),
    ]);
    // Një burim që dështon (p.sh. pa internet) e lë atë që e kishim lexuar më parë: ekrani s'zbrazet.
    setCvt((m) => (c.status === "fulfilled" ? { ok: true, v: c.value } : m?.ok ? m : { ok: false }));
    setTeRuajturat((m) => (r.status === "fulfilled" ? { ok: true, v: r.value.size } : m?.ok ? m : { ok: false }));
    setPunet((m) => (p.status === "fulfilled" ? { ok: true, v: p.value } : m?.ok ? m : { ok: false }));
    setKontrollet((m) => (g.status === "fulfilled" ? { ok: true, v: g.value } : m?.ok ? m : { ok: false }));
    setIntervistat((m) => (i.status === "fulfilled" ? { ok: true, v: i.value.length } : m?.ok ? m : { ok: false }));
    return [c, r, p, g, i].every((x) => x.status === "fulfilled");
  }, []);

  useFocusEffect(
    useCallback(() => {
      ngarko();
    }, [ngarko]),
  );

  // Interneti u kthye: rifreskon vetë.
  const { kaInternet } = useRrjeti(() => {
    ngarko();
  });

  // Tërheqja poshtë: rrotullimi i sistemit qëndron sa zgjat leximi i vërtetë.
  async function rifresko() {
    if (!kaInternet) {
      // Pa internet s'ka çka të pritet: asnjë rrotë, vetëm njoftimi; ç'kemi në ekran mbetet.
      prekja.gabim();
      njofto(paInternet("po t'i shfaqim të dhënat që i pe herën e fundit").cfare, "gabim");
      return;
    }
    setRifreskim(true);
    const ok = await ngarko();
    setRifreskim(false);
    if (!ok) {
      prekja.gabim();
      njofto("S'u rifreskua gjithçka. Provo përsëri.", "gabim");
    }
  }

  // ---------- Gjendja e përdoruesit ----------
  const versionet = cvt?.ok ? cvt.v : null;
  const iAnalizuar = versionet?.find((v) => v.nota !== null) ?? null; // versionet vijnë më i riu i pari
  const ruajtura = teRuajturat?.ok ? teRuajturat.v : null;
  const listaEPuneve = punet?.ok ? punet.v : null;
  const hapiMbaruar = iAnalizuar ? 1 : 0; // vetëm CV-ja ka të dhëna të vërteta; Përputhja vjen me "A jam gati?"
  // null = ende s'dihet. Nga këto vjen edhe lista e hapave, edhe "Hapi tjetër".
  const kaKontroll = kontrollet?.ok ? kontrollet.v.length > 0 : null;
  const kaIntervista = intervistat?.ok ? intervistat.v > 0 : null;

  const cvVecoria = veco("cv");
  const gatiVecoria = veco("gati");
  const intervistaVecoria = veco("intervista");

  let nenCV: string | undefined;
  if (cvt === null) nenCV = "Po lexohet…";
  else if (versionet === null) nenCV = kaInternet ? "S'u lexua. Tërhiqe poshtë për të provuar përsëri." : PA_INTERNET_SHKURT;
  else if (versionet.length === 0) nenCV = "Ende pa CV · ngarkoje ose ndërtoje";
  else if (iAnalizuar) nenCV = `v${iAnalizuar.versioni} · analizuar · ${iAnalizuar.nota}/100 (vlerësim i AI-së)`;
  else nenCV = `v${versionet[0].versioni} · pa analizë ende`;

  let nenPunet: string | undefined;
  if (teRuajturat === null) nenPunet = "Po lexohet…";
  else if (ruajtura === null) nenPunet = kaInternet ? "S'u lexua. Tërhiqe poshtë për të provuar përsëri." : PA_INTERNET_SHKURT;
  else if (ruajtura === 0) nenPunet = "Asnjë e ruajtur · prek ☆ te një punë";
  else nenPunet = `${ruajtura} ${ruajtura === 1 ? "e ruajtur" : "të ruajtura"} me ⭐`;

  let nenGati: string;
  if (kontrollet === null) nenGati = "Po lexohet…";
  else if (kaKontroll === null) nenGati = kaInternet ? "S'u lexua. Tërhiqe poshtë për të provuar përsëri." : PA_INTERNET_SHKURT;
  else if (!kaKontroll) nenGati = "Ende pa kontroll · zgjidh një punë";
  else nenGati = "E ke kontrolluar · provoje edhe për një punë tjetër";

  let nenIntervista: string;
  if (intervistat === null) nenIntervista = "Po lexohet…";
  else if (kaIntervista === null) nenIntervista = kaInternet ? "S'u lexua. Tërhiqe poshtë për të provuar përsëri." : PA_INTERNET_SHKURT;
  else if (!kaIntervista) nenIntervista = "Ende pa intervistë · AI-ja të pyet për punën që zgjedh";
  else nenIntervista = "E ke bërë një intervistë · praktikoje përsëri";

  // Hapi tjetër: i pari që s'është bërë (e njëjta gjendje si te lista e hapave); nëse është i kyçur, e themi ndershmërisht.
  // CV-ja hapet vetëm kur veçoria është gati (ose në zhvillim); përndryshe tregojmë gjendjen e saj, jo një buton të vdekur.
  const cvHref: Href | null = hapetVecoria(cvVecoria) ? "/cv" : null;
  const cvShenim = tekstiIGjendjes(cvVecoria.gjendja);
  let tjeter: HapiTjeter | null = null;
  if (versionet !== null && ruajtura !== null && kaKontroll !== null && kaIntervista !== null) {
    if (versionet.length === 0) {
      tjeter = { titulli: "Ngarko CV-në", pershkrimi: "Një herë. AI-ja e lexon dhe të tregon çka e ngre dhe çka e ul.", href: cvHref, butoni: "Hap CV-në", shenim: cvShenim };
    } else if (!iAnalizuar) {
      tjeter = { titulli: "Analizoje CV-në", pershkrimi: "AI-ja e lexon CV-në dhe të jep këshilla konkrete.", href: cvHref, butoni: "Hap CV-në", shenim: cvShenim };
    } else if (ruajtura === 0) {
      tjeter = { titulli: "Zgjidh një punë", pershkrimi: "Ruaj me ⭐ punën që do. Pastaj shohim sa je gati për të.", href: "/pune", butoni: "Hap punët" };
    } else if (!kaKontroll) {
      tjeter = hapiIVecorise(gatiVecoria);
    } else if (!kaIntervista) {
      tjeter = hapiIVecorise(intervistaVecoria);
    } else {
      tjeter = {
        ...hapiIVecorise(intervistaVecoria),
        titulli: "Praktiko përsëri",
        pershkrimi: "Bëj edhe një intervistë dhe shih a rritet gatishmëria jote.",
      };
    }
  }

  return (
    <TabScroll onRefresh={rifresko} refreshing={rifreskim}>
      {(cvt?.ok || teRuajturat?.ok || punet?.ok || kontrollet?.ok) && (
        <ShiritiPaInternet teksti={paInternet("po t'i shfaqim të dhënat që i pe herën e fundit").cfare} />
      )}
      <T zbehur madhesia={14}>
        {dataSot()}
        {profili?.emri ? ` · ${profili.emri}` : ""}
      </T>

      <Karta style={styles.qellimi}>
        <T zbehur madhesia={14}>
          Rruga drejt punës
        </T>
        <Rruga hapi={hapiMbaruar} />
        {tjeter === null ? (
          cvt === null || teRuajturat === null || kontrollet === null || intervistat === null ? (
            <Pulsi>
              <View style={styles.skeleti} accessibilityLabel="Po lexohet gjendja jote">
                <Vije gjeresia="45%" lartesia={16} />
                <Vije gjeresia="90%" lartesia={12} />
              </View>
            </Pulsi>
          ) : (
            <T zbehur madhesia={13.5}>
              S&apos;u lexua gjendja jote. Tërhiqe poshtë për të provuar përsëri.
            </T>
          )
        ) : (
          <View style={styles.tjeter}>
            <T zbehur madhesia={13}>
              Hapi tjetër
            </T>
            <T pesha="trashe" madhesia={18}>
              {tjeter.titulli}
            </T>
            <T zbehur madhesia={14}>
              {tjeter.pershkrimi}
            </T>
            {tjeter.href !== null ? (
              <Link href={tjeter.href} asChild>
                <Prekshme
                  accessibilityRole="button"
                  style={StyleSheet.flatten([styles.butoni, { backgroundColor: t.teksti }])}
                >
                  <T pesha="trashe" madhesia={15} ngjyra={t.sfondi}>
                    {tjeter.butoni}
                  </T>
                </Prekshme>
              </Link>
            ) : (
              <T pesha="gjysme" madhesia={13.5} ngjyra={t.theksi}>
                {tjeter.shenim}
              </T>
            )}
          </View>
        )}
      </Karta>

      {/* "Gatishmëria jote": vetëm kontrollet e vërteta (tabela gatishmeria). Pa asnjë kontroll, blloku s'shfaqet. */}
      {kontrollet?.ok && kontrollet.v.length > 0 && (
        <View style={styles.gatishmeria}>
          <T pesha="trashe" madhesia={17} accessibilityRole="header">
            Gatishmëria jote
          </T>
          <Karta style={styles.lista}>
            {kontrollet.v.map((k, i) => (
              <RreshtiIKontrollit key={k.puna_id} kontrolli={k} iFundit={i === kontrollet.v.length - 1} />
            ))}
          </Karta>
        </View>
      )}

      <Karta style={styles.lista}>
        <RreshtiVecorise vecoria={cvVecoria} bere={iAnalizuar !== null} nenTeksti={nenCV} />
        <RreshtiVecorise vecoria={veco("punet")} bere={(ruajtura ?? 0) > 0} nenTeksti={nenPunet} />
        <RreshtiVecorise vecoria={gatiVecoria} bere={kaKontroll === true} nenTeksti={nenGati} />
        <RreshtiVecorise vecoria={intervistaVecoria} bere={kaIntervista === true} nenTeksti={nenIntervista} iFundit />
      </Karta>

      <Link href="/pune" asChild>
        <Prekshme accessibilityRole="button" accessibilityLabel="Hap listën e punëve">
          <Karta style={styles.rreshtKarte}>
            <Ikona emri={IKONAT.canta} madhesia={20} ngjyra={t.theksi} />
            <View style={styles.flex}>
              {punet === null ? (
                <Pulsi>
                  <View style={styles.skeleti} accessibilityLabel="Po ngarkohen punët">
                    <Vije gjeresia="55%" lartesia={16} />
                    <Vije gjeresia="85%" lartesia={12} />
                  </View>
                </Pulsi>
              ) : listaEPuneve === null ? (
                <>
                  <T pesha="trashe" madhesia={15.5}>
                    S&apos;u lexuan punët
                  </T>
                  <T zbehur madhesia={13}>
                    Hape listën për të provuar përsëri
                  </T>
                </>
              ) : (
                <>
                  <T pesha="trashe" madhesia={15.5}>
                    {listaEPuneve.length} punë në Karriera
                  </T>
                  <T zbehur madhesia={13} numberOfLines={2}>
                    {listaEPuneve.length === 0
                      ? "Ende s'ka shpallje"
                      : listaEPuneve
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

      <Link href="/permbledhja" asChild>
        <Prekshme accessibilityRole="button" accessibilityLabel="Hap përmbledhjen time">
          <Karta style={styles.rreshtKarte}>
            <Ikona emri={IKONAT.grafiku} madhesia={20} ngjyra={t.theksi} />
            <View style={styles.flex}>
              <T pesha="trashe" madhesia={15.5}>
                Përmbledhja ime
              </T>
              <T zbehur madhesia={13}>
                Rezultatet e fundit, edhe pa internet
              </T>
            </View>
            <Ikona emri={IKONAT.shigjeta} madhesia={14} ngjyra={t.zbehur} />
          </Karta>
        </Prekshme>
      </Link>
    </TabScroll>
  );
}

// Një kontroll i fundit: titulli i punës, përqindja dhe ndryshimi kundrejt kontrollit të mëparshëm; hap ekranin e saj.
function RreshtiIKontrollit({ kontrolli, iFundit }: { kontrolli: KontrollEFundit; iFundit: boolean }) {
  const t = useTema();
  const { delta } = kontrolli;
  const ndryshimi = delta === null || delta === 0 ? null : `${delta > 0 ? "+" : "−"}${Math.abs(delta)}`;
  const etiketa = `${kontrolli.titulli}, ${kontrolli.kompania}: gati ${kontrolli.perqindja} për qind${
    delta === null || delta === 0 ? "" : `, ${delta > 0 ? "plus" : "minus"} ${Math.abs(delta)} nga herë e kaluar`
  }`;
  return (
    <Link href={{ pathname: "/gati/[id]", params: { id: kontrolli.puna_id } }} asChild>
      <Prekshme
        accessibilityRole="button"
        accessibilityLabel={etiketa}
        style={StyleSheet.flatten([
          styles.kontrolli,
          !iFundit && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.vija },
        ])}
      >
        <View style={styles.flex}>
          <T pesha="trashe" madhesia={15} numberOfLines={1}>
            {kontrolli.titulli}
          </T>
          <T zbehur madhesia={13} numberOfLines={1}>
            {kontrolli.kompania}
          </T>
        </View>
        <View style={styles.perqindja}>
          <T pesha="shumeTrashe" madhesia={20} maxFontSizeMultiplier={1.2} ngjyra={t.theksi}>
            {kontrolli.perqindja}%
          </T>
          {ndryshimi !== null && (
            <T pesha="gjysme" madhesia={12.5} ngjyra={delta !== null && delta > 0 ? t.ok : t.keq}>
              {ndryshimi}
            </T>
          )}
        </View>
        <Ikona emri={IKONAT.shigjeta} madhesia={14} ngjyra={t.zbehur} />
      </Prekshme>
    </Link>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  qellimi: { gap: 10 },
  tjeter: { gap: 4, marginTop: 4 },
  butoni: {
    marginTop: 8,
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingVertical: 13,
    paddingHorizontal: 26,
    minHeight: 44,
    justifyContent: "center",
  },
  lista: { padding: 0, overflow: "hidden" },
  gatishmeria: { gap: 10 },
  kontrolli: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16, minHeight: 56 },
  perqindja: { alignItems: "flex-end", minWidth: 48 },
  rreshtKarte: { flexDirection: "row", alignItems: "center", gap: 12 },
  skeleti: { gap: 7, paddingVertical: 2 },
});
