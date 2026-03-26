#!/usr/bin/env python3
"""
Overpriseed - 融资新闻抓取脚本
使用 Perplexity Pro 搜索最新 AI 融资新闻，解析后写入 D1 数据库

用法:
    python fetch_deals.py                    # 抓取并写入
    python fetch_deals.py --dry-run          # 只抓取，不写入
    python fetch_deals.py --query "custom"   # 自定义搜索词
"""

import os
import sys
import json
import re
import argparse
import requests
from datetime import datetime, timedelta
from typing import Optional, List, Dict

# Perplexity 配置
def get_perplexity_token() -> str:
    """从环境变量获取 Perplexity session token"""
    token = os.getenv("PERPLEXITY_SESSION_TOKEN")
    if not token:
        # 尝试从 .env 文件读取
        env_file = os.path.expanduser("~/.env")
        if os.path.exists(env_file):
            with open(env_file) as f:
                for line in f:
                    if line.startswith("PERPLEXITY_SESSION_TOKEN="):
                        token = line.strip().split("=", 1)[1]
                        break
    if not token:
        raise ValueError("PERPLEXITY_SESSION_TOKEN not found")
    return token


def search_perplexity(query: str, mode: str = "pro", model: str = "sonar") -> str:
    """使用 Perplexity 搜索"""
    import perplexity
    
    token = get_perplexity_token()
    client = perplexity.Client(cookies={"next-auth.session-token": token})
    resp = client.search(query, mode=mode, model=model)
    
    # 解析回答
    for step in resp.get("text", []):
        if step.get("step_type") == "FINAL":
            answer_str = step["content"]["answer"]
            answer = json.loads(answer_str)
            return answer.get("answer", str(answer))
    
    return str(resp)


def parse_funding_news(text: str) -> List[Dict]:
    """从 Perplexity 回答中解析融资信息"""
    deals = []
    
    # 用 GPT 或简单规则解析
    # 这里用简单的正则提取
    
    # 匹配模式: "Company raised $XXM in Series X"
    patterns = [
        r"([A-Z][A-Za-z0-9\s]+?)\s+(?:raised|closes?|secures?|gets?|announces?)\s+\$?([\d.]+)\s*(million|billion|M|B)",
        r"([A-Z][A-Za-z0-9\s]+?)\s+(?:Series\s+[A-Z]|Seed|Pre-Seed)\s+.*?\$?([\d.]+)\s*(million|billion|M|B)",
    ]
    
    for pattern in patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        for match in matches:
            company = match[0].strip()
            amount = float(match[1])
            unit = match[2].lower()
            
            if unit in ['billion', 'b']:
                amount *= 1_000_000_000
            elif unit in ['million', 'm']:
                amount *= 1_000_000
            
            # 提取轮次
            round_match = re.search(rf"{re.escape(company)}.*?(Series\s+[A-Z]|Seed|Pre-Seed|Series\s+\w+)", text, re.IGNORECASE)
            round_name = round_match.group(1) if round_match else "Unknown"
            
            deals.append({
                "company": company,
                "round": round_name,
                "amount_usd": int(amount),
                "source_url": "",  # Perplexity 不总是提供具体 URL
                "raw_text": text[:500]  # 保留原文片段用于调试
            })
    
    return deals


def write_to_d1(deals: List[Dict], dry_run: bool = False) -> int:
    """写入 Cloudflare D1 数据库"""
    
    cf_token = os.getenv("CLOUDFLARE_API_TOKEN")
    account_id = os.getenv("CLOUDFLARE_ACCOUNT_ID", "2fbf558da1e7c9c03c6149488f2cd99f")
    database_id = os.getenv("D1_DATABASE_ID", "bc5272b6-133e-49ba-bb19-adb1bca72816")
    
    if not cf_token:
        raise ValueError("CLOUDFLARE_API_TOKEN not found")
    
    if dry_run:
        print(f"[DRY RUN] Would insert {len(deals)} deals")
        for d in deals:
            print(f"  - {d['company']}: ${d['amount_usd']:,} ({d['round']})")
        return len(deals)
    
    # D1 HTTP API
    url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/d1/database/{database_id}/query"
    headers = {
        "Authorization": f"Bearer {cf_token}",
        "Content-Type": "application/json"
    }
    
    inserted = 0
    for deal in deals:
        # 检查是否已存在
        check_sql = "SELECT id FROM deals WHERE company = ? AND round = ?"
        resp = requests.post(url, headers=headers, json={
            "sql": check_sql,
            "params": [deal["company"], deal["round"]]
        })
        
        if resp.status_code == 200:
            result = resp.json()
            if result.get("result", [{}])[0].get("results", []):
                print(f"  ⏭️  Skip (exists): {deal['company']}")
                continue
        
        # 插入新记录
        insert_sql = """
            INSERT INTO deals (company, round, amount_usd, source_url, created_at)
            VALUES (?, ?, ?, ?, datetime('now'))
        """
        resp = requests.post(url, headers=headers, json={
            "sql": insert_sql,
            "params": [deal["company"], deal["round"], deal["amount_usd"], deal["source_url"]]
        })
        
        if resp.status_code == 200 and resp.json().get("success"):
            print(f"  ✅ Inserted: {deal['company']} - ${deal['amount_usd']:,}")
            inserted += 1
        else:
            print(f"  ❌ Failed: {deal['company']} - {resp.text[:100]}")
    
    return inserted


def main():
    parser = argparse.ArgumentParser(description="Fetch AI funding news")
    parser.add_argument("--dry-run", action="store_true", help="Don't write to database")
    parser.add_argument("--query", default="AI startup funding rounds this week 2026", help="Search query")
    parser.add_argument("--debug", action="store_true", help="Print raw response")
    
    args = parser.parse_args()
    
    print(f"🔍 Searching: {args.query}")
    print("-" * 50)
    
    try:
        # 搜索
        result = search_perplexity(args.query)
        
        if args.debug:
            print("Raw result:")
            print(result)
            print("-" * 50)
        
        # 解析
        deals = parse_funding_news(result)
        print(f"📊 Found {len(deals)} deals")
        
        if not deals:
            print("No deals found. Raw response preview:")
            print(result[:500])
            return
        
        # 写入
        inserted = write_to_d1(deals, dry_run=args.dry_run)
        print(f"\n✅ Done! Inserted {inserted} new deals")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
