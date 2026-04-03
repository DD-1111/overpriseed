#!/usr/bin/env python3
"""
Overpriseed - Deal Enrichment Script
Enriches deals with AI-generated analysis and stores in new fields.

Usage:
    python enrich_deals.py              # Enrich all deals without analysis
    python enrich_deals.py --deal-id 60 # Enrich specific deal
    python enrich_deals.py --limit 5    # Limit to 5 deals
"""

import os
import sys
import json
import argparse
import requests
import time
from typing import Dict, List

# Import Perplexity search
sys.path.insert(0, os.path.dirname(__file__))
from fetch_deals import search_perplexity


def get_cloudflare_headers():
    """Get Cloudflare API headers."""
    cf_token = os.getenv("CLOUDFLARE_API_TOKEN")
    if not cf_token:
        env_file = os.path.expanduser("~/.env")
        if os.path.exists(env_file):
            with open(env_file) as f:
                for line in f:
                    if line.startswith("CLOUDFLARE_API_TOKEN="):
                        cf_token = line.strip().split("=", 1)[1]
                        break
    
    if not cf_token:
        raise ValueError("CLOUDFLARE_API_TOKEN not found")
    
    return {
        "Authorization": f"Bearer {cf_token}",
        "Content-Type": "application/json"
    }


def get_d1_url():
    """Get D1 API URL."""
    account_id = os.getenv("CLOUDFLARE_ACCOUNT_ID", "2fbf558da1e7c9c03c6149488f2cd99f")
    database_id = os.getenv("D1_DATABASE_ID", "bc5272b6-133e-49ba-bb19-adb1bca72816")
    return f"https://api.cloudflare.com/client/v4/accounts/{account_id}/d1/database/{database_id}/query"


def query_d1(sql: str, params: list = None):
    """Execute D1 query."""
    headers = get_cloudflare_headers()
    url = get_d1_url()
    
    payload = {"sql": sql}
    if params:
        payload["params"] = params
    
    resp = requests.post(url, headers=headers, json=payload)
    if resp.status_code != 200:
        raise Exception(f"D1 query failed: {resp.text}")
    
    result = resp.json()
    if not result.get("success"):
        raise Exception(f"D1 error: {result}")
    
    return result.get("result", [{}])[0].get("results", [])


def get_deals_to_enrich(limit: int = 10, deal_id: int = None) -> List[Dict]:
    """Get deals that need enrichment."""
    if deal_id:
        sql = "SELECT * FROM deals WHERE id = ?"
        return query_d1(sql, [deal_id])
    else:
        sql = """
            SELECT * FROM deals 
            WHERE description IS NULL OR description = ''
            ORDER BY created_at DESC 
            LIMIT ?
        """
        return query_d1(sql, [limit])


def enrich_deal(company: str, round: str, amount_usd: int) -> Dict:
    """Use Perplexity to enrich deal with structured analysis."""
    
    amount_str = f"${amount_usd:,}" if amount_usd else "undisclosed"
    
    prompt = f"""Analyze this startup for AI agents who want to understand and potentially replicate it:

Company: {company}
Funding: {round} round, {amount_str}

Provide a structured analysis in JSON format:

```json
{{
  "description": "2-3 sentence description of what the company does",
  "target_users": "Who are the primary customers/users?",
  "core_features": ["feature1", "feature2", "feature3"],
  "tech_stack": {{
    "frontend": ["React/Vue/etc"],
    "backend": ["Node/Python/Go/etc"],
    "ai_ml": ["OpenAI API/custom models/etc"],
    "infrastructure": ["AWS/GCP/Cloudflare/etc"]
  }},
  "mvp_effort_days": 30,
  "ai_summary": "One paragraph: Is this overpriced? What's the replication risk? Key insights for AI agents."
}}
```

Be realistic about MVP effort - a competent 2-person team with AI assistance.
Focus on what an AI agent would need to know to evaluate or replicate this product."""

    result = search_perplexity(prompt)
    
    # Extract JSON from response - try multiple strategies
    import re
    
    # Strategy 1: Find ```json ... ``` block
    json_block_match = re.search(r'```json\s*([\s\S]*?)\s*```', result)
    if json_block_match:
        try:
            return json.loads(json_block_match.group(1))
        except json.JSONDecodeError:
            pass
    
    # Strategy 2: Find outermost { ... } with balanced braces
    def find_balanced_json(text):
        start = text.find('{')
        if start == -1:
            return None
        depth = 0
        in_string = False
        escape = False
        for i, c in enumerate(text[start:], start):
            if escape:
                escape = False
                continue
            if c == '\\':
                escape = True
                continue
            if c == '"' and not escape:
                in_string = not in_string
                continue
            if in_string:
                continue
            if c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    return text[start:i+1]
        return None
    
    json_str = find_balanced_json(result)
    if json_str:
        try:
            return json.loads(json_str)
        except json.JSONDecodeError:
            pass
    
    # Strategy 3: Simple regex fallback
    try:
        json_match = re.search(r'\{[\s\S]*\}', result)
        if json_match:
            return json.loads(json_match.group())
    except json.JSONDecodeError:
        pass
    
    return {
        "error": "Failed to parse response",
        "raw": result[:500]
    }


def update_deal(deal_id: int, enrichment: Dict) -> bool:
    """Update deal with enrichment data."""
    
    # Prepare JSON fields
    core_features = json.dumps(enrichment.get("core_features", []))
    tech_stack = json.dumps(enrichment.get("tech_stack", {}))
    
    sql = """
        UPDATE deals SET
            description = ?,
            target_users = ?,
            core_features = ?,
            tech_stack = ?,
            mvp_effort_days = ?,
            ai_summary = ?,
            analyzed_at = datetime('now')
        WHERE id = ?
    """
    
    params = [
        enrichment.get("description"),
        enrichment.get("target_users"),
        core_features,
        tech_stack,
        enrichment.get("mvp_effort_days"),
        enrichment.get("ai_summary"),
        deal_id
    ]
    
    try:
        query_d1(sql, params)
        return True
    except Exception as e:
        print(f"❌ Failed to update deal {deal_id}: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Enrich deals with AI analysis")
    parser.add_argument("--deal-id", type=int, help="Specific deal ID to enrich")
    parser.add_argument("--limit", type=int, default=5, help="Max deals to enrich")
    parser.add_argument("--dry-run", action="store_true", help="Don't save to database")
    args = parser.parse_args()
    
    print("🔍 Finding deals to enrich...")
    deals = get_deals_to_enrich(args.limit, args.deal_id)
    print(f"📋 Found {len(deals)} deals\n")
    
    for deal in deals:
        print(f"{'='*60}")
        print(f"🏢 {deal['company']} ({deal['round']}, ${deal['amount_usd']:,})")
        print(f"{'='*60}")
        
        enrichment = enrich_deal(deal['company'], deal['round'], deal['amount_usd'])
        
        if "error" in enrichment:
            print(f"❌ Error: {enrichment['error']}")
            if "raw" in enrichment:
                print(f"   Raw: {enrichment['raw'][:200]}...")
            continue
        
        print(f"📝 Description: {enrichment.get('description', 'N/A')[:100]}...")
        print(f"🎯 Target: {enrichment.get('target_users', 'N/A')[:80]}...")
        print(f"⚡ Features: {', '.join(enrichment.get('core_features', [])[:3])}")
        print(f"🔧 MVP Effort: {enrichment.get('mvp_effort_days', 'N/A')} person-days")
        
        if not args.dry_run:
            if update_deal(deal['id'], enrichment):
                print(f"✅ Saved to database")
            else:
                print(f"❌ Failed to save")
        else:
            print(f"🔹 Dry run - not saving")
        
        print()
        time.sleep(2)  # Rate limit
    
    print(f"\n{'='*60}")
    print("✨ Done!")


if __name__ == "__main__":
    main()
