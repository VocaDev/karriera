// Gabimet e hyrjes në shqip: fjalëkalim i gabuar, llogari që ekziston, pa internet.
// Mesazhi teknik nuk i shfaqet përdoruesit; mbetet vetëm në log-un e zhvillimit.

type GabimISupabase = { name?: string; code?: string; status?: number; message?: string };

function eshtePaInternet(g: GabimISupabase): boolean {
  const m = (g.message ?? "").toLowerCase();
  return (
    g.name === "AuthRetryableFetchError" ||
    m.includes("network request failed") ||
    m.includes("failed to fetch") ||
    m.includes("network error")
  );
}

/** Kthen një fjali të qartë në shqip për çdo gabim të Supabase (hyrja, regjistrimi, të dhënat). */
export function mesazhiIGabimit(gabimi: unknown): string {
  const g = (gabimi ?? {}) as GabimISupabase;
  if (eshtePaInternet(g)) return "Pa internet. Kontrollo lidhjen dhe provo përsëri.";

  switch (g.code) {
    case "invalid_credentials":
      return "Email-i ose fjalëkalimi është gabim.";
    case "user_already_exists":
    case "email_exists":
      return "Ky email ka tashmë llogari. Hyr me të.";
    case "weak_password":
      return "Fjalëkalimi është shumë i dobët. Përdor të paktën 6 shkronja.";
    case "email_address_invalid":
    case "validation_failed":
      return "Email-i nuk duket i saktë.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Shumë përpjekje njëra pas tjetrës. Prit një minutë dhe provo përsëri.";
    case "email_not_confirmed":
      return "Llogaria s'është konfirmuar ende.";
    case "signup_disabled":
      return "Regjistrimi i llogarive të reja është i mbyllur për momentin.";
  }
  if (g.status === 429) return "Shumë përpjekje njëra pas tjetrës. Prit një minutë dhe provo përsëri.";

  if (__DEV__ && g.message) console.warn("[hyrja]", g.code ?? g.name, g.message);
  return "Diçka shkoi keq. Provo përsëri.";
}
