import Animated, { useAnimatedProps, type SharedValue } from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";

// Unaza: ikona e Karrierës (bordi, "Ikona e app-it", ideja 3). Gjurma gri, harku portokalli = gatishmëria,
// ✓ në mes. Gjeometria është ajo e bordit (viewBox 100): rrethi r = 27, trashësia 10, harku nis lart.
const RrethiIAnimuar = Animated.createAnimatedComponent(Circle);
const R = 27;
const PERIMETRI = 2 * Math.PI * R;

type Props = {
  madhesia: number;
  progresi: SharedValue<number>; // 0–1, sa është mbushur harku
  ngjyrat: { gjurma: string; harku: string; shenja: string };
};

export default function Unaza({ madhesia, progresi, ngjyrat }: Props) {
  const harku = useAnimatedProps(() => ({ strokeDashoffset: PERIMETRI * (1 - progresi.get()) }));
  return (
    <Svg width={madhesia} height={madhesia} viewBox="0 0 100 100">
      <Circle cx={50} cy={50} r={R} stroke={ngjyrat.gjurma} strokeWidth={10} fill="none" />
      <RrethiIAnimuar
        cx={50}
        cy={50}
        r={R}
        stroke={ngjyrat.harku}
        strokeWidth={10}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${PERIMETRI} ${PERIMETRI}`}
        animatedProps={harku}
        transform="rotate(-90 50 50)"
      />
      <Path
        d="M39 51 l7 7 L62 42"
        stroke={ngjyrat.shenja}
        strokeWidth={7}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
