-- Migration script to add missing columns to Supabase database
-- Run this in the Supabase SQL Editor

-- ============================================
-- entities_gp table - Source tracking columns
-- ============================================
ALTER TABLE entities_gp ADD COLUMN IF NOT EXISTS sources_used text[] DEFAULT '{}';
ALTER TABLE entities_gp ADD COLUMN IF NOT EXISTS source_urls text[] DEFAULT '{}';
ALTER TABLE entities_gp ADD COLUMN IF NOT EXISTS last_updated_by varchar;
ALTER TABLE entities_gp ADD COLUMN IF NOT EXISTS last_updated_on timestamp DEFAULT now();

-- ============================================
-- entities_lp table - Source tracking columns
-- ============================================
ALTER TABLE entities_lp ADD COLUMN IF NOT EXISTS sources_used text[] DEFAULT '{}';
ALTER TABLE entities_lp ADD COLUMN IF NOT EXISTS source_urls text[] DEFAULT '{}';
ALTER TABLE entities_lp ADD COLUMN IF NOT EXISTS last_updated_by varchar;
ALTER TABLE entities_lp ADD COLUMN IF NOT EXISTS last_updated_on timestamp DEFAULT now();

-- ============================================
-- entities_fund table - Source tracking columns
-- ============================================
ALTER TABLE entities_fund ADD COLUMN IF NOT EXISTS sources_used text[] DEFAULT '{}';
ALTER TABLE entities_fund ADD COLUMN IF NOT EXISTS source_urls text[] DEFAULT '{}';
ALTER TABLE entities_fund ADD COLUMN IF NOT EXISTS last_updated_by varchar;
ALTER TABLE entities_fund ADD COLUMN IF NOT EXISTS last_updated_on timestamp DEFAULT now();

-- ============================================
-- entities_portfolio_company table - Add missing columns
-- ============================================
ALTER TABLE entities_portfolio_company ADD COLUMN IF NOT EXISTS revenue_band text;
ALTER TABLE entities_portfolio_company ADD COLUMN IF NOT EXISTS valuation_band text;
ALTER TABLE entities_portfolio_company ADD COLUMN IF NOT EXISTS current_owner_type text;
ALTER TABLE entities_portfolio_company ADD COLUMN IF NOT EXISTS exit_type text;
ALTER TABLE entities_portfolio_company ADD COLUMN IF NOT EXISTS exit_year integer;
ALTER TABLE entities_portfolio_company ADD COLUMN IF NOT EXISTS confidence_score integer;
ALTER TABLE entities_portfolio_company ADD COLUMN IF NOT EXISTS data_source text;
ALTER TABLE entities_portfolio_company ADD COLUMN IF NOT EXISTS sources_used text[] DEFAULT '{}';
ALTER TABLE entities_portfolio_company ADD COLUMN IF NOT EXISTS source_urls text[] DEFAULT '{}';
ALTER TABLE entities_portfolio_company ADD COLUMN IF NOT EXISTS last_updated_by varchar;
ALTER TABLE entities_portfolio_company ADD COLUMN IF NOT EXISTS last_updated_on timestamp DEFAULT now();

-- ============================================
-- entities_service_provider table - Source tracking columns
-- ============================================
ALTER TABLE entities_service_provider ADD COLUMN IF NOT EXISTS sources_used text[] DEFAULT '{}';
ALTER TABLE entities_service_provider ADD COLUMN IF NOT EXISTS source_urls text[] DEFAULT '{}';
ALTER TABLE entities_service_provider ADD COLUMN IF NOT EXISTS last_updated_by varchar;
ALTER TABLE entities_service_provider ADD COLUMN IF NOT EXISTS last_updated_on timestamp DEFAULT now();

-- ============================================
-- entities_contact table - Add all missing columns
-- ============================================
ALTER TABLE entities_contact ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE entities_contact ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE entities_contact ADD COLUMN IF NOT EXISTS entity_type text;
ALTER TABLE entities_contact ADD COLUMN IF NOT EXISTS entity_id varchar;
ALTER TABLE entities_contact ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE entities_contact ADD COLUMN IF NOT EXISTS role_category text;
ALTER TABLE entities_contact ADD COLUMN IF NOT EXISTS seniority_level text;
ALTER TABLE entities_contact ADD COLUMN IF NOT EXISTS asset_class_focus text;
ALTER TABLE entities_contact ADD COLUMN IF NOT EXISTS sector_focus text;
ALTER TABLE entities_contact ADD COLUMN IF NOT EXISTS geography_focus text;
ALTER TABLE entities_contact ADD COLUMN IF NOT EXISTS verification_status text;
ALTER TABLE entities_contact ADD COLUMN IF NOT EXISTS verification_source text;
ALTER TABLE entities_contact ADD COLUMN IF NOT EXISTS last_verified_at timestamp;
ALTER TABLE entities_contact ADD COLUMN IF NOT EXISTS associated_fund_ids text;
ALTER TABLE entities_contact ADD COLUMN IF NOT EXISTS board_roles text;
ALTER TABLE entities_contact ADD COLUMN IF NOT EXISTS confidence_score integer;
ALTER TABLE entities_contact ADD COLUMN IF NOT EXISTS importance_score integer;
ALTER TABLE entities_contact ADD COLUMN IF NOT EXISTS sources_used text[] DEFAULT '{}';
ALTER TABLE entities_contact ADD COLUMN IF NOT EXISTS source_urls text[] DEFAULT '{}';
ALTER TABLE entities_contact ADD COLUMN IF NOT EXISTS last_updated_by varchar;
ALTER TABLE entities_contact ADD COLUMN IF NOT EXISTS last_updated_on timestamp DEFAULT now();

-- ============================================
-- entities_deal table - Add all missing columns
-- ============================================
ALTER TABLE entities_deal ADD COLUMN IF NOT EXISTS deal_round text;
ALTER TABLE entities_deal ADD COLUMN IF NOT EXISTS asset_class text;
ALTER TABLE entities_deal ADD COLUMN IF NOT EXISTS target_company_id varchar;
ALTER TABLE entities_deal ADD COLUMN IF NOT EXISTS acquirer_company_id varchar;
ALTER TABLE entities_deal ADD COLUMN IF NOT EXISTS lead_investor boolean;
ALTER TABLE entities_deal ADD COLUMN IF NOT EXISTS ownership_percentage numeric;
ALTER TABLE entities_deal ADD COLUMN IF NOT EXISTS verification_status text;
ALTER TABLE entities_deal ADD COLUMN IF NOT EXISTS confidence_score integer;
ALTER TABLE entities_deal ADD COLUMN IF NOT EXISTS sources_used text[] DEFAULT '{}';
ALTER TABLE entities_deal ADD COLUMN IF NOT EXISTS source_urls text[] DEFAULT '{}';
ALTER TABLE entities_deal ADD COLUMN IF NOT EXISTS last_updated_by varchar;
ALTER TABLE entities_deal ADD COLUMN IF NOT EXISTS last_updated_on timestamp DEFAULT now();

-- ============================================
-- entity_urls table - Create if not exists or add columns
-- ============================================
CREATE TABLE IF NOT EXISTS entity_urls (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id varchar NOT NULL,
  entity_type text NOT NULL,
  entity_id varchar NOT NULL,
  url_type text NOT NULL,
  url_link text NOT NULL,
  added_date timestamp DEFAULT now(),
  status text DEFAULT 'active',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- If table already exists but missing columns
ALTER TABLE entity_urls ADD COLUMN IF NOT EXISTS url_link text;
ALTER TABLE entity_urls ADD COLUMN IF NOT EXISTS url_type text;
ALTER TABLE entity_urls ADD COLUMN IF NOT EXISTS added_date timestamp DEFAULT now();
ALTER TABLE entity_urls ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- Create indexes for entity_urls
CREATE INDEX IF NOT EXISTS entity_urls_org_id_idx ON entity_urls(org_id);
CREATE INDEX IF NOT EXISTS entity_urls_entity_idx ON entity_urls(entity_type, entity_id);

-- ============================================
-- users table - Add super_admin role support
-- ============================================
-- No column changes needed, just ensure the role constraint allows 'super_admin'
-- This is typically handled by the application layer

SELECT 'Migration completed successfully!' as status;
