-- Migration: Add industry column to deals table
-- Run via: npx wrangler d1 execute overpriseed-db --file=migrations/002_add_industry.sql

-- Add industry column with default 'Other'
ALTER TABLE deals ADD COLUMN industry VARCHAR(50) DEFAULT 'Other';

-- Create index for industry queries
CREATE INDEX IF NOT EXISTS idx_deals_industry ON deals(industry);
