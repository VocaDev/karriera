
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { Faqja, Ikona, IKONAT, Karta, T, Titulli } from "@/components/ui";
import { useTema } from "@/lib/tema";
import {
  krijoCV,
  merrCVTeFundit,
  ruajCV,
  type CvStrukturuar,
  type FormatiCV,
  type GjuhaCV,
} from "@/lib/cv";

const FORMATET: { id: FormatiCV; emri: string }[] = [
  { id: "ks", emri: "Kosovë" },
  { id: "europass", emri: "Europass" },
  { id: "eu", emri: "EU" },
  { id: "us", emri: "US" },
  { id: "uk", emri: "UK" },
  { id: "ats", emri: "ATS" },
];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function krijoHtml(cv: CvStrukturuar, formati: FormatiCV, gjuha: GjuhaCV) {
  const en = gjuha === "en";
  const ats = formati === "ats";
  const paDatelindje = ["us", "uk", "ats"].includes(formati);

  const titujt = {
    profili: en ? "PROFILE" : "PROFILI",
    arsimi: en ? "EDUCATION" : "ARSIMI",
    pervoja: en ? "EXPERIENCE" : "PËRVOJA",
    projektet: en ? "PROJECTS" : "PROJEKTET",
    aftesite: en ? "SKILLS" : "AFTËSITË",
    gjuhet: en ? "LANGUAGES" : "GJUHËT",
  };

  const seksioni = (titull: string, permbajtja: string) =>
    `<section><h2>${titull}</h2>${permbajtja}</section>`;

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

  const aftesite = cv.aftesite
    .map((a) => `<span>${escapeHtml(a)}</span>`)
    .join(" · ");

  const gjuhet = cv.gjuhet
    .map((g) => `${escapeHtml(g.gjuha)} (${escapeHtml(g.niveli)})`)
    .join(" · ");

    const kontaktet = [
    cv.email,
    cv.telefoni,
    cv.qyteti,
    !paDatelindje ? cv.datelindja : null,
  ]
    .filter((value): value is string => value !== null)
    .map(escapeHtml)
    .join(" · ");

  return `<!DOCTYPE html>
  <html lang="${en ? "en" : "sq"}">
  <head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <style>
      body {
        font-family: Arial, sans-serif;
        color: #141414;
        background: white;
        margin: 36px;
        line-height: 1.45;
        font-size: 11px;
      }
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
      <div>${kontaktet}</div>
    </header>
    ${seksioni(titujt.profili, `<p>${escapeHtml(cv.profili)}</p>`)}
    ${seksioni(titujt.arsimi, arsimi)}
    ${seksioni(titujt.pervoja, pervoja)}
    ${seksioni(titujt.projektet, projektet)}
    ${seksioni(titujt.aftesite, `<p class="skills">${aftesite}</p>`)}
    ${seksioni(titujt.gjuhet, `<p>${gjuhet}</p>`)}
  </body>
  </html>`;
}

export default function DokumentiCV() {
  const t = useTema();
  const router = useRouter();

  const [cv, setCv] = useState<CvStrukturuar | null>(null);
  const [formati, setFormati] = useState<FormatiCV>("ks");
  const [gjuha, setGjuha] = useState<GjuhaCV>("sq");
  const [dukeNgarkuar, setDukeNgarkuar] = useState(true);
  const [dukeGjeneruar, setDukeGjeneruar] = useState(false);
  const [dukeRuajtur, setDukeRuajtur] = useState(false);

  useEffect(() => {
    let aktiv = true;

    async function ngarko() {
      try {
        const rezultati = await merrCVTeFundit();
        if (aktiv) setCv(rezultati);
      } catch {
        Alert.alert("Gabim", "Nuk mundëm ta hapim CV-në.");
      } finally {
        if (aktiv) setDukeNgarkuar(false);
      }
    }

    void ngarko();
    return () => {
      aktiv = false;
    };
  }, []);

  const ndryshoFormatin = useCallback(
    async (formatRi: FormatiCV) => {
      if (!cv || formatRi === formati) return;

      setDukeGjeneruar(true);
      try {
        const cvRi = await krijoCV({ cv }, formatRi, gjuha);
        setCv(cvRi);
        setFormati(formatRi);
      } catch {
        Alert.alert("Gabim", "Nuk mundëm ta ndryshojmë formatin.");
      } finally {
        setDukeGjeneruar(false);
      }
    },
    [cv, formati, gjuha],
  );

  const ndryshoGjuhen = useCallback(
    async (gjuhaRe: GjuhaCV) => {
      if (!cv || gjuhaRe === gjuha) return;

      setDukeGjeneruar(true);
      try {
        const cvRi = await krijoCV({ cv }, formati, gjuhaRe);
        setCv(cvRi);
        setGjuha(gjuhaRe);
      } catch {
        Alert.alert("Gabim", "Nuk mundëm ta ndryshojmë gjuhën.");
      } finally {
        setDukeGjeneruar(false);
      }
    },
    [cv, formati, gjuha],
  );

  async function shkarkoPDF() {
    if (!cv) return;

    setDukeGjeneruar(true);
    try {
      const file = await Print.printToFileAsync({
        html: krijoHtml(cv, formati, gjuha),
      });

      const mundTeNdaje = await Sharing.isAvailableAsync();
      if (mundTeNdaje) {
        await Sharing.shareAsync(file.uri, {
          mimeType: "application/pdf",
          dialogTitle: "CV-ja ime",
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert("PDF u krijua", `Skedari: ${file.uri}`);
      }
    } catch {
      Alert.alert("Gabim", "Nuk mundëm ta krijojmë PDF-në.");
    } finally {
      setDukeGjeneruar(false);
    }
  }

  async function ruaje() {
    if (!cv) return;

    setDukeRuajtur(true);
    try {
      await ruajCV(cv, formati);
      Alert.alert("U ruajt", "Versioni i ri i CV-së u ruajt.");
    } catch {
      Alert.alert("Gabim", "Nuk mundëm ta ruajmë CV-në.");
    } finally {
      setDukeRuajtur(false);
    }
  }

  if (dukeNgarkuar) {
    return (
      <Faqja>
        <View style={styles.qender}>
          <ActivityIndicator size="large" color={t.theksi} />
          <T zbehur>Po e hapim CV-në...</T>
        </View>
      </Faqja>
    );
  }

  if (!cv) {
    return (
      <Faqja>
        <Titulli>CV-ja ime</Titulli>
        <Karta>
          <T>Nuk u gjet asnjë CV.</T>
          <Pressable onPress={() => router.replace("/cv/ndertoje")}>
            <T pesha="trashe">Ndërto CV-në</T>
          </Pressable>
        </Karta>
      </Faqja>
    );
  }

  const shfaqDatelindjen =
    !["us", "uk", "ats"].includes(formati) && cv.datelindja;

  return (
    <Faqja>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.krye}>
          <Pressable onPress={() => router.back()} style={styles.kthim}>
            <Ikona emri={IKONAT.shigjeta} madhesia={18} />
          </Pressable>
          <T zbehur madhesia={12}>DOKUMENTI YT</T>
        </View>

        <Titulli>CV-ja ime</Titulli>
        <T zbehur>Ndrysho formatin, gjuhën dhe përmbajtjen para shkarkimit.</T>

        <T pesha="trashe" style={styles.nentitull}>Formati</T>
        <View style={styles.chips}>
          {FORMATET.map((f) => (
            <Pressable
              key={f.id}
              onPress={() => void ndryshoFormatin(f.id)}
              style={[
                styles.chip,
                {
                  backgroundColor: formati === f.id ? t.teksti : t.karta,
                  borderColor: t.vija,
                },
              ]}
            >
              <T
                pesha="mesme"
                ngjyra={formati === f.id ? t.sfondi : t.teksti}
                madhesia={13}
              >
                {f.emri}
              </T>
            </Pressable>
          ))}
        </View>

        <T pesha="trashe" style={styles.nentitull}>Gjuha</T>
        <View style={styles.chips}>
          {([
            { id: "sq" as const, emri: "Shqip" },
            { id: "en" as const, emri: "English" },
          ]).map((g) => (
            <Pressable
              key={g.id}
              onPress={() => void ndryshoGjuhen(g.id)}
              style={[
                styles.chip,
                {
                  backgroundColor: gjuha === g.id ? t.teksti : t.karta,
                  borderColor: t.vija,
                },
              ]}
            >
              <T
                pesha="mesme"
                ngjyra={gjuha === g.id ? t.sfondi : t.teksti}
                madhesia={13}
              >
                {g.emri}
              </T>
            </Pressable>
          ))}
        </View>

        <View style={styles.kryeParapamjes}>
          <T pesha="trashe">Parapamja</T>
          {dukeGjeneruar ? (
            <ActivityIndicator color={t.theksi} />
          ) : null}
        </View>

        <Karta style={styles.flete}>
          <View style={styles.kontakti}>
            <T pesha="shumeTrashe" madhesia={23}>{cv.emri}</T>
            <T pesha="mesme" zbehur>{cv.titulli}</T>
            <T madhesia={12} zbehur>
              {[cv.email, cv.telefoni, cv.qyteti, shfaqDatelindjen]
                .filter(Boolean)
                .join(" · ")}
            </T>
          </View>

          <View style={styles.seksion}>
            <T pesha="trashe">PROFILI</T>
            <T>{cv.profili}</T>
          </View>

          <View style={styles.seksion}>
            <T pesha="trashe">ARSIMI</T>
            {cv.arsimi.map((a, i) => (
              <View key={`${a.programi}-${i}`} style={styles.rresht}>
                <T pesha="mesme">{a.programi}</T>
                <T zbehur madhesia={13}>{a.institucioni} · {a.periudha}</T>
              </View>
            ))}
          </View>

          <View style={styles.seksion}>
            <T pesha="trashe">PËRVOJA</T>
            {cv.pervoja.map((p, i) => (
              <View key={`${p.roli}-${i}`} style={styles.rresht}>
                <View style={styles.rreshtiTitullit}>
                  <T pesha="mesme">{p.roli}</T>
                  {p.nga_ai ? <T ngjyra={t.theksi} madhesia={10}>AI</T> : null}
                </View>
                <T zbehur madhesia={13}>{p.vendi} · {p.periudha}</T>
                <T>{p.pershkrimi}</T>
              </View>
            ))}
          </View>

          <View style={styles.seksion}>
            <T pesha="trashe">PROJEKTET</T>
            {cv.projektet.map((p, i) => (
              <View key={`${p.titulli}-${i}`} style={styles.rresht}>
                <View style={styles.rreshtiTitullit}>
                  <T pesha="mesme">{p.titulli}</T>
                  {p.nga_ai ? <T ngjyra={t.theksi} madhesia={10}>AI</T> : null}
                </View>
                <T>{p.pershkrimi}</T>
                {p.linku ? <T zbehur madhesia={12}>{p.linku}</T> : null}
              </View>
            ))}
          </View>

          <View style={styles.seksion}>
            <T pesha="trashe">AFTËSITË</T>
            <T>{cv.aftesite.join(" · ")}</T>
          </View>

          <View style={styles.seksion}>
            <T pesha="trashe">GJUHËT</T>
            <T>{cv.gjuhet.map((g) => `${g.gjuha} (${g.niveli})`).join(" · ")}</T>
          </View>
        </Karta>

        {cv.pervoja.some((p) => p.nga_ai) ||
        cv.projektet.some((p) => p.nga_ai) ? (
          <View style={styles.shenim}>
            <T ngjyra={t.theksi} pesha="trashe" madhesia={12}>AI</T>
            <T zbehur madhesia={12}>
              Rreshtat me AI u rishkruan. I ndryshon para se ta shkarkosh.
            </T>
          </View>
        ) : null}

        {formati === "ats" ? (
          <T zbehur madhesia={12} style={styles.shenimATS}>
            Formati ATS përdor një paraqitje të thjeshtë, me një kolonë, për lexim nga sistemet automatike.
          </T>
        ) : null}

        <Pressable
          onPress={() => void shkarkoPDF()}
          disabled={dukeGjeneruar}
          style={[styles.buton, { backgroundColor: t.teksti }]}
        >
          {dukeGjeneruar ? (
            <ActivityIndicator color={t.sfondi} />
          ) : (
            <>
              <Ikona emri={IKONAT.dokumenti} ngjyra={t.sfondi} />
              <T ngjyra={t.sfondi} pesha="trashe">Shkarko PDF</T>
            </>
          )}
        </Pressable>

        <Pressable
          onPress={() => void ruaje()}
          disabled={dukeRuajtur}
          style={[styles.butonDyte, { borderColor: t.vija }]}
        >
          {dukeRuajtur ? (
            <ActivityIndicator color={t.teksti} />
          ) : (
            <T pesha="trashe">Ruaje versionin</T>
          )}
        </Pressable>

        <View style={{ height: 30 }} />
      </ScrollView>
    </Faqja>
  );
}

const styles = StyleSheet.create({
  qender: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  krye: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  kthim: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  nentitull: {
    marginTop: 22,
    marginBottom: 10,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 30,
    paddingHorizontal: 15,
    paddingVertical: 9,
  },
  kryeParapamjes: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 26,
    marginBottom: 12,
  },
  flete: {
    padding: 20,
    gap: 0,
  },
  kontakti: {
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: "#141414",
    gap: 5,
  },
  seksion: {
    marginTop: 18,
    gap: 8,
  },
  rresht: {
    gap: 3,
    marginTop: 5,
  },
  rreshtiTitullit: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  shenim: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 14,
  },
  shenimATS: {
    marginTop: 12,
  },
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
    borderWidth: 1,
    borderRadius: 30,
    marginTop: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});
