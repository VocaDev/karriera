import KreuIPunedhenesit from "@/components/KreuIPunedhenesit";
import PunetEMia from "@/components/PunetEMia";
import { useSesioni } from "@/lib/sesioni";

// Punëdhënësi: Kreu (bordi, ekrani 59). Qendra: numrat e Karrierës dhe punët e saj, si më parë.
export default function Kreu() {
  const { profili } = useSesioni();
  return profili?.lloji === "qender" ? <PunetEMia /> : <KreuIPunedhenesit />;
}
