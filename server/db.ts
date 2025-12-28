import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// Use SUPABASE_DATABASE_URL for production, fall back to DATABASE_URL for local development
const connectionString = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("SUPABASE_DATABASE_URL or DATABASE_URL environment variable is required");
}
console.log(`[db] Connection string available: ${connectionString ? "yes" : "no"}`);

const isSupabase = connectionString.includes("supabase");
console.log(`[db] Connecting to ${isSupabase ? "Supabase" : "local"} PostgreSQL database`);

const pool = new Pool({
  connectionString,
  ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool, { schema });
export { pool };
