import React, { useState } from "react";
import { Check, CalendarDays, CalendarPlus, Plus, Sparkles, X } from "lucide-react";
import { CATS, VIBES } from "../lib/constants.js";
import { useSetStatus, mergedPlaces, fmtDate, uid, typeForPlace, questionFor } from "../lib/helpers.js";
import { aiCapture, AUTOADD_MIN, placeKey, findDup } from "../lib/ai.js";
import { Card, RateRow, PhotoPicker } from "./ui.jsx";

export function Explore(ctx) {
const { state, setState, tIndex, db, flash, days, tripCities, trip, runSave } = ctx;
const setStatus = useSetStatus(ctx);
const here = days[tIndex] ? days[tIndex].city : "";
const cityList = tripCities.length ? tripCities : (here ? [here] : []);
const startCity = cityList.includes(here) ? here : (cityList[0] || "");
const [city, setCity] = useState(startCity);
const [vibe, setVibe] = useState("All");
const [picker, setPicker] = useState(null);
const [adding, setAdding] = useState(false);
const [capturing, setCapturing] = useState(false);
const [capText, setCapText] = useState("");
const [capFiles, setCapFiles] = useState([]);
const [capBusy, setCapBusy] = useState(false);
const [review, setReview] = useState(null); // low-confidence drafts awaiting review

const places = mergedPlaces(state).filter(p => p.city === city);
const vibesHere = ["All", ...Array.from(new Set(places.map(p => p.tag)))];
const shown = vibe === "All" ? places : places.filter(p => p.tag === vibe);
const doneCount = places.filter(p => p.been).length;
const cityDays = days.map((d, i) => ({ i, d })).filter(x => x.d.city === city);
const byCat = CATS.map(cat => ({ cat, items: shown.filter(p => p.cat === cat) })).filter(g => g.items.length);

// Optimistically add a place and persist it (offline-first via the queue descriptor).
const persistPlace = (place) => {
setState(s => ({ ...s, exploreAdded: [...(s.exploreAdded || []), place] }));
runSave("Saving place...", () => db.addPlace(trip.id, place), { kind: "addPlace", tripId: trip.id, args: { place } })
.catch(() => { flash("Could not save place"); setState(s => ({ ...s, exploreAdded: (s.exploreAdded || []).filter(p => p.id !== place.id) })); });
};
const addPlace = (place) => { setAdding(false); persistPlace(place); };

// Normalise an AI draft into a place row, defaulting blanks to the current city/cat/tag.
const normaliseDraft = (d) => ({
id: uid(), name: (d.name || "").trim(),
city: d.city || city, cat: CATS.includes(d.cat) ? d.cat : "Eat & Drink",
tag: VIBES.includes(d.tag) ? d.tag : VIBES[0], area: d.area || "", note: d.note || "",
confidence: typeof d.confidence === "number" ? d.confidence : 0.6,
});

// AI capture: a note / link / photo(s) -> place drafts. Confident ones are added
// straight away; the rest go to a review sheet. Duplicates are dropped.
const runCapture = async () => {
if (!capText.trim() && !capFiles.length) return;
setCapBusy(true);
try {
const raw = await aiCapture({ input: capText.trim(), files: capFiles, cities: tripCities, cats: CATS, tags: VIBES });
const existing = mergedPlaces(state);
const seen = new Set();
const drafts = raw.map(normaliseDraft).filter(d => {
if (!d.name) return false;
const k = placeKey(d.name, d.city);
if (seen.has(k) || findDup(existing, d.name, d.city)) return false;
seen.add(k); return true;
});
capFiles.forEach(f => { try { URL.revokeObjectURL(f.__preview); } catch (e) {} });
setCapText(""); setCapFiles([]); setCapturing(false);
if (!drafts.length) { flash("Nothing new found"); return; }
const confident = drafts.filter(d => d.confidence >= AUTOADD_MIN);
const rest = drafts.filter(d => d.confidence < AUTOADD_MIN);
confident.forEach(persistPlace);
if (confident.length) flash(`Added ${confident.length} place${confident.length > 1 ? "s" : ""}`);
if (rest.length) setReview(rest);
} catch (e) { flash(e.message || "Could not read that"); }
setCapBusy(false);
};

if (!cityList.length) return <div className="page"><div className="page-h">Explore</div><div className="muted sm empty pad">Add destinations to your trip to start collecting places.</div></div>;

return (
<div className="page wide">
<div className="page-h">Explore</div>
<div className="citytabs scrollx">
{cityList.map(c => <button key={c} className={"citytab" + (city === c ? " on" : "")} onClick={() => { setCity(c); setVibe("All"); setPicker(null); }}>{c}</button>)}
</div>
<div className="city-meta">{doneCount} of {places.length} done in {city}</div>
<div className="vibebar">
{vibesHere.map(v => <button key={v} className={"vibechip" + (vibe === v ? " on" : "")} onClick={() => setVibe(v)}>{v}</button>)}
</div>
{byCat.length === 0 && <div className="muted sm empty pad">No ideas here yet. Add one below.</div>}
{byCat.map(g => (
<div key={g.cat}>
<div className="section-label">{g.cat}</div>
<div className="cardgrid">
{g.items.map(p => {
const planned = p.plannedDay != null;
const day = planned ? days[p.plannedDay] : null;
return (
<div key={p.id} className={"placecard" + (p.been ? " been" : "")}>
<button className="placecheck" onClick={() => setStatus(p.id, { been: !p.been })}><span className="box">{p.been && <Check size={13} strokeWidth={3} />}</span></button>
<div className="place-body">
<div className="place-top"><span className="place-name">{p.name}</span><span className="vibetag">{p.tag}</span></div>
{(p.area || p.note) && <div className="muted xs">{[p.area, p.note].filter(Boolean).join(" · ")}</div>}
<div className="place-actions">
{planned && day
? <button className="planpill" onClick={() => setPicker(picker === p.id ? null : p.id)}><CalendarDays size={12} /> {day.dow} {fmtDate(day.date)}</button>
: <button className="addday" onClick={() => setPicker(picker === p.id ? null : p.id)}><CalendarPlus size={13} /> Add to a day</button>}
</div>
{picker === p.id && (
<div className="daypicker">
{cityDays.map(({ i, d }) => <button key={i} className={"dpbtn" + (p.plannedDay === i ? " on" : "")} onClick={() => { setStatus(p.id, { plannedDay: i }); setPicker(null); }}>{d.dow} {fmtDate(d.date)}</button>)}
{planned && <button className="dpbtn clear" onClick={() => { setStatus(p.id, { plannedDay: null }); setPicker(null); }}>Remove</button>}
</div>
)}
</div>
</div>
);
})}
</div>
</div>
))}
{capturing && (
<Card>
<div style={{ fontSize: "13px", fontWeight: 700, display: "flex", alignItems: "center", gap: "7px", marginBottom: "8px" }}><Sparkles size={15} /> Capture a place</div>
<input className="inline-input full" placeholder="Paste a link, or type a place or a few names…" value={capText} onChange={e => setCapText(e.target.value)} />
<PhotoPicker files={capFiles} setFiles={setCapFiles} flash={flash} />
<div className="muted xs">Paste a link, snap a menu or sign, or jot a name — Voyage fills in the details. Confident finds are added; the rest you confirm.</div>
<div className="btnrow"><button className="primary grow" onClick={runCapture} disabled={capBusy}><Sparkles size={15} /> {capBusy ? "Reading…" : "Find places"}</button><button className="ghostbtn" onClick={() => { setCapturing(false); setCapText(""); setCapFiles([]); }}>Cancel</button></div>
</Card>
)}
{review && <MultiReview drafts={review} city={city} onClose={() => setReview(null)} onAdd={(picked) => { picked.forEach(persistPlace); setReview(null); flash(`Added ${picked.length} place${picked.length === 1 ? "" : "s"}`); }} />}
{adding && <AddPlace city={city} onCancel={() => setAdding(false)} onAdd={addPlace} />}
{!capturing && !adding && !review && (
<div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
<button className="addplace" onClick={() => setCapturing(true)}><Sparkles size={16} /> Capture with AI</button>
<button className="addplace" onClick={() => setAdding(true)}><Plus size={16} /> Add a place</button>
</div>
)}
</div>
);
}

function MultiReview({ drafts, city, onAdd, onClose }) {
const [picked, setPicked] = useState(() => new Set(drafts.map(d => d.id)));
const toggle = (id) => setPicked(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
return (
<Card>
<div style={{ fontSize: "13px", fontWeight: 700, display: "flex", alignItems: "center", gap: "7px", marginBottom: "4px" }}><Sparkles size={15} /> {drafts.length} found — add which?</div>
{drafts.map(d => (
<button key={d.id} onClick={() => toggle(d.id)} style={{ display: "flex", gap: "10px", alignItems: "flex-start", width: "100%", textAlign: "left", padding: "11px 0", background: "none", border: "none", borderTop: "1px solid #EDF1F7", cursor: "pointer" }}>
<span className="box" style={{ marginTop: "1px" }}>{picked.has(d.id) && <Check size={13} strokeWidth={3} />}</span>
<span>
<span className="place-name">{d.name}</span>
<span className="muted xs" style={{ display: "block" }}>{[d.city || city, d.tag].filter(Boolean).join(" · ")}{d.confidence < AUTOADD_MIN ? " · check this one" : ""}</span>
</span>
</button>
))}
<div className="btnrow"><button className="primary grow" onClick={() => onAdd(drafts.filter(d => picked.has(d.id)))} disabled={!picked.size}><Plus size={15} /> Add {picked.size} place{picked.size === 1 ? "" : "s"}</button><button className="ghostbtn" onClick={onClose}>Cancel</button></div>
</Card>
);
}

function AddPlace({ city, onAdd, onCancel }) {
const [name, setName] = useState("");
const [cat, setCat] = useState("Eat & Drink");
const [tag, setTag] = useState(VIBES[0]);
const [area, setArea] = useState("");
const [note, setNote] = useState("");
const go = () => { if (!name.trim()) return; onAdd({ id: uid(), city, cat, tag, name: name.trim(), area: area.trim(), note: note.trim() }); };
return (
<Card>
<input className="inline-input full" placeholder="Place name…" value={name} onChange={e => setName(e.target.value)} />
<select className="sel full" value={cat} onChange={e => setCat(e.target.value)}>{CATS.map(c => <option key={c}>{c}</option>)}</select>
<select className="sel full" value={tag} onChange={e => setTag(e.target.value)}>{VIBES.map(v => <option key={v}>{v}</option>)}</select>
<input className="inline-input full" placeholder="Area / neighbourhood (optional)" value={area} onChange={e => setArea(e.target.value)} />
<input className="inline-input full" placeholder="Note (optional)" value={note} onChange={e => setNote(e.target.value)} />
<div className="btnrow"><button className="primary grow" onClick={go}><Plus size={15} /> Add to {city}</button><button className="ghostbtn" onClick={onCancel}>Cancel</button></div>
</Card>
);
}

export function RatePrompt({ place, ctx, setStatus, travellers }) {
const { setState, tIndex, flash, db, trip, session, runSave } = ctx;
const [ratings, setRatings] = useState(() => Object.fromEntries(travellers.map(t => [t, 0])));
const [note, setNote] = useState("");
const [files, setFiles] = useState([]);
const [busy, setBusy] = useState(false);
const save = async () => {
setBusy(true);
const day = place.plannedDay != null ? place.plannedDay : tIndex;
const entry = { id: uid(), type: typeForPlace(place), title: place.name, note: note.trim(), ratings: { ...ratings }, region: "", vintage: "", city: place.city, day, ts: Date.now(), place_id: place.id, photos: [] };
try {
const res = await runSave("Saving memory...", () => db.addJournal(trip.id, entry), { kind: "addJournal", tripId: trip.id, args: { entry } });
const queued = !!(res && res.queued);
const uploaded = [];
// Photos need the journal row persisted (FK) + a live connection. When the write is only
// queued (offline, or draining a backlog) skip the upload rather than FK-fail and lose them.
if (!queued) { for (const f of files) { try { uploaded.push(await db.uploadPhoto(trip.id, entry.id, f, session.user.id)); } catch (e) { flash("A photo failed to upload"); } } }
files.forEach(f => { try { URL.revokeObjectURL(f.__preview); } catch (e) {} });
entry.photos = uploaded;
setState(s => ({ ...s, journal: [entry, ...s.journal] }));
setStatus(place.id, { rated: true });
flash(queued ? (files.length ? "Saved — reconnect to add photos" : "Saved, will sync") : "Saved to journal");
} catch (e) { flash("Could not save"); }
setBusy(false);
};
return (
<Card>
<div className="prompt-q">{questionFor(place)}</div>
<div className="ratepair">{travellers.map(t => <RateRow key={t} label={t} value={ratings[t] || 0} onChange={(v) => setRatings(r => ({ ...r, [t]: v }))} />)}</div>
<input className="inline-input full" placeholder="A line on it (optional)…" value={note} onChange={e => setNote(e.target.value)} />
<PhotoPicker files={files} setFiles={setFiles} flash={flash} />
<button className="primary" onClick={save} disabled={busy}><Check size={15} /> {busy ? "Saving…" : "Save to journal"}</button>
</Card>
);
}
