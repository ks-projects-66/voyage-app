import React, { useState, useEffect, useRef, useMemo } from "react";
import {
ChevronLeft, Share2, RefreshCw, Sun, CalendarDays, BookOpen, Compass, Sparkles, Zap,
Globe, Check, Trash2, Map as MapIcon, ChevronDown, Clock, Bed, Plus, Copy,
} from "lucide-react";
import { PRIVATE_TYPE_ORDER, privateTypeMeta } from "../lib/constants.js";
import {
buildItinerary, todayIndexFor, tripCitiesOf, uid, db, useSetStatus, useLiveWeather,
mergedPlaces, mapDayUrl, fmtDate, tzChip, tzFull,
} from "../lib/helpers.js";
import { queueLength, enqueue, flushQueue, isNetworkish } from "../lib/sync.js";
import { supabase } from "../lib/supabase.js";
import { WeatherGlyph, HomeClock, Card, QuickAdd, Stat } from "./ui.jsx";
import { Journal } from "./Journal.jsx";
import { Explore } from "./Explore.jsx";
import { Recap, ShareTrip, FastCapture } from "./ShareRecap.jsx";

export function TripApp({ trip, legs, session, onExit, flash }) {
const days = useMemo(() => buildItinerary(trip, legs), [trip, legs]);
const tIndex = useMemo(() => todayIndexFor(days), [days]);
const tripCities = useMemo(() => tripCitiesOf(legs), [legs]);
const total = days.length || 1;

const [tab, setTab] = useState("today");
const [loaded, setLoaded] = useState(false);
const [stale, setStale] = useState(false);
const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
const [toast, setToast] = useState("");
const [sync, setSync] = useState({ state: "idle", message: "Synced" });
const [pending, setPending] = useState(typeof localStorage === "undefined" ? 0 : queueLength());
const [members, setMembers] = useState({ enabled: null, list: [] });
const [sharing, setSharing] = useState(false);
const [capturing, setCapturing] = useState(false);
const PREFS_KEY = `wl:prefs:${trip.id}`;
const [state, setState] = useState({ weather: {}, planDone: {}, planAdd: {}, journal: [], exploreStatus: {}, exploreAdded: [], privateNotes: [] });
const localPrefs = useRef({ weather: {}, planDone: {}, planAdd: {} });
const isFetching = useRef(false);

useEffect(() => {
try { const v = localStorage.getItem(PREFS_KEY); if (v) { const p = JSON.parse(v); localPrefs.current = p; setState(s => ({ ...s, ...p })); } } catch (e) {}
}, [PREFS_KEY]);
const persistPrefs = (next) => {
const prefs = { weather: next.weather, planDone: next.planDone, planAdd: next.planAdd };
localPrefs.current = prefs;
try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) {}
};
const setLocal = (updater) => setState(s => { const next = typeof updater === "function" ? updater(s) : { ...s, ...updater }; persistPrefs(next); return next; });

useEffect(() => {
const onUp = () => { setOnline(true); flushQueue(setPending); };
const onDown = () => setOnline(false);
window.addEventListener("online", onUp); window.addEventListener("offline", onDown);
return () => { window.removeEventListener("online", onUp); window.removeEventListener("offline", onDown); };
}, []);
// Drain anything left queued from a previous (offline) session on load.
useEffect(() => { if (queueLength()) flushQueue(setPending); }, []);

const localToast = (m) => { setToast(m); setTimeout(() => setToast(""), 1800); };
// runSave(label, op[, queueOp]). When a serialisable queueOp { kind, tripId?, args }
// is supplied, the write becomes offline-first: offline or a network failure enqueues
// it (keeping the optimistic UI) instead of throwing; a logical error still throws so
// the caller can revert. Writes without a queueOp keep the old online-only behaviour.
const runSave = async (label, op, queueOp) => {
if (!online) {
if (queueOp) { enqueue(queueOp); setPending(queueLength()); setSync({ state: "queued", message: "Saved offline, will sync" }); return { queued: true }; }
setSync({ state: "queued", message: "Offline, retry when connected" }); throw new Error("offline");
}
setSync({ state: "saving", message: label || "Saving..." });
try {
const result = await op();
flushQueue(setPending);
setSync({ state: "synced", message: "Saved" });
setTimeout(() => setSync(s => s.state === "synced" ? { state: "idle", message: "Synced" } : s), 1600);
return result;
} catch (e) {
if (queueOp && isNetworkish(e)) { enqueue(queueOp); setPending(queueLength()); setSync({ state: "queued", message: "Saved offline, will sync" }); return { queued: true }; }
setSync({ state: "error", message: "Sync failed, tap retry" });
throw e;
}
};
const refreshMembers = async () => {
const r = await db.loadMembers(trip.id);
setMembers({ enabled: r.enabled, list: r.members || [] });
return r;
};
const refresh = async () => {
if (isFetching.current) return; // guard against overlapping refetches (realtime can fire in bursts)
isFetching.current = true;
try {
const [data] = await Promise.all([db.loadTripData(trip.id), refreshMembers()]);
setState(s => ({ ...s, ...localPrefs.current, ...data }));
setStale(false); setLoaded(true); setSync(s => (s.state === "queued" ? s : { state: "idle", message: "Synced" }));
} catch (e) { setStale(true); setLoaded(true); }
finally { isFetching.current = false; }
};
useEffect(() => { refresh(); }, [trip.id]);
useEffect(() => {
const onVis = () => { if (document.visibilityState === "visible") refresh(); };
document.addEventListener("visibilitychange", onVis);
return () => document.removeEventListener("visibilitychange", onVis);
}, [trip.id]);
// Live sync: refetch (debounced) when any collaborator changes this trip's shared rows.
useEffect(() => {
const tables = ["wl_places", "wl_place_status", "wl_journal_entries", "wl_journal_photos", "wl_private_notes", "wl_inbox", "wl_trip_members"];
let timer = null;
const bump = () => { clearTimeout(timer); timer = setTimeout(() => refresh(), 300); };
const ch = supabase.channel("trip:" + trip.id);
tables.forEach(t => ch.on("postgres_changes", { event: "*", schema: "public", table: t, filter: `trip_id=eq.${trip.id}` }, bump));
ch.subscribe();
return () => { clearTimeout(timer); supabase.removeChannel(ch); };
}, [trip.id]);

const copy = (txt, label) => {
try { navigator.clipboard.writeText(txt); localToast((label || "Copied") + " copied"); }
catch { localToast("Copy failed"); }
};

const ctx = { state, setState, setLocal, tIndex, days, legs, trip, tripCities, total, copy, flash: localToast, uid, setTab, refresh, refreshMembers, runSave, members, db, session, user: session.user, canEdit: true };

const stats = useMemo(() => {
const wines = state.journal.filter(j => j.type === "Wine").length;
const meals = state.journal.filter(j => j.type === "Meal").length;
const sum = (r) => Object.values(r || {}).reduce((a, b) => a + (b || 0), 0);
const bestMeal = [...state.journal].filter(j => j.type === "Meal").sort((a, b) => sum(b.ratings) - sum(a.ratings))[0];
return { wines, meals, bestMeal };
}, [state.journal]);

return (
<div className="scroll-wrap">
<header className="topbar">
<div className="topbar-row">
<button className="crumb" onClick={onExit}><ChevronLeft size={18} /> Trips</button>
<div className="brand-mid">
<div className="brandline mid">{trip.name}</div>
</div>
<button className="sharetop" onClick={() => setSharing(true)}><Share2 size={14} /> Share</button>
<div className="daychip">
<span className="daychip-num">Day {Math.min(tIndex + 1, total)}</span>
<span className="daychip-of">/ {total}</span>
</div>
</div>
<div className="progress"><div className="progress-fill" style={{ width: `${((tIndex + 1) / total) * 100}%` }} /></div>
<div className="syncrow">
<span className={"syncnote" + (!online || pending > 0 || sync.state === "error" || sync.state === "queued" ? " warn" : "")}>{
!online ? (pending > 0 ? `Offline · ${pending} change${pending === 1 ? "" : "s"} pending` : "Offline · edits saved on this device")
: pending > 0 ? `Syncing ${pending} change${pending === 1 ? "" : "s"}…`
: `${sync.message}${members.enabled === false ? " - collaboration setup needed" : ""}`
}</span>
{sync.state === "error" && <button className="syncbtn" onClick={refresh}><RefreshCw size={11} /> Retry</button>}
</div>
{stale && <button className="stalebanner" onClick={refresh}>Couldn't load the latest trip data — tap to retry.</button>}
</header>

<main className="scroll">
{days.length === 0 && <div className="page"><div className="muted sm empty pad">This trip has no dates yet.</div></div>}
{days.length > 0 && tab === "today" && <Today {...ctx} />}
{days.length > 0 && tab === "days" && <Days {...ctx} />}
{tab === "journal" && <Journal {...ctx} stats={stats} />}
{days.length > 0 && tab === "explore" && <Explore {...ctx} />}
{days.length > 0 && tab === "recap" && <Recap {...ctx} />}
</main>

{toast && <div className="toast">{toast}</div>}
{sharing && <ShareTrip ctx={ctx} onClose={() => setSharing(false)} />}
{capturing && <FastCapture ctx={ctx} onClose={() => setCapturing(false)} />}
<button className="capturefab" onClick={() => setCapturing(true)}><Zap size={17} /> Capture</button>

<nav className="tabbar">
{[
{ id: "today", label: "Today", Icon: Sun },
{ id: "days", label: "Days", Icon: CalendarDays },
{ id: "journal", label: "Journal", Icon: BookOpen },
{ id: "explore", label: "Explore", Icon: Compass },
{ id: "recap", label: "Recap", Icon: Sparkles },
].map(({ id, label, Icon }) => (
<button key={id} className={"tab" + (tab === id ? " active" : "")} onClick={() => setTab(id)}>
<Icon size={20} strokeWidth={tab === id ? 2.2 : 1.7} />
<span>{label}</span>
</button>
))}
</nav>
</div>
);
}

/* ============================== PRIVATE NOTES ============================== */

function PrivateNotes({ ctx, dayIndex, compact }) {
const { state, copy, db, setState, flash, trip, runSave } = ctx;
const [adding, setAdding] = useState(false);
const notes = (state.privateNotes || []).filter(n => n.day === dayIndex);
const groups = PRIVATE_TYPE_ORDER.map(t => ({ type: t, items: notes.filter(n => n.type === t) })).filter(g => g.items.length);

const del = async (id) => {
const prev = state.privateNotes;
setState(s => ({ ...s, privateNotes: (s.privateNotes || []).filter(n => n.id !== id) }));
try { await runSave("Removing note...", () => db.deletePrivateNote(id), { kind: "deletePrivateNote", args: { id } }); flash("Note removed"); }
catch (e) { flash("Delete failed"); setState(s => ({ ...s, privateNotes: prev })); }
};
const addNote = async (note) => {
const entry = { id: uid(), day: dayIndex, type: note.type, title: note.title, body: note.body, ref: note.ref, url: "", sort_order: 0 };
setState(s => ({ ...s, privateNotes: [...(s.privateNotes || []), entry] }));
setAdding(false);
try { await runSave("Saving note...", () => db.addPrivateNote(trip.id, entry), { kind: "addPrivateNote", tripId: trip.id, args: { note: entry } }); flash("Note added"); }
catch (e) { flash("Could not save note"); }
};

if (!notes.length && !adding) {
return (
<div className="privsec">
<div className="privhead"><Bed size={13} /> Logistics</div>
<button className="privadd" onClick={() => setAdding(true)}><Plus size={14} /> Add a booking or note</button>
</div>
);
}
return (
<div className="privsec">
<div className="privhead"><Bed size={13} /> Logistics</div>
{groups.map(g => {
const Ic = privateTypeMeta(g.type).icon;
return (
<div key={g.type} className="privgroup">
<div className="privgroup-label"><Ic size={12} /> {privateTypeMeta(g.type).label}</div>
{g.items.map(n => (
<div key={n.id} className={"privrow" + (compact ? " compact" : "")}>
<div className="privrow-body">
<div className="privrow-title">{n.title}</div>
{n.body && <div className="muted xs">{n.body}</div>}
{n.ref && <button className="reflink xs" onClick={() => copy(n.ref, "Reference")}><span>{n.ref}</span><Copy size={11} /></button>}
</div>
<button className="del" onClick={() => del(n.id)}><Trash2 size={13} /></button>
</div>
))}
</div>
);
})}
{adding ? <AddPrivateNote onCancel={() => setAdding(false)} onAdd={addNote} />
: <button className="privadd" onClick={() => setAdding(true)}><Plus size={14} /> Add a booking or note</button>}
</div>
);
}

function AddPrivateNote({ onAdd, onCancel }) {
const [type, setType] = useState("note");
const [title, setTitle] = useState("");
const [body, setBody] = useState("");
const [ref, setRef] = useState("");
const go = () => { if (!title.trim()) return; onAdd({ type, title: title.trim(), body: body.trim(), ref: ref.trim() }); };
return (
<div className="privadd-form">
<select className="sel full" value={type} onChange={e => setType(e.target.value)}>{PRIVATE_TYPE_ORDER.map(t => <option key={t} value={t}>{privateTypeMeta(t).label}</option>)}</select>
<input className="inline-input full" placeholder="Title (e.g. Hotel, Flight)…" value={title} onChange={e => setTitle(e.target.value)} />
<input className="inline-input full" placeholder="Details (optional)…" value={body} onChange={e => setBody(e.target.value)} />
<input className="inline-input full" placeholder="Reference / booking code (optional)…" value={ref} onChange={e => setRef(e.target.value)} />
<div className="btnrow"><button className="primary grow" onClick={go}><Plus size={15} /> Add</button><button className="ghostbtn" onClick={onCancel}>Cancel</button></div>
</div>
);
}

/* ============================== TODAY ============================== */

function Today(ctx) {
const { state, setLocal, tIndex, copy, setTab, days, trip } = ctx;
const setStatus = useSetStatus(ctx);
const d = days[tIndex];
const live = useLiveWeather(d.coords);
const wOverride = state.weather[tIndex] || "";
const toRate = mergedPlaces(state).filter(p => p.been && !p.rated).length;
const exploreToday = mergedPlaces(state).filter(p => p.plannedDay === tIndex);
const planItems = (state.planAdd[tIndex] || []).map(p => ({ ...p, custom: true }));
const done = state.planDone[tIndex] || {};
const donePlaces = mergedPlaces(state).filter(p => p.been).length;
const toggle = (id) => setLocal(s => ({ ...s, planDone: { ...s.planDone, [tIndex]: { ...(s.planDone[tIndex] || {}), [id]: !(s.planDone[tIndex] || {})[id] } } }));
const removePlan = (id) => setLocal(s => ({ ...s, planAdd: { ...s.planAdd, [tIndex]: (s.planAdd[tIndex] || []).filter(x => x.id !== id) } }));
const mapUrl = mapDayUrl(exploreToday);
const showClock = trip.home_tz && d.tz && trip.home_tz !== d.tz;

return (
<div className="page">
<div className="hero">
<div className="hero-top">
<div>
<div className="hero-date">{d.dow} {fmtDate(d.date)}</div>
<div className="hero-city">{d.disp}</div>
{d.country && <div className="hero-country"><Globe size={12} /> {d.country}</div>}
</div>
<div className="hero-weather">
<WeatherGlyph kind={(live && !wOverride) ? live.icon : "cloudsun"} size={34} />
<div className="hero-temp">{live ? `${live.temp}°` : "—"}{live && <span>{`H${live.hi}° L${live.lo}°`}</span>}</div>
{live && !wOverride && <span className="wxlive"><span className="wxdot" />live</span>}
</div>
</div>
<div className="hero-cond">{wOverride || (live ? live.cond : (d.coords ? "Fetching live weather…" : "No live weather for this stop"))}</div>
<input className="weather-input" placeholder="Tap to note today's real forecast…" value={wOverride}
onChange={e => setLocal(s => ({ ...s, weather: { ...s.weather, [tIndex]: e.target.value } }))} />
</div>

{showClock && <HomeClock homeTz={trip.home_tz} homeCity={trip.home_city} />}

{toRate > 0 && (
<button className="nudge" onClick={() => setTab("journal")}>
<BookOpen size={15} /> {toRate} {toRate === 1 ? "place" : "places"} to rate in your journal
</button>
)}

<PrivateNotes ctx={ctx} dayIndex={tIndex} />

<div className="section-label">Plan</div>
<Card>
{planItems.length === 0 && exploreToday.length === 0 && <div className="muted sm empty">Nothing locked in. Add something below as the day unfolds.</div>}
{planItems.map(p => (
<div key={p.id} className="planrow">
<button className={"checkrow" + (done[p.id] ? " checked" : "")} onClick={() => toggle(p.id)}>
<span className="box">{done[p.id] && <Check size={13} strokeWidth={3} />}</span>
<span className="checktext">{p.t}</span>
</button>
<button className="del" onClick={() => removePlan(p.id)} aria-label="Remove plan item"><Trash2 size={13} /></button>
</div>
))}
{exploreToday.map(p => (
<button key={p.id} className={"checkrow" + (p.been ? " checked" : "")} onClick={() => setStatus(p.id, { been: !p.been })}>
<span className="box">{p.been && <Check size={13} strokeWidth={3} />}</span>
<span className="checktext">{p.name}<span className="vibetag inline">{p.tag}</span></span>
</button>
))}
<QuickAdd placeholder="Add to today…" onAdd={(t) => setLocal(s => ({ ...s, planAdd: { ...s.planAdd, [tIndex]: [...(s.planAdd[tIndex] || []), { id: uid(), t }] } }))} />
</Card>

{mapUrl && (
<a className="mapday" href={mapUrl} target="_blank" rel="noopener noreferrer">
<MapIcon size={14} /> Map today's stops{exploreToday.length > 1 ? " in walking order" : ""}
</a>
)}

<div className="ministats">
<Stat label="Planned today" value={planItems.length + exploreToday.length} />
<Stat label="Places done" value={donePlaces} />
<Stat label="To rate" value={toRate} accent />
</div>
</div>
);
}

/* ============================== DAYS ============================== */

function Days(ctx) {
const { state, setLocal, tIndex, days, trip } = ctx;
const setStatus = useSetStatus(ctx);
const [open, setOpen] = useState({ [tIndex]: true });
const toggleOpen = (i) => setOpen(o => ({ ...o, [i]: !o[i] }));

return (
<div className="page">
<div className="page-h">Itinerary</div>
{days.map((d, i) => {
const tz = d.tz;
const isOpen = open[i];
const isToday = i === tIndex;
const planItems = (state.planAdd[i] || []).map(p => ({ ...p, custom: true }));
const done = state.planDone[i] || {};
const exploreDay = mergedPlaces(state).filter(p => p.plannedDay === i);
const dayMapUrl = mapDayUrl(exploreDay);
return (
<div key={i} className={"daycard" + (isToday ? " today" : "")} style={{ animationDelay: `${Math.min(i, 12) * 28}ms` }}>
<button className="daycard-head" onClick={() => toggleOpen(i)}>
<div className="daycard-date"><div className="dc-dow">{d.dow}</div><div className="dc-num">{d.date.slice(8)}</div></div>
<div className="daycard-main">
<div className="dc-city">{d.disp}{isToday && <span className="todaybadge">today</span>}</div>
<div className="dc-sub"><span className="tzchip"><Clock size={12} /> {tzChip(trip.home_tz, tz)}</span></div>
</div>
<ChevronDown size={18} className={"chev" + (isOpen ? " up" : "")} />
</button>
{isOpen && (
<div className="daycard-body">
<div className="tzline"><Clock size={13} /> {tzFull(trip.home_tz, tz)}</div>
<PrivateNotes ctx={ctx} dayIndex={i} compact />
{planItems.map(p => (
<div key={p.id} className="planrow">
<button className={"checkrow sm" + (done[p.id] ? " checked" : "")}
onClick={() => setLocal(s => ({ ...s, planDone: { ...s.planDone, [i]: { ...(s.planDone[i] || {}), [p.id]: !(s.planDone[i] || {})[p.id] } } }))}>
<span className="box">{done[p.id] && <Check size={12} strokeWidth={3} />}</span>
<span className="checktext">{p.t}</span>
</button>
<button className="del" aria-label="Remove plan item"
onClick={() => setLocal(s => ({ ...s, planAdd: { ...s.planAdd, [i]: (s.planAdd[i] || []).filter(x => x.id !== p.id) } }))}><Trash2 size={13} /></button>
</div>
))}
{exploreDay.map(p => (
<button key={p.id} className={"checkrow sm" + (p.been ? " checked" : "")} onClick={() => setStatus(p.id, { been: !p.been })}>
<span className="box">{p.been && <Check size={12} strokeWidth={3} />}</span>
<span className="checktext">{p.name}<span className="vibetag inline">{p.tag}</span></span>
</button>
))}
{dayMapUrl && <a className="mapday sm" href={dayMapUrl} target="_blank" rel="noopener noreferrer"><MapIcon size={13} /> Map this day</a>}
<QuickAdd placeholder="Add a stop…" onAdd={(t) => setLocal(s => ({ ...s, planAdd: { ...s.planAdd, [i]: [...(s.planAdd[i] || []), { id: uid(), t }] } }))} />
</div>
)}
</div>
);
})}
</div>
);
}
