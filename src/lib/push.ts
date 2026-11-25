// Push nga serveri: GATI NË KOD, I FIKUR (PUSH_NGA_SERVERI te src/lib/vecorite.ts).
//
// Pse i fikur: Expo Go në Android s'merr push që nga SDK 53 (vetëm njoftime lokale), dhe një sender në server s'ekziston
// ende. Hapat për ta ndezur (development build, projectId i EAS, tabela e token-ave, Edge Function që dërgon):
// docs/njoftimet.md. Deri atëherë njoftimet janë vetëm lokale (src/lib/kujtesat.ts).
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { kerkoLejen } from "@/lib/kujtesat";
import { supabase } from "@/lib/supabase";

/** projectId i EAS nga app.json (extra.eas.projectId); pa të, Expo s'jep token. */
function projectId(): string | null {
  const id = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  return typeof id === "string" && id ? id : null;
}

/** Expo Go në Android s'ka push (thirrja do të hidhte gabim). Në iOS Expo Go jep vetëm paralajmërim. */
function mbeshtetetPush(): boolean {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return false;
  return !(Platform.OS === "android" && Constants.executionEnvironment === ExecutionEnvironment.StoreClient);
}

/**
 * Merr token-in e Expo Push (pas lejes) dhe e ruan te tabela `push_tokenat` (docs/njoftimet.md, hapi 3), që një Edge
 * Function t'i dërgojë njoftime kësaj pajisjeje. Kthen token-in, ose null kur s'mundet (pa leje, Expo Go Android, pa
 * projectId). Thirret vetëm kur PUSH_NGA_SERVERI është true.
 */
export async function regjistroPerPush(): Promise<string | null> {
  if (!mbeshtetetPush()) return null;
  const id = projectId();
  if (!id) return null;
  if ((await kerkoLejen()) !== "dhene") return null;
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    // RLS te push_tokenat: secili shkruan vetëm rreshtin e vet (perdoruesi_id = auth.uid(), default në server).
    const { error } = await supabase.from("push_tokenat").upsert({ token, platforma: Platform.OS }, { onConflict: "token" });
    if (error) return null;
    return token;
  } catch {
    return null;
  }
}
