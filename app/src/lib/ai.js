// Client for the Gemini-backed `assistant` edge function.
// A note / pasted link / photo(s) become structured place drafts (with a 0-1
// confidence); a ticket PDF or photo becomes logistics items. The trip's own
// cities + Explore taxonomy are passed so results fit any trip, not a fixed one.
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabase } from "./supabase.js";
import { compressImage } from "./helpers.js";

export const AUTOADD_MIN = 0.7; // confidence at/above which a place is auto-added

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => { const s = String(r.result || ""); const i = s.indexOf(","); resolve(i >= 0 ? s.slice(i + 1) : s); };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

async function authToken() {
  try { const { data } = await supabase.auth.getSession(); return (data && data.session && data.session.access_token) || SUPABASE_ANON_KEY; }
  catch (e) { return SUPABASE_ANON_KEY; }
}

async function post(body) {
  const token = await authToken();
  const r = await fetch(`${SUPABASE_URL}/functions/v1/assistant`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("assistant request failed");
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j;
}

// Note / link / photo(s) -> array of place drafts ({ name, city, cat, tag, area, note, confidence }).
export async function aiCapture({ input = "", files = [], cities = [], cats = [], tags = [] }) {
  const images = [];
  for (const f of (files || []).slice(0, 4)) {
    let g = f;
    if (f.type && f.type.startsWith("image/")) { try { g = await compressImage(f); } catch (e) {} }
    images.push({ mimeType: g.type || f.type || "image/jpeg", data: await fileToBase64(g) });
  }
  // Fail fast on an oversized payload (e.g. an iOS HEIC that didn't compress).
  const b64 = images.reduce((n, im) => n + (im.data ? im.data.length : 0), 0);
  if (images.length && b64 > 8000000) throw new Error("Those photos are too large — try fewer or smaller ones.");
  const j = await post({ mode: "place", input, images, cities, cats, tags });
  return Array.isArray(j.items) ? j.items : (j.place && j.place.name ? [j.place] : []);
}

// A ticket / booking PDF or photo -> array of logistics items ({ type, title, body, ref }).
export async function aiExtractDoc(file) {
  let f = file;
  if (file.type && file.type.startsWith("image/")) { try { f = await compressImage(file); } catch (e) {} }
  const data = await fileToBase64(f);
  const mimeType = f.type || file.type || "application/pdf";
  const j = await post({ mode: "doc", mimeType, data });
  return Array.isArray(j.items) ? j.items : [];
}

// Normalised name+city key for de-duplicating against existing places.
export function placeKey(name, city) {
  return (name || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "") + "|" + (city || "").toLowerCase().trim();
}
export function findDup(places, name, city) {
  const k = placeKey(name, city);
  return (places || []).find(p => placeKey(p.name, p.city) === k) || null;
}
