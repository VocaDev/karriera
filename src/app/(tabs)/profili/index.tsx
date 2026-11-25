import FtesaPerLlogari from "@/components/FtesaPerLlogari";
import ProfiliIm from "@/components/ProfiliIm";
import { TabScroll } from "@/components/TabEkrani";
import { Karta } from "@/components/ui";
import { useSesioni } from "@/lib/sesioni";

// Profili i kërkuesit: llogaria, ⭐ të ruajturat dhe "Dil".
// Mysafiri s'ka profil: tab-i tregon ftesën "Krijo llogari që të kesh profilin tënd" (pa fletë: tab-i është vetë ekrani).
export default function Profili() {
  const { mysafir } = useSesioni();
  if (mysafir) {
    return (
      <TabScroll>
        <Karta>
          <FtesaPerLlogari arsyeja="profili" />
        </Karta>
      </TabScroll>
    );
  }
  return <ProfiliIm />;
}
