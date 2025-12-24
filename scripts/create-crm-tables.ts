import pg from "pg";

const { Pool } = pg;

async function createCRMTables() {
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

    console.log("1. Creating entities_gp table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS entities_gp (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        firm_name TEXT NOT NULL,
        firm_type TEXT,
        headquarters_country TEXT,
        headquarters_city TEXT,
        website TEXT,
        total_aum_usd DECIMAL,
        vintage_year INTEGER,
        fund_count INTEGER,
        investment_focus TEXT,
        sector_focus TEXT,
        geographic_focus TEXT,
        strategy_description TEXT,
        founded_year INTEGER,
        status TEXT DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("   entities_gp created");

    console.log("2. Creating entities_lp table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS entities_lp (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        firm_name TEXT NOT NULL,
        firm_type TEXT,
        headquarters_country TEXT,
        headquarters_city TEXT,
        website TEXT,
        total_aum_usd DECIMAL,
        commitment_size TEXT,
        investment_focus TEXT,
        sector_focus TEXT,
        geographic_focus TEXT,
        founded_year INTEGER,
        status TEXT DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("   entities_lp created");

    console.log("3. Creating entities_fund table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS entities_fund (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        fund_name TEXT NOT NULL,
        fund_type TEXT,
        vintage_year INTEGER,
        fund_size_usd DECIMAL,
        target_size_usd DECIMAL,
        fund_strategy TEXT,
        sector_focus TEXT,
        geographic_focus TEXT,
        fund_status TEXT DEFAULT 'Active',
        gp_id UUID,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("   entities_fund created");

    console.log("4. Creating entities_portfolio_company table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS entities_portfolio_company (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        company_name TEXT NOT NULL,
        company_type TEXT,
        headquarters_country TEXT,
        headquarters_city TEXT,
        primary_industry TEXT,
        business_model TEXT,
        website TEXT,
        business_description TEXT,
        founded_year INTEGER,
        employee_count INTEGER,
        status TEXT DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("   entities_portfolio_company created");

    console.log("5. Creating entities_service_provider table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS entities_service_provider (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        provider_name TEXT NOT NULL,
        provider_type TEXT,
        headquarters_country TEXT,
        headquarters_city TEXT,
        website TEXT,
        services_offered TEXT,
        sector_expertise TEXT,
        geographic_coverage TEXT,
        founded_year INTEGER,
        status TEXT DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("   entities_service_provider created");

    console.log("6. Creating entities_contact table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS entities_contact (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        title TEXT,
        company_name TEXT,
        entity_type TEXT,
        entity_id UUID,
        linkedin_url TEXT,
        notes TEXT,
        status TEXT DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("   entities_contact created");

    console.log("7. Creating entities_deal table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS entities_deal (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        deal_name TEXT NOT NULL,
        deal_type TEXT,
        deal_status TEXT DEFAULT 'Active',
        deal_amount_usd DECIMAL,
        deal_date DATE,
        target_company TEXT,
        acquirer_company TEXT,
        investor_ids TEXT,
        sector TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("   entities_deal created");

    console.log("8. Creating relationships table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS relationships (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        from_entity_type TEXT NOT NULL,
        from_entity_id UUID NOT NULL,
        from_entity_name_snapshot TEXT,
        to_entity_type TEXT NOT NULL,
        to_entity_id UUID NOT NULL,
        to_entity_name_snapshot TEXT,
        relationship_type TEXT NOT NULL,
        relationship_subtype TEXT,
        relationship_status TEXT DEFAULT 'Active',
        start_date DATE,
        end_date DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("   relationships created");

    console.log("9. Creating public_company_snapshot table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public_company_snapshot (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ticker TEXT,
        company_name TEXT NOT NULL,
        exchange TEXT,
        sector TEXT,
        industry TEXT,
        market_cap_usd DECIMAL,
        last_price DECIMAL,
        price_date DATE,
        snapshot_data JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("   public_company_snapshot created");

    console.log("10. Creating indexes...");
    await client.query(`CREATE INDEX IF NOT EXISTS idx_entities_gp_org ON entities_gp(org_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_entities_lp_org ON entities_lp(org_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_entities_fund_org ON entities_fund(org_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_entities_portfolio_company_org ON entities_portfolio_company(org_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_entities_service_provider_org ON entities_service_provider(org_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_entities_contact_org ON entities_contact(org_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_entities_deal_org ON entities_deal(org_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_relationships_org ON relationships(org_id)`);
    console.log("   Indexes created");

    client.release();
    console.log("\nAll CRM tables created successfully!");
    
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createCRMTables();
