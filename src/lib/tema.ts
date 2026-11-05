// Ngjyrat e drejtimit D (Gjurmimi) nga design/karriera-ui.html, për temën e çelët dhe të errët.
import { useColorScheme } from "react-native";

export type Tema = {
  sfondi: string;
  karta: string;
  teksti: string;
  zbehur: string;
  vija: string;
  theksi: string; // portokallia: vetëm për progres dhe nota
  theksiButë: string;
  ok: string;
};

const ECELET: Tema = {
  sfondi: "#F5F5F4",
  karta: "#FFFFFF",
  teksti: "#141414",
  zbehur: "#6B6B6B",
  vija: "#E4E4E2",
  theksi: "#E8590C",
  theksiButë: "#FDEBDF",
  ok: "#2B8A3E",
};

const EERRET: Tema = {
  sfondi: "#0E0E0E",
  karta: "#1A1A1A",
  teksti: "#F3F3F2",
  zbehur: "#9A9A9A",
  vija: "#2A2A2A",
  theksi: "#F76707",
  theksiButë: "#3A2214",
  ok: "#51CF66",
};

export function useTema(): Tema {
  return useColorScheme() === "dark" ? EERRET : ECELET;
}
