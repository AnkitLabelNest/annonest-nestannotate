import pg from "pg";

const { Pool } = pg;

async function fixCRMColumns() {
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

    console.log("1. Dropping and recreating entities_gp with correct columns...");
    await client.query(`DROP TABLE IF EXISTS entities_gp CASCADE`);
    await client.query(`
      CREATE TABLE entities_gp (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        gp_name TEXT NOT NULL,
        gp_legal_name TEXT,
        firm_type TEXT,
        headquarters_country TEXT,
        headquarters_city TEXT,
        total_aum TEXT,
        aum_currency TEXT DEFAULT 'USD',
        website TEXT,
        primary_asset_classes TEXT,
        status TEXT DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX idx_entities_gp_org ON entities_gp(org_id)`);
    console.log("   entities_gp recreated");

    console.log("2. Dropping and recreating entities_lp with correct columns...");
    await client.query(`DROP TABLE IF EXISTS entities_lp CASCADE`);
    await client.query(`
      CREATE TABLE entities_lp (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        lp_name TEXT NOT NULL,
        lp_legal_name TEXT,
        firm_type TEXT,
        headquarters_country TEXT,
        headquarters_city TEXT,
        total_aum TEXT,
        aum_currency TEXT DEFAULT 'USD',
        website TEXT,
        investor_type TEXT,
        status TEXT DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX idx_entities_lp_org ON entities_lp(org_id)`);
    console.log("   entities_lp recreated");

    console.log("3. Dropping and recreating entities_fund with correct columns...");
    await client.query(`DROP TABLE IF EXISTS entities_fund CASCADE`);
    await client.query(`
      CREATE TABLE entities_fund (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        fund_name TEXT NOT NULL,
        gp_id UUID,
        fund_type TEXT,
        vintage_year INTEGER,
        fund_size TEXT,
        fund_currency TEXT DEFAULT 'USD',
        target_size TEXT,
        fund_status TEXT DEFAULT 'Open',
        primary_sector TEXT,
        geographic_focus TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX idx_entities_fund_org ON entities_fund(org_id)`);
    console.log("   entities_fund recreated");

    console.log("4. Dropping and recreating entities_portfolio_company with correct columns...");
    await client.query(`DROP TABLE IF EXISTS entities_portfolio_company CASCADE`);
    await client.query(`
      CREATE TABLE entities_portfolio_company (
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
    await client.query(`CREATE INDEX idx_entities_portfolio_company_org ON entities_portfolio_company(org_id)`);
    console.log("   entities_portfolio_company recreated");

    console.log("5. Dropping and recreating entities_service_provider with correct columns...");
    await client.query(`DROP TABLE IF EXISTS entities_service_provider CASCADE`);
    await client.query(`
      CREATE TABLE entities_service_provider (
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
    await client.query(`CREATE INDEX idx_entities_service_provider_org ON entities_service_provider(org_id)`);
    console.log("   entities_service_provider recreated");

    console.log("6. Dropping and recreating entities_contact with correct columns...");
    await client.query(`DROP TABLE IF EXISTS entities_contact CASCADE`);
    await client.query(`
      CREATE TABLE entities_contact (
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
    await client.query(`CREATE INDEX idx_entities_contact_org ON entities_contact(org_id)`);
    console.log("   entities_contact recreated");

    console.log("7. Dropping and recreating entities_deal with correct columns...");
    await client.query(`DROP TABLE IF EXISTS entities_deal CASCADE`);
    await client.query(`
      CREATE TABLE entities_deal (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        deal_name TEXT NOT NULL,
        deal_type TEXT,
        deal_status TEXT DEFAULT 'Active',
        deal_amount TEXT,
        deal_currency TEXT DEFAULT 'USD',
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
    await client.query(`CREATE INDEX idx_entities_deal_org ON entities_deal(org_id)`);
    console.log("   entities_deal recreated");

    console.log("8. Dropping and recreating relationships with correct columns...");
    await client.query(`DROP TABLE IF EXISTS relationships CASCADE`);
    await client.query(`
      CREATE TABLE relationships (
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
    await client.query(`CREATE INDEX idx_relationships_org ON relationships(org_id)`);
    console.log("   relationships recreated");

    client.release();
    console.log("\nAll CRM tables fixed successfully!");
    
  } catch (error) {
    console.error("Fix failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixCRMColumns();
