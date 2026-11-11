import { Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

import { KOHA, LEHTESIMI } from "@/lib/levizja";
import { useTema } from "@/lib/tema";

const PressableEAnimuar = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, "style"> & { style?: StyleProp<ViewStyle>; shkalla?: number };

// Çdo prekje merr përgjigje brenda 100 ms (bordi: `transform: scale(.97)` kur shtypet).
// iPhone: elementi zvogëlohet pak; Android: vala e sistemit (ripple); me "Reduce Motion": vetëm zbehet.
export default function Prekshme({ style, shkalla = 0.97, onPressIn, onPressOut, ...rest }: Props) {
  const t = useTema();
  const qetesi = useReducedMotion();
  const vlera = useSharedValue(1);
  const stili = useAnimatedStyle(() => (qetesi ? { opacity: vlera.get() } : { transform: [{ scale: vlera.get() }] }));

  return (
    <PressableEAnimuar
      {...rest}
      android_ripple={Platform.OS === "android" ? { color: t.vija, foreground: true } : undefined}
      onPressIn={(e) => {
        if (Platform.OS !== "android") {
          vlera.set(withTiming(qetesi ? 0.6 : shkalla, { duration: KOHA.shpejt, easing: LEHTESIMI.hyrje }));
        }
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        vlera.set(withTiming(1, { duration: KOHA.mesme, easing: LEHTESIMI.hyrje }));
        onPressOut?.(e);
      }}
      style={[style, stili]}
    />
  );
}
