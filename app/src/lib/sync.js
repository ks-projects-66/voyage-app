// Offline-first write queue.
//
// Writes apply optimistically in the UI, then either hit the server (online) or
// get enqueued here (offline / transient network failure) and replayed FIFO on
// reconnect. Ops are plain serialisable descriptors { kind, tripId?, args } so
// they survive a reload. Replay is idempotent: inserts use client-generated ids
// (a re-insert returns 23505, which we treat as "already applied"); upserts and
// deletes are naturally idempotent. Photo blobs are never queued (online-only).
import { db } from "./helpers.js";

const QUEUE_KEY = "voyage:queue";
const qid = () => Math.random().toString(36).slice(2, 9);

function readQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]"); } catch (e) { return []; }
}
function writeQueue(q) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch (e) {}
}
export function queueLength() { return readQueue().length; }
export function enqueue(op) {
  const q = readQueue();
  q.push({ qid: qid(), ts: Date.now(), ...op });
  writeQueue(q);
}

// A thrown Supabase error carries a Postgres .code; 23505 = unique violation =
// the insert already landed (a duplicate replay), so the op is effectively done.
export function isAlreadyApplied(e) { return !!(e && e.code === "23505"); }

// Distinguish "couldn't reach the server" (re-queue, keep optimistic state) from
// a real logical rejection (revert). Offline, or a fetch/network error, is networkish.
export function isNetworkish(e) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const m = (e && (e.message || e.toString())) || "";
  return /fetch|network|failed to fetch|load failed|offline|timeout/i.test(m);
}

// Apply one queued op against the server.
function replay(op) {
  switch (op.kind) {
    case "upsertStatus": return db.upsertStatus(op.tripId, op.args.placeId, op.args.patch);
    case "addPlace": return db.addPlace(op.tripId, op.args.place);
    case "addJournal": return db.addJournal(op.tripId, op.args.entry);
    case "updateJournal": return db.updateJournal(op.args.entry);
    case "deleteJournal": return db.deleteJournal(op.args.id);
    case "addPrivateNote": return db.addPrivateNote(op.tripId, op.args.note);
    case "deletePrivateNote": return db.deletePrivateNote(op.args.id);
    default: return Promise.resolve();
  }
}

// Drain the queue oldest-first. Stops on the first hard (non-idempotent) failure
// so the op is retried on the next reconnect/save rather than dropped.
export async function flushQueue(onChange) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  let q = readQueue();
  while (q.length) {
    const op = q[0];
    try { await replay(op); }
    catch (e) { if (!isAlreadyApplied(e)) return; }
    q = readQueue(); q.shift(); writeQueue(q);
    if (onChange) onChange(queueLength());
  }
  if (onChange) onChange(0);
}
