import { useState, useEffect } from "react";
import { supabase, PHOTO_BUCKET } from "./supabase.js";

/* ============================== HELPERS ============================== */

export const uid = () => Math.random().toString(36).slice(2, 9);
export const shareToken = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
export const todayCanon = () => new Date().toLocaleDateString("en-CA");
export function appUrl(params = {}) {
const u = new URL(window.location.href);
Object.entries(params).forEach(([k, v]) => v == null ? u.searchParams.delete(k) : u.searchParams.set(k, v));
return u.toString();
}
export function publicRecapUrl(token) { return appUrl({ recap: token }); }
export function sumRatings(r) { return Object.values(r || {}).reduce((a, b) => a + (b || 0), 0); }
export function buildRecapSnapshot(trip, days, state) {
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

export function fmtDate(iso) {
const m = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const p = (iso || "").split("-");
if (p.length < 3) return iso || "";
return `${parseInt(p[2], 10)} ${m[parseInt(p[1], 10) - 1]}`;
}
export function dowShort(iso) {
try { return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" }); }
catch (e) { return ""; }
}
export function addDays(iso, n) {
const dt = new Date(iso + "T00:00:00");
dt.setDate(dt.getDate() + n);
return dt.toLocaleDateString("en-CA");
}
export function daysInclusive(startIso, endIso) {
if (!startIso || !endIso) return 0;
const a = new Date(startIso + "T00:00:00"), b = new Date(endIso + "T00:00:00");
return Math.max(1, Math.round((b - a) / 86400000) + 1);
}
export const deviceTz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return "UTC"; } };

// Minutes east of UTC for an IANA timezone right now (handles half-hour zones).
export function tzOffsetMinutes(tz) {
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
export function homeAheadHours(homeTz, destTz) {
if (!homeTz || !destTz) return 0;
return (tzOffsetMinutes(homeTz) - tzOffsetMinutes(destTz)) / 60;
}
export function tzChip(homeTz, destTz) {
if (!homeTz || !destTz || homeTz === destTz) return "Home time";
const diff = homeAheadHours(homeTz, destTz);
if (diff === 0) return "Home time";
const v = Math.abs(diff);
return `Home ${diff > 0 ? "+" : "−"}${Number.isInteger(v) ? v : v.toFixed(1)}h`;
}
export function tzFull(homeTz, destTz) {
if (!homeTz || !destTz || homeTz === destTz) return "Same time as home";
const diff = homeAheadHours(homeTz, destTz);
if (diff === 0) return `${destTz} · same time as home`;
const v = Math.abs(diff); const vs = Number.isInteger(v) ? v : v.toFixed(1);
return `${destTz} · home is ${vs}h ${diff > 0 ? "ahead" : "behind"}`;
}

export function homeTime(homeTz) {
try {
return new Intl.DateTimeFormat("en-AU", { timeZone: homeTz, weekday: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date());
} catch (e) { return ""; }
}

/* ============================== GEOCODING (Open-Meteo, keyless) ============================== */

// Resolve a free-text city to coordinates + IANA timezone + country.
// Returns null on any failure so the caller can fall back to name-only.
export async function geocodeCity(name) {
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

export function wmo(code) {
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
export async function fetchWeather(coords) {
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
export function useLiveWeather(coords) {
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

export function photoPublicUrl(path) {
if (!path) return "";
const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
return data ? data.publicUrl : "";
}
export async function compressImage(file, maxDim = 1600, quality = 0.82) {
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
export function buildItinerary(trip, legs) {
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
export function todayIndexFor(days) {
if (!days.length) return 0;
const t = todayCanon();
const i = days.findIndex(d => d.date === t);
if (i >= 0) return i;
if (t < days[0].date) return 0;
return days.length - 1;
}
export function tripCitiesOf(legs) {
const sorted = [...(legs || [])].sort((a, b) =>
(a.arrival_date || "").localeCompare(b.arrival_date || "") || (a.sort_order - b.sort_order));
const seen = []; sorted.forEach(l => { if (l.city && !seen.includes(l.city)) seen.push(l.city); });
return seen;
}

export function mapDayUrl(places) {
const pts = places.map(p => encodeURIComponent([p.name, (p.area || "").replace(/·/g, ","), p.city].filter(Boolean).join(", ")));
if (!pts.length) return null;
if (pts.length === 1) return `https://www.google.com/maps/search/?api=1&query=${pts[0]}`;
return `https://www.google.com/maps/dir/?api=1&destination=${pts[pts.length - 1]}&waypoints=${pts.slice(0, -1).join("%7C")}&travelmode=walking`;
}

/* ============================== EXPLORE STATE HELPERS ============================== */

export function mergedPlaces(state) {
const added = (state.exploreAdded || []);
return added.map(p => {
const st = (state.exploreStatus && state.exploreStatus[p.id]) || {};
return { ...p, plannedDay: ("plannedDay" in st) ? st.plannedDay : null, been: !!st.been, rated: !!st.rated };
});
}
export function questionFor(p) {
if (p.cat === "See & Do") return `${p.name}. Glad you went?`;
if (p.cat === "Shop") return `Find anything at ${p.name}?`;
if (p.tag === "Wine bar") return `What were you drinking at ${p.name}?`;
if (p.tag === "Sweet treat" || p.tag === "Coffee & cake") return `How was ${p.name}?`;
if (p.tag === "Fancy dinner") return `${p.name}. Worth it?`;
if (p.tag === "Quick bite") return `${p.name}. Quick and good?`;
return `How was ${p.name}?`;
}
export function typeForPlace(p) {
if (p.cat === "See & Do") return "Sight";
if (p.cat === "Shop") return "Moment";
if (p.tag === "Wine bar") return "Wine";
return "Meal";
}

/* ============================== STATUS WRITER ============================== */

export function useSetStatus(ctx) {
return (id, patch) => {
ctx.setState(s => ({ ...s, exploreStatus: { ...s.exploreStatus, [id]: { ...(s.exploreStatus[id] || {}), ...patch } } }));
ctx.runSave("Saving place status...", () => ctx.db.upsertStatus(ctx.trip.id, id, patch)).catch(() => ctx.flash("Sync failed - retry"));
};
}

/* ============================== DATA LAYER (trip-scoped) ============================== */

export const db = {
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
