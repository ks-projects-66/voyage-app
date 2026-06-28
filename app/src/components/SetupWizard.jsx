import React, { useState, useEffect, useMemo } from "react";
import { ChevronLeft, Users, X, Plus, Home, MapPin, Clock, Search, CalendarDays, Trash2, Check } from "lucide-react";
import { addDays, geocodeCity, deviceTz, uid, dowShort, fmtDate, daysInclusive, db } from "../lib/helpers.js";
import { Card } from "./ui.jsx";

export function SetupWizard({ onCancel, onCreated, flash }) {
const [name, setName] = useState("");
const [travellers, setTravellers] = useState([]);
const [tInput, setTInput] = useState("");
const [home, setHome] = useState(null); // resolved geocode {city,country,lat,lon,tz}
const [homeInput, setHomeInput] = useState("");
const [homeBusy, setHomeBusy] = useState(false);
const [dests, setDests] = useState([]); // [{key, city, country, lat, lon, tz, arrival_date}]
const [destCity, setDestCity] = useState("");
const [destDate, setDestDate] = useState("");
const [destBusy, setDestBusy] = useState(false);
const [start, setStart] = useState("");
const [end, setEnd] = useState("");
const [touchedDates, setTouchedDates] = useState(false);
const [busy, setBusy] = useState(false);

// Keep start/end auto-suggested from destinations until the user edits them.
useEffect(() => {
if (touchedDates || !dests.length) return;
const dates = dests.map(d => d.arrival_date).filter(Boolean).sort();
if (dates.length) { setStart(dates[0]); setEnd(addDays(dates[dates.length - 1], 3)); }
}, [dests, touchedDates]);

const addTraveller = () => { const v = tInput.trim(); if (v && !travellers.includes(v)) setTravellers([...travellers, v]); setTInput(""); };
const setHomeCity = async () => {
const q = homeInput.trim(); if (!q) return;
setHomeBusy(true);
const g = await geocodeCity(q);
setHomeBusy(false);
setHome(g || { city: q, country: "", lat: null, lon: null, tz: deviceTz() });
};
const addDest = async () => {
const q = destCity.trim(); if (!q || !destDate) { flash("Add a city and an arrival date"); return; }
setDestBusy(true);
const g = await geocodeCity(q);
setDestBusy(false);
const row = g ? { ...g, arrival_date: destDate, key: uid() } : { city: q, country: "", lat: null, lon: null, tz: "", arrival_date: destDate, key: uid() };
setDests(ds => [...ds, row].sort((a, b) => (a.arrival_date || "").localeCompare(b.arrival_date || "")));
setDestCity(""); setDestDate("");
};
const removeDest = (key) => setDests(ds => ds.filter(d => d.key !== key));

const liveTravellers = useMemo(() => {
const extra = tInput.trim() && !travellers.includes(tInput.trim()) ? [tInput.trim()] : [];
return [...travellers, ...extra];
}, [travellers, tInput]);

const canCreate = name.trim() && liveTravellers.length >= 1 && dests.length >= 1 && start && end && start <= end;

const create = async () => {
if (!canCreate) { flash("Fill in name, a traveller, a destination and dates"); return; }
setBusy(true);
const trip = {
name: name.trim(),
home_city: home ? home.city : null, home_country: home ? home.country : null,
home_lat: home ? home.lat : null, home_lon: home ? home.lon : null,
home_tz: home && home.tz ? home.tz : deviceTz(),
start_date: start, end_date: end, travellers: liveTravellers,
};
const legs = [...dests].sort((a, b) => (a.arrival_date || "").localeCompare(b.arrival_date || ""))
.map(d => ({ city: d.city, country: d.country, lat: d.lat, lon: d.lon, tz: d.tz, arrival_date: d.arrival_date }));
try {
const tripId = await db.createTrip(trip, legs);
flash("Trip created");
onCreated(tripId);
} catch (e) { setBusy(false); flash("Could not create trip"); }
};

return (
<div className="scroll solo">
<header className="topbar">
<div className="topbar-row">
<button className="crumb" onClick={onCancel}><ChevronLeft size={18} /> Trips</button>
<div className="wiztitle">New trip</div>
<div style={{ width: 54 }} />
</div>
</header>
<div className="page">
<div className="section-label">Trip name</div>
<Card><input className="inline-input full" placeholder="e.g. Italy honeymoon, Japan 2027…" value={name} onChange={e => setName(e.target.value)} style={{ marginBottom: 0 }} /></Card>

<div className="section-label"><Users size={13} /> Travellers</div>
<Card>
{!!travellers.length && <div className="chips">{travellers.map(t => (
<span key={t} className="chip">{t}<button onClick={() => setTravellers(travellers.filter(x => x !== t))}><X size={12} strokeWidth={3} /></button></span>
))}</div>}
<div className="quickadd" style={{ marginTop: travellers.length ? 12 : 0 }}>
<input value={tInput} placeholder="Add a traveller's name…" onChange={e => setTInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTraveller(); } }} />
<button onClick={addTraveller}><Plus size={16} /></button>
</div>
<div className="muted xs" style={{ marginTop: 8 }}>Each traveller gets their own star rating in the journal.</div>
</Card>

<div className="section-label"><Home size={13} /> Home base <span className="optional">for time-zone & home clock</span></div>
<Card>
{home ? (
<div className="resolved">
<div><MapPin size={14} /> {home.city}{home.country ? `, ${home.country}` : ""}<div className="muted xs">{home.tz || deviceTz()}</div></div>
<button className="ghostbtn sm" onClick={() => { setHome(null); setHomeInput(""); }}>Change</button>
</div>
) : (
<div className="quickadd">
<input value={homeInput} placeholder="Your home city…" onChange={e => setHomeInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); setHomeCity(); } }} />
<button onClick={setHomeCity} disabled={homeBusy}>{homeBusy ? <Clock size={15} /> : <Search size={16} />}</button>
</div>
)}
</Card>

<div className="section-label"><MapPin size={13} /> Destinations</div>
<Card>
{!!dests.length && dests.map(d => (
<div key={d.key} className="destrow">
<div className="destrow-body">
<div className="destrow-city">{d.city}{d.country ? <span className="muted"> · {d.country}</span> : ""}</div>
<div className="muted xs">Arrive {d.arrival_date ? `${dowShort(d.arrival_date)} ${fmtDate(d.arrival_date)}` : "—"}{d.lat == null ? " · no map/weather (city not found)" : ""}</div>
</div>
<button className="del" onClick={() => removeDest(d.key)}><Trash2 size={13} /></button>
</div>
))}
<div className="destadd">
<input className="inline-input full" placeholder="City…" value={destCity} onChange={e => setDestCity(e.target.value)} />
<div className="destadd-row">
<input className="inline-input" type="date" value={destDate} onChange={e => setDestDate(e.target.value)} />
<button className="primary grow" onClick={addDest} disabled={destBusy}><Plus size={15} /> {destBusy ? "Finding…" : "Add stop"}</button>
</div>
</div>
<div className="muted xs" style={{ marginTop: 6 }}>Add each place you'll stay and the date you arrive. Order sorts by date automatically.</div>
</Card>

<div className="section-label"><CalendarDays size={13} /> Trip dates</div>
<Card>
<div className="daterow">
<label>Start<input className="inline-input" type="date" value={start} onChange={e => { setTouchedDates(true); setStart(e.target.value); }} /></label>
<label>End<input className="inline-input" type="date" value={end} onChange={e => { setTouchedDates(true); setEnd(e.target.value); }} /></label>
</div>
{start && end && start > end && <div className="autherr" style={{ marginTop: 8 }}>End date is before the start date.</div>}
{start && end && start <= end && <div className="muted xs" style={{ marginTop: 8 }}>{daysInclusive(start, end)} days.</div>}
</Card>

<button className="primary newtrip" onClick={create} disabled={!canCreate || busy}>
<Check size={16} /> {busy ? "Creating…" : "Create trip"}
</button>
<button className="ghostbtn block" onClick={onCancel}>Cancel</button>
</div>
</div>
);
}
