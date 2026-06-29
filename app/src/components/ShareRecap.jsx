import React, { useState, useMemo } from "react";
import {
ShieldCheck, Users, Trash2, UserPlus, Sparkles, Share2, Copy, Zap, Check,
UtensilsCrossed, Wine, Link as LinkIcon, Download,
} from "lucide-react";
import { TYPE_META } from "../lib/constants.js";
import { buildRecapSnapshot, publicRecapUrl, uid } from "../lib/helpers.js";
import { OverlaySheet, RateRow, PhotoPicker, Card, Stat } from "./ui.jsx";
import { shareLink } from "../lib/native.js";

export function ShareTrip({ ctx, onClose }) {
const { members, refreshMembers, runSave, db, trip, flash, copy, days, state } = ctx;
const [email, setEmail] = useState("");
const [recapUrl, setRecapUrl] = useState("");
const invite = async () => {
const v = email.trim().toLowerCase();
if (!v || !v.includes("@")) { flash("Add an email address"); return; }
try {
await runSave("Inviting traveller...", () => db.inviteMember(trip.id, v));
await refreshMembers();
setEmail("");
flash("Invite ready");
} catch (e) { flash("Invite could not be saved"); }
};
const publish = async () => {
try {
const snapshot = buildRecapSnapshot(trip, days, state);
const token = await runSave("Publishing recap...", () => db.saveRecapShare(trip.id, snapshot));
const url = publicRecapUrl(token);
setRecapUrl(url);
const r = await shareLink({ title: trip.name, text: `${trip.name} — trip recap`, url });
flash(r === "shared" ? "Recap shared" : r === "copied" ? "Recap link copied" : "Recap link ready");
} catch (e) { flash("Could not publish recap, please try again"); }
};
return (
<OverlaySheet title="Share trip" onClose={onClose}>
<div className="shareblock">
<div className="sharehero"><ShieldCheck size={17} /><div><strong>Group-first sync</strong><span>Invite a traveller by email. Once they sign in with that address, this trip appears in their account.</span></div></div>
{members.enabled === false && <div className="autherr">Collaboration tables are not installed yet. Apply the Supabase migration included with this update.</div>}
<div className="section-label tight"><Users size={13} /> Travellers</div>
<div className="memberlist">
{(members.list || []).length === 0 && <div className="muted sm">No invited collaborators yet.</div>}
{(members.list || []).map(m => (
<div key={m.id} className="memberrow">
<div><div className="memberemail">{m.display_name || m.invited_email}</div><div className="muted xs">{m.accepted_at ? "Accepted" : "Invited"} · {m.role || "editor"}</div></div>
<button className="del" onClick={() => runSave("Removing traveller...", () => db.removeMember(m.id)).then(refreshMembers).catch(() => flash("Could not remove traveller"))}><Trash2 size={13} /></button>
</div>
))}
</div>
<div className="quickadd">
<input value={email} placeholder="Traveller email..." onChange={e => setEmail(e.target.value)} onKeyDown={e => { if (e.key === "Enter") invite(); }} />
<button onClick={invite}><UserPlus size={16} /></button>
</div>
</div>
<div className="shareblock">
<div className="section-label tight"><Sparkles size={13} /> End-of-trip recap</div>
<button className="primary" onClick={publish}><Share2 size={15} /> Publish recap link</button>
{recapUrl && <button className="reflink" onClick={() => copy(recapUrl, "Recap link")}><span>{recapUrl}</span><Copy size={12} /></button>}
</div>
</OverlaySheet>
);
}

export function FastCapture({ ctx, onClose }) {
const { trip, days, tIndex, state, setState, db, session, runSave, flash } = ctx;
const travellers = trip.travellers && trip.travellers.length ? trip.travellers : ["Me"];
const day = days[tIndex] || {};
const [type, setType] = useState("Moment");
const [title, setTitle] = useState("");
const [note, setNote] = useState("");
const [ratings, setRatings] = useState(() => Object.fromEntries(travellers.map(t => [t, 0])));
const [files, setFiles] = useState([]);
const [busy, setBusy] = useState(false);
const save = async () => {
if (!title.trim()) { flash("Name the memory"); return; }
setBusy(true);
const entry = { id: uid(), type, title: title.trim(), note: note.trim(), ratings: { ...ratings }, region: "", vintage: "", city: day.city || "", day: tIndex, ts: Date.now(), place_id: null, photos: [] };
try {
const uploaded = await runSave("Saving quick capture...", async () => {
await db.addJournal(trip.id, entry);
const pics = [];
for (const f of files) pics.push(await db.uploadPhoto(trip.id, entry.id, f, session.user.id));
return pics;
});
files.forEach(f => { try { URL.revokeObjectURL(f.__preview); } catch (e) {} });
entry.photos = uploaded || [];
setState(s => ({ ...s, journal: [entry, ...s.journal] }));
flash("Captured");
onClose();
} catch (e) { flash("Could not save capture"); }
setBusy(false);
};
return (
<OverlaySheet title="Quick capture" onClose={onClose}>
<div className="capturelead"><Zap size={16} /> Photo, name, stars, done.</div>
<div className="typetabs">
{Object.keys(TYPE_META).map(tp => {
const Ic = TYPE_META[tp].icon;
return <button key={tp} className={"typetab" + (type === tp ? " on" : "")} style={type === tp ? { color: TYPE_META[tp].color } : undefined} onClick={() => setType(tp)}><Ic size={15} /> {tp}</button>;
})}
</div>
<input className="inline-input full" placeholder={type === "Moment" ? "What happened..." : "Name..."} value={title} onChange={e => setTitle(e.target.value)} autoFocus />
<input className="inline-input full" placeholder="One line, optional..." value={note} onChange={e => setNote(e.target.value)} />
<PhotoPicker files={files} setFiles={setFiles} flash={flash} />
<div className="ratepair">{travellers.map(t => <RateRow key={t} label={t} value={ratings[t] || 0} onChange={(v) => setRatings(r => ({ ...r, [t]: v }))} />)}</div>
<button className="primary" onClick={save} disabled={busy}><Check size={15} /> {busy ? "Saving..." : "Save capture"}</button>
</OverlaySheet>
);
}

export function Recap({ trip, days, state, db, runSave, copy, flash }) {
const [url, setUrl] = useState("");
const snapshot = useMemo(() => buildRecapSnapshot(trip, days, state), [trip, days, state]);
const publish = async () => {
try {
const token = await runSave("Publishing recap...", () => db.saveRecapShare(trip.id, snapshot));
const next = publicRecapUrl(token);
setUrl(next);
const r = await shareLink({ title: trip.name, text: `${trip.name} — trip recap`, url: next });
flash(r === "shared" ? "Recap shared" : r === "copied" ? "Recap link copied" : "Recap link ready");
} catch (e) { flash("Could not publish recap, please try again"); }
};
return (
<div className="page">
<div className="page-h">Recap</div>
<div className="recaphero">
<div className="kicker">PLAN TO MEMORY</div>
<h2>{trip.name}</h2>
<div className="muted sm">{snapshot.cities.join(" · ") || "Your route will appear here"}</div>
</div>
<div className="ministats">
<Stat label="Days" value={snapshot.stats.days} />
<Stat label="Cities" value={snapshot.stats.cities} />
<Stat label="Memories" value={snapshot.stats.memories} accent />
</div>
{(snapshot.bestMeal || snapshot.bestWine) && <div className="section-label">The best of it</div>}
{snapshot.bestMeal && <Card><div className="bestline"><UtensilsCrossed size={16} /> Best meal</div><div className="jcard-title">{snapshot.bestMeal.title}</div><div className="muted xs">{snapshot.bestMeal.city}</div></Card>}
{snapshot.bestWine && <Card><div className="bestline"><Wine size={16} /> Best wine</div><div className="jcard-title">{snapshot.bestWine.title}</div><div className="muted xs">{snapshot.bestWine.city}</div></Card>}
{!!snapshot.photos.length && <><div className="section-label">Photo highlights</div><div className="recapphotos">{snapshot.photos.map((p, i) => <img key={i} src={p.src} alt="" />)}</div></>}
<Card>
<div className="sharehero"><LinkIcon size={17} /><div><strong>Zero-install keepsake</strong><span>Publish a web recap anyone can open, with no app install and no login.</span></div></div>
<button className="primary" onClick={publish}><Share2 size={15} /> Publish recap</button>
{url && <button className="reflink" onClick={() => copy(url, "Recap link")}><span>{url}</span><Copy size={12} /></button>}
<button className="ghostbtn block" onClick={() => window.print()}><Download size={15} /> Print or save PDF</button>
</Card>
</div>
);
}

export function PublicRecap({ snapshot }) {
const s = snapshot || {};
const stats = s.stats || {};
return (
<div className="publicrecap">
<header className="publichero">
<div className="brandline">{(s.trip && s.trip.name) || "Voyage recap"}</div>
<div className="muted sm">{(s.cities || []).join(" · ")}</div>
</header>
<div className="ministats">
<Stat label="Days" value={stats.days || 0} />
<Stat label="Cities" value={stats.cities || 0} />
<Stat label="Memories" value={stats.memories || 0} accent />
</div>
{(s.bestMeal || s.bestWine) && <div className="section-label">The best of it</div>}
{s.bestMeal && <Card><div className="bestline"><UtensilsCrossed size={16} /> Best meal</div><div className="jcard-title">{s.bestMeal.title}</div><div className="muted xs">{s.bestMeal.city}</div></Card>}
{s.bestWine && <Card><div className="bestline"><Wine size={16} /> Best wine</div><div className="jcard-title">{s.bestWine.title}</div><div className="muted xs">{s.bestWine.city}</div></Card>}
{!!(s.photos || []).length && <><div className="section-label">Photo highlights</div><div className="recapphotos">{s.photos.map((p, i) => <img key={i} src={p.src} alt="" />)}</div></>}
<div className="section-label">Diary</div>
{(s.journal || []).slice(0, 24).map((j, i) => <Card key={i}><div className="jcard-title">{j.title}</div><div className="muted xs">{[j.type, j.city].filter(Boolean).join(" · ")}</div>{j.note && <div className="jcard-note">{j.note}</div>}</Card>)}
</div>
);
}
