import React, { useState } from "react";
import { Check, CalendarDays, CalendarPlus, Plus } from "lucide-react";
import { CATS, VIBES } from "../lib/constants.js";
import { useSetStatus, mergedPlaces, fmtDate, uid, typeForPlace, questionFor } from "../lib/helpers.js";
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

const places = mergedPlaces(state).filter(p => p.city === city);
const vibesHere = ["All", ...Array.from(new Set(places.map(p => p.tag)))];
const shown = vibe === "All" ? places : places.filter(p => p.tag === vibe);
const doneCount = places.filter(p => p.been).length;
const cityDays = days.map((d, i) => ({ i, d })).filter(x => x.d.city === city);
const byCat = CATS.map(cat => ({ cat, items: shown.filter(p => p.cat === cat) })).filter(g => g.items.length);

const addPlace = async (place) => {
setState(s => ({ ...s, exploreAdded: [...(s.exploreAdded || []), place] }));
setAdding(false);
try { await runSave("Saving place...", () => db.addPlace(trip.id, place)); } catch (e) { flash("Could not save place"); }
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
{adding ? <AddPlace city={city} onCancel={() => setAdding(false)} onAdd={addPlace} />
: <button className="addplace" onClick={() => setAdding(true)}><Plus size={16} /> Add a place</button>}
</div>
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
await runSave("Saving memory...", () => db.addJournal(trip.id, entry));
const uploaded = [];
for (const f of files) { try { uploaded.push(await db.uploadPhoto(trip.id, entry.id, f, session.user.id)); } catch (e) { flash("A photo failed to upload"); } }
files.forEach(f => { try { URL.revokeObjectURL(f.__preview); } catch (e) {} });
entry.photos = uploaded;
setState(s => ({ ...s, journal: [entry, ...s.journal] }));
setStatus(place.id, { rated: true });
flash("Saved to journal");
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
