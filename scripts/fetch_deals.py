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
    
    for step in resp.get("text", []):
        if step.get("step_type") == "FINAL":
            answer_str = step["content"]["answer"]
            answer = json.loads(answer_str)
            return answer.get("answer", str(answer))
    
    return str(resp)


def fetch_structured_deals() -> List[Dict]:
    """
    用结构化 prompt 获取融资新闻
    直接让 Perplexity 返回 JSON 格式
    """
    prompt = """Find the latest AI startup funding rounds from the past 7 days.

Return ONLY a JSON array with this exact format (no other text):
[
  {
    "company": "Company Name",
    "round": "Series A/Seed/etc",
    "amount_usd": 50000000,
    "source_url": "https://..."
  }
]

Focus on:
- AI/ML startups
- Controversial or potentially overpriced deals
- ChatGPT wrappers, AI email assistants, AI PDF tools
- Large funding rounds ($10M+)

If no recent funding news found, return: []
"""
    
    result = search_perplexity(prompt)
    
    # 尝试从回复中提取 JSON
    deals = extract_json_from_text(result)
    
    if not deals:
        # 如果结构化解析失败，回退到正则解析
        print("  ⚠️  Structured parsing failed, falling back to regex")
        deals = parse_funding_news_regex(result)
    
    return deals


def extract_json_from_text(text: str) -> List[Dict]:
    """从文本中提取 JSON 数组"""
    # 尝试找到 JSON 数组
    json_patterns = [
        r'\[[\s\S]*?\]',  # 匹配 [...] 
    ]
    
    for pattern in json_patterns:
        matches = re.findall(pattern, text)
        for match in matches:
            try:
                data = json.loads(match)
                if isinstance(data, list) and len(data) > 0:
                    # 验证数据结构
                    valid_deals = []
                    for item in data:
                        if isinstance(item, dict) and 'company' in item:
                            deal = {
                                'company': str(item.get('company', '')).strip(),
                                'round': str(item.get('round', 'Unknown')).strip(),
                                'amount_usd': parse_amount(item.get('amount_usd', 0)),
                                'source_url': str(item.get('source_url', '')).strip()
                            }
                            if deal['company'] and deal['amount_usd'] > 0:
                                valid_deals.append(deal)
                    if valid_deals:
                        return valid_deals
            except json.JSONDecodeError:
                continue
    
    return []


def parse_amount(value) -> int:
    """解析金额，支持多种格式"""
    if isinstance(value, (int, float)):
        return int(value)
    
    if isinstance(value, str):
        value = value.replace('$', '').replace(',', '').strip().lower()
        
        multiplier = 1
        if 'billion' in value or 'b' in value:
            multiplier = 1_000_000_000
            value = re.sub(r'[^\d.]', '', value)
        elif 'million' in value or 'm' in value:
            multiplier = 1_000_000
            value = re.sub(r'[^\d.]', '', value)
        
        try:
            return int(float(value) * multiplier)
        except:
            return 0
    
    return 0


def parse_funding_news_regex(text: str) -> List[Dict]:
    """回退方案：用正则解析融资新闻"""
    deals = []
    seen = set()
    
    # 改进的正则模式
    patterns = [
        # "Company raised $50M in Series A"
        r'\*\*([A-Z][A-Za-z0-9\s\-\.]+?)\*\*[^$]*?\$(\d+(?:\.\d+)?)\s*(million|billion|M|B)',
        r'([A-Z][A-Za-z0-9\s\-\.]{2,30}?)\s+(?:has\s+)?(?:raised|closes?d?|secures?d?|announces?d?|gets?|got)\s+\$(\d+(?:\.\d+)?)\s*(million|billion|M|B)',
        r'([A-Z][A-Za-z0-9\s\-\.]{2,30}?),?\s+(?:a[n]?\s+)?(?:AI|ML|startup)[^$]{0,50}\$(\d+(?:\.\d+)?)\s*(million|billion|M|B)',
    ]
    
    for pattern in patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        for match in matches:
            company = match[0].strip()
            
            # 过滤掉明显不是公司名的
            skip_words = ['the', 'a', 'an', 'this', 'that', 'according', 'report', 'analysis', 'funding']
            if company.lower() in skip_words or len(company) < 3 or len(company) > 50:
                continue
            
            amount = float(match[1])
            unit = match[2].lower()
            
            if unit in ['billion', 'b']:
                amount *= 1_000_000_000
            else:
                amount *= 1_000_000
            
            # 提取轮次
            round_match = re.search(
                rf'{re.escape(company)}[^.]*?(Series\s+[A-Z]|Seed|Pre-Seed|Series\s+\w+|funding\s+round)',
                text, re.IGNORECASE
            )
            round_name = round_match.group(1) if round_match else "Unknown"
            
            # 去重
            key = f"{company.lower()}_{int(amount)}"
            if key not in seen:
                seen.add(key)
                deals.append({
                    "company": company,
                    "round": round_name,
                    "amount_usd": int(amount),
                    "source_url": ""
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
        print(f"[DRY RUN] Would insert {len(deals)} deals:")
        for d in deals:
            print(f"  - {d['company']}: ${d['amount_usd']:,} ({d['round']})")
        return len(deals)
    
    url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/d1/database/{database_id}/query"
    headers = {
        "Authorization": f"Bearer {cf_token}",
        "Content-Type": "application/json"
    }
    
    inserted = 0
    for deal in deals:
        # 检查是否已存在（用公司名 + 金额去重）
        check_sql = "SELECT id FROM deals WHERE company = ? AND amount_usd = ?"
        resp = requests.post(url, headers=headers, json={
            "sql": check_sql,
            "params": [deal["company"], deal["amount_usd"]]
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
            print(f"  ✅ Inserted: {deal['company']} - ${deal['amount_usd']:,} ({deal['round']})")
            inserted += 1
        else:
            print(f"  ❌ Failed: {deal['company']} - {resp.text[:100]}")
    
    return inserted


def main():
    parser = argparse.ArgumentParser(description="Fetch AI funding news")
    parser.add_argument("--dry-run", action="store_true", help="Don't write to database")
    parser.add_argument("--query", default=None, help="Custom search query (uses structured prompt if not set)")
    parser.add_argument("--debug", action="store_true", help="Print raw response")
    
    args = parser.parse_args()
    
    print("🔍 Fetching AI funding news...")
    print("-" * 50)
    
    try:
        if args.query:
            # 自定义查询
            print(f"Custom query: {args.query}")
            result = search_perplexity(args.query)
            if args.debug:
                print("Raw result:")
                print(result)
                print("-" * 50)
            deals = parse_funding_news_regex(result)
        else:
            # 使用结构化 prompt
            print("Using structured prompt...")
            deals = fetch_structured_deals()
        
        print(f"📊 Found {len(deals)} deals")
        
        if not deals:
            print("No deals found.")
            return
        
        for d in deals:
            print(f"  • {d['company']}: ${d['amount_usd']:,} ({d['round']})")
        
        print("-" * 50)
        
        # 写入数据库
        inserted = write_to_d1(deals, dry_run=args.dry_run)
        print(f"\n✅ Done! Inserted {inserted} new deals")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
