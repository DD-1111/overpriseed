#!/usr/bin/env python3
"""
Overpriseed - Twitter/X 融资新闻抓取
使用 bird CLI 搜索 Twitter，提取 AI 融资新闻

用法:
    python fetch_twitter.py              # 抓取并写入
    python fetch_twitter.py --dry-run    # 只抓取，不写入
    python fetch_twitter.py --limit 20   # 限制搜索结果数
"""

import os
import sys
import re
import json
import argparse
import subprocess
from datetime import datetime
from typing import List, Dict, Optional

# 搜索查询 - 多个关键词组合
SEARCH_QUERIES = [
    '"raises" "AI startup" -filter:replies',
    '"raised" "million" "AI" -filter:replies',
    '"Series A" OR "Series B" "AI" -filter:replies',
    '"seed round" "AI" -filter:replies',
    '"funding" "generative AI" -filter:replies',
]

# 黑名单 - 不是公司名的词
BLACKLIST = {
    # 常见词
    'the', 'a', 'an', 'ai', 'vcs', 'vc', 'why', 'how', 'what', 'with', 'from',
    'startup', 'startups', 'funding', 'report', 'analysis', 'according',
    'this', 'that', 'these', 'those', 'here', 'there', 'breaking', 'news',
    'after', 'before', 'air', 'data', 'cloud', 'tech', 'open', 'new', 'just',
    'update', 'thread', 'icymi', 'fyi', 'via', 'read', 'today', 'now',
    # 新闻/媒体账号（不是公司）
    'cybernewslive', 'techcrunch', 'bloomberg', 'reuters', 'axios', 'wsj',
    'cnbc', 'forbes', 'fortune', 'wired', 'theverge', 'venturebeat',
    # 国家/地区
    'canada', 'usa', 'china', 'india', 'europe', 'uk', 'japan', 'korea',
    'germany', 'france', 'brazil', 'australia', 'singapore', 'israel',
    # 其他常见误报
    'openai', 'google', 'microsoft', 'amazon', 'meta', 'nvidia', 'apple',
    'anthropic', 'deepmind',  # 太大的公司，不是新创
}


def run_bird_search(query: str, limit: int = 10) -> List[Dict]:
    """运行 bird search 命令"""
    try:
        cmd = ['bird', 'search', query, '-n', str(limit), '--json', '--plain']
        
        # 支持环境变量认证（用于 CI）
        auth_token = os.getenv('TWITTER_AUTH_TOKEN')
        ct0 = os.getenv('TWITTER_CT0')
        if auth_token and ct0:
            cmd.extend(['--auth-token', auth_token, '--ct0', ct0])
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        
        if result.returncode != 0:
            print(f"  ❌ bird search failed: {result.stderr[:200]}")
            return []
        
        # 解析 JSON 输出 - bird 返回 JSON 数组
        try:
            tweets = json.loads(result.stdout)
            if isinstance(tweets, list):
                return tweets
            return [tweets] if tweets else []
        except json.JSONDecodeError as e:
            print(f"  ❌ JSON parse error: {e}")
            return []
    
    except subprocess.TimeoutExpired:
        print(f"  ⏱️  Search timeout for: {query[:50]}...")
        return []
    except FileNotFoundError:
        print("  ❌ bird CLI not found. Install: npm install -g @steipete/bird")
        return []
    except Exception as e:
        print(f"  ❌ Error running bird: {e}")
        return []


def extract_funding_from_tweet(tweet: Dict) -> Optional[Dict]:
    """从推文中提取融资详情"""
    text = tweet.get('text', '') or tweet.get('full_text', '')
    url = tweet.get('url', '') or f"https://x.com/i/status/{tweet.get('id', '')}"
    
    if not text:
        return None
    
    # 跳过估值讨论（不是实际融资）
    if re.search(r'\b(valuation|valued at|worth|market cap)\b', text, re.IGNORECASE):
        return None
    
    # 提取金额 - 优先匹配 "raised $X" 模式
    amount = 0
    
    # 明确的融资金额模式
    raised_patterns = [
        r'(?:raises?|raised|secures?|secured|closes?|closed)\s+\$(\d+(?:\.\d+)?)\s*(billion|B|million|M)\b',
        r'(?:raises?|raised|secures?|secured|closes?|closed)\s+(\d+(?:\.\d+)?)\s*(billion|million)',
    ]
    
    for pattern in raised_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            value = float(match.group(1))
            unit = match.group(2).lower()
            if unit in ['billion', 'b']:
                amount = int(value * 1_000_000_000)
            else:
                amount = int(value * 1_000_000)
            break
    
    # 回退到通用金额模式
    if amount == 0:
        generic_patterns = [
            r'\$(\d+(?:\.\d+)?)\s*(million|M)\b',  # 只匹配 million，避免估值
        ]
        for pattern in generic_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                value = float(match.group(1))
                amount = int(value * 1_000_000)
                break
    
    if amount == 0:
        return None
    
    # 过滤不合理的金额（太大可能是估值，太小可能是噪音）
    if amount > 2_000_000_000:  # > $2B 可能是估值
        return None
    if amount < 500_000:  # < $500K 太小
        return None
    
    # 提取公司名
    company_patterns = [
        # @company raises/secures/closes
        r'@([A-Za-z][A-Za-z0-9_]+)\s+(?:raises|secures|closes|announces)',
        # Company raises/secures
        r'\b([A-Z][A-Za-z0-9]+(?:\.[A-Za-z]+)?)\s+(?:raises|raised|secures|secured|closes|closed)',
        # hashtag
        r'#([A-Z][A-Za-z0-9]+)\b',
    ]
    
    company = None
    for pattern in company_patterns:
        match = re.search(pattern, text)
        if match:
            company = match.group(1).strip()
            # 移除 @ 和 #
            company = company.lstrip('@#')
            break
    
    if not company or len(company) < 2 or len(company) > 40:
        return None
    
    # 过滤黑名单
    if company.lower() in BLACKLIST:
        return None
    
    # 过滤通用词（不是真正的公司名）
    generic_words = {'technologies', 'technology', 'cybersecurity', 'software', 'systems',
                     'solutions', 'services', 'group', 'labs', 'capital', 'ventures'}
    if company.lower() in generic_words:
        return None
    
    # 公司名至少要有 3 个字符
    if len(company) < 3:
        return None
    
    # 提取轮次
    round_patterns = [
        r'(Series\s+[A-Z])',
        r'(Pre-Seed)',
        r'(Seed)',
        r'(seed\s+round)',
    ]
    
    round_name = "Unknown"
    for pattern in round_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            round_name = match.group(1).strip()
            break
    
    return {
        'company': company,
        'round': round_name,
        'amount_usd': amount,
        'source_url': url
    }


def search_twitter_funding(limit: int = 10) -> List[Dict]:
    """搜索 Twitter 上的 AI 融资新闻"""
    all_deals = []
    seen = set()
    
    for query in SEARCH_QUERIES:
        print(f"🔍 Searching: {query[:50]}...")
        tweets = run_bird_search(query, limit=limit)
        print(f"   Found {len(tweets)} tweets")
        
        for tweet in tweets:
            deal = extract_funding_from_tweet(tweet)
            if deal:
                key = f"{deal['company'].lower()}_{deal['amount_usd']}"
                if key not in seen:
                    seen.add(key)
                    all_deals.append(deal)
                    print(f"   ✓ {deal['company']}: ${deal['amount_usd']:,} ({deal['round']})")
    
    return all_deals


def write_to_d1(deals: List[Dict], dry_run: bool = False) -> int:
    """写入 Cloudflare D1 数据库"""
    import requests
    
    if dry_run:
        print(f"\n[DRY RUN] Would insert {len(deals)} deals:")
        for d in deals:
            print(f"  - {d['company']}: ${d['amount_usd']:,} ({d['round']})")
        return len(deals)
    
    cf_token = os.getenv("CLOUDFLARE_API_TOKEN")
    account_id = os.getenv("CLOUDFLARE_ACCOUNT_ID", "2fbf558da1e7c9c03c6149488f2cd99f")
    database_id = os.getenv("D1_DATABASE_ID", "bc5272b6-133e-49ba-bb19-adb1bca72816")
    
    if not cf_token:
        raise ValueError("CLOUDFLARE_API_TOKEN not found")
    
    url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/d1/database/{database_id}/query"
    headers = {
        "Authorization": f"Bearer {cf_token}",
        "Content-Type": "application/json"
    }
    
    inserted = 0
    for deal in deals:
        # 检查是否已存在
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
            print(f"  ✅ Inserted: {deal['company']} - ${deal['amount_usd']:,}")
            inserted += 1
        else:
            print(f"  ❌ Failed: {deal['company']} - {resp.text[:100]}")
    
    return inserted


def main():
    parser = argparse.ArgumentParser(description="Fetch Twitter AI funding news via bird CLI")
    parser.add_argument("--dry-run", action="store_true", help="Don't write to database")
    parser.add_argument("--limit", type=int, default=10, help="Results per query (default: 10)")
    parser.add_argument("--debug", action="store_true", help="Print debug info")
    
    args = parser.parse_args()
    
    print("🐦 Twitter/X AI Funding Scraper")
    print("=" * 50)
    print(f"Results per query: {args.limit}")
    print()
    
    try:
        deals = search_twitter_funding(limit=args.limit)
        
        print()
        print(f"📊 Total: {len(deals)} AI funding deals found")
        
        if not deals:
            print("No AI funding deals found on Twitter.")
            return
        
        print("-" * 50)
        
        # 写入数据库
        inserted = write_to_d1(deals, dry_run=args.dry_run)
        print(f"\n✅ Done! Inserted {inserted} new deals from Twitter/X")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
