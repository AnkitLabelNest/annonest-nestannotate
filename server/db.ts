import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import fs from "fs";

const { Pool } = pg;

function getDatabaseUrl(): string {
  const replitDbPath = "/tmp/replitdb";
  
  if (fs.existsSync(replitDbPath)) {
    try {
      const url = fs.readFileSync(replitDbPath, "utf-8").trim();
      if (url && url.startsWith("postgres")) {
        console.log("[db] Using production database URL from /tmp/replitdb");
        return url;
      } else {
        console.warn("[db] /tmp/replitdb exists but content is invalid, falling back to env");
      }
    } catch (err) {
      console.warn("[db] Could not read /tmp/replitdb, falling back to env");
    }
  }
  
  const envUrl = process.env.DATABASE_URL;
  if (!envUrl) {
    throw new Error("DATABASE_URL is not set and /tmp/replitdb not found");
  }
  
  console.log("[db] Using DATABASE_URL from environment");
  return envUrl;
}

const connectionString = getDatabaseUrl();

const pool = new Pool({
  connectionString,
});

export const db = drizzle(pool, { schema });
