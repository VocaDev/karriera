// Pjesët e formularëve në stilin D (hyrja, regjistrimi, "Shto një punë"): fusha, udhëzimi, butoni kryesor.
import type { Ref } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  TextInput,
  type PressableProps,
  type TextInputInstance,
  type TextInputProps,
} from "react-native";

import Prekshme from "@/components/Prekshme";
import { T } from "@/components/ui";
import { SHKRONJAT, useTema } from "@/lib/tema";

// Fushë teksti: e bardhë, pa kornizë, me qoshe të rrumbullakëta; kornizë e kuqe vetëm kur mungon diçka.
export function Fusha({ ref, gabim = false, style, ...props }: TextInputProps & { ref?: Ref<TextInputInstance>; gabim?: boolean }) {
  const t = useTema();
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={t.zbehur}
      {...props}
      style={[
        styles.fusha,
        { backgroundColor: t.karta, color: t.teksti, shadowColor: t.hija, fontFamily: SHKRONJAT.normal },
        gabim && { borderColor: t.keq, borderWidth: 1.5 },
        style,
      ]}
    />
  );
}

// Udhëzimi poshtë fushës: del vetëm pasi provon të dërgosh, dhe zhduket sapo fusha plotësohet.
export function Udhezimi({ shfaq, children }: { shfaq: boolean; children: string }) {
  const t = useTema();
  if (!shfaq) return null;
  return (
    <T madhesia={13} ngjyra={t.keq}>
      {children}
    </T>
  );
}

export function Etiketa({ children }: { children: string }) {
  return (
    <T pesha="gjysme" madhesia={14} style={styles.etiketa}>
      {children}
    </T>
  );
}

// Butoni kryesor: i errët (si në bord), me rrotullim gjatë dërgimit. "joValid" e zbeh, por s'e fik:
// prekja tregon çka mungon.
export function ButoniKryesor({
  teksti,
  duke_punuar = false,
  joValid = false,
  ...props
}: Omit<PressableProps, "style" | "children"> & { teksti: string; duke_punuar?: boolean; joValid?: boolean }) {
  const t = useTema();
  return (
    <Prekshme
      accessibilityRole="button"
      {...props}
      disabled={duke_punuar}
      style={[styles.butoni, { backgroundColor: t.teksti }, joValid && styles.joAktiv]}
    >
      {duke_punuar ? (
        <ActivityIndicator color={t.sfondi} />
      ) : (
        <T pesha="trashe" madhesia={16} ngjyra={t.sfondi}>
          {teksti}
        </T>
      )}
    </Prekshme>
  );
}

const styles = StyleSheet.create({
  fusha: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1.5,
    borderColor: "transparent",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  etiketa: { marginTop: 10 },
  butoni: { marginTop: 22, borderRadius: 999, padding: 16, minHeight: 52, alignItems: "center", justifyContent: "center" },
  joAktiv: { opacity: 0.45 },
});
