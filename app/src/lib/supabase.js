import { createClient } from "@supabase/supabase-js";

/* ============================== SUPABASE ============================== */

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://bsbuhkzdebqobkpxtivb.supabase.co";
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_lHRUROp8gqkZcDRUuVuI9w_Vc00p7Ra";
export const PHOTO_BUCKET = import.meta.env.VITE_PHOTO_BUCKET || "wl-photos";
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
