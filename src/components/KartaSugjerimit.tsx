// Karta e një sugjerimi të analizës: çka ndryshon (para → pas), pse, dhe një prekje: "Shtoje në CV" ose "Kalo".
// Faktet që AI-ja s'i di ([numri i përdoruesve]) bëhen fusha të vogla: kandidati shkruan vlerën e vërtetë,
// AI-ja s'e shpik kurrë. Pa vlerë, sugjerimi s'shtohet (dridhje + shënim nën fushë, si te formularët).
import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import Animated from "react-native-reanimated";

import Prekshme from "@/components/Prekshme";
import { Chip, Ikona, IKONAT, Karta, T } from "@/components/ui";
import type { SugjerimCV } from "@/lib/cv";
import { useDridhja } from "@/lib/levizja";
import { celesiVleres, etiketaEPlaceholderit, placeholderat, type Vendimi } from "@/lib/rindertimi";
import { SHKRONJAT, useTema } from "@/lib/tema";

export const EMRAT_E_LLOJEVE: Record<SugjerimCV["lloji"], string> = {
  rishkrim: "Rishkrim",
  gabim: "Drejtshkrim",
  shto: "Shto",
  hiq: "Hiq",
};

/** Çka ndodhi kur u shtyp "Shtoje në CV" (e vendos ekrani). */
export type PergjigjjaEPranimit = "ok" | "mungojne" | "perplasje";

type Props = {
  sugjerimi: SugjerimCV;
  ku: string; // "Përvoja · Praktikant"
  vendimi: Vendimi | undefined;
  zbatohet: boolean; // false = s'gjendet saktë në CV: vetëm këshillë
  vlerat: Record<string, string>;
  onVlera: (placeholder: string, vlera: string) => void;
  onPrano: () => PergjigjjaEPranimit;
  onKalo: () => void;
  onZhbej: () => void;
};

// "Ndërtova [numri] ekrane" → copa teksti dhe placeholder-a, që të shfaqen ndryshe (ose me vlerën e shkruar).
function copat(pas: string, lista: string[]): { teksti: string; placeholder: string | null }[] {
  if (lista.length === 0) return [{ teksti: pas, placeholder: null }];
  const shmang = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(${lista.map(shmang).join("|")})`, "g");
  return pas
    .split(re)
    .filter(Boolean)
    .map((c) => ({ teksti: c, placeholder: lista.includes(c) ? c : null }));
}

export default function KartaSugjerimit({
  sugjerimi: s,
  ku,
  vendimi,
  zbatohet,
  vlerat,
  onVlera,
  onPrano,
  onKalo,
  onZhbej,
}: Props) {
  const t = useTema();
  const { stili: stiliIDridhjes, dridhu } = useDridhja();
  const [provoi, setProvoi] = useState(false); // shënimi nën fusha del vetëm pas provës së parë

  const lista = placeholderat(s);
  const mungojne = lista.filter((p) => !vlerat[celesiVleres(s.id, p)]?.trim());

  function prano() {
    const r = onPrano();
    if (r === "mungojne") {
      setProvoi(true);
      dridhu();
    }
  }

  const tekstiIRi = (
    <T pesha="mesme" style={styles.lartesia}>
      {copat(s.pas, lista).map((c, i) => {
        if (!c.placeholder) return c.teksti;
        const vlera = vlerat[celesiVleres(s.id, c.placeholder)]?.trim();
        return vlera ? (
          <T key={i} pesha="trashe" style={styles.vleraEShkruar}>
            {vlera}
          </T>
        ) : (
          <T key={i} pesha="gjysme" zbehur style={{ backgroundColor: t.karta2 }}>
            {` ${etiketaEPlaceholderit(c.placeholder)} `}
          </T>
        );
      })}
    </T>
  );

  // ---------- E vendosur: kompakte, me "Zhbëj" ----------
  if (vendimi) {
    const pranuar = vendimi === "pranuar";
    return (
      <Karta style={styles.kompakte}>
        <View style={styles.rreshti}>
          {pranuar ? <Ikona emri={IKONAT.check} madhesia={15} ngjyra={t.ok} /> : null}
          <T pesha="trashe" madhesia={13} ngjyra={pranuar ? t.ok : t.zbehur} style={styles.flex} numberOfLines={1}>
            {pranuar ? "U shtua në CV" : "E kalove"} · {ku}
          </T>
          <Prekshme
            onPress={onZhbej}
            accessibilityRole="button"
            accessibilityLabel={pranuar ? "Zhbëje, hiqe nga CV-ja" : "Zhbëje, shiko përsëri sugjerimin"}
            hitSlop={8}
            style={styles.zhbej}
          >
            <T pesha="gjysme" madhesia={13} zbehur>
              Zhbëj
            </T>
          </Prekshme>
        </View>
        {pranuar && s.lloji !== "hiq" ? (
          <T numberOfLines={3} madhesia={14}>
            {tekstiIRi}
          </T>
        ) : null}
        {pranuar && s.lloji === "hiq" ? (
          <T numberOfLines={2} madhesia={14} zbehur style={styles.vize}>
            {s.para}
          </T>
        ) : null}
      </Karta>
    );
  }

  // ---------- E hapur ----------
  return (
    <Karta style={styles.karta}>
      <View style={styles.rreshti}>
        <Chip teksti={zbatohet ? EMRAT_E_LLOJEVE[s.lloji] : "Këshillë"} />
        <T zbehur madhesia={12} numberOfLines={1} style={styles.flex}>
          {ku}
        </T>
      </View>

      {s.arsyeja ? <T>{s.arsyeja}</T> : null}

      <View style={[styles.ndryshimi, { borderLeftColor: t.vija }]}>
        {s.para ? (
          <View style={styles.pjesa}>
            <T zbehur pesha="trashe" madhesia={11}>
              {s.lloji === "hiq" ? "HIQET" : "TANI"}
            </T>
            <T zbehur style={s.lloji === "hiq" ? styles.vize : styles.lartesia}>
              {s.para}
            </T>
          </View>
        ) : null}
        {s.lloji !== "hiq" ? (
          <View style={styles.pjesa}>
            <T ngjyra={t.ok} pesha="trashe" madhesia={11}>
              {s.lloji === "shto" ? "SHTOHET" : "BËHET"}
            </T>
            {tekstiIRi}
          </View>
        ) : null}
      </View>

      {zbatohet && lista.length > 0 ? (
        <View style={styles.fushat}>
          {lista.map((p) => {
            const celesi = celesiVleres(s.id, p);
            const bosh = provoi && !vlerat[celesi]?.trim();
            return (
              <View key={p} style={styles.fusha}>
                <T zbehur madhesia={12} pesha="gjysme">
                  {etiketaEPlaceholderit(p)}
                </T>
                <TextInput
                  value={vlerat[celesi] ?? ""}
                  onChangeText={(v) => onVlera(p, v)}
                  placeholder="Shkruaj vlerën e vërtetë"
                  placeholderTextColor={t.zbehur}
                  maxLength={200}
                  returnKeyType="done"
                  accessibilityLabel={`Plotëso: ${etiketaEPlaceholderit(p)}`}
                  style={[
                    styles.input,
                    { color: t.teksti, backgroundColor: t.karta2, borderColor: bosh ? t.keq : "transparent" },
                  ]}
                />
              </View>
            );
          })}
          {provoi && mungojne.length > 0 ? (
            <T ngjyra={t.keq} madhesia={13}>
              Shkruaj vlerën e vërtetë, ose kaloje këtë sugjerim. AI-ja s&apos;i shpik numrat.
            </T>
          ) : null}
        </View>
      ) : null}

      {!zbatohet ? (
        <T zbehur madhesia={12}>
          Ky ndryshim s&apos;gjendet saktë në CV. Bëje vetë te &quot;Rindërto CV-në&quot;, ku mund ta ndryshosh çdo rresht.
        </T>
      ) : null}

      <View style={styles.butonat}>
        {zbatohet ? (
          <Animated.View style={[styles.flex, stiliIDridhjes]}>
            <Prekshme
              onPress={prano}
              accessibilityRole="button"
              accessibilityLabel={s.lloji === "hiq" ? "Hiqe nga CV-ja" : "Shtoje në CV"}
              accessibilityHint={mungojne.length > 0 ? "Plotëso më parë vlerat që mungojnë" : undefined}
              style={[styles.buton, { backgroundColor: t.teksti }]}
            >
              <T ngjyra={t.sfondi} pesha="trashe" madhesia={14}>
                {s.lloji === "hiq" ? "Hiqe nga CV-ja" : "Shtoje në CV"}
              </T>
            </Prekshme>
          </Animated.View>
        ) : null}
        <Prekshme
          onPress={onKalo}
          accessibilityRole="button"
          accessibilityLabel={zbatohet ? "Kalo këtë sugjerim" : "E kuptova"}
          style={[styles.buton, styles.butonDyte, zbatohet ? null : styles.flex, { borderColor: t.vija }]}
        >
          <T pesha="trashe" madhesia={14}>
            {zbatohet ? "Kalo" : "E kuptova"}
          </T>
        </Prekshme>
      </View>
    </Karta>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  karta: { gap: 12, padding: 16 },
  kompakte: { gap: 6, paddingVertical: 10, paddingHorizontal: 16 },
  rreshti: { flexDirection: "row", alignItems: "center", gap: 8 },
  ndryshimi: { gap: 10, borderLeftWidth: 2, paddingLeft: 12 },
  pjesa: { gap: 3 },
  lartesia: { lineHeight: 22 },
  vize: { textDecorationLine: "line-through", lineHeight: 22 },
  vleraEShkruar: { textDecorationLine: "underline" },
  fushat: { gap: 10 },
  fusha: { gap: 5 },
  input: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 15,
    fontFamily: SHKRONJAT.normal,
  },
  butonat: { flexDirection: "row", gap: 10 },
  buton: { minHeight: 46, borderRadius: 28, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  butonDyte: { borderWidth: StyleSheet.hairlineWidth },
  zhbej: { minHeight: 44, justifyContent: "center", paddingHorizontal: 6 },
});
