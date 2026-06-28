import React, { useState } from "react";
import { supabase } from "../lib/supabase.js";
import { PRODUCT, TAGLINE } from "../lib/constants.js";

export function AuthScreen() {
const [mode, setMode] = useState("signin"); // signin | signup
const [email, setEmail] = useState("");
const [pw, setPw] = useState("");
const [busy, setBusy] = useState(false);
const [err, setErr] = useState("");
const [info, setInfo] = useState("");
const submit = async (e) => {
e && e.preventDefault();
setBusy(true); setErr(""); setInfo("");
const creds = { email: email.trim(), password: pw };
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
return (
<div className="authwrap">
<div className="authcard">
<div className="authbrand">{PRODUCT}</div>
<div className="authsub">{TAGLINE}</div>
<form onSubmit={submit}>
<input className="authinput" type="email" autoComplete="username" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
<input className="authinput" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder="Password" value={pw} onChange={e => setPw(e.target.value)} />
{err && <div className="autherr">{err}</div>}
{info && <div className="authok">{info}</div>}
<button className="primary" type="submit" disabled={busy}>{busy ? "…" : (mode === "signup" ? "Create account" : "Sign in")}</button>
</form>
<button className="viewerbtn" onClick={() => { setErr(""); setInfo(""); setMode(mode === "signup" ? "signin" : "signup"); }}>
{mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
</button>
<div className="authnote">Your trips are private to your account and sync to any device you sign in on.</div>
</div>
</div>
);
}
