import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// Use DATABASE_URL for development (Replit Postgres), 
// fall back to SUPABASE_DATABASE_URL for production
const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
if (!connectionString) {
  throw new Error("SUPABASE_DATABASE_URL or DATABASE_URL environment variable is required");
}

const isSupabase = connectionString.includes("supabase");
console.log(`[db] Connecting to ${isSupabase ? "Supabase" : "local"} PostgreSQL database`);

const pool = new Pool({
  connectionString,
  ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool, { schema });
export { pool };
