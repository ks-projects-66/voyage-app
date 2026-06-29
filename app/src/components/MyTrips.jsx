import React from "react";
import { LogOut, Luggage, MapPin, Users, Trash2, Plus } from "lucide-react";
import { PRODUCT } from "../lib/constants.js";
import { fmtDate, daysInclusive, db } from "../lib/helpers.js";

export function MyTrips({ trips, legCounts, onNew, onOpen, onDeleted, onSignOut, flash }) {
const del = async (e, t) => {
e.stopPropagation();
if (!window.confirm(`Delete "${t.name}"? This removes its itinerary, journal and photos.`)) return;
try { await db.deleteTrip(t.id); flash("Trip deleted"); onDeleted(); }
catch (err) { flash("Delete failed"); }
};
const delAccount = async () => {
if (!window.confirm("Delete your account? This permanently removes all your trips, journal entries, photos and your sign-in. This cannot be undone.")) return;
if (!window.confirm("Are you absolutely sure? This is permanent and immediate.")) return;
try { flash("Deleting your account…"); await db.deleteAccount(); }
catch (err) { flash("Account deletion failed, please try again"); }
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
<div className="account-footer">
<button className="link-danger" onClick={delAccount}>Delete account</button>
</div>
</div>
</div>
);
}
