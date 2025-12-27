-- Migration: Add source tracking fields to sector extension tables
-- Run this in Supabase SQL Editor to add source tracking support to AgriTech, Healthcare, and Blockchain tables

-- Add source tracking columns to ext_agritech_portfolio_company
ALTER TABLE ext_agritech_portfolio_company
ADD COLUMN IF NOT EXISTS sources_used TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS source_urls TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS last_updated_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_updated_on TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Add source tracking columns to ext_healthcare_portfolio_company
ALTER TABLE ext_healthcare_portfolio_company
ADD COLUMN IF NOT EXISTS sources_used TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS source_urls TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS last_updated_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_updated_on TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Add source tracking columns to ext_blockchain_portfolio_company
ALTER TABLE ext_blockchain_portfolio_company
ADD COLUMN IF NOT EXISTS sources_used TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS source_urls TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS last_updated_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_updated_on TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
