import pg from "pg";

const { Pool } = pg;

const LABELNEST_ORG_ID = "b650b699-16be-43bc-9119-0250cea2e44e";

async function migrateSupabase() {
  const connectionString = process.env.SUPABASE_DATABASE_URL;
  
  if (!connectionString) {
    console.error("SUPABASE_DATABASE_URL environment variable is required");
    process.exit(1);
  }

  console.log("Connecting to Supabase database...");
  
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const client = await pool.connect();
    console.log("Connected to Supabase database");

    console.log("1. Checking if org_id column exists on users table...");
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'org_id'
    `);

    if (columnCheck.rows.length === 0) {
      console.log("   org_id column does not exist. Adding it...");
      
      await client.query(`
        ALTER TABLE users ADD COLUMN org_id VARCHAR(255)
      `);
      console.log("   org_id column added successfully");
    } else {
      console.log("   org_id column already exists");
    }

    console.log("2. Backfilling existing users with Labelnest org ID...");
    const updateResult = await client.query(`
      UPDATE users 
      SET org_id = $1 
      WHERE org_id IS NULL
    `, [LABELNEST_ORG_ID]);
    console.log(`   Updated ${updateResult.rowCount} users with org_id`);

    console.log("3. Verifying all users have org_id...");
    const nullCheck = await client.query(`
      SELECT COUNT(*) as count FROM users WHERE org_id IS NULL
    `);
    
    if (parseInt(nullCheck.rows[0].count) === 0) {
      console.log("   All users have org_id set");
      
      console.log("4. Setting org_id as NOT NULL...");
      try {
        await client.query(`
          ALTER TABLE users ALTER COLUMN org_id SET NOT NULL
        `);
        console.log("   org_id is now NOT NULL");
      } catch (err: any) {
        if (err.message?.includes("already set not null")) {
          console.log("   org_id is already NOT NULL");
        } else {
          console.log("   Warning: Could not set NOT NULL:", err.message);
        }
      }
    } else {
      console.log(`   Warning: ${nullCheck.rows[0].count} users still have NULL org_id`);
    }

    console.log("5. Verifying users table structure...");
    const tableInfo = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    console.log("   Users table columns:");
    tableInfo.rows.forEach(row => {
      console.log(`   - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    client.release();
    console.log("\nMigration completed successfully!");
    
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrateSupabase();
