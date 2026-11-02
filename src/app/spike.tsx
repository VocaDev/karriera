import { Stack } from "expo-router";
import { WebView } from "react-native-webview";

// Testi i avatarit: kamera + mikrofoni + avatari 3D + MediaPipe brenda një WebView.
const URL = "https://raw.githack.com/VocaDev/karriera/72d3147791c1a6ac22d3465d3ff275845606df53/spike/avatar.html";

export default function Spike() {
  return (
    <>
      <Stack.Screen options={{ title: "Testi i avatarit" }} />
      <WebView
        source={{ uri: URL }}
        style={{ flex: 1, backgroundColor: "#0B0D10" }}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionGrantType="grant"
        javaScriptEnabled
      />
    </>
  );
}
