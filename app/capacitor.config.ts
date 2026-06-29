import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.greensquare.voyage",
  appName: "Voyage",
  webDir: "dist",
  ios: {
    // Let the web content manage its own insets via CSS safe-area variables.
    contentInset: "never",
    backgroundColor: "#F2F2F7",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 500,
      backgroundColor: "#F2F2F7",
      showSpinner: false,
    },
    Keyboard: {
      resize: "native",
    },
  },
};

export default config;
