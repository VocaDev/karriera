// Dokumenti i CV-së së krijuar me AI: parapamja dhe PDF. Del tani bashkë me ndërtuesin (vendimi i Gentit, 11.11).
// Pas Demo Day-t: 5 formatet e tjera dhe rishkrimi në anglisht (CV_PAS_DEMO_DAY_HAPUR); deri atëherë: Kosovë, shqip.
import { SegmentedControl } from "@expo/ui/community/segmented-control";
import * as Print from "expo-print";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useNjoftim } from "@/components/Njoftimet";
import Prekshme from "@/components/Prekshme";
import { Faqja, Ikona, IKONAT, Karta, T, Titulli } from "@/components/ui";
import { krijoCV, merrCVTeFundit, ruajCV, type CvStrukturuar, type FormatiCV, type GjuhaCV } from "@/lib/cv";
import { CV_PAS_DEMO_DAY_HAPUR } from "@/lib/vecorite";
import { prekja } from "@/lib/prekja";
import { useTema } from "@/lib/tema";

const FORMATET: { id: FormatiCV; emri: string }[] = [
  { id: "ks", emri: "Kosovë" },
  { id: "europass", emri: "Europass" },
  { id: "eu", emri: "EU" },
  { id: "us", emri: "US" },
  { id: "uk", emri: "UK" },
  { id: "ats", emri: "ATS" },
];

const GJUHET: { id: GjuhaCV; emri: string }[] = [
  { id: "sq", emri: "Shqip" },
  { id: "en", emri: "English" },
];

const PA_DATELINDJE: FormatiCV[] = ["us", "uk", "ats"];

function titujt(gjuha: GjuhaCV) {
  const en = gjuha === "en";
  return {
    profili: en ? "PROFILE" : "PROFILI",
    arsimi: en ? "EDUCATION" : "ARSIMI",
    pervoja: en ? "EXPERIENCE" : "PËRVOJA",
    projektet: en ? "PROJECTS" : "PROJEKTET",
    aftesite: en ? "SKILLS" : "AFTËSITË",
    gjuhet: en ? "LANGUAGES" : "GJUHËT",
  };
}

function kontaktet(cv: CvStrukturuar, formati: FormatiCV): string[] {
  return [cv.email, cv.telefoni, cv.qyteti, PA_DATELINDJE.includes(formati) ? null : cv.datelindja].filter(
    (v): v is string => !!v,
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// HTML-ja e PDF-së (letër e bardhë, jo tema e app-it). Çdo tekst kalon nga escapeHtml.
function krijoHtml(cv: CvStrukturuar, formati: FormatiCV, gjuha: GjuhaCV) {
  const ats = formati === "ats";
  const t = titujt(gjuha);
  const seksioni = (titull: string, permbajtja: string) => `<section><h2>${titull}</h2>${permbajtja}</section>`;

  const arsimi = cv.arsimi
    .map(
      (a) =>
        `<p><strong>${escapeHtml(a.programi)}</strong><br/>${escapeHtml(a.institucioni)} · ${escapeHtml(a.periudha)}</p>`,
    )
    .join("");
  const pervoja = cv.pervoja
    .map(
      (p) =>
        `<p><strong>${escapeHtml(p.roli)}</strong><br/>${escapeHtml(p.vendi)} · ${escapeHtml(p.periudha)}<br/>${escapeHtml(p.pershkrimi)}</p>`,
    )
    .join("");
  const projektet = cv.projektet
    .map(
      (p) =>
        `<p><strong>${escapeHtml(p.titulli)}</strong><br/>${escapeHtml(p.pershkrimi)}${p.linku ? `<br/>${escapeHtml(p.linku)}` : ""}</p>`,
    )
    .join("");
  const aftesite = cv.aftesite.map((a) => `<span>${escapeHtml(a)}</span>`).join(" · ");
  const gjuhet = cv.gjuhet.map((g) => `${escapeHtml(g.gjuha)} (${escapeHtml(g.niveli)})`).join(" · ");

  return `<!DOCTYPE html>
  <html lang="${gjuha}">
  <head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <style>
      body { font-family: Arial, sans-serif; color: #141414; background: white; margin: 36px; line-height: 1.45; font-size: 11px; }
      header { border-bottom: 2px solid #141414; padding-bottom: 14px; }
      h1 { font-size: 25px; margin: 0 0 4px; }
      h3 { font-size: 13px; margin: 0 0 8px; color: #555; }
      h2 { font-size: 12px; text-transform: uppercase; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-top: 22px; }
      p { margin: 7px 0 12px; }
      section { page-break-inside: avoid; }
      .skills { line-height: 2; }
      ${ats ? "body { margin: 24px; font-size: 10px; } h2 { border-bottom: none; }" : ""}
    </style>
  </head>
  <body>
    <header>
      <h1>${escapeHtml(cv.emri)}</h1>
      <h3>${escapeHtml(cv.titulli)}</h3>
      <div>${kontaktet(cv, formati).map(escapeHtml).join(" · ")}</div>
    </header>
    ${seksioni(t.profili, `<p>${escapeHtml(cv.profili)}</p>`)}
    ${seksioni(t.arsimi, arsimi)}
    ${seksioni(t.pervoja, pervoja)}
    ${seksioni(t.projektet, projektet)}
    ${seksioni(t.aftesite, `<p class="skills">${aftesite}</p>`)}
    ${seksioni(t.gjuhet, `<p>${gjuhet}</p>`)}
  </body>
  </html>`;
}

type Gjendja = { lloji: "duke" } | { lloji: "gati"; cv: CvStrukturuar | null } | { lloji: "gabim"; mesazhi: string };

export default function DokumentiCV() {
  const t = useTema();
  const router = useRouter();
  const njofto = useNjoftim();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [gjendja, setGjendja] = useState<Gjendja>({ lloji: "duke" });
  const [formati, setFormati] = useState<FormatiCV>("ks");
  const [gjuha, setGjuha] = useState<GjuhaCV>("sq");
  const [dukeGjeneruar, setDukeGjeneruar] = useState(false);
  const [dukeRuajtur, setDukeRuajtur] = useState(false);

  useEffect(() => {
    let aktiv = true;
    merrCVTeFundit(id)
      .then((r) => {
        if (!aktiv) return;
        setGjendja({ lloji: "gati", cv: r?.cv ?? null });
        if (r) {
          setFormati(r.formati);
          setGjuha(r.gjuha);
        }
      })
      .catch((e: unknown) => {
        if (aktiv) setGjendja({ lloji: "gabim", mesazhi: e instanceof Error ? e.message : "S'u hap CV-ja." });
      });
    return () => {
      aktiv = false;
    };
  }, [id]);

  const cv = gjendja.lloji === "gati" ? gjendja.cv : null;

  // Formati ose gjuha e re = AI-ja e rishkruan CV-në (cv-create), pa shtuar fakte.
  async function rishkruaj(formatRi: FormatiCV, gjuhaRe: GjuhaCV) {
    if (!cv || dukeGjeneruar || (formatRi === formati && gjuhaRe === gjuha)) return;
    prekja.zgjedhje();
    setDukeGjeneruar(true);
    try {
      const cvRi = await krijoCV({ cv }, formatRi, gjuhaRe);
      setGjendja({ lloji: "gati", cv: cvRi });
      setFormati(formatRi);
      setGjuha(gjuhaRe);
    } catch (e) {
      prekja.gabim();
      njofto(e instanceof Error ? e.message : "S'u ndryshua CV-ja.", "gabim");
    } finally {
      setDukeGjeneruar(false);
    }
  }

  async function shkarkoPDF() {
    if (!cv) return;
    setDukeGjeneruar(true);
    try {
      const file = await Print.printToFileAsync({ html: krijoHtml(cv, formati, gjuha) });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: "application/pdf", dialogTitle: "CV-ja ime", UTI: "com.adobe.pdf" });
      } else {
        njofto("Ndarja e skedarëve s'mbështetet në këtë pajisje.", "info");
      }
    } catch {
      prekja.gabim();
      njofto("S'u krijua PDF-ja. Provo përsëri.", "gabim");
    } finally {
      setDukeGjeneruar(false);
    }
  }

  async function ruaje() {
    if (!cv) return;
    setDukeRuajtur(true);
    try {
      await ruajCV(cv, formati, gjuha);
      prekja.sukses();
      njofto("Versioni u ruajt", "sukses");
    } catch (e) {
      prekja.gabim();
      njofto(e instanceof Error ? e.message : "S'u ruajt CV-ja.", "gabim");
    } finally {
      setDukeRuajtur(false);
    }
  }

  if (gjendja.lloji === "duke") {
    return (
      <Faqja>
        <View style={styles.qender}>
          <ActivityIndicator size="large" color={t.zbehur} />
          <T zbehur>Po e hapim CV-në…</T>
        </View>
      </Faqja>
    );
  }

  if (!cv) {
    return (
      <Faqja>
        <Titulli>CV-ja ime</Titulli>
        <Karta style={styles.bosh}>
          <T>{gjendja.lloji === "gabim" ? gjendja.mesazhi : "Ende s'ke krijuar asnjë CV me AI."}</T>
          <Prekshme
            onPress={() => router.replace("/cv/ndertoje")}
            accessibilityRole="button"
            style={[styles.butonDyte, { borderColor: t.vija }]}
          >
            <T pesha="trashe">Ndërto CV-në</T>
          </Prekshme>
        </Karta>
      </Faqja>
    );
  }

  const tit = titujt(gjuha);
  const shenjaAI = (
    <T zbehur pesha="trashe" madhesia={10}>
      AI
    </T>
  );

  return (
    <Faqja>
      <Titulli>CV-ja ime</Titulli>
      <T zbehur>
        {CV_PAS_DEMO_DAY_HAPUR
          ? "Ndrysho formatin dhe gjuhën para shkarkimit."
          : "Kontrolloje, pastaj shkarkoje si PDF. Formati: Kosovë, shqip."}
      </T>

      {CV_PAS_DEMO_DAY_HAPUR && (
        <>
      <T pesha="trashe" style={styles.nentitull}>
        Formati
      </T>
      <View style={styles.chips}>
        {FORMATET.map((f) => {
          const zgjedhur = formati === f.id;
          return (
            <Prekshme
              key={f.id}
              onPress={() => rishkruaj(f.id, gjuha)}
              disabled={dukeGjeneruar}
              accessibilityRole="button"
              accessibilityState={{ selected: zgjedhur, disabled: dukeGjeneruar }}
              style={[styles.chip, { backgroundColor: zgjedhur ? t.teksti : t.karta, borderColor: t.vija }]}
            >
              <T pesha="mesme" ngjyra={zgjedhur ? t.sfondi : t.teksti} madhesia={13}>
                {f.emri}
              </T>
            </Prekshme>
          );
        })}
      </View>

      <T pesha="trashe" style={styles.nentitull}>
        Gjuha
      </T>
      <SegmentedControl
        values={GJUHET.map((g) => g.emri)}
        selectedIndex={GJUHET.findIndex((g) => g.id === gjuha)}
        enabled={!dukeGjeneruar}
        onChange={(e) => rishkruaj(formati, GJUHET[e.nativeEvent.selectedSegmentIndex].id)}
        appearance={t.errët ? "dark" : "light"}
        accessibilityLabel="Gjuha e CV-së"
      />
        </>
      )}

      <View style={styles.kryeParapamjes}>
        <T pesha="trashe">Parapamja</T>
        {dukeGjeneruar ? <ActivityIndicator color={t.zbehur} /> : null}
      </View>

      <Karta style={styles.flete}>
        <View style={[styles.kontakti, { borderBottomColor: t.teksti }]}>
          <T pesha="shumeTrashe" madhesia={23}>
            {cv.emri}
          </T>
          <T pesha="mesme" zbehur>
            {cv.titulli}
          </T>
          <T madhesia={12} zbehur>
            {kontaktet(cv, formati).join(" · ")}
          </T>
        </View>

        <View style={styles.seksion}>
          <T pesha="trashe">{tit.profili}</T>
          <T>{cv.profili}</T>
        </View>

        <View style={styles.seksion}>
          <T pesha="trashe">{tit.arsimi}</T>
          {cv.arsimi.map((a, i) => (
            <View key={`${a.programi}-${i}`} style={styles.rresht}>
              <T pesha="mesme">{a.programi}</T>
              <T zbehur madhesia={13}>
                {a.institucioni} · {a.periudha}
              </T>
            </View>
          ))}
        </View>

        <View style={styles.seksion}>
          <T pesha="trashe">{tit.pervoja}</T>
          {cv.pervoja.map((p, i) => (
            <View key={`${p.roli}-${i}`} style={styles.rresht}>
              <View style={styles.rreshtiTitullit}>
                <T pesha="mesme">{p.roli}</T>
                {p.nga_ai ? shenjaAI : null}
              </View>
              <T zbehur madhesia={13}>
                {p.vendi} · {p.periudha}
              </T>
              <T>{p.pershkrimi}</T>
            </View>
          ))}
        </View>

        <View style={styles.seksion}>
          <T pesha="trashe">{tit.projektet}</T>
          {cv.projektet.map((p, i) => (
            <View key={`${p.titulli}-${i}`} style={styles.rresht}>
              <View style={styles.rreshtiTitullit}>
                <T pesha="mesme">{p.titulli}</T>
                {p.nga_ai ? shenjaAI : null}
              </View>
              <T>{p.pershkrimi}</T>
              {p.linku ? (
                <T zbehur madhesia={12}>
                  {p.linku}
                </T>
              ) : null}
            </View>
          ))}
        </View>

        <View style={styles.seksion}>
          <T pesha="trashe">{tit.aftesite}</T>
          <T>{cv.aftesite.join(" · ")}</T>
        </View>

        <View style={styles.seksion}>
          <T pesha="trashe">{tit.gjuhet}</T>
          <T>{cv.gjuhet.map((g) => `${g.gjuha} (${g.niveli})`).join(" · ")}</T>
        </View>
      </Karta>

      {cv.pervoja.some((p) => p.nga_ai) || cv.projektet.some((p) => p.nga_ai) ? (
        <View style={styles.shenim}>
          <T pesha="trashe" madhesia={12}>
            AI
          </T>
          <T zbehur madhesia={12} style={styles.flex}>
            Rreshtat me AI u rishkruan nga AI-ja. Kontrolloji para se ta dërgosh CV-në.
          </T>
        </View>
      ) : null}

      {formati === "ats" ? (
        <T zbehur madhesia={12} style={styles.shenimATS}>
          Formati ATS përdor një paraqitje të thjeshtë, me një kolonë, për lexim nga sistemet automatike.
        </T>
      ) : null}

      <Prekshme
        onPress={shkarkoPDF}
        disabled={dukeGjeneruar}
        accessibilityRole="button"
        style={[styles.buton, { backgroundColor: t.teksti, opacity: dukeGjeneruar ? 0.7 : 1 }]}
      >
        {dukeGjeneruar ? (
          <ActivityIndicator color={t.sfondi} />
        ) : (
          <>
            <Ikona emri={IKONAT.dokumenti} ngjyra={t.sfondi} />
            <T ngjyra={t.sfondi} pesha="trashe">
              Shkarko PDF
            </T>
          </>
        )}
      </Prekshme>

      {/* Ndërtuesi e ruan vetë versionin; "Ruaje" duhet vetëm pas një formati/gjuhe të re (pas Demo Day-t). */}
      {CV_PAS_DEMO_DAY_HAPUR && (
        <Prekshme
          onPress={ruaje}
          disabled={dukeRuajtur}
          accessibilityRole="button"
          style={[styles.butonDyte, { borderColor: t.vija }]}
        >
          {dukeRuajtur ? <ActivityIndicator color={t.teksti} /> : <T pesha="trashe">Ruaje versionin</T>}
        </Prekshme>
      )}

      <View style={styles.hapesira} />
    </Faqja>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  qender: { alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 60 },
  bosh: { marginTop: 16, gap: 8 },
  nentitull: { marginTop: 22, marginBottom: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 30,
    paddingHorizontal: 15,
    minHeight: 44,
    justifyContent: "center",
  },
  kryeParapamjes: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 26,
    marginBottom: 12,
  },
  flete: { padding: 20 },
  kontakti: { paddingBottom: 16, borderBottomWidth: 2, gap: 5 },
  seksion: { marginTop: 18, gap: 8 },
  rresht: { gap: 3, marginTop: 5 },
  rreshtiTitullit: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  shenim: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 14 },
  shenimATS: { marginTop: 12 },
  buton: {
    minHeight: 54,
    borderRadius: 30,
    marginTop: 24,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  butonDyte: {
    minHeight: 52,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 30,
    marginTop: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  hapesira: { height: 30 },
});
