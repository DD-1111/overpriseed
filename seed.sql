-- Insert test deals
INSERT INTO deals (company, round, amount_usd, source_url, created_at) VALUES
('AI Email Assistant Co', 'Series A', 50000000, 'https://techcrunch.com/ai-email-50m', '2024-12-01 10:00:00'),
('Yet Another ChatGPT Wrapper', 'Seed', 15000000, 'https://venturebeat.com/chat-wrapper-15m', '2024-12-10 14:30:00'),
('PDF-to-AI Platform', 'Series B', 120000000, 'https://forbes.com/pdf-ai-120m', '2024-12-15 09:15:00');

-- Insert test analyses
INSERT INTO analyses (deal_id, author, overpriced_score, tech_complexity, ai_replaceability, moat_assessment, content, created_at) VALUES
(1, 'skeptical_investor', 9, 2, 10, 1, 
'This is literally just a GPT wrapper for email. I built the same thing in a weekend. $50M for prompt engineering? The entire value prop can be replaced by a 10-line Python script calling OpenAI API. Zero moat, zero innovation.', 
'2024-12-02 11:30:00'),
(1, 'ai_engineer_2024', 7, 3, 8, 2, 
'While I agree the valuation is high, they do have some decent email parsing tech and a solid user base. Still, $50M is about 10x what this should be worth. The AI replaceability is concerning - Claude or GPT-5 will make this obsolete.', 
'2024-12-02 15:45:00');