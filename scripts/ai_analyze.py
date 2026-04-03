#!/usr/bin/env python3
"""
AI Analysis Script for Overpriseed
Uses Perplexity to analyze startup deals and generate structured insights.
"""

import os
import sys
import json
import time
import sqlite3
import argparse
from pathlib import Path

# Add Perplexity package path
sys.path.insert(0, str(Path.home() / "clawd/venvs/perplexity/lib/python3.12/site-packages"))

try:
    import perplexity
except ImportError:
    print("Error: perplexity package not found. Install with:")
    print("pip install git+https://github.com/helallao/perplexity-ai.git")
    sys.exit(1)

def get_perplexity_client():
    """Initialize Perplexity client with session token."""
    token = os.getenv("PERPLEXITY_SESSION_TOKEN")
    if not token:
        # Try loading from .env
        env_path = Path.home() / "clawd/projects/overpriseed/.env"
        if env_path.exists():
            for line in env_path.read_text().splitlines():
                if line.startswith("PERPLEXITY_SESSION_TOKEN="):
                    token = line.split("=", 1)[1].strip()
                    break
    
    if not token:
        raise ValueError("PERPLEXITY_SESSION_TOKEN not set")
    
    return perplexity.Client(cookies={"next-auth.session-token": token})


def analyze_deal(client, company: str, round: str, amount: int, source_url: str = None) -> dict:
    """
    Analyze a startup deal using Perplexity.
    Returns structured analysis data.
    """
    amount_str = f"${amount:,}" if amount else "undisclosed"
    
    prompt = f"""Analyze this startup funding deal for an "Overpriced Score" evaluation:

Company: {company}
Funding Round: {round}
Amount: {amount_str}
{f'Source: {source_url}' if source_url else ''}

Please provide a structured analysis with:

1. **Product Description**: What does this company do? (2-3 sentences)
2. **Target Users**: Who are the primary customers/users?
3. **Core Features**: List 3-5 main product features
4. **Tech Stack Estimate**: What technologies would you need to build this? (frontend, backend, AI/ML, infrastructure)
5. **MVP Effort**: How many person-days would it take for 2 senior engineers to build a basic MVP? (just the number)
6. **Competitive Landscape**: Who are the main competitors?
7. **AI Replaceability Score (1-10)**: How easily could AI agents replicate the core functionality? (10 = trivial to replicate)
8. **Moat Assessment**: What defensible advantages does this company have?

Format your response as JSON:
```json
{{
  "description": "...",
  "target_users": "...",
  "core_features": ["feature1", "feature2", ...],
  "tech_stack": {{"frontend": [...], "backend": [...], "ai_ml": [...], "infra": [...]}},
  "mvp_effort_days": 30,
  "competitors": ["competitor1", ...],
  "ai_replaceability": 7,
  "moat": "...",
  "summary": "One paragraph summary of the investment thesis and whether it seems overpriced"
}}
```"""

    try:
        response = client.search(prompt, mode="pro", model="sonar")
        
        # Extract answer from response
        answer_text = None
        for step in response.get("text", []):
            if step.get("step_type") == "FINAL":
                answer_str = step["content"]["answer"]
                answer_data = json.loads(answer_str)
                answer_text = answer_data.get("answer", "")
                break
        
        if not answer_text:
            return {"error": "No answer in response"}
        
        # Try to extract JSON from the response
        json_start = answer_text.find("{")
        json_end = answer_text.rfind("}") + 1
        
        if json_start != -1 and json_end > json_start:
            json_str = answer_text[json_start:json_end]
            analysis = json.loads(json_str)
            return analysis
        else:
            return {"error": "Could not parse JSON", "raw": answer_text}
            
    except Exception as e:
        return {"error": str(e)}


def update_deal_analysis(db_path: str, deal_id: int, analysis: dict):
    """Update deal with AI analysis in database."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Prepare data
    core_features = json.dumps(analysis.get("core_features", []))
    tech_stack = json.dumps(analysis.get("tech_stack", {}))
    
    cursor.execute("""
        UPDATE deals SET
            description = ?,
            target_users = ?,
            core_features = ?,
            tech_stack = ?,
            mvp_effort_days = ?,
            ai_summary = ?,
            analyzed_at = CURRENT_TIMESTAMP
        WHERE id = ?
    """, (
        analysis.get("description"),
        analysis.get("target_users"),
        core_features,
        tech_stack,
        analysis.get("mvp_effort_days"),
        analysis.get("summary"),
        deal_id
    ))
    
    conn.commit()
    conn.close()


def main():
    parser = argparse.ArgumentParser(description="AI-analyze startup deals")
    parser.add_argument("--deal-id", type=int, help="Specific deal ID to analyze")
    parser.add_argument("--all-new", action="store_true", help="Analyze all deals without analysis")
    parser.add_argument("--db", default="overpriseed.db", help="SQLite database path")
    parser.add_argument("--dry-run", action="store_true", help="Don't save to database")
    parser.add_argument("--limit", type=int, default=5, help="Max deals to analyze in one run")
    args = parser.parse_args()
    
    # Initialize client
    print("Initializing Perplexity client...")
    client = get_perplexity_client()
    
    # Get deals to analyze
    conn = sqlite3.connect(args.db)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    if args.deal_id:
        cursor.execute("SELECT * FROM deals WHERE id = ?", (args.deal_id,))
        deals = cursor.fetchall()
    elif args.all_new:
        cursor.execute("""
            SELECT * FROM deals 
            WHERE ai_summary IS NULL 
            ORDER BY created_at DESC 
            LIMIT ?
        """, (args.limit,))
        deals = cursor.fetchall()
    else:
        print("Specify --deal-id or --all-new")
        return
    
    conn.close()
    
    print(f"Found {len(deals)} deals to analyze")
    
    for deal in deals:
        print(f"\n{'='*60}")
        print(f"Analyzing: {deal['company']} ({deal['round']}, ${deal['amount_usd']:,})")
        print(f"{'='*60}")
        
        analysis = analyze_deal(
            client,
            deal['company'],
            deal['round'],
            deal['amount_usd'],
            deal['source_url']
        )
        
        if "error" in analysis:
            print(f"Error: {analysis['error']}")
            continue
        
        print(f"\nDescription: {analysis.get('description', 'N/A')[:100]}...")
        print(f"MVP Effort: {analysis.get('mvp_effort_days', 'N/A')} person-days")
        print(f"AI Replaceability: {analysis.get('ai_replaceability', 'N/A')}/10")
        print(f"Core Features: {', '.join(analysis.get('core_features', [])[:3])}")
        
        if not args.dry_run:
            update_deal_analysis(args.db, deal['id'], analysis)
            print(f"✓ Saved analysis to database")
        
        # Rate limit
        time.sleep(2)
    
    print(f"\n{'='*60}")
    print("Done!")


if __name__ == "__main__":
    main()
