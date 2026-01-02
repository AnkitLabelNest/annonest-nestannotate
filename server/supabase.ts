import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error("Missing Supabase environment variables");
}

/**
 * ✅ Used ONLY to verify JWTs
 */
export const supabaseAuth = createClient(
  supabaseUrl,
  anonKey,
  { auth: { persistSession: false } }
);

/**
 * ✅ Used for admin DB operations
 */
export const supabaseAdmin = createClient(
  supabaseUrl,
  serviceRoleKey,
  { auth: { persistSession: false } }
);
