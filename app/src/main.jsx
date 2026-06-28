import React, { useState, useEffect, useRef, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import { createClient } from "@supabase/supabase-js";
import "./styles.css";
import {
Sun, Cloud, CloudRain, CloudSun, Plane, TrainFront, Wine, UtensilsCrossed,
Camera, Sparkles, Check, Plus, Copy, Trash2, Star, ChevronDown, ChevronLeft, BookOpen,
CalendarDays, Bed, Globe, Clock, Compass, CalendarPlus, ShoppingBag, ImagePlus, LogOut, Ticket, BellRing, StickyNote,
X, Map as MapIcon, MapPin, Users, Home, Search, Luggage, Share2, UserPlus, Zap, RefreshCw, ShieldCheck, Link as LinkIcon, Download
} from "lucide-react";

/* ============================== SUPABASE ============================== */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://bsbuhkzdebqobkpxtivb.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_lHRUROp8gqkZcDRUuVuI9w_Vc00p7Ra";
const PHOTO_BUCKET = import.meta.env.VITE_PHOTO_BUCKET || "wl-photos";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const PRODUCT = "Voyage"; // app name — shown on the auth screen and the trips list.
const TAGLINE = "PLAN ANY TRIP, ANYWHERE"; // (inside a trip, the trip's own name becomes the header brand)

/* ============================== EXPLORE TAXONOMY ============================== */

const VIBES = ["Fancy dinner","Long lunch","Quick bite","Coffee & cake","Wine bar","Cheap & cheerful","Sweet treat","Must-see","Hidden gem","Golden hour","Browse & buy"];
const CATS = ["Eat & Drink","See & Do","Shop"];

const PRIVATE_TYPE_META = {
hotel:    { icon: Bed,         label: "Stay" },
flight:   { icon: Plane,       label: "Flight" },
train:    { icon: TrainFront,  label: "Train" },
ticket:   { icon: Ticket,      label: "Ticket" },
reminder: { icon: BellRing,    label: "Reminder" },
note:     { icon: StickyNote,  label: "Note" },
};
const PRIVATE_TYPE_ORDER = ["hotel","flight","train","ticket","reminder","note"];
function privateTypeMeta(t){ return PRIVATE_TYPE_META[t] || PRIVATE_TYPE_META.note; }

const TYPE_META = {
Meal: { icon: UtensilsCrossed, color: "var(--c-meal)",   bg: "var(--c-meal-bg)" },
Wine: { icon: Wine,            color: "var(--c-wine)",   bg: "var(--c-wine-bg)" },
Sight: { icon: Camera,         color: "var(--c-sight)",  bg: "var(--c-sight-bg)" },
Moment:{ icon: Sparkles,       color: "var(--c-moment)", bg: "var(--c-moment-bg)" },
};

/* ============================== HELPERS ============================== */

const uid = () => Math.random().toString(36).slice(2, 9);
const shareToken = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
const todayCanon = () => new Date().toLocaleDateString("en-CA");
function appUrl(params = {}) {
const u = new URL(window.location.href);
Object.entries(params).forEach(([k, v]) => v == null ? u.searchParams.delete(k) : u.searchParams.set(k, v));
return u.toString();
}
function publicRecapUrl(token) { return appUrl({ recap: token }); }
function sumRatings(r) { return Object.values(r || {}).reduce((a, b) => a + (b || 0), 0); }
function buildRecapSnapshot(trip, days, state) {
const journal = state.journal || [];
const meals = journal.filter(j => j.type === "Meal");
const wines = journal.filter(j => j.type === "Wine");
const bestMeal = [...meals].sort((a, b) => sumRatings(b.ratings) - sumRatings(a.ratings))[0] || null;
const bestWine = [...wines].sort((a, b) => sumRatings(b.ratings) - sumRatings(a.ratings))[0] || null;
const allPhotos = journal.flatMap(j => (j.photos || []).map(p => ({ src: p.src, name: p.name || j.title }))).slice(0, 18);
const cities = [...new Set((days || []).map(d => d.city).filter(Boolean))];
return {
trip: { name: trip.name, start_date: trip.start_date, end_date: trip.end_date, travellers: trip.travellers || [] },
days: (days || []).map(d => ({ date: d.date, city: d.city, disp: d.disp, country: d.country })),
cities,
stats: { days: (days || []).length, cities: cities.length, meals: meals.length, wines: wines.length, memories: journal.length },
bestMeal: bestMeal ? { title: bestMeal.title, city: bestMeal.city, ratings: bestMeal.ratings || {}, note: bestMeal.note || "" } : null,
bestWine: bestWine ? { title: bestWine.title, city: bestWine.city, ratings: bestWine.ratings || {}, note: bestWine.note || "" } : null,
photos: allPhotos,
journal: journal.slice(0, 80).map(j => ({ type: j.type, title: j.title, note: j.note || "", city: j.city || "", day: j.day, ratings: j.ratings || {}, photos: (j.photos || []).slice(0, 4).map(p => ({ src: p.src, name: p.name || "" })) })),
updated_at: new Date().toISOString(),
};
}

function fmtDate(iso) {
const m = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const p = (iso || "").split("-");
if (p.length < 3) return iso || "";
return `${parseInt(p[2], 10)} ${m[parseInt(p[1], 10) - 1]}`;
}
function dowShort(iso) {
try { return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" }); }
catch (e) { return ""; }
}
function addDays(iso, n) {
const dt = new Date(iso + "T00:00:00");
dt.setDate(dt.getDate() + n);
return dt.toLocaleDateString("en-CA");
}
function daysInclusive(startIso, endIso) {
if (!startIso || !endIso) return 0;
const a = new Date(startIso + "T00:00:00"), b = new Date(endIso + "T00:00:00");
return Math.max(1, Math.round((b - a) / 86400000) + 1);
}
const deviceTz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return "UTC"; } };

// Minutes east of UTC for an IANA timezone right now (handles half-hour zones).
function tzOffsetMinutes(tz) {
try {
const name = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset", hour: "numeric" })
.formatToParts(new Date()).find(p => p.type === "timeZoneName").value;
const m = name.match(/([+-])(\d{1,2})(?::?(\d{2}))?/);
if (!m) return 0; // "GMT"/"UTC" → 0
const sign = m[1] === "-" ? -1 : 1;
return sign * (parseInt(m[2], 10) * 60 + (m[3] ? parseInt(m[3], 10) : 0));
} catch (e) { return 0; }
}
// How far ahead/behind HOME is relative to the destination, in hours.
function homeAheadHours(homeTz, destTz) {
if (!homeTz || !destTz) return 0;
return (tzOffsetMinutes(homeTz) - tzOffsetMinutes(destTz)) / 60;
}
function tzChip(homeTz, destTz) {
if (!homeTz || !destTz || homeTz === destTz) return "Home time";
const diff = homeAheadHours(homeTz, destTz);
if (diff === 0) return "Home time";
const v = Math.abs(diff);
return `Home ${diff > 0 ? "+" : "−"}${Number.isInteger(v) ? v : v.toFixed(1)}h`;
}
function tzFull(homeTz, destTz) {
if (!homeTz || !destTz || homeTz === destTz) return "Same time as home";
const diff = homeAheadHours(homeTz, destTz);
if (diff === 0) return `${destTz} · same time as home`;
const v = Math.abs(diff); const vs = Number.isInteger(v) ? v : v.toFixed(1);
return `${destTz} · home is ${vs}h ${diff > 0 ? "ahead" : "behind"}`;
}

function homeTime(homeTz) {
try {
return new Intl.DateTimeFormat("en-AU", { timeZone: homeTz, weekday: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date());
} catch (e) { return ""; }
}
function HomeClock({ homeTz, homeCity }) {
const [t, setT] = useState(() => homeTime(homeTz));
useEffect(() => {
const id = setInterval(() => setT(homeTime(homeTz)), 30000);
return () => clearInterval(id);
}, [homeTz]);
if (!t) return null;
return <div className="homeclock"><Clock size={13} /><span className="homeclock-l">{homeCity || "Home"}</span><span className="homeclock-t">{t}</span></div>;
}

/* ============================== GEOCODING (Open-Meteo, keyless) ============================== */

// Resolve a free-text city to coordinates + IANA timezone + country.
// Returns null on any failure so the caller can fall back to name-only.
async function geocodeCity(name) {
try {
const u = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`;
const r = await fetch(u);
if (!r.ok) return null;
const j = await r.json();
const g = (j.results || [])[0];
if (!g) return null;
return { city: g.name, country: g.country || "", lat: g.latitude, lon: g.longitude, tz: g.timezone || "" };
} catch (e) { return null; }
}

/* ============================== WEATHER (Open-Meteo, keyless) ============================== */

function WeatherGlyph({ kind, size = 22 }) {
const p = { size, strokeWidth: 1.6 };
if (kind === "sun") return <Sun {...p} />;
if (kind === "cloud") return <Cloud {...p} />;
if (kind === "cloudrain") return <CloudRain {...p} />;
return <CloudSun {...p} />;
}
function wmo(code) {
if (code === 0) return { icon: "sun", cond: "Clear" };
if (code === 1 || code === 2) return { icon: "cloudsun", cond: "Partly cloudy" };
if (code === 3) return { icon: "cloud", cond: "Overcast" };
if (code === 45 || code === 48) return { icon: "cloud", cond: "Fog" };
if (code >= 51 && code <= 57) return { icon: "cloudrain", cond: "Drizzle" };
if (code >= 61 && code <= 67) return { icon: "cloudrain", cond: "Rain" };
if (code >= 71 && code <= 77) return { icon: "cloud", cond: "Snow" };
if (code >= 80 && code <= 82) return { icon: "cloudrain", cond: "Rain showers" };
if (code >= 85 && code <= 86) return { icon: "cloud", cond: "Snow showers" };
if (code >= 95) return { icon: "cloudrain", cond: "Thunderstorms" };
return { icon: "cloudsun", cond: "Mixed sky" };
}
async function fetchWeather(coords) {
try {
const u = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}`
+ `&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code`
+ `&timezone=auto&forecast_days=1`;
const r = await fetch(u);
if (!r.ok) return null;
const j = await r.json();
const cur = j.current || {};
const day = j.daily || {};
const code = (day.weather_code && day.weather_code[0] != null) ? day.weather_code[0] : cur.weather_code;
const w = wmo(code);
return { temp: Math.round(cur.temperature_2m), hi: Math.round(day.temperature_2m_max[0]), lo: Math.round(day.temperature_2m_min[0]), icon: w.icon, cond: w.cond };
} catch (e) { return null; }
}
function useLiveWeather(coords) {
const [live, setLive] = useState(null);
const key = coords ? `${coords.lat},${coords.lon}` : "";
useEffect(() => {
let on = true; setLive(null);
if (!coords) return;
const go = () => fetchWeather(coords).then(w => { if (on && w) setLive(w); });
go();
const onVis = () => { if (document.visibilityState === "visible") go(); };
document.addEventListener("visibilitychange", onVis);
return () => { on = false; document.removeEventListener("visibilitychange", onVis); };
}, [key]);
return live;
}

/* ============================== PHOTOS ============================== */

function photoPublicUrl(path) {
if (!path) return "";
const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
return data ? data.publicUrl : "";
}
async function compressImage(file, maxDim = 1600, quality = 0.82) {
try {
const bmp = await createImageBitmap(file);
const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
if (scale === 1 && file.size < 900000) return file;
const canvas = document.createElement("canvas");
canvas.width = Math.max(1, Math.round(bmp.width * scale));
canvas.height = Math.max(1, Math.round(bmp.height * scale));
canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
const blob = await new Promise(res => canvas.toBlob(res, "image/jpeg", quality));
return blob || file;
} catch (e) { return file; }
}

/* ============================== ITINERARY DERIVATION ============================== */

// Build a per-day itinerary from a trip's date range + its destination legs.
// Each day's active leg = the last leg whose arrival_date <= that day.
function buildItinerary(trip, legs) {
if (!trip || !trip.start_date || !trip.end_date) return [];
const sorted = [...(legs || [])].sort((a, b) =>
(a.arrival_date || "").localeCompare(b.arrival_date || "") || (a.sort_order - b.sort_order));
const days = [];
let d = trip.start_date, guard = 0;
while (d <= trip.end_date && guard < 400) {
let active = sorted[0] || null, activeIdx = 0;
for (let i = 0; i < sorted.length; i++) {
if ((sorted[i].arrival_date || "") <= d) { active = sorted[i]; activeIdx = i; }
}
const arrivalHere = sorted.findIndex(l => l.arrival_date === d);
const isTravel = arrivalHere > 0;
const city = active ? active.city : (trip.name || "");
const disp = isTravel ? `${sorted[arrivalHere - 1].city} → ${sorted[arrivalHere].city}` : city;
days.push({
date: d, dow: dowShort(d), city, disp,
country: active ? (active.country || "") : "",
coords: (active && active.lat != null) ? { lat: active.lat, lon: active.lon } : null,
tz: active ? (active.tz || trip.home_tz) : trip.home_tz,
});
d = addDays(d, 1); guard++;
}
return days;
}
function todayIndexFor(days) {
if (!days.length) return 0;
const t = todayCanon();
const i = days.findIndex(d => d.date === t);
if (i >= 0) return i;
if (t < days[0].date) return 0;
return days.length - 1;
}
function tripCitiesOf(legs) {
const sorted = [...(legs || [])].sort((a, b) =>
(a.arrival_date || "").localeCompare(b.arrival_date || "") || (a.sort_order - b.sort_order));
const seen = []; sorted.forEach(l => { if (l.city && !seen.includes(l.city)) seen.push(l.city); });
return seen;
}

function mapDayUrl(places) {
const pts = places.map(p => encodeURIComponent([p.name, (p.area || "").replace(/·/g, ","), p.city].filter(Boolean).join(", ")));
if (!pts.length) return null;
if (pts.length === 1) return `https://www.google.com/maps/search/?api=1&query=${pts[0]}`;
return `https://www.google.com/maps/dir/?api=1&destination=${pts[pts.length - 1]}&waypoints=${pts.slice(0, -1).join("%7C")}&travelmode=walking`;
}

/* ============================== EXPLORE STATE HELPERS ============================== */

function mergedPlaces(state) {
const added = (state.exploreAdded || []);
return added.map(p => {
const st = (state.exploreStatus && state.exploreStatus[p.id]) || {};
return { ...p, plannedDay: ("plannedDay" in st) ? st.plannedDay : null, been: !!st.been, rated: !!st.rated };
});
}
function questionFor(p) {
if (p.cat === "See & Do") return `${p.name}. Glad you went?`;
if (p.cat === "Shop") return `Find anything at ${p.name}?`;
if (p.tag === "Wine bar") return `What were you drinking at ${p.name}?`;
if (p.tag === "Sweet treat" || p.tag === "Coffee & cake") return `How was ${p.name}?`;
if (p.tag === "Fancy dinner") return `${p.name}. Worth it?`;
if (p.tag === "Quick bite") return `${p.name}. Quick and good?`;
return `How was ${p.name}?`;
}
function typeForPlace(p) {
if (p.cat === "See & Do") return "Sight";
if (p.cat === "Shop") return "Moment";
if (p.tag === "Wine bar") return "Wine";
return "Meal";
}

/* ============================== DATA LAYER (trip-scoped) ============================== */

const db = {
async loadTrips() {
const { data, error } = await supabase.from("wl_trips").select("*").order("created_at", { ascending: false });
if (error) throw error;
return (data || []).map(r => ({
id: r.id, name: r.name, home_city: r.home_city, home_country: r.home_country,
home_lat: r.home_lat, home_lon: r.home_lon, home_tz: r.home_tz,
start_date: r.start_date, end_date: r.end_date, travellers: r.travellers || [],
}));
},
async loadLegs(tripId) {
const { data, error } = await supabase.from("wl_legs").select("*").eq("trip_id", tripId);
if (error) throw error;
return (data || []).map(r => ({ id: r.id, city: r.city, country: r.country, lat: r.lat, lon: r.lon, tz: r.tz, arrival_date: r.arrival_date, sort_order: r.sort_order }));
},
async loadAllLegs() {
const { data } = await supabase.from("wl_legs").select("trip_id,city,arrival_date");
return data || [];
},
async claimMemberships(user) {
if (!user || !user.email) return;
try {
await supabase.from("wl_trip_members")
.update({ user_id: user.id, accepted_at: new Date().toISOString() })
.is("user_id", null)
.ilike("invited_email", user.email);
} catch (e) {}
},
async loadMembers(tripId) {
const { data, error } = await supabase.from("wl_trip_members")
.select("id,trip_id,user_id,invited_email,display_name,role,accepted_at,created_at")
.eq("trip_id", tripId)
.order("created_at", { ascending: true });
if (error) return { enabled: false, members: [], error };
return { enabled: true, members: data || [] };
},
async inviteMember(tripId, email, role = "editor") {
const row = { id: uid(), trip_id: tripId, invited_email: email.trim().toLowerCase(), display_name: email.trim(), role };
const { data, error } = await supabase.from("wl_trip_members").upsert(row, { onConflict: "trip_id,invited_email" }).select().single();
if (error) throw error;
return data;
},
async removeMember(id) {
const { error } = await supabase.from("wl_trip_members").delete().eq("id", id);
if (error) throw error;
},
async loadPublicRecap(token) {
const { data, error } = await supabase.from("wl_recap_shares")
.select("token,snapshot,updated_at")
.eq("token", token)
.single();
if (error) throw error;
return data;
},
async saveRecapShare(tripId, snapshot) {
let token = shareToken();
try {
const { data: existing } = await supabase.from("wl_recap_shares").select("token").eq("trip_id", tripId).maybeSingle();
if (existing && existing.token) token = existing.token;
} catch (e) {}
const { data, error } = await supabase.from("wl_recap_shares").upsert({
trip_id: tripId, token, snapshot, updated_at: new Date().toISOString(),
}, { onConflict: "trip_id" }).select("token").single();
if (error) throw error;
return data.token;
},
async createTrip(trip, legs) {
const { data, error } = await supabase.from("wl_trips").insert({
name: trip.name, home_city: trip.home_city, home_country: trip.home_country,
home_lat: trip.home_lat, home_lon: trip.home_lon, home_tz: trip.home_tz,
start_date: trip.start_date, end_date: trip.end_date, travellers: trip.travellers,
}).select().single();
if (error) throw error;
const tripId = data.id;
if (legs.length) {
const rows = legs.map((l, i) => ({ trip_id: tripId, city: l.city, country: l.country || null, lat: l.lat ?? null, lon: l.lon ?? null, tz: l.tz || null, arrival_date: l.arrival_date, sort_order: i }));
const { error: e2 } = await supabase.from("wl_legs").insert(rows);
if (e2) throw e2;
}
return tripId;
},
async deleteTrip(id) {
// Best-effort: remove this trip's stored photos, then the trip (cascades all rows).
try {
const { data } = await supabase.from("wl_journal_photos").select("path").eq("trip_id", id);
const paths = (data || []).map(r => r.path).filter(Boolean);
if (paths.length) await supabase.storage.from(PHOTO_BUCKET).remove(paths);
} catch (e) {}
const { error } = await supabase.from("wl_trips").delete().eq("id", id);
if (error) throw error;
},
async loadTripData(tripId) {
const [placesRes, statusRes, journalRes, photosRes, privRes] = await Promise.all([
supabase.from("wl_places").select("*").eq("trip_id", tripId),
supabase.from("wl_place_status").select("*").eq("trip_id", tripId),
supabase.from("wl_journal_entries").select("*").eq("trip_id", tripId).order("ts", { ascending: false }),
supabase.from("wl_journal_photos").select("*").eq("trip_id", tripId),
supabase.from("wl_private_notes").select("*").eq("trip_id", tripId).order("day", { ascending: true }).order("sort_order", { ascending: true }),
]);
const exploreAdded = (placesRes.data || []).map(r => ({ id: r.id, city: r.city, cat: r.cat, tag: r.tag, name: r.name, area: r.area || "", note: r.note || "" }));
const exploreStatus = {};
(statusRes.data || []).forEach(r => { exploreStatus[r.place_id] = { plannedDay: r.planned_day, been: !!r.been, rated: !!r.rated }; });
const photosByJournal = {};
(photosRes.data || []).forEach(ph => { (photosByJournal[ph.journal_id] = photosByJournal[ph.journal_id] || []).push({ id: ph.id, src: ph.url || photoPublicUrl(ph.path), path: ph.path, name: ph.caption || "" }); });
const journal = (journalRes.data || []).map(r => ({
id: r.id, type: r.type, title: r.title, note: r.note || "", ratings: r.ratings || {},
region: r.region || "", vintage: r.vintage || "", city: r.city || "", day: r.day, ts: r.ts, place_id: r.place_id || null,
photos: photosByJournal[r.id] || [],
}));
const privateNotes = (privRes.data || []).map(r => ({ id: r.id, day: r.day, type: r.type, title: r.title, body: r.body || "", ref: r.ref || "", url: r.url || "", sort_order: r.sort_order || 0 }));
return { exploreAdded, exploreStatus, journal, privateNotes };
},
async addPlace(tripId, p) {
await supabase.from("wl_places").insert({ id: p.id, trip_id: tripId, city: p.city, cat: p.cat, tag: p.tag, name: p.name, area: p.area || null, note: p.note || null });
},
async upsertStatus(tripId, placeId, patch) {
const row = { trip_id: tripId, place_id: placeId, updated_at: new Date().toISOString() };
if ("plannedDay" in patch) row.planned_day = patch.plannedDay;
if ("been" in patch) row.been = patch.been;
if ("rated" in patch) row.rated = patch.rated;
await supabase.from("wl_place_status").upsert(row, { onConflict: "trip_id,place_id" });
},
async addJournal(tripId, j) {
await supabase.from("wl_journal_entries").insert({
id: j.id, trip_id: tripId, type: j.type, title: j.title, note: j.note || null, ratings: j.ratings || {},
region: j.region || null, vintage: j.vintage || null, city: j.city || null, day: j.day, ts: j.ts, place_id: j.place_id || null,
});
},
async updateJournal(j) {
const { error } = await supabase.from("wl_journal_entries").update({
type: j.type, title: j.title, note: j.note || null, ratings: j.ratings || {},
region: j.region || null, vintage: j.vintage || null, city: j.city || null,
}).eq("id", j.id);
if (error) throw error;
},
async deleteJournal(id) {
const { data } = await supabase.from("wl_journal_photos").select("path").eq("journal_id", id);
const paths = (data || []).map(r => r.path).filter(Boolean);
if (paths.length) await supabase.storage.from(PHOTO_BUCKET).remove(paths);
await supabase.from("wl_journal_entries").delete().eq("id", id);
},
async uploadPhoto(tripId, journalId, file, userId) {
const blob = await compressImage(file);
const compressed = blob !== file;
const ext = compressed ? "jpg" : ((file.name && file.name.includes(".")) ? file.name.split(".").pop().toLowerCase() : "jpg");
const path = `${userId}/${tripId}/${journalId}/${uid()}.${ext}`;
const up = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { cacheControl: "3600", upsert: false, contentType: compressed ? "image/jpeg" : (file.type || "image/jpeg") });
if (up.error) throw up.error;
const url = photoPublicUrl(path);
const id = uid();
await supabase.from("wl_journal_photos").insert({ id, trip_id: tripId, journal_id: journalId, path, url, caption: file.name || null });
return { id, src: url, path, name: file.name || "" };
},
async deletePhoto(photo) {
if (photo.path) await supabase.storage.from(PHOTO_BUCKET).remove([photo.path]);
await supabase.from("wl_journal_photos").delete().eq("id", photo.id);
},
async addPrivateNote(tripId, n) {
await supabase.from("wl_private_notes").insert({ id: n.id, trip_id: tripId, day: n.day, type: n.type, title: n.title, body: n.body || null, ref: n.ref || null, url: n.url || null, sort_order: n.sort_order || 0 });
},
async deletePrivateNote(id) {
await supabase.from("wl_private_notes").delete().eq("id", id);
},
};

/* ============================== AUTH SCREEN ============================== */

function AuthScreen() {
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

/* ============================== ROOT ============================== */

function App() {
const publicToken = useMemo(() => new URLSearchParams(window.location.search).get("recap"), []);
const [publicRecap, setPublicRecap] = useState(null);
const [publicErr, setPublicErr] = useState("");
const [session, setSession] = useState(null);
const [authChecked, setAuthChecked] = useState(false);
const [view, setView] = useState("trips"); // trips | wizard | trip
const [trips, setTrips] = useState(null); // null = loading
const [legCounts, setLegCounts] = useState({});
const [active, setActive] = useState(null); // { trip, legs }
const [toast, setToast] = useState("");
const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 1800); };

useEffect(() => {
supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthChecked(true); });
const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
return () => { sub.subscription.unsubscribe(); };
}, []);

useEffect(() => {
if (!publicToken) return;
db.loadPublicRecap(publicToken).then(r => setPublicRecap(r.snapshot)).catch(() => setPublicErr("This recap link is not available."));
}, [publicToken]);

const loadTrips = async () => {
try {
if (session && session.user) await db.claimMemberships(session.user);
const [t, allLegs] = await Promise.all([db.loadTrips(), db.loadAllLegs()]);
const counts = {};
(allLegs || []).forEach(l => { counts[l.trip_id] = (counts[l.trip_id] || 0) + 1; });
setLegCounts(counts);
setTrips(t);
} catch (e) { setTrips([]); }
};

useEffect(() => {
if (!session) { setTrips(null); setActive(null); setView("trips"); return; }
loadTrips();
}, [session]);

const openTrip = async (trip) => {
try {
const legs = await db.loadLegs(trip.id);
setActive({ trip, legs });
setView("trip");
} catch (e) { flash("Could not open trip"); }
};
const onTripCreated = async (tripId) => {
await loadTrips();
try {
const [legs, tlist] = await Promise.all([db.loadLegs(tripId), db.loadTrips()]);
const trip = (tlist || []).find(t => t.id === tripId);
if (trip) { setActive({ trip, legs }); setView("trip"); }
else setView("trips");
} catch (e) { setView("trips"); }
};
const signOut = async () => { await supabase.auth.signOut(); };

if (publicToken) return <div className="app">{publicRecap ? <PublicRecap snapshot={publicRecap} /> : <div className="page"><div className="muted sm empty pad">{publicErr || "Loading recap..."}</div></div>}</div>;
if (!authChecked) return <div className="app"></div>;
if (!session) return <div className="app"><AuthScreen /></div>;

return (
<div className="app">
{view === "trips" && (
<MyTrips
trips={trips} legCounts={legCounts}
onNew={() => setView("wizard")}
onOpen={openTrip}
onDeleted={loadTrips}
onSignOut={signOut} flash={flash} />
)}
{view === "wizard" && (
<SetupWizard onCancel={() => setView("trips")} onCreated={onTripCreated} flash={flash} />
)}
{view === "trip" && active && (
<TripApp key={active.trip.id} trip={active.trip} legs={active.legs} session={session}
onExit={() => { setActive(null); setView("trips"); loadTrips(); }} flash={flash} />
)}
{toast && <div className="toast">{toast}</div>}
</div>
);
}

/* ============================== MY TRIPS ============================== */

function MyTrips({ trips, legCounts, onNew, onOpen, onDeleted, onSignOut, flash }) {
const del = async (e, t) => {
e.stopPropagation();
if (!window.confirm(`Delete "${t.name}"? This removes its itinerary, journal and photos.`)) return;
try { await db.deleteTrip(t.id); flash("Trip deleted"); onDeleted(); }
catch (err) { flash("Delete failed"); }
};
return (
<div className="scroll solo">
<header className="topbar">
<div className="topbar-row">
<div>
<div className="kicker">{PRODUCT.toUpperCase()}</div>
<div className="brandline">Your trips</div>
</div>
<button className="signout" onClick={onSignOut}><LogOut size={12} /> Sign out</button>
</div>
</header>
<div className="page">
{trips === null && <div className="muted sm empty pad">Loading…</div>}
{trips && trips.length === 0 && (
<div className="emptytrips">
<div className="emptytrips-icon"><Luggage size={30} /></div>
<div className="emptytrips-h">No trips yet</div>
<div className="muted sm">Set up your first trip — any destinations, any dates.</div>
</div>
)}
{trips && trips.length > 0 && <div className="cardgrid">{trips.map(t => {
const range = t.start_date && t.end_date ? `${fmtDate(t.start_date)} – ${fmtDate(t.end_date)}` : "Dates TBC";
const nights = t.start_date && t.end_date ? daysInclusive(t.start_date, t.end_date) : 0;
return (
<div key={t.id} className="tripcard" onClick={() => onOpen(t)}>
<div className="tripcard-body">
<div className="tripcard-name">{t.name}</div>
<div className="tripcard-meta">{range}{nights ? ` · ${nights} days` : ""}</div>
<div className="tripcard-sub">
<span><MapPin size={12} /> {legCounts[t.id] || 0} stop{(legCounts[t.id] || 0) === 1 ? "" : "s"}</span>
<span><Users size={12} /> {(t.travellers || []).length || 1}</span>
</div>
</div>
<button className="del" onClick={(e) => del(e, t)} aria-label="Delete trip"><Trash2 size={15} /></button>
</div>
);
})}</div>}
<button className="primary newtrip" onClick={onNew}><Plus size={16} /> New trip</button>
</div>
</div>
);
}

/* ============================== SETUP WIZARD ============================== */

function SetupWizard({ onCancel, onCreated, flash }) {
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

/* ============================== TRIP APP (the 4 tabs) ============================== */

function TripApp({ trip, legs, session, onExit, flash }) {
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
const [members, setMembers] = useState({ enabled: null, list: [] });
const [sharing, setSharing] = useState(false);
const [capturing, setCapturing] = useState(false);
const PREFS_KEY = `wl:prefs:${trip.id}`;
const [state, setState] = useState({ weather: {}, planDone: {}, planAdd: {}, journal: [], exploreStatus: {}, exploreAdded: [], privateNotes: [] });
const localPrefs = useRef({ weather: {}, planDone: {}, planAdd: {} });

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
const onUp = () => setOnline(true); const onDown = () => setOnline(false);
window.addEventListener("online", onUp); window.addEventListener("offline", onDown);
return () => { window.removeEventListener("online", onUp); window.removeEventListener("offline", onDown); };
}, []);

const localToast = (m) => { setToast(m); setTimeout(() => setToast(""), 1800); };
const runSave = async (label, op) => {
if (!online) { setSync({ state: "queued", message: "Offline, retry when connected" }); throw new Error("offline"); }
setSync({ state: "saving", message: label || "Saving..." });
try {
const result = await op();
setSync({ state: "synced", message: "Saved" });
setTimeout(() => setSync(s => s.state === "synced" ? { state: "idle", message: "Synced" } : s), 1600);
return result;
} catch (e) {
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
try {
const [data] = await Promise.all([db.loadTripData(trip.id), refreshMembers()]);
setState(s => ({ ...s, ...localPrefs.current, ...data }));
setStale(false); setLoaded(true); setSync({ state: "idle", message: "Synced" });
} catch (e) { setStale(true); setLoaded(true); }
};
useEffect(() => { refresh(); }, [trip.id]);
useEffect(() => {
const onVis = () => { if (document.visibilityState === "visible") refresh(); };
document.addEventListener("visibilitychange", onVis);
return () => document.removeEventListener("visibilitychange", onVis);
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
<span className={"syncnote" + (!online || sync.state === "error" || sync.state === "queued" ? " warn" : "")}>{!online ? "offline - edits stay local until reconnected" : `${sync.message}${members.enabled === false ? " - collaboration setup needed" : ""}`}</span>
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

/* ============================== STATUS WRITER ============================== */

function useSetStatus(ctx) {
return (id, patch) => {
ctx.setState(s => ({ ...s, exploreStatus: { ...s.exploreStatus, [id]: { ...(s.exploreStatus[id] || {}), ...patch } } }));
ctx.runSave("Saving place status...", () => ctx.db.upsertStatus(ctx.trip.id, id, patch)).catch(() => ctx.flash("Sync failed - retry"));
};
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
try { await runSave("Removing note...", () => db.deletePrivateNote(id)); flash("Note removed"); }
catch (e) { flash("Delete failed"); setState(s => ({ ...s, privateNotes: prev })); }
};
const addNote = async (note) => {
const entry = { id: uid(), day: dayIndex, type: note.type, title: note.title, body: note.body, ref: note.ref, url: "", sort_order: 0 };
setState(s => ({ ...s, privateNotes: [...(s.privateNotes || []), entry] }));
setAdding(false);
try { await runSave("Saving note...", () => db.addPrivateNote(trip.id, entry)); flash("Note added"); }
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

/* ============================== JOURNAL ============================== */

function Journal(ctx) {
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
await runSave("Saving journal entry...", () => db.addJournal(trip.id, entry));
const uploaded = [];
for (const f of files) { try { uploaded.push(await db.uploadPhoto(trip.id, entry.id, f, session.user.id)); } catch (e) { flash("A photo failed to upload"); } }
files.forEach(f => { try { URL.revokeObjectURL(f.__preview); } catch (e) {} });
entry.photos = uploaded;
setState(s => ({ ...s, journal: [entry, ...s.journal] }));
setTitle(""); setNote(""); setRatings(Object.fromEntries(travellers.map(t => [t, 0]))); setRegion(""); setVintage(""); setFiles([]);
flash("Saved");
} catch (e) { flash("Could not save entry"); }
setBusy(false);
};
const del = async (id) => {
if (!window.confirm("Delete this entry? Its photos will be removed too.")) return;
const prev = state.journal;
setState(s => ({ ...s, journal: s.journal.filter(j => j.id !== id) }));
try { await runSave("Deleting journal entry...", () => db.deleteJournal(id)); } catch (e) { flash("Delete failed"); setState(s => ({ ...s, journal: prev })); }
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
await runSave("Updating journal entry...", () => db.updateJournal(patch));
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

/* ============================== EXPLORE ============================== */

function Explore(ctx) {
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

function RatePrompt({ place, ctx, setStatus, travellers }) {
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

/* ============================== SHARE, CAPTURE, RECAP ============================== */

function OverlaySheet({ title, onClose, children }) {
return createPortal(
<div className="sheet" onClick={onClose}>
<div className="sheetcard" onClick={e => e.stopPropagation()}>
<div className="sheethead">
<div className="sheettitle">{title}</div>
<button className="sheetx" onClick={onClose} aria-label="Close"><X size={16} /></button>
</div>
{children}
</div>
</div>
, document.body);
}

function ShareTrip({ ctx, onClose }) {
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
setRecapUrl(url); copy(url, "Recap link");
} catch (e) { flash("Recap sharing needs the Supabase migration"); }
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

function FastCapture({ ctx, onClose }) {
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

function Recap({ trip, days, state, db, runSave, copy, flash }) {
const [url, setUrl] = useState("");
const snapshot = useMemo(() => buildRecapSnapshot(trip, days, state), [trip, days, state]);
const publish = async () => {
try {
const token = await runSave("Publishing recap...", () => db.saveRecapShare(trip.id, snapshot));
const next = publicRecapUrl(token);
setUrl(next); copy(next, "Recap link");
} catch (e) { flash("Recap sharing needs the Supabase migration"); }
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

function PublicRecap({ snapshot }) {
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

/* ============================== SHARED UI ============================== */

function Card({ children }) { return <div className="card">{children}</div>; }

function QuickAdd({ placeholder, onAdd }) {
const [v, setV] = useState("");
const go = () => { if (v.trim()) { onAdd(v.trim()); setV(""); } };
return <div className="quickadd"><input value={v} placeholder={placeholder} onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === "Enter") go(); }} /><button onClick={go}><Plus size={16} /></button></div>;
}

function Stat({ label, value, accent }) {
return <div className={"stat" + (accent ? " accent" : "")}><div className="stat-v">{value}</div><div className="stat-l">{label}</div></div>;
}

function RateRow({ label, value, onChange }) {
return (
<div className="raterow"><span className="rate-label">{label}</span><div className="stars">
{[1, 2, 3, 4, 5].map(n => <button key={n} className="starbtn" onClick={() => onChange(n === value ? 0 : n)}><Star size={20} fill={n <= value ? "var(--accent)" : "none"} stroke={n <= value ? "var(--accent)" : "var(--line2)"} strokeWidth={1.5} /></button>)}
</div></div>
);
}

function MiniStars({ label, v }) {
return <span className="mini"><span className="mini-l">{label}</span>{[1, 2, 3, 4, 5].map(n => <Star key={n} size={11} fill={n <= v ? "var(--accent)" : "none"} stroke={n <= v ? "var(--accent)" : "var(--line2)"} strokeWidth={1.5} />)}</span>;
}

function PhotoPicker({ files, setFiles, flash }) {
const pick = (fileList) => {
const room = Math.max(0, 4 - files.length);
const selected = Array.from(fileList || []).slice(0, room);
if (!selected.length) return;
const withPreview = selected.map(f => { f.__preview = URL.createObjectURL(f); return f; });
setFiles([...(files || []), ...withPreview]);
flash && flash(`${selected.length} photo${selected.length === 1 ? "" : "s"} ready`);
};
const remove = (idx) => {
const f = (files || [])[idx];
if (f && f.__preview) { try { URL.revokeObjectURL(f.__preview); } catch (e) {} }
setFiles((files || []).filter((_, i) => i !== idx));
};
return (
<div className="photopicker">
<label className="photobtn"><ImagePlus size={15} /> Add photos<input type="file" accept="image/*" multiple onChange={e => pick(e.target.files)} /></label>
<div className="muted xs">Photos upload to your account when you save.</div>
{!!(files || []).length && <div className="photochips">{files.map((f, i) => <button key={i} className="photochip" onClick={() => remove(i)}><img src={f.__preview} alt="" /><span>×</span></button>)}</div>}
</div>
);
}

function PhotoGrid({ photos, onOpen }) {
return <div className="photogrid">{photos.map((p, i) => <button key={i} onClick={(e) => { e.stopPropagation(); onOpen(i); }}><img src={p.src} alt="Journal memory" loading="lazy" /></button>)}</div>;
}

function PhotoViewer({ photos, index, onClose }) {
const [i, setI] = useState(index);
const startX = useRef(null);
const onTouchStart = (e) => { startX.current = e.touches[0].clientX; };
const onTouchEnd = (e) => {
if (startX.current == null) return;
const dx = e.changedTouches[0].clientX - startX.current;
startX.current = null;
if (dx <= -40) setI(v => Math.min(v + 1, photos.length - 1));
else if (dx >= 40) setI(v => Math.max(v - 1, 0));
};
return createPortal(
<div className="viewer" onClick={onClose} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
<button className="viewer-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
<img src={photos[i].src} alt="Expanded memory" onClick={e => e.stopPropagation()} />
{photos.length > 1 && (
<div className="viewer-dots" onClick={e => e.stopPropagation()}>
{photos.map((_, n) => <button key={n} className={"dot" + (n === i ? " on" : "")} onClick={() => setI(n)} aria-label={`Photo ${n + 1}`} />)}
</div>
)}
</div>
, document.body);
}


createRoot(document.getElementById("root")).render(<App />);

