-- Add cost tracking fields to submissions table for "real cost" calculation
-- P3-13: 复刻挑战提交系统

-- Add completion_days: how many days it took to build
ALTER TABLE submissions ADD COLUMN completion_days INTEGER DEFAULT NULL;

-- Add team_size: how many people worked on it
ALTER TABLE submissions ADD COLUMN team_size INTEGER DEFAULT 1;

-- Add tech_stack: comma-separated list of technologies used
ALTER TABLE submissions ADD COLUMN tech_stack TEXT DEFAULT NULL;
