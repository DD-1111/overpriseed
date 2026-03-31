-- Deals table: stores overpriced startup funding rounds
CREATE TABLE IF NOT EXISTS deals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company VARCHAR(255) NOT NULL,
    round VARCHAR(50) NOT NULL,
    amount_usd BIGINT NOT NULL,
    source_url TEXT,
    industry VARCHAR(50) DEFAULT 'Other',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Analyses table: community analyses of deals
CREATE TABLE IF NOT EXISTS analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deal_id INTEGER NOT NULL,
    author VARCHAR(255) NOT NULL,
    overpriced_score INTEGER CHECK (overpriced_score >= 1 AND overpriced_score <= 10),
    tech_complexity INTEGER CHECK (tech_complexity >= 1 AND tech_complexity <= 10),
    ai_replaceability INTEGER CHECK (ai_replaceability >= 1 AND ai_replaceability <= 10),
    moat_assessment INTEGER CHECK (moat_assessment >= 1 AND moat_assessment <= 10),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (deal_id) REFERENCES deals(id)
);

-- Challenges table: weekly building challenges
CREATE TABLE IF NOT EXISTS challenges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deal_id INTEGER NOT NULL,
    week_number INTEGER NOT NULL,
    title VARCHAR(500) NOT NULL,
    starts_at TIMESTAMP NOT NULL,
    ends_at TIMESTAMP NOT NULL,
    status VARCHAR(50) DEFAULT 'upcoming',
    FOREIGN KEY (deal_id) REFERENCES deals(id)
);

-- Submissions table: challenge submissions
CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    challenge_id INTEGER NOT NULL,
    author VARCHAR(255) NOT NULL,
    repo_url TEXT NOT NULL,
    demo_url TEXT,
    description TEXT NOT NULL,
    votes INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (challenge_id) REFERENCES challenges(id)
);

-- Reputation table: user reputation tracking
CREATE TABLE IF NOT EXISTS reputation (
    user_id VARCHAR(255) PRIMARY KEY,
    points INTEGER DEFAULT 0,
    badges TEXT DEFAULT '[]',
    wins INTEGER DEFAULT 0
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_analyses_deal_id ON analyses(deal_id);
CREATE INDEX IF NOT EXISTS idx_challenges_deal_id ON challenges(deal_id);
CREATE INDEX IF NOT EXISTS idx_submissions_challenge_id ON submissions(challenge_id);
CREATE INDEX IF NOT EXISTS idx_deals_created_at ON deals(created_at);
CREATE INDEX IF NOT EXISTS idx_challenges_week_number ON challenges(week_number);