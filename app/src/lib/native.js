// Native bridge: thin wrappers around Capacitor plugins with web fallbacks.
// On the web, isNative is false and these degrade to standard web behavior,
// so the browser build is unaffected. On iOS they use the native equivalents.
import { Capacitor } from "@capacitor/core";

export const isNative = Capacitor.isNativePlatform();

// Set up native chrome once, on app mount (status bar style, hide splash).
export async function initNative() {
  if (!isNative) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Light }); // dark glyphs on our light UI
  } catch (e) { /* status bar unavailable */ }
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch (e) { /* no splash */ }
}

// Share a link via the native share sheet; on web use Web Share or clipboard.
// Returns "shared" | "copied" | "none".
export async function shareLink({ title, text, url }) {
  if (isNative) {
    try {
      const { Share } = await import("@capacitor/share");
      await Share.share({ title, text, url });
      return "shared";
    } catch (e) { return "none"; }
  }
  if (typeof navigator !== "undefined" && navigator.share) {
    try { await navigator.share({ title, text, url }); return "shared"; } catch (e) { /* cancelled */ }
  }
  try { await navigator.clipboard.writeText(url); return "copied"; } catch (e) { return "none"; }
}

// Native camera / photo library picker -> File. Returns null on web (caller
// falls back to a normal <input type="file">).
export async function pickNativePhoto() {
  if (!isNative) return null;
  try {
    const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
    const photo = await Camera.getPhoto({
      quality: 82,
      resultType: CameraResultType.Uri,
      source: CameraSource.Prompt, // user picks: take photo or choose from library
      allowEditing: false,
      presentationStyle: "popover",
    });
    const res = await fetch(photo.webPath);
    const blob = await res.blob();
    return new File([blob], `photo.${photo.format || "jpg"}`, { type: blob.type || "image/jpeg" });
  } catch (e) {
    return null; // user cancelled or denied
  }
}

// Light haptic tap (no-op on web).
export async function tapHaptic() {
  if (!isNative) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch (e) { /* no haptics */ }
}
