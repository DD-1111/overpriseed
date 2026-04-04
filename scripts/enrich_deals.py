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


def repair_truncated_json(json_str: str) -> str:
    """Attempt to repair truncated JSON by closing open structures."""
    import re
    
    # Count open brackets
    open_braces = json_str.count('{') - json_str.count('}')
    open_brackets = json_str.count('[') - json_str.count(']')
    
    # Check if we're in the middle of a string
    in_string = False
    last_quote_pos = -1
    for i, c in enumerate(json_str):
        if c == '\\' and i + 1 < len(json_str):
            continue
        if c == '"':
            in_string = not in_string
            last_quote_pos = i
    
    repaired = json_str
    
    # Close open string
    if in_string:
        repaired += '"'
    
    # Remove trailing incomplete key-value (e.g., ', "key":' or ', "key": "val')
    repaired = re.sub(r',\s*"[^"]*":\s*"?[^"{}[\]]*$', '', repaired)
    repaired = re.sub(r',\s*$', '', repaired)
    
    # Recount after cleanup
    open_braces = repaired.count('{') - repaired.count('}')
    open_brackets = repaired.count('[') - repaired.count(']')
    
    # Close arrays first, then objects
    repaired += ']' * max(0, open_brackets)
    repaired += '}' * max(0, open_braces)
    
    return repaired


def parse_json_robust(text: str) -> Dict:
    """Try multiple strategies to extract JSON from text."""
    import re
    
    # Strategy 1: Find ```json ... ``` block
    json_block_match = re.search(r'```json\s*([\s\S]*?)\s*```', text)
    if json_block_match:
        try:
            return json.loads(json_block_match.group(1))
        except json.JSONDecodeError:
            # Try repairing
            try:
                repaired = repair_truncated_json(json_block_match.group(1))
                return json.loads(repaired)
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
        # If not balanced, return everything from start and try to repair
        return text[start:]
    
    json_str = find_balanced_json(text)
    if json_str:
        try:
            return json.loads(json_str)
        except json.JSONDecodeError:
            # Try repairing truncated JSON
            try:
                repaired = repair_truncated_json(json_str)
                return json.loads(repaired)
            except json.JSONDecodeError:
                pass
    
    # Strategy 3: Simple regex fallback with repair
    try:
        json_match = re.search(r'\{[\s\S]*', text)
        if json_match:
            repaired = repair_truncated_json(json_match.group())
            return json.loads(repaired)
    except json.JSONDecodeError:
        pass
    
    return None


def enrich_deal(company: str, round: str, amount_usd: int, retry: int = 0) -> Dict:
    """Use Perplexity to enrich deal with structured analysis."""
    
    amount_str = f"${amount_usd:,}" if amount_usd else "undisclosed"
    
    # Compact prompt to avoid truncation
    prompt = f"""Analyze {company} ({round}, {amount_str}) for AI replication.

Return JSON ONLY (no markdown, no explanation):
{{"description":"what they do","target_users":"who uses it","core_features":["f1","f2","f3"],"tech_stack":{{"frontend":["x"],"backend":["x"],"ai_ml":["x"],"infrastructure":["x"]}},"mvp_effort_days":30,"ai_summary":"Is this overpriced? Replication risk?"}}

Keep responses SHORT. MVP effort = 2-person team with AI."""

    result = search_perplexity(prompt)
    
    parsed = parse_json_robust(result)
    
    if parsed and "description" in parsed:
        return parsed
    
    # Retry once with simpler prompt
    if retry == 0:
        print(f"   ⚠️  Parse failed, retrying with simpler prompt...")
        time.sleep(3)
        
        simple_prompt = f"""What does {company} do? (They raised {amount_str} in {round})
        
Return ONLY this JSON: {{"description":"2 sentences","target_users":"who","core_features":["a","b","c"],"tech_stack":{{"backend":["x"],"ai_ml":["x"]}},"mvp_effort_days":30,"ai_summary":"short analysis"}}"""
        
        result = search_perplexity(simple_prompt)
        parsed = parse_json_robust(result)
        
        if parsed and "description" in parsed:
            return parsed
    
    return {
        "error": "Failed to parse response",
        "raw": result[:500] if result else "empty response"
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
