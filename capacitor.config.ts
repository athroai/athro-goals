import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "co.uk.athrogoals.app",
  appName: "Athro Goals",
  webDir: "out",
  server: {
    // Load from your deployed app URL. For local dev, use your tunnel (e.g. ngrok).
    url: process.env.CAPACITOR_SERVER_URL ?? "https://athrogoals.co.uk",
    cleartext: false,
  },
  ios: {
    contentInset: "automatic",
    backgroundColor: "#1c2a1e",
    preferredContentMode: "mobile",
    scheme: "Athro Goals",
  },
  plugins: {
    Keyboard: {
      resize: "native",
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#1c2a1e",
    },
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 1500,
      backgroundColor: "#1c2a1e",
      showSpinner: false,
    },
  },
};

export default config;
