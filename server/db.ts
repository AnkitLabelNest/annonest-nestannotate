import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// In development (NODE_ENV=development), use DATABASE_URL for synced schema
// In production, prefer SUPABASE_DATABASE_URL for multi-tenant data
const isDevelopment = process.env.NODE_ENV === "development";
const connectionString = isDevelopment 
  ? (process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL)
  : (process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL);
  
if (!connectionString) {
  throw new Error("SUPABASE_DATABASE_URL or DATABASE_URL environment variable is required");
}

// Use NODE_ENV to determine which database schema we're using
// Production uses Supabase with "entities_project" table
// Development uses local DB with "projects" table
const isProduction = process.env.NODE_ENV === "production";
const isSupabase = isProduction || connectionString.includes("supabase");
console.log(`[db] Connecting to ${isProduction ? "production (Supabase)" : "development (local)"} PostgreSQL database`);

// Table name mapping for production vs development
// Production (Supabase) uses entities_project, development uses projects
export const getProjectTableName = () => isProduction ? "entities_project" : "projects";

const pool = new Pool({
  connectionString,
  ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool, { schema });
export { pool };
