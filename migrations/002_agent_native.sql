-- Migration: Agent Native Enhancement
-- Date: 2026-04-04
-- Description: Add fields for AI analysis and MCP compatibility

-- Add new columns to deals table
ALTER TABLE deals ADD COLUMN description TEXT;
ALTER TABLE deals ADD COLUMN target_users TEXT;
ALTER TABLE deals ADD COLUMN core_features TEXT DEFAULT '[]';  -- JSON array
ALTER TABLE deals ADD COLUMN tech_stack TEXT DEFAULT '[]';     -- JSON array
ALTER TABLE deals ADD COLUMN mvp_effort_days INTEGER;          -- Estimated person-days to replicate
ALTER TABLE deals ADD COLUMN ai_summary TEXT;                  -- AI-generated analysis
ALTER TABLE deals ADD COLUMN website_url TEXT;                 -- Official website
ALTER TABLE deals ADD COLUMN analyzed_at TIMESTAMP;            -- When AI analysis was done

-- Create MCP-friendly view
CREATE VIEW IF NOT EXISTS deals_mcp AS
SELECT 
    id,
    company,
    round,
    amount_usd,
    description,
    target_users,
    core_features,
    tech_stack,
    mvp_effort_days,
    ai_summary,
    website_url,
    source_url,
    industry,
    created_at,
    analyzed_at
FROM deals
WHERE ai_summary IS NOT NULL;
