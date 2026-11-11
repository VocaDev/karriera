// Dridhjet e lehta të telefonit (AGENTS.md, "Native feel" #3): vetëm kur kanë kuptim, kurrë në çdo buton.
// `.catch`: në web ose në një telefon pa motor dridhjesh, thirrja dështon në heshtje.
import * as Haptics from "expo-haptics";

export const prekja = {
  // zgjedh diçka: chip-i i rolit, ylli i ruajtjes
  zgjedhje() {
    Haptics.selectionAsync().catch(() => {});
  },
  // prek diçka të kyçur: e ndjen që u prek, por s'ndodh asgjë
  lehte() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  // diçka u ruajt
  sukses() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  // formulari s'është plotësuar ose ruajtja dështoi
  gabim() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  },
};
