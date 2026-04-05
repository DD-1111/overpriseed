#!/usr/bin/env python3
"""
Auto Challenge Selection Script
Selects a deal as the weekly challenge based on criteria:
1. Has AI analysis (mvp_effort_days not null)
2. Not already used as a challenge
3. Prefers deals with higher AI replaceability (more "overpriced")
4. Recent deals (within last 30 days)
"""

import os
import sys
import json
import argparse
import subprocess
from datetime import datetime, timedelta
from typing import Optional, Dict, Any


def run_d1_query(query: str, params: list = None, write: bool = False) -> Dict[str, Any]:
    """Execute a D1 SQL query via wrangler CLI"""
    cmd = ["npx", "wrangler", "d1", "execute", "overpriseed-db"]
    
    if write:
        cmd.append("--remote")
    else:
        cmd.extend(["--remote", "--json"])
    
    # Build the query with params
    if params:
        for i, param in enumerate(params):
            if isinstance(param, str):
                query = query.replace(f"?{i+1}", f"'{param}'")
            else:
                query = query.replace(f"?{i+1}", str(param))
    
    cmd.extend(["--command", query])
    
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=os.path.dirname(os.path.dirname(__file__)))
    
    if result.returncode != 0:
        print(f"Error: {result.stderr}", file=sys.stderr)
        return {"results": []}
    
    if not write:
        try:
            data = json.loads(result.stdout)
            if isinstance(data, list) and len(data) > 0:
                return data[0]
            return data
        except json.JSONDecodeError:
            return {"results": []}
    
    return {"success": True}


def get_week_number() -> int:
    """Get ISO week number"""
    return datetime.now().isocalendar()[1]


def get_week_dates() -> tuple:
    """Get start and end dates for current week (Monday to Sunday)"""
    today = datetime.now()
    start = today - timedelta(days=today.weekday())
    start = start.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=6, hours=23, minutes=59, seconds=59)
    return start.isoformat(), end.isoformat()


def select_challenge_deal() -> Optional[Dict[str, Any]]:
    """
    Select the best deal for this week's challenge.
    Criteria:
    1. Has enrichment data (mvp_effort_days not null)
    2. Not already used as a challenge
    3. Prefers deals with reasonable MVP effort (7-60 days)
    4. Recent deals preferred
    """
    query = """
    SELECT d.id, d.company, d.round, d.amount_usd, d.industry,
           d.description, d.mvp_effort_days, d.ai_summary
    FROM deals d
    LEFT JOIN challenges c ON d.id = c.deal_id
    WHERE c.id IS NULL
      AND d.mvp_effort_days IS NOT NULL
      AND d.mvp_effort_days BETWEEN 7 AND 60
    ORDER BY d.created_at DESC
    LIMIT 1
    """
    
    result = run_d1_query(query)
    results = result.get("results", [])
    
    if results:
        return results[0]
    
    # Fallback: any deal with enrichment, not used
    query_fallback = """
    SELECT d.id, d.company, d.round, d.amount_usd, d.industry,
           d.description, d.mvp_effort_days, d.ai_summary
    FROM deals d
    LEFT JOIN challenges c ON d.id = c.deal_id
    WHERE c.id IS NULL
      AND d.ai_summary IS NOT NULL
    ORDER BY d.created_at DESC
    LIMIT 1
    """
    
    result = run_d1_query(query_fallback)
    results = result.get("results", [])
    return results[0] if results else None


def check_existing_challenge(week: int) -> bool:
    """Check if a challenge already exists for this week"""
    query = f"SELECT id FROM challenges WHERE week_number = {week}"
    result = run_d1_query(query)
    return len(result.get("results", [])) > 0


def create_challenge(deal: dict, week: int, starts_at: str, ends_at: str, dry_run: bool = False) -> bool:
    """Create a new challenge in the database"""
    title = f"Week {week}: Replicate {deal['company']}"
    
    if deal.get('mvp_effort_days'):
        title += f" in {deal['mvp_effort_days']} days"
    
    print(f"\n{'[DRY RUN] ' if dry_run else ''}Creating challenge:")
    print(f"  Title: {title}")
    print(f"  Deal: {deal['company']} ({deal['round']}, ${deal['amount_usd']:,})")
    print(f"  Industry: {deal.get('industry', 'Unknown')}")
    print(f"  MVP Effort: {deal.get('mvp_effort_days', 'Unknown')} days")
    print(f"  Period: {starts_at[:10]} to {ends_at[:10]}")
    
    if dry_run:
        return True
    
    # Escape single quotes in title
    safe_title = title.replace("'", "''")
    
    query = f"""
    INSERT INTO challenges (deal_id, week_number, title, starts_at, ends_at, status)
    VALUES ({deal['id']}, {week}, '{safe_title}', '{starts_at}', '{ends_at}', 'active')
    """
    
    result = run_d1_query(query, write=True)
    return result.get("success", False)


def main():
    parser = argparse.ArgumentParser(description="Auto-select weekly challenge deal")
    parser.add_argument("--dry-run", action="store_true", help="Don't actually create the challenge")
    parser.add_argument("--force", action="store_true", help="Create even if challenge exists for this week")
    args = parser.parse_args()
    
    week = get_week_number()
    starts_at, ends_at = get_week_dates()
    
    print(f"🎯 Auto Challenge Selection")
    print(f"Week: {week} ({starts_at[:10]} to {ends_at[:10]})")
    
    # Check if challenge already exists
    if not args.force and check_existing_challenge(week):
        print(f"\n⚠️  Challenge already exists for week {week}. Use --force to override.")
        return
    
    # Select a deal
    deal = select_challenge_deal()
    
    if not deal:
        print("\n❌ No suitable deals found for challenge.")
        print("   Need deals with AI enrichment that haven't been used yet.")
        return
    
    # Create the challenge
    success = create_challenge(deal, week, starts_at, ends_at, dry_run=args.dry_run)
    
    if success:
        print(f"\n✅ {'Would create' if args.dry_run else 'Created'} challenge successfully!")
    else:
        print(f"\n❌ Failed to create challenge")
        sys.exit(1)


if __name__ == "__main__":
    main()
