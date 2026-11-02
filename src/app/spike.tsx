import { Stack } from "expo-router";
import { WebView } from "react-native-webview";

// Testi i avatarit: kamera + mikrofoni + avatari 3D + MediaPipe brenda një WebView.
const URL = "https://raw.githack.com/VocaDev/karriera/cd41aad4ed0cf6e8425e6d8889ad071d8dbc8ef0/spike/avatar.html";

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
