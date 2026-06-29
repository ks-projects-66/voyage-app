import React, { useState, useEffect } from "react";
import { X, Share } from "lucide-react";
import { isNative } from "../lib/native.js";

// Nudges users to add Voyage to their home screen. iOS shows no install prompt,
// so we explain the Share -> Add to Home Screen flow; Android/Chrome gets a real
// Install button via beforeinstallprompt. Hidden once installed or dismissed.
export function InstallHint() {
  const [show, setShow] = useState(false);
  const [mode, setMode] = useState("ios");
  const [deferred, setDeferred] = useState(null);

  useEffect(() => {
    if (isNative) return;
    try { if (localStorage.getItem("voyage-install-dismissed")) return; } catch (e) {}
    const standalone =
      (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
      window.navigator.standalone === true;
    if (standalone) return;

    const ua = navigator.userAgent || "";
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    if (isIOS) {
      const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
      if (isSafari) { setMode("ios"); setShow(true); }
      return;
    }
    const onPrompt = (e) => { e.preventDefault(); setDeferred(e); setMode("android"); setShow(true); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const dismiss = () => { setShow(false); try { localStorage.setItem("voyage-install-dismissed", "1"); } catch (e) {} };
  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch (e) {}
    dismiss();
  };

  if (!show) return null;
  return (
    <div className="installhint" role="dialog" aria-label="Add Voyage to your home screen">
      <button className="installhint-x" onClick={dismiss} aria-label="Dismiss"><X size={15} /></button>
      {mode === "android" ? (
        <>
          <div className="installhint-t">Add Voyage to your phone</div>
          <div className="installhint-s">Install it for a full-screen, app-like experience.</div>
          <button className="installhint-btn" onClick={install}>Install</button>
        </>
      ) : (
        <>
          <div className="installhint-t">Add Voyage to your Home Screen</div>
          <div className="installhint-s">
            Tap <Share size={13} style={{ verticalAlign: "-2px" }} /> Share, then <strong>Add to Home Screen</strong> — it opens just like an app.
          </div>
        </>
      )}
    </div>
  );
}
