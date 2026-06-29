import { createRoot } from "react-dom/client";
import "./styles.css";
import App from "./App.jsx";
import { isNative } from "./lib/native.js";

createRoot(document.getElementById("root")).render(<App />);

// Register the service worker on the web (not inside the native shell) so the
// installed home-screen PWA loads fast and survives a weak connection.
if (!isNative && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
