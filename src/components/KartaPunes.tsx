import { Pressable, StyleSheet, Text, View } from "react-native";
import { useState } from "react";

import { useTema } from "@/lib/tema";

type Props = {
  titulli: string;
  kompania: string;
  qyteti: string;
} & React.ComponentProps<typeof Pressable>;

export default function KartaPunes({
  titulli,
  kompania,
  qyteti,
  style,
  ...pressableProps
}: Props) {
  const t = useTema();
  const [ruajtur, setRuajtur] = useState(false);

  return (
    <Pressable
      {...pressableProps}
      style={(state) => [
        styles.karta,
        typeof style === "function" ? style(state) : style,
      ]}
    >
      <View style={styles.rreshti}>
        <View style={styles.info}>
          <Text style={[styles.titulli, { color: t.teksti }]}>{titulli}</Text>
          <Text style={[styles.detajet, { color: t.zbehur }]}>
            {kompania} · {qyteti}
          </Text>
        </View>

        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            setRuajtur(!ruajtur);
          }}
        >
          <Text style={[styles.ylli, { color: t.teksti }]}>{ruajtur ? "⭐" : "☆"}</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  karta: {
    padding: 16,
  },
  rreshti: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  info: {
    flex: 1,
  },
  titulli: {
    fontSize: 18,
    fontWeight: "bold",
  },
  detajet: {
    marginTop: 4,
    color: "gray",
  },
  ylli: {
    fontSize: 24,
  },
});