import React, { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { Sparkles, Trash2, Plus, X, Check } from "lucide-react";
import { TYPE_META } from "../lib/constants.js";
import { useSetStatus, mergedPlaces, uid, fmtDate } from "../lib/helpers.js";
import { Card, Stat, RateRow, MiniStars, PhotoPicker, PhotoGrid, PhotoViewer } from "./ui.jsx";
import { RatePrompt } from "./Explore.jsx";

export function Journal(ctx) {
const { state, setState, tIndex, stats, flash, db, trip, days, session, runSave } = ctx;
const setStatus = useSetStatus(ctx);
const travellers = trip.travellers && trip.travellers.length ? trip.travellers : ["Me"];
const d = days[tIndex] || { city: "" };
const [type, setType] = useState("Meal");
const [title, setTitle] = useState("");
const [note, setNote] = useState("");
const [ratings, setRatings] = useState(() => Object.fromEntries(travellers.map(t => [t, 0])));
const [region, setRegion] = useState("");
const [vintage, setVintage] = useState("");
const [files, setFiles] = useState([]);
const [busy, setBusy] = useState(false);
const [viewer, setViewer] = useState(null);
const [editing, setEditing] = useState(null);

const add = async () => {
if (!title.trim()) return;
setBusy(true);
const entry = { id: uid(), type, title: title.trim(), note: note.trim(), ratings: { ...ratings }, region: region.trim(), vintage: vintage.trim(), city: d.city, day: tIndex, ts: Date.now(), place_id: null, photos: [] };
try {
const res = await runSave("Saving journal entry...", () => db.addJournal(trip.id, entry), { kind: "addJournal", tripId: trip.id, args: { entry } });
const queued = !!(res && res.queued);
const uploaded = [];
// Photos need the journal row persisted (FK) + a live connection. When the write is only
// queued (offline, or draining a backlog) skip the upload rather than FK-fail and lose them.
if (!queued) { for (const f of files) { try { uploaded.push(await db.uploadPhoto(trip.id, entry.id, f, session.user.id)); } catch (e) { flash("A photo failed to upload"); } } }
files.forEach(f => { try { URL.revokeObjectURL(f.__preview); } catch (e) {} });
entry.photos = uploaded;
setState(s => ({ ...s, journal: [entry, ...s.journal] }));
setTitle(""); setNote(""); setRatings(Object.fromEntries(travellers.map(t => [t, 0]))); setRegion(""); setVintage(""); setFiles([]);
flash(queued ? (files.length ? "Saved — reconnect to add photos" : "Saved, will sync") : "Saved");
} catch (e) { flash("Could not save entry"); }
setBusy(false);
};
const del = async (id) => {
if (!window.confirm("Delete this entry? Its photos will be removed too.")) return;
const prev = state.journal;
setState(s => ({ ...s, journal: s.journal.filter(j => j.id !== id) }));
try { await runSave("Deleting journal entry...", () => db.deleteJournal(id), { kind: "deleteJournal", args: { id } }); } catch (e) { flash("Delete failed"); setState(s => ({ ...s, journal: prev })); }
};
const rated = state.journal.filter(j => Object.values(j.ratings || {}).some(v => v > 0));
const avg = (name) => {
const vals = rated.map(j => (j.ratings || {})[name]).filter(v => v > 0);
return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : "–";
};
const toRate = mergedPlaces(state).filter(p => p.been && !p.rated);

const journalGroups = useMemo(() => {
const by = {};
state.journal.forEach(j => { const k = (j.day != null ? j.day : -1); (by[k] = by[k] || []).push(j); });
return Object.keys(by).map(Number).sort((a, b) => b - a).map(day => ({ day, items: by[day].slice().sort((a, b) => (b.ts || 0) - (a.ts || 0)) }));
}, [state.journal]);

const renderJCard = (j) => {
const Ic = TYPE_META[j.type].icon;
const vals = travellers.map(t => (j.ratings || {})[t]).filter(v => v > 0);
const split = vals.length >= 2 && (Math.max(...vals) - Math.min(...vals)) >= 2;
return (
<div key={j.id} className="jcard">
<div className="jcard-icon" style={{ color: TYPE_META[j.type].color, background: TYPE_META[j.type].bg }}><Ic size={16} /></div>
<div className="jcard-body editable" onClick={() => setEditing(j)}>
<div className="jcard-title">{j.title}{j.vintage ? <span className="vint"> {j.vintage}</span> : ""}</div>
{(j.region || j.city) && <div className="muted xs">{[j.region, j.city].filter(Boolean).join(" · ")}</div>}
{j.note && <div className="jcard-note">{j.note}</div>}
{!!(j.photos || []).length && <PhotoGrid photos={j.photos} onOpen={(idx) => setViewer({ photos: j.photos, index: idx })} />}
<div className="jcard-rate">
{travellers.map(t => <MiniStars key={t} label={t} v={(j.ratings || {})[t] || 0} />)}
{split && <span className="split">split decision</span>}
</div>
</div>
<button className="del" onClick={() => del(j.id)} aria-label="Delete entry"><Trash2 size={14} /></button>
</div>
);
};

return (
<div className="page">
<div className="page-h">Journal</div>

<div className="journal-stats wrap">
<Stat label="Meals" value={stats.meals} />
<Stat label="Wines" value={stats.wines} />
{travellers.slice(0, 3).map(t => <Stat key={t} label={t} value={avg(t)} accent />)}
</div>

{stats.bestMeal && <div className="best"><Sparkles size={14} /><span>Best meal so far: <strong>{stats.bestMeal.title}</strong>{stats.bestMeal.city ? ` (${stats.bestMeal.city})` : ""}</span></div>}

{toRate.length > 0 && (
<>
<div className="section-label">Still to rate</div>
{toRate.map(p => <RatePrompt key={p.id} place={p} ctx={ctx} setStatus={setStatus} travellers={travellers} />)}
</>
)}

<Card>
<div className="typetabs">
{Object.keys(TYPE_META).map(tp => {
const Ic = TYPE_META[tp].icon;
return <button key={tp} className={"typetab" + (type === tp ? " on" : "")} style={type === tp ? { color: TYPE_META[tp].color } : undefined} onClick={() => setType(tp)}><Ic size={15} /> {tp}</button>;
})}
</div>
<input className="inline-input full" placeholder={type === "Wine" ? "Producer / wine name…" : type === "Moment" ? "What happened…" : "Name…"} value={title} onChange={e => setTitle(e.target.value)} />
{type === "Wine" && (
<div className="addrow">
<input className="inline-input" placeholder="Region / appellation" value={region} onChange={e => setRegion(e.target.value)} />
<input className="inline-input vintage" placeholder="Vintage" value={vintage} onChange={e => setVintage(e.target.value)} />
</div>
)}
<input className="inline-input full" placeholder="Tasting note / thoughts…" value={note} onChange={e => setNote(e.target.value)} />
<PhotoPicker files={files} setFiles={setFiles} flash={flash} />
<div className="ratepair">
{travellers.map(t => <RateRow key={t} label={t} value={ratings[t] || 0} onChange={(v) => setRatings(r => ({ ...r, [t]: v }))} />)}
</div>
<button className="primary" onClick={add} disabled={busy}><Plus size={15} /> {busy ? "Saving…" : "Add entry"}</button>
</Card>

{journalGroups.map(g => {
const di = days[g.day];
const place = di ? di.city : "";
return (
<div key={g.day} className="diarygroup">
<div className="diaryday">
<span className="diaryday-date">{di ? `${di.dow} ${fmtDate(di.date)}` : "Earlier"}</span>
{place && <span className="diaryday-place">{place}</span>}
</div>
{g.items.map(renderJCard)}
</div>
);
})}
{state.journal.length === 0 && <div className="muted sm empty pad">Log your first meal, glass or moment. This becomes your trip diary.</div>}
{viewer && <PhotoViewer photos={viewer.photos} index={viewer.index} onClose={() => setViewer(null)} />}
{editing && <EditEntry entry={editing} ctx={ctx} travellers={travellers} onClose={() => setEditing(null)} />}
</div>
);
}

/* ============================== EDIT ENTRY ============================== */

function EditEntry({ entry, ctx, travellers, onClose }) {
const { setState, flash, db, trip, session, runSave } = ctx;
const [type, setType] = useState(entry.type);
const [title, setTitle] = useState(entry.title);
const [note, setNote] = useState(entry.note || "");
const [city, setCity] = useState(entry.city || "");
const [region, setRegion] = useState(entry.region || "");
const [vintage, setVintage] = useState(entry.vintage || "");
const [ratings, setRatings] = useState(() => Object.fromEntries(travellers.map(t => [t, (entry.ratings || {})[t] || 0])));
const [photos, setPhotos] = useState(entry.photos || []);
const [files, setFiles] = useState([]);
const [busy, setBusy] = useState(false);

const removePhoto = async (ph) => {
if (!window.confirm("Remove this photo?")) return;
setPhotos(ps => ps.filter(p => p.id !== ph.id));
setState(s => ({ ...s, journal: s.journal.map(j => j.id === entry.id ? { ...j, photos: (j.photos || []).filter(p => p.id !== ph.id) } : j) }));
try { await runSave("Removing photo...", () => db.deletePhoto(ph)); flash("Photo removed"); } catch (e) { flash("Could not remove photo"); }
};
const save = async () => {
if (!title.trim()) return;
setBusy(true);
const patch = { id: entry.id, type, title: title.trim(), note: note.trim(), ratings: { ...ratings }, region: region.trim(), vintage: vintage.trim(), city: city.trim() };
try {
await runSave("Updating journal entry...", () => db.updateJournal(patch), { kind: "updateJournal", args: { entry: patch } });
const uploaded = [];
for (const f of files) { try { uploaded.push(await db.uploadPhoto(trip.id, entry.id, f, session.user.id)); } catch (e) { flash("A photo failed to upload"); } }
files.forEach(f => { try { URL.revokeObjectURL(f.__preview); } catch (e) {} });
const nextPhotos = [...photos, ...uploaded];
setState(s => ({ ...s, journal: s.journal.map(j => j.id === entry.id ? { ...j, ...patch, photos: nextPhotos } : j) }));
flash("Updated"); onClose();
} catch (e) { flash("Could not update entry"); }
setBusy(false);
};

return createPortal(
<div className="sheet" onClick={onClose}>
<div className="sheetcard" onClick={e => e.stopPropagation()}>
<div className="sheethead">
<div className="sheettitle">Edit entry</div>
<button className="sheetx" onClick={onClose} aria-label="Close"><X size={16} /></button>
</div>
<div className="typetabs">
{Object.keys(TYPE_META).map(tp => {
const Ic = TYPE_META[tp].icon;
return <button key={tp} className={"typetab" + (type === tp ? " on" : "")} style={type === tp ? { color: TYPE_META[tp].color } : undefined} onClick={() => setType(tp)}><Ic size={15} /> {tp}</button>;
})}
</div>
<input className="inline-input full" placeholder="Name…" value={title} onChange={e => setTitle(e.target.value)} />
{type === "Wine" && (
<div className="addrow">
<input className="inline-input" placeholder="Region / appellation" value={region} onChange={e => setRegion(e.target.value)} />
<input className="inline-input vintage" placeholder="Vintage" value={vintage} onChange={e => setVintage(e.target.value)} />
</div>
)}
<input className="inline-input full" placeholder="City / location" value={city} onChange={e => setCity(e.target.value)} />
<input className="inline-input full" placeholder="Tasting note / thoughts…" value={note} onChange={e => setNote(e.target.value)} />
{!!photos.length && (
<div className="photogrid edit">
{photos.map(ph => (
<div key={ph.id} className="photoeditcell">
<img src={ph.src} alt="" />
<button className="photox" onClick={() => removePhoto(ph)} aria-label="Remove photo"><X size={12} strokeWidth={3} /></button>
</div>
))}
</div>
)}
<PhotoPicker files={files} setFiles={setFiles} flash={flash} />
<div className="ratepair">
{travellers.map(t => <RateRow key={t} label={t} value={ratings[t] || 0} onChange={(v) => setRatings(r => ({ ...r, [t]: v }))} />)}
</div>
<button className="primary" onClick={save} disabled={busy}><Check size={15} /> {busy ? "Saving…" : "Save changes"}</button>
</div>
</div>
, document.body);
}
