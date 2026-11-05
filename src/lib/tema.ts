// Drejtimi D (Gjurmimi) nga design/karriera-ui.html: vlerat e sakta të bordit, e çelët dhe e errët.
import { useColorScheme } from "react-native";

export type Tema = {
  sfondi: string;
  karta: string;
  karta2: string;
  teksti: string;
  zbehur: string;
  vija: string;
  theksi: string; // portokallia: vetëm për progres, nota dhe veprimin kryesor
  theksiButë: string;
  ok: string;
  keq: string;
  hija: string;
  errët: boolean;
};

const ECELET: Tema = {
  sfondi: "#F5F5F4",
  karta: "#FFFFFF",
  karta2: "#EEEDEB",
  teksti: "#141414",
  zbehur: "#75726D",
  vija: "#E4E2DE",
  theksi: "#F2611D",
  theksiButë: "#FDE8DA",
  ok: "#1E9E5A",
  keq: "#D93A2B",
  hija: "#141414",
  errët: false,
};

const EERRET: Tema = {
  sfondi: "#0E0E0F",
  karta: "#1A1A1C",
  karta2: "#262628",
  teksti: "#F4F4F5",
  zbehur: "#9C9CA3",
  vija: "#2E2E31",
  theksi: "#FF7A3D",
  theksiButë: "#2B1A10",
  ok: "#3DD68C",
  keq: "#FF6B6B",
  hija: "#000000",
  errët: true,
};

export function useTema(): Tema {
  return useColorScheme() === "dark" ? EERRET : ECELET;
}

// Plus Jakarta Sans (fonti i bordit). Në React Native çdo peshë është familje më vete.
export const SHKRONJAT = {
  normal: "PlusJakartaSans_400Regular",
  mesme: "PlusJakartaSans_500Medium",
  gjysme: "PlusJakartaSans_600SemiBold",
  trashe: "PlusJakartaSans_700Bold",
  shumeTrashe: "PlusJakartaSans_800ExtraBold",
} as const;
