// Hyrja me një prekje për demo (si te Mjeku): një buton për secilën llogari demo, që thërret të njëjtin `hyr()`
// si forma, me email dhe fjalëkalim të vërtetë të Supabase Auth.
//
// Vlerat vijnë vetëm nga .env.local (i shkruan scripts/demo-env.ps1 nga .env.demo). Në kod s'ka asnjë email ose
// fjalëkalim: repo-ja është publike. EXPO_PUBLIC_* futen në bundle-in e app-it, ndaj vetëm për llogaritë demo dhe
// kurrë në një build EAS/APK.
//
// Expo i zëvendëson vetëm `process.env.EXPO_PUBLIC_X` të shkruara të plota, ndaj secila lexohet me emrin e vet.
import type { Lloji } from "@/lib/hyrja";

export type LlogariaDemo = {
  lloji: Lloji;
  teksti: string;
  email: string;
  fjalekalimi: string;
};

const ndezur = process.env.EXPO_PUBLIC_QUICK_LOGIN?.trim() === "true";

const KANDIDATET: { lloji: Lloji; teksti: string; email?: string; fjalekalimi?: string }[] = [
  {
    lloji: "kerkues",
    teksti: "Hyr si kërkues",
    email: process.env.EXPO_PUBLIC_DEMO_KERKUES_EMAIL,
    fjalekalimi: process.env.EXPO_PUBLIC_DEMO_KERKUES_PASSWORD,
  },
  {
    lloji: "punedhenes",
    teksti: "Hyr si punëdhënës",
    email: process.env.EXPO_PUBLIC_DEMO_PUNEDHENES_EMAIL,
    fjalekalimi: process.env.EXPO_PUBLIC_DEMO_PUNEDHENES_PASSWORD,
  },
  {
    lloji: "qender",
    teksti: "Hyr si qendër",
    email: process.env.EXPO_PUBLIC_DEMO_QENDER_EMAIL,
    fjalekalimi: process.env.EXPO_PUBLIC_DEMO_QENDER_PASSWORD,
  },
];

/** Bosh kur flamuri s'është "true". Një rol shfaqet vetëm kur i ka të dyja: email-in dhe fjalëkalimin. */
export const LLOGARITE_DEMO: readonly LlogariaDemo[] = ndezur
  ? KANDIDATET.flatMap((k) => {
      const email = k.email?.trim();
      const fjalekalimi = k.fjalekalimi;
      return email && fjalekalimi ? [{ lloji: k.lloji, teksti: k.teksti, email, fjalekalimi }] : [];
    })
  : [];
