// A u nxorëm nga llogaria (sesioni mbaroi), jo se dolëm vetë? Kur po, ekrani i hyrjes tregon mesazhin "Hyr përsëri"
// (mesazhet.ts). Rojet te _layout.tsx e çojnë përdoruesin te hyrja sapo sesioni zhduket, prandaj mesazhi jeton aty.
// Pa varësi nga hyrja.ts ose sesioni.tsx (që të mos bëhet rreth i importeve).
import { useSyncExternalStore } from "react";

let skaduar = false;
let daljaVullnetareDeri = 0; // koha (ms) deri kur një SIGNED_OUT llogaritet dalje e jona
const degjuesit = new Set<() => void>();

function njofto() {
  degjuesit.forEach((d) => d());
}

/** Thirret para `signOut()` kur përdoruesi del vetë: ajo s'është "sesion i mbaruar". */
export function shenoDaljenVullnetare(): void {
  daljaVullnetareDeri = Date.now() + 5000;
  vendos(false);
}

/** Thirret nga SesioniProvider kur Supabase njofton dalje (SIGNED_OUT) ose hyrje (SIGNED_IN). */
export function pasNdryshimitTeSesionit(ngjarja: string): void {
  if (ngjarja === "SIGNED_OUT") {
    if (Date.now() > daljaVullnetareDeri) vendos(true);
    daljaVullnetareDeri = 0;
  } else if (ngjarja === "SIGNED_IN") {
    vendos(false);
  }
}

function vendos(v: boolean) {
  if (skaduar === v) return;
  skaduar = v;
  njofto();
}

export function useSesioniSkaduar(): boolean {
  return useSyncExternalStore(
    (d) => {
      degjuesit.add(d);
      return () => {
        degjuesit.delete(d);
      };
    },
    () => skaduar,
    () => false,
  );
}
