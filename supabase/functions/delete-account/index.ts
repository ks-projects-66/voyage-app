// Voyage — in-app account deletion (App Store Guideline 5.1.1(v)).
// Authenticated user calls this to permanently delete their account and all data.
// Runs with the service role, so it bypasses RLS to clean up everything the user owns.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "missing token" }, 401);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    // Identify the caller from their JWT.
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ error: "invalid token" }, 401);
    const uid = userData.user.id;
    const email = (userData.user.email || "").toLowerCase();

    // 1. Collect every storage path the user is responsible for:
    //    (a) photos they uploaded, (b) all photos in trips they own.
    const paths = new Set<string>();
    const own = await admin.from("wl_journal_photos").select("path").eq("owner", uid);
    (own.data || []).forEach((r: { path: string | null }) => r.path && paths.add(r.path));

    const myTrips = await admin.from("wl_trips").select("id").eq("owner", uid);
    const tripIds = (myTrips.data || []).map((t: { id: string }) => t.id);
    if (tripIds.length) {
      const inTrips = await admin.from("wl_journal_photos").select("path").in("trip_id", tripIds);
      (inTrips.data || []).forEach((r: { path: string | null }) => r.path && paths.add(r.path));
    }
    if (paths.size) {
      await admin.storage.from("wl-photos").remove([...paths]);
    }

    // 2. Delete the user's owned trips — cascades all child rows (legs, places,
    //    journal, photos, private notes, members, invites, inbox, recap shares).
    await admin.from("wl_trips").delete().eq("owner", uid);

    // 3. Delete the user's own contributions to trips owned by others.
    for (const t of [
      "wl_journal_photos", "wl_journal_entries", "wl_place_status",
      "wl_places", "wl_private_notes", "wl_legs", "wl_inbox", "wl_recap_shares",
    ]) {
      await admin.from(t).delete().eq("owner", uid);
    }

    // 4. Remove memberships and any pending invites addressed to them.
    await admin.from("wl_trip_members").delete().eq("user_id", uid);
    if (email) await admin.from("wl_trip_invites").delete().eq("email", email);

    // 5. Finally, delete the auth user itself.
    const { error: delErr } = await admin.auth.admin.deleteUser(uid);
    if (delErr) return json({ error: "failed to delete account: " + delErr.message }, 500);

    return json({ ok: true });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
