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
// Production uses Supabase, Development uses local DB
const isProduction = process.env.NODE_ENV === "production";
const isSupabase = isProduction || connectionString.includes("supabase");
console.log(`[db] Connecting to ${isProduction ? "production (Supabase)" : "development (local)"} PostgreSQL database`);

// Table name mapping based on database connection (Supabase vs local)
// Use isSupabase flag to determine table names so staging environments work correctly
export const getTableName = (entity: string) => {
  if (!isSupabase) {
    // Local dev database uses mixed table names
    const devTables: Record<string, string> = {
      project: "projects",
      contacts: "entities_contacts",
      contact: "entities_contacts",
      project_items: "entities_project_items",
      project_members: "entities_project_members",
      gp: "entities_gp",
      lp: "entities_lp",
      fund: "entities_fund",
      portfolio_company: "entities_portfolio_company",
      service_provider: "entities_service_provider",
      deal: "entities_deal",
    };
    return devTables[entity] || entity;
  }
  // Supabase uses entities_* prefix
  // Note: contacts table is entities_contacts (plural) per user specification
  // Note: entities_project has NO assigned_to column
  const supabaseTables: Record<string, string> = {
    project: "entities_project",
    contacts: "entities_contacts",
    contact: "entities_contacts",
    gp: "entities_gp",
    lp: "entities_lp",
    fund: "entities_fund",
    portfolio_company: "entities_portfolio_company",
    service_provider: "entities_service_provider",
    deal: "entities_deal",
    project_items: "entities_project_items",
    project_members: "entities_project_members",
  };
  return supabaseTables[entity] || `entities_${entity}`;
};

// Legacy function for backwards compatibility
export const getProjectTableName = () => getTableName("project");

// Column name mapping for project table (local uses 'name', Supabase uses 'project_name')
export const getProjectColumns = () => {
  if (!isSupabase) {
    // Local dev database column names
    return {
      name: "name",
      description: "description",
      type: "type",
      status: "status",
      createdBy: "created_by",
      assignedTo: "assigned_to",
      orgId: "org_id",
    };
  }
  // Supabase column names (entities_project has NO assigned_to column)
  return {
    name: "project_name",
    description: "notes",
    type: "project_type",
    status: "status",
    createdBy: "created_by",
    assignedTo: null, // Supabase entities_project has no assigned_to
    orgId: "org_id",
  };
};

// Column name mapping for project_items table
// Supabase entities_project_items: id, project_id, entity_type, entity_id, assigned_to, task_status, last_updated_on, last_updated_by, created_at
// Local dev entities_project_items: id, project_id, entity_type, entity_id, entity_name_snapshot, assigned_to, task_status, notes, org_id, created_at, updated_at
export const getProjectItemColumns = () => {
  if (!isSupabase) {
    // Local dev database column names
    return {
      entityNameSnapshot: "entity_name_snapshot",
      hasEntityNameSnapshot: true,
      hasOrgId: true,
      hasNotes: true,
      updatedAt: "updated_at",
      createdAt: "created_at",
    };
  }
  // Supabase entities_project_items:
  // - NO entity_name_snapshot column
  // - NO org_id column (org isolation is via project's org_id)
  // - NO notes column
  // - Uses last_updated_on/last_updated_by instead of updated_at
  return {
    entityNameSnapshot: null,
    hasEntityNameSnapshot: false,
    hasOrgId: false,
    hasNotes: false,
    updatedAt: "last_updated_on",
    createdAt: "created_at",
  };
};

// Export isSupabase flag for routes that need conditional logic
export { isSupabase };

const pool = new Pool({
  connectionString,
  ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool, { schema });
export { pool };
