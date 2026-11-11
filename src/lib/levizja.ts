// Lëvizja në drejtimin D: e shkurtër, e qetë, pa kërcime. Lëvizja ka vetëm tri punë:
// përgjigje ndaj prekjes, orientim (nga erdhi diçka) dhe një moment të vetëm të planifikuar (hapja e app-it).
// Hyrjet janë "ease-out" (nisin shpejt, ndalen butë); daljet "ease-in" dhe ~70% e kohës së hyrjes.
// Me "Reduce Motion" të ndezur, lëvizja zëvendësohet me zbehje ose me asgjë; kuptimi mbetet.
import { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from "react-native-reanimated";

export const KOHA = {
  shpejt: 120, // shtypja, ndërrimi i një gjendjeje
  mesme: 220, // njoftimet, elementet e vogla
  ngadale: 420, // progresi, unaza e hapjes
} as const;

export const LEHTESIMI = {
  hyrje: Easing.bezier(0.16, 1, 0.3, 1),
  dalje: Easing.bezier(0.7, 0, 0.84, 0),
  levizje: Easing.bezier(0.65, 0, 0.35, 1),
} as const;

// "Jo tani": një dridhje e shkurtër anash, si fusha e fjalëkalimit në iPhone.
// Për diçka të kyçur ose për një formular që s'është plotësuar ende.
export function useDridhja() {
  const qetesi = useReducedMotion();
  const x = useSharedValue(0);
  const stili = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  function dridhu() {
    if (qetesi) return;
    x.set(
      withSequence(
        withTiming(-6, { duration: 50 }),
        withTiming(6, { duration: 60 }),
        withTiming(-3, { duration: 60 }),
        withTiming(0, { duration: 70, easing: LEHTESIMI.hyrje }),
      ),
    );
  }
  return { stili, dridhu };
}
