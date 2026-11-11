import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IKONAT, Ikona, T } from "@/components/ui";
import { KOHA, LEHTESIMI } from "@/lib/levizja";
import { useTema } from "@/lib/tema";

// Njoftimi i shkurtër lart, nën ishullin e kamerës: konfirmon me të njëjtën folje si veprimi
// ("Shto" → "Puna u shtua") dhe zhduket vetë. Gabimet e formularëve mbeten te fusha, jo këtu.
type Lloji = "sukses" | "info" | "gabim";
type Njoftim = { id: number; teksti: string; lloji: Lloji };

const KontekstiINjoftimeve = createContext<(teksti: string, lloji?: Lloji) => void>(() => {});

export function useNjoftim() {
  return useContext(KontekstiINjoftimeve);
}

const IKONA = { sukses: IKONAT.check, info: IKONAT.info, gabim: IKONAT.alarm } as const;
const HYRJA = FadeInUp.duration(KOHA.mesme).easing(LEHTESIMI.hyrje).withInitialValues({ transform: [{ translateY: -12 }] });
const DALJA = FadeOutUp.duration(160).easing(LEHTESIMI.dalje);

export function NjoftimetProvider({ children }: { children: ReactNode }) {
  const t = useTema();
  const kufijte = useSafeAreaInsets();
  const [njoftimi, setNjoftimi] = useState<Njoftim | null>(null);
  const numri = useRef(0);

  const trego = useCallback((teksti: string, lloji: Lloji = "info") => {
    numri.current += 1;
    setNjoftimi({ id: numri.current, teksti, lloji });
    AccessibilityInfo.announceForAccessibility(teksti); // VoiceOver e lexon menjëherë
  }, []);

  useEffect(() => {
    if (!njoftimi) return;
    const ora = setTimeout(() => setNjoftimi(null), njoftimi.lloji === "sukses" ? 2600 : 3400);
    return () => clearTimeout(ora);
  }, [njoftimi]);

  return (
    <KontekstiINjoftimeve.Provider value={trego}>
      {children}
      <View pointerEvents="none" style={[styles.vendi, { top: kufijte.top + 6 }]}>
        {njoftimi && (
          <Animated.View
            key={njoftimi.id}
            entering={HYRJA}
            exiting={DALJA}
            style={[styles.njoftimi, { backgroundColor: t.teksti, shadowColor: t.hija }]}
          >
            <Ikona emri={IKONA[njoftimi.lloji]} madhesia={15} ngjyra={t.sfondi} />
            <T pesha="gjysme" madhesia={14.5} ngjyra={t.sfondi} style={styles.teksti}>
              {njoftimi.teksti}
            </T>
          </Animated.View>
        )}
      </View>
    </KontekstiINjoftimeve.Provider>
  );
}

const styles = StyleSheet.create({
  vendi: { position: "absolute", left: 16, right: 16, alignItems: "center" },
  njoftimi: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    maxWidth: "100%",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  teksti: { flexShrink: 1 },
});
