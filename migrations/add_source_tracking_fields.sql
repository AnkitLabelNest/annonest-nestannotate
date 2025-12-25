-- Source Tracking Fields Migration
-- Run this in Supabase SQL Editor to add source tracking fields to all entity tables

-- entities_gp
ALTER TABLE entities_gp 
ADD COLUMN IF NOT EXISTS sources_used text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS source_urls text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS last_updated_by uuid,
ADD COLUMN IF NOT EXISTS last_updated_on timestamptz DEFAULT now();

ALTER TABLE entities_gp 
DROP CONSTRAINT IF EXISTS entities_gp_sources_used_max_5,
DROP CONSTRAINT IF EXISTS entities_gp_source_urls_max_5;

ALTER TABLE entities_gp 
ADD CONSTRAINT entities_gp_sources_used_max_5 CHECK (array_length(sources_used, 1) IS NULL OR array_length(sources_used, 1) <= 5),
ADD CONSTRAINT entities_gp_source_urls_max_5 CHECK (array_length(source_urls, 1) IS NULL OR array_length(source_urls, 1) <= 5);

-- entities_lp
ALTER TABLE entities_lp 
ADD COLUMN IF NOT EXISTS sources_used text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS source_urls text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS last_updated_by uuid,
ADD COLUMN IF NOT EXISTS last_updated_on timestamptz DEFAULT now();

ALTER TABLE entities_lp 
DROP CONSTRAINT IF EXISTS entities_lp_sources_used_max_5,
DROP CONSTRAINT IF EXISTS entities_lp_source_urls_max_5;

ALTER TABLE entities_lp 
ADD CONSTRAINT entities_lp_sources_used_max_5 CHECK (array_length(sources_used, 1) IS NULL OR array_length(sources_used, 1) <= 5),
ADD CONSTRAINT entities_lp_source_urls_max_5 CHECK (array_length(source_urls, 1) IS NULL OR array_length(source_urls, 1) <= 5);

-- entities_fund
ALTER TABLE entities_fund 
ADD COLUMN IF NOT EXISTS sources_used text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS source_urls text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS last_updated_by uuid,
ADD COLUMN IF NOT EXISTS last_updated_on timestamptz DEFAULT now();

ALTER TABLE entities_fund 
DROP CONSTRAINT IF EXISTS entities_fund_sources_used_max_5,
DROP CONSTRAINT IF EXISTS entities_fund_source_urls_max_5;

ALTER TABLE entities_fund 
ADD CONSTRAINT entities_fund_sources_used_max_5 CHECK (array_length(sources_used, 1) IS NULL OR array_length(sources_used, 1) <= 5),
ADD CONSTRAINT entities_fund_source_urls_max_5 CHECK (array_length(source_urls, 1) IS NULL OR array_length(source_urls, 1) <= 5);

-- entities_portfolio_company
ALTER TABLE entities_portfolio_company 
ADD COLUMN IF NOT EXISTS sources_used text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS source_urls text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS last_updated_by uuid,
ADD COLUMN IF NOT EXISTS last_updated_on timestamptz DEFAULT now();

ALTER TABLE entities_portfolio_company 
DROP CONSTRAINT IF EXISTS entities_portfolio_company_sources_used_max_5,
DROP CONSTRAINT IF EXISTS entities_portfolio_company_source_urls_max_5;

ALTER TABLE entities_portfolio_company 
ADD CONSTRAINT entities_portfolio_company_sources_used_max_5 CHECK (array_length(sources_used, 1) IS NULL OR array_length(sources_used, 1) <= 5),
ADD CONSTRAINT entities_portfolio_company_source_urls_max_5 CHECK (array_length(source_urls, 1) IS NULL OR array_length(source_urls, 1) <= 5);

-- entities_service_provider
ALTER TABLE entities_service_provider 
ADD COLUMN IF NOT EXISTS sources_used text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS source_urls text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS last_updated_by uuid,
ADD COLUMN IF NOT EXISTS last_updated_on timestamptz DEFAULT now();

ALTER TABLE entities_service_provider 
DROP CONSTRAINT IF EXISTS entities_service_provider_sources_used_max_5,
DROP CONSTRAINT IF EXISTS entities_service_provider_source_urls_max_5;

ALTER TABLE entities_service_provider 
ADD CONSTRAINT entities_service_provider_sources_used_max_5 CHECK (array_length(sources_used, 1) IS NULL OR array_length(sources_used, 1) <= 5),
ADD CONSTRAINT entities_service_provider_source_urls_max_5 CHECK (array_length(source_urls, 1) IS NULL OR array_length(source_urls, 1) <= 5);

-- entities_contact
ALTER TABLE entities_contact 
ADD COLUMN IF NOT EXISTS sources_used text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS source_urls text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS last_updated_by uuid,
ADD COLUMN IF NOT EXISTS last_updated_on timestamptz DEFAULT now();

ALTER TABLE entities_contact 
DROP CONSTRAINT IF EXISTS entities_contact_sources_used_max_5,
DROP CONSTRAINT IF EXISTS entities_contact_source_urls_max_5;

ALTER TABLE entities_contact 
ADD CONSTRAINT entities_contact_sources_used_max_5 CHECK (array_length(sources_used, 1) IS NULL OR array_length(sources_used, 1) <= 5),
ADD CONSTRAINT entities_contact_source_urls_max_5 CHECK (array_length(source_urls, 1) IS NULL OR array_length(source_urls, 1) <= 5);

-- entities_deal
ALTER TABLE entities_deal 
ADD COLUMN IF NOT EXISTS sources_used text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS source_urls text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS last_updated_by uuid,
ADD COLUMN IF NOT EXISTS last_updated_on timestamptz DEFAULT now();

ALTER TABLE entities_deal 
DROP CONSTRAINT IF EXISTS entities_deal_sources_used_max_5,
DROP CONSTRAINT IF EXISTS entities_deal_source_urls_max_5;

ALTER TABLE entities_deal 
ADD CONSTRAINT entities_deal_sources_used_max_5 CHECK (array_length(sources_used, 1) IS NULL OR array_length(sources_used, 1) <= 5),
ADD CONSTRAINT entities_deal_source_urls_max_5 CHECK (array_length(source_urls, 1) IS NULL OR array_length(source_urls, 1) <= 5);
