import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Karriera" }} />
      <Stack.Screen name="pune/shto" options={{ presentation: "modal" }} />
    </Stack>
  );
}
