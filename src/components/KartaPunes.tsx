import { StyleSheet, Text, View } from "react-native";

// Edoniku · J2: komponenti i kartës së punës (props + useState).
// Përdoret në src/app/index.tsx brenda FlatList-it.

type Props = {
  titulli: string;
  kompania: string;
  qyteti: string;
};

export default function KartaPunes({ titulli, kompania, qyteti }: Props) {
  // TODO 1: useState për butonin ⭐ "ruaj" (true / false)
  // TODO 2: shfaq titullin, dhe poshtë tij "kompania · qyteti"
  // TODO 3: një Pressable me ⭐ ose ☆ që e ndërron state-in kur e prek

  return (
    <View style={styles.karta}>
      <Text>{titulli}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  karta: { padding: 16 },
});
