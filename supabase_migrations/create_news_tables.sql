-- Migration: Create News Intelligence tables for AnnoNest
-- Run this in your Supabase SQL Editor to create the required tables

-- 1. Create news table
CREATE TABLE IF NOT EXISTS public.news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  headline TEXT,
  source_name TEXT,
  publish_date TEXT,
  url TEXT,
  raw_text TEXT,
  cleaned_text TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID
);

CREATE INDEX IF NOT EXISTS news_org_id_idx ON public.news(org_id);

-- 2. Create news_entity_links table
CREATE TABLE IF NOT EXISTS public.news_entity_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  news_id UUID NOT NULL REFERENCES public.news(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  org_id UUID,
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS news_entity_links_news_id_idx ON public.news_entity_links(news_id);
CREATE INDEX IF NOT EXISTS news_entity_links_org_id_idx ON public.news_entity_links(org_id);

-- 3. Create text_annotations table
CREATE TABLE IF NOT EXISTS public.text_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  news_id UUID NOT NULL REFERENCES public.news(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  text_span TEXT NOT NULL,
  confidence INTEGER,
  org_id UUID,
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS text_annotations_news_id_idx ON public.text_annotations(news_id);
CREATE INDEX IF NOT EXISTS text_annotations_org_id_idx ON public.text_annotations(org_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_entity_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.text_annotations ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies for news table
DROP POLICY IF EXISTS "Users can view news in their org" ON public.news;
CREATE POLICY "Users can view news in their org" ON public.news
  FOR SELECT USING (org_id IN (SELECT org_id FROM public.users WHERE supabase_id = auth.uid()::varchar));

DROP POLICY IF EXISTS "Users can insert news in their org" ON public.news;
CREATE POLICY "Users can insert news in their org" ON public.news
  FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM public.users WHERE supabase_id = auth.uid()::varchar));

DROP POLICY IF EXISTS "Users can update news in their org" ON public.news;
CREATE POLICY "Users can update news in their org" ON public.news
  FOR UPDATE USING (org_id IN (SELECT org_id FROM public.users WHERE supabase_id = auth.uid()::varchar));

-- 6. RLS policies for news_entity_links table
DROP POLICY IF EXISTS "Users can view entity links in their org" ON public.news_entity_links;
CREATE POLICY "Users can view entity links in their org" ON public.news_entity_links
  FOR SELECT USING (org_id IN (SELECT org_id FROM public.users WHERE supabase_id = auth.uid()::varchar));

DROP POLICY IF EXISTS "Users can insert entity links in their org" ON public.news_entity_links;
CREATE POLICY "Users can insert entity links in their org" ON public.news_entity_links
  FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM public.users WHERE supabase_id = auth.uid()::varchar));

DROP POLICY IF EXISTS "Users can delete entity links in their org" ON public.news_entity_links;
CREATE POLICY "Users can delete entity links in their org" ON public.news_entity_links
  FOR DELETE USING (org_id IN (SELECT org_id FROM public.users WHERE supabase_id = auth.uid()::varchar));

-- 7. RLS policies for text_annotations table
DROP POLICY IF EXISTS "Users can view annotations in their org" ON public.text_annotations;
CREATE POLICY "Users can view annotations in their org" ON public.text_annotations
  FOR SELECT USING (org_id IN (SELECT org_id FROM public.users WHERE supabase_id = auth.uid()::varchar));

DROP POLICY IF EXISTS "Users can insert annotations in their org" ON public.text_annotations;
CREATE POLICY "Users can insert annotations in their org" ON public.text_annotations
  FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM public.users WHERE supabase_id = auth.uid()::varchar));

DROP POLICY IF EXISTS "Users can delete annotations in their org" ON public.text_annotations;
CREATE POLICY "Users can delete annotations in their org" ON public.text_annotations
  FOR DELETE USING (org_id IN (SELECT org_id FROM public.users WHERE supabase_id = auth.uid()::varchar));

-- Grant permissions to authenticated users only (no anon access for security)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.news TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.news_entity_links TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.text_annotations TO authenticated;
