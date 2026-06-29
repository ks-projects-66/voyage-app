import React, { useState } from "react";
import { supabase } from "../lib/supabase.js";
import { PRODUCT, TAGLINE } from "../lib/constants.js";

export function AuthScreen() {
const [mode, setMode] = useState("signin"); // signin | signup | reset
const [email, setEmail] = useState("");
const [pw, setPw] = useState("");
const [busy, setBusy] = useState(false);
const [err, setErr] = useState("");
const [info, setInfo] = useState("");

const submit = async (e) => {
e && e.preventDefault();
setBusy(true); setErr(""); setInfo("");
const em = email.trim();

if (mode === "reset") {
const { error } = await supabase.auth.resetPasswordForEmail(em, {
redirectTo: window.location.origin + window.location.pathname,
});
setBusy(false);
if (error) { setErr(error.message || "Could not send reset link"); return; }
setInfo("Check your email for a link to reset your password.");
return;
}

const creds = { email: em, password: pw };
if (mode === "signup") {
const { data, error } = await supabase.auth.signUp(creds);
setBusy(false);
if (error) { setErr(error.message || "Could not create account"); return; }
if (!data.session) { setInfo("Account created. Check your email to confirm, then sign in."); setMode("signin"); return; }
} else {
const { error } = await supabase.auth.signInWithPassword(creds);
setBusy(false);
if (error) { setErr(error.message || "Could not sign in"); return; }
}
};

const go = (m) => { setErr(""); setInfo(""); setMode(m); };

return (
<div className="authwrap">
<div className="authcard">
<div className="authbrand">{PRODUCT}</div>
<div className="authsub">{mode === "reset" ? "RESET YOUR PASSWORD" : TAGLINE}</div>
<form onSubmit={submit}>
<input className="authinput" type="email" autoComplete="username" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
{mode !== "reset" && (
<input className="authinput" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder="Password" value={pw} onChange={e => setPw(e.target.value)} />
)}
{err && <div className="autherr">{err}</div>}
{info && <div className="authok">{info}</div>}
<button className="primary" type="submit" disabled={busy}>{busy ? "…" : (mode === "signup" ? "Create account" : mode === "reset" ? "Send reset link" : "Sign in")}</button>
</form>
{mode === "signin" && (
<>
<button className="viewerbtn" onClick={() => go("signup")}>New here? Create an account</button>
<button className="viewerbtn subtle" onClick={() => go("reset")}>Forgot password?</button>
</>
)}
{mode === "signup" && (
<button className="viewerbtn" onClick={() => go("signin")}>Already have an account? Sign in</button>
)}
{mode === "reset" && (
<button className="viewerbtn" onClick={() => go("signin")}>Back to sign in</button>
)}
<div className="authnote">Your trips are private to your account and sync to any device you sign in on.</div>
</div>
</div>
);
}

// Shown when a user returns via a password-recovery link (they arrive with a
// temporary session and the PASSWORD_RECOVERY event). Lets them set a new password.
export function ResetPassword({ onDone }) {
const [pw, setPw] = useState("");
const [busy, setBusy] = useState(false);
const [err, setErr] = useState("");

const submit = async (e) => {
e && e.preventDefault();
if (pw.length < 6) { setErr("Use at least 6 characters"); return; }
setBusy(true); setErr("");
const { error } = await supabase.auth.updateUser({ password: pw });
setBusy(false);
if (error) { setErr(error.message || "Could not update password"); return; }
onDone && onDone();
};

return (
<div className="authwrap">
<div className="authcard">
<div className="authbrand">{PRODUCT}</div>
<div className="authsub">SET A NEW PASSWORD</div>
<form onSubmit={submit}>
<input className="authinput" type="password" autoComplete="new-password" placeholder="New password" value={pw} onChange={e => setPw(e.target.value)} />
{err && <div className="autherr">{err}</div>}
<button className="primary" type="submit" disabled={busy}>{busy ? "…" : "Update password"}</button>
</form>
<div className="authnote">Choose a new password for your account.</div>
</div>
</div>
);
}
