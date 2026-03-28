#!/usr/bin/env python3
"""
Overpriseed - 自动批量分析脚本
为没有分析的 deals 自动生成 AI 分析

用法:
    python auto_analyze.py              # 分析所有没有分析的 deals
    python auto_analyze.py --limit 5    # 最多分析 5 个
    python auto_analyze.py --dry-run    # 只显示哪些 deals 需要分析
"""

import os
import sys
import json
import argparse
import requests
import time
from typing import List, Dict

# 导入现有的分析函数
sys.path.insert(0, os.path.dirname(__file__))
from analyze_deal import analyze_deal


def get_deals_without_analysis(limit: int = 10) -> List[Dict]:
    """查询没有分析的 deals"""
    
    cf_token = os.getenv("CLOUDFLARE_API_TOKEN")
    account_id = os.getenv("CLOUDFLARE_ACCOUNT_ID", "2fbf558da1e7c9c03c6149488f2cd99f")
    database_id = os.getenv("D1_DATABASE_ID", "bc5272b6-133e-49ba-bb19-adb1bca72816")
    
    if not cf_token:
        # 尝试从 .env 文件读取
        env_file = os.path.expanduser("~/.env")
        if os.path.exists(env_file):
            with open(env_file) as f:
                for line in f:
                    if line.startswith("CLOUDFLARE_API_TOKEN="):
                        cf_token = line.strip().split("=", 1)[1]
                        break
    
    if not cf_token:
        raise ValueError("CLOUDFLARE_API_TOKEN not found")
    
    url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/d1/database/{database_id}/query"
    headers = {
        "Authorization": f"Bearer {cf_token}",
        "Content-Type": "application/json"
    }
    
    # 查询没有分析的 deals（LEFT JOIN + IS NULL）
    sql = """
        SELECT d.id, d.company, d.round, d.amount_usd, d.created_at
        FROM deals d
        LEFT JOIN analyses a ON d.id = a.deal_id
        WHERE a.id IS NULL
        ORDER BY d.created_at DESC
        LIMIT ?
    """
    
    resp = requests.post(url, headers=headers, json={
        "sql": sql,
        "params": [limit]
    })
    
    if resp.status_code != 200:
        raise Exception(f"Database query failed: {resp.text}")
    
    result = resp.json()
    if not result.get("success"):
        raise Exception(f"Query error: {result}")
    
    deals = result.get("result", [{}])[0].get("results", [])
    return deals


def save_analysis(deal_id: int, analysis: Dict) -> bool:
    """保存分析结果到数据库"""
    
    cf_token = os.getenv("CLOUDFLARE_API_TOKEN")
    if not cf_token:
        env_file = os.path.expanduser("~/.env")
        if os.path.exists(env_file):
            with open(env_file) as f:
                for line in f:
                    if line.startswith("CLOUDFLARE_API_TOKEN="):
                        cf_token = line.strip().split("=", 1)[1]
                        break
    
    account_id = os.getenv("CLOUDFLARE_ACCOUNT_ID", "2fbf558da1e7c9c03c6149488f2cd99f")
    database_id = os.getenv("D1_DATABASE_ID", "bc5272b6-133e-49ba-bb19-adb1bca72816")
    
    url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/d1/database/{database_id}/query"
    headers = {
        "Authorization": f"Bearer {cf_token}",
        "Content-Type": "application/json"
    }
    
    # 从分析结果中提取分数
    scores = analysis.get('scores', {})
    total_score = analysis.get('total_score', 50)
    
    # 映射到数据库的 1-10 分制
    # overpriced_score: 直接用 total_score / 10
    overpriced_score = min(10, max(1, round(total_score / 10)))
    
    # tech_complexity: 技术复刻性反转 (高分=容易复刻=低复杂度)
    tech_rep = scores.get('technical_replicability', {}).get('score', 15)
    tech_complexity = min(10, max(1, round((30 - tech_rep) / 3)))
    
    # ai_replaceability: AI 替代风险
    ai_risk = scores.get('ai_replacement_risk', {}).get('score', 10)
    ai_replaceability = min(10, max(1, round(ai_risk / 2)))
    
    # moat_assessment: 护城河评估反转 (高分=弱护城河=低moat)
    comp_moat = scores.get('competition_moat', {}).get('score', 5)
    moat_assessment = min(10, max(1, round((10 - comp_moat))))
    
    # 生成分析内容
    verdict = analysis.get('verdict', 'AI 自动分析')
    replication = analysis.get('replication_estimate', 'Unknown')
    fair_val = analysis.get('fair_valuation_estimate', 'Unknown')
    
    content = f"""🤖 AI 自动分析

**结论**: {verdict}

**复刻估计**: {replication}
**合理估值**: {fair_val}

---
详细评分:
- 技术可复刻性: {tech_rep}/30 - {scores.get('technical_replicability', {}).get('reason', 'N/A')}
- AI 替代风险: {ai_risk}/20 - {scores.get('ai_replacement_risk', {}).get('reason', 'N/A')}
- 估值合理性: {scores.get('valuation_reasonableness', {}).get('score', 'N/A')}/25
- 市场规模: {scores.get('market_size_issues', {}).get('score', 'N/A')}/15
- 竞争护城河: {comp_moat}/10
"""
    
    insert_sql = """
        INSERT INTO analyses (deal_id, author, overpriced_score, tech_complexity, ai_replaceability, moat_assessment, content, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    """
    
    params = [
        deal_id,
        "🤖 AI Analyzer",
        overpriced_score,
        tech_complexity,
        ai_replaceability,
        moat_assessment,
        content
    ]
    
    resp = requests.post(url, headers=headers, json={
        "sql": insert_sql,
        "params": params
    })
    
    if resp.status_code == 200 and resp.json().get("success"):
        return True
    else:
        print(f"  ❌ Save failed: {resp.text[:100]}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Auto-analyze deals without analysis")
    parser.add_argument("--limit", type=int, default=5, help="Max deals to analyze (default: 5)")
    parser.add_argument("--dry-run", action="store_true", help="Only show deals, don't analyze")
    parser.add_argument("--delay", type=int, default=3, help="Delay between analyses in seconds")
    
    args = parser.parse_args()
    
    print("🤖 Overpriseed Auto-Analyzer")
    print("=" * 50)
    
    try:
        # 获取没有分析的 deals
        deals = get_deals_without_analysis(limit=args.limit)
        
        if not deals:
            print("✅ All deals have analyses! Nothing to do.")
            return
        
        print(f"📋 Found {len(deals)} deals without analysis:")
        for d in deals:
            print(f"  • [{d['id']}] {d['company']} - {d['round']} ${d['amount_usd']:,}")
        
        if args.dry_run:
            print("\n[DRY RUN] Would analyze these deals.")
            return
        
        print("\n" + "-" * 50)
        print("🔍 Starting analysis...\n")
        
        analyzed = 0
        for i, deal in enumerate(deals):
            print(f"[{i+1}/{len(deals)}] Analyzing: {deal['company']}")
            
            try:
                # 调用 AI 分析
                analysis = analyze_deal(
                    company=deal['company'],
                    round=deal['round'],
                    amount_usd=deal['amount_usd']
                )
                
                if 'error' in analysis:
                    print(f"  ⚠️ Analysis returned error: {analysis.get('error')}")
                    continue
                
                # 保存到数据库
                if save_analysis(deal['id'], analysis):
                    print(f"  ✅ Saved: Score {analysis.get('total_score', '?')}/100")
                    analyzed += 1
                
                # 避免 rate limit
                if i < len(deals) - 1:
                    print(f"  ⏳ Waiting {args.delay}s...")
                    time.sleep(args.delay)
                    
            except Exception as e:
                print(f"  ❌ Error: {e}")
                continue
        
        print("\n" + "=" * 50)
        print(f"✅ Done! Analyzed {analyzed}/{len(deals)} deals")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
