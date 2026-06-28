import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "./lib/supabase.js";
import { db } from "./lib/helpers.js";
import { AuthScreen } from "./components/AuthScreen.jsx";
import { MyTrips } from "./components/MyTrips.jsx";
import { SetupWizard } from "./components/SetupWizard.jsx";
import { TripApp } from "./components/TripApp.jsx";
import { PublicRecap } from "./components/ShareRecap.jsx";

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

export default App;
