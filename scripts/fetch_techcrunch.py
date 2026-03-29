#!/usr/bin/env python3
"""
Overpriseed - TechCrunch RSS 融资新闻抓取
解析 TechCrunch Startups/Funding RSS，提取 AI 融资新闻

用法:
    python fetch_techcrunch.py              # 抓取并写入
    python fetch_techcrunch.py --dry-run    # 只抓取，不写入
    python fetch_techcrunch.py --days 3     # 过去 3 天的新闻
"""

import os
import sys
import re
import json
import argparse
import requests
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from xml.etree import ElementTree
import time

# RSS Feeds
RSS_FEEDS = [
    "https://techcrunch.com/category/startups/feed/",
    "https://techcrunch.com/category/venture/feed/",
]

# AI 相关关键词
AI_KEYWORDS = [
    'ai', 'artificial intelligence', 'machine learning', 'ml', 'llm',
    'chatgpt', 'openai', 'gpt', 'generative ai', 'gen ai',
    'deep learning', 'neural', 'transformer', 'copilot', 'agent',
    'automation', 'nlp', 'computer vision', 'robotics'
]

# 融资相关关键词
FUNDING_KEYWORDS = [
    'raises', 'raised', 'funding', 'secures', 'secured',
    'series a', 'series b', 'series c', 'series d', 'series e',
    'seed', 'pre-seed', 'round', 'investment', 'million', 'billion',
    'closes', 'closed', 'announces', 'announced'
]


def fetch_rss(url: str) -> List[Dict]:
    """获取 RSS feed 并解析文章"""
    try:
        resp = requests.get(url, timeout=30, headers={
            'User-Agent': 'Overpriseed/1.0 (AI Funding Tracker)'
        })
        resp.raise_for_status()
        
        root = ElementTree.fromstring(resp.content)
        items = []
        
        for item in root.findall('.//item'):
            title = item.find('title')
            link = item.find('link')
            description = item.find('description')
            pub_date = item.find('pubDate')
            
            if title is not None and link is not None:
                items.append({
                    'title': title.text or '',
                    'link': link.text or '',
                    'description': (description.text or '')[:500] if description is not None else '',
                    'pub_date': pub_date.text if pub_date is not None else ''
                })
        
        return items
    except Exception as e:
        print(f"  ❌ Failed to fetch {url}: {e}")
        return []


def is_ai_related(text: str) -> bool:
    """检查文章是否与 AI 相关"""
    text_lower = text.lower()
    return any(kw in text_lower for kw in AI_KEYWORDS)


def is_funding_related(text: str) -> bool:
    """检查文章是否与融资相关"""
    text_lower = text.lower()
    return any(kw in text_lower for kw in FUNDING_KEYWORDS)


def parse_date(date_str: str) -> Optional[datetime]:
    """解析 RSS 日期格式"""
    formats = [
        '%a, %d %b %Y %H:%M:%S %z',  # RFC 2822
        '%a, %d %b %Y %H:%M:%S GMT',
        '%Y-%m-%dT%H:%M:%S%z',
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt)
        except:
            continue
    return None


def extract_funding_details(title: str, description: str, url: str) -> Optional[Dict]:
    """从标题和描述中提取融资详情"""
    text = f"{title} {description}"
    
    # 黑名单 - 不是公司名的词
    BLACKLIST = {
        'the', 'a', 'an', 'ai', 'vcs', 'vc', 'why', 'how', 'what', 'with', 'from',
        'startup', 'startups', 'funding', 'report', 'analysis', 'according',
        'techcrunch', 'this', 'that', 'these', 'those', 'here', 'there',
        'after', 'before', 'air', 'data', 'cloud', 'tech', 'open', 'new',
    }
    
    # 提取金额
    amount_patterns = [
        r'\$(\d+(?:\.\d+)?)\s*(billion|B)',
        r'\$(\d+(?:\.\d+)?)\s*(million|M)',
        r'(\d+(?:\.\d+)?)\s*(billion|million)\s*(?:dollars?)?',
    ]
    
    amount = 0
    for pattern in amount_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            value = float(match.group(1))
            unit = match.group(2).lower()
            if unit in ['billion', 'b']:
                amount = int(value * 1_000_000_000)
            else:
                amount = int(value * 1_000_000)
            break
    
    if amount == 0:
        return None
    
    # 提取公司名 - 通常在标题开头
    company_patterns = [
        r'^([A-Z][A-Za-z0-9\.\-]+(?:\s+[A-Z][A-Za-z0-9\.\-]+)?)\s+(?:raises|secures|closes|announces)',
        r'^([A-Z][A-Za-z0-9\.\-]+(?:\s+[A-Z][A-Za-z0-9\.\-]+)?),?\s+(?:an?\s+)?(?:AI|startup)',
        r'^([A-Z][A-Za-z0-9\.\-]+(?:\s+AI)?)\s+',
    ]
    
    company = None
    for pattern in company_patterns:
        match = re.search(pattern, title)
        if match:
            company = match.group(1).strip()
            # 清理公司名
            company = re.sub(r'\s+(raises|secures|closes|announces).*', '', company, flags=re.IGNORECASE)
            break
    
    if not company or len(company) < 2 or len(company) > 50:
        return None
    
    # 过滤黑名单词
    if company.lower() in BLACKLIST:
        return None
    
    # 提取轮次
    round_patterns = [
        r'(Series\s+[A-Z])',
        r'(Pre-Seed)',
        r'(Seed)',
        r'(seed\s+round)',
        r'(Series\s+\w+)',
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


def fetch_all_feeds(days: int = 7) -> List[Dict]:
    """从所有 RSS feeds 抓取融资新闻"""
    cutoff = datetime.now().astimezone() - timedelta(days=days)
    all_deals = []
    seen = set()
    
    for feed_url in RSS_FEEDS:
        print(f"📡 Fetching: {feed_url}")
        items = fetch_rss(feed_url)
        print(f"   Found {len(items)} articles")
        
        for item in items:
            # 检查日期
            pub_date = parse_date(item['pub_date'])
            if pub_date and pub_date < cutoff:
                continue
            
            text = f"{item['title']} {item['description']}"
            
            # 只处理 AI + 融资相关文章
            if not is_funding_related(text):
                continue
            
            if not is_ai_related(text):
                continue
            
            # 提取融资详情
            deal = extract_funding_details(item['title'], item['description'], item['link'])
            if deal:
                key = f"{deal['company'].lower()}_{deal['amount_usd']}"
                if key not in seen:
                    seen.add(key)
                    all_deals.append(deal)
                    print(f"   ✓ {deal['company']}: ${deal['amount_usd']:,} ({deal['round']})")
        
        time.sleep(1)  # 礼貌延迟
    
    return all_deals


def write_to_d1(deals: List[Dict], dry_run: bool = False) -> int:
    """写入 Cloudflare D1 数据库"""
    
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
    parser = argparse.ArgumentParser(description="Fetch TechCrunch AI funding news")
    parser.add_argument("--dry-run", action="store_true", help="Don't write to database")
    parser.add_argument("--days", type=int, default=7, help="Days to look back (default: 7)")
    parser.add_argument("--debug", action="store_true", help="Print debug info")
    
    args = parser.parse_args()
    
    print("🚀 TechCrunch AI Funding Scraper")
    print("=" * 50)
    print(f"Looking back: {args.days} days")
    print()
    
    try:
        deals = fetch_all_feeds(days=args.days)
        
        print()
        print(f"📊 Total: {len(deals)} AI funding deals found")
        
        if not deals:
            print("No AI funding deals found in TechCrunch RSS.")
            return
        
        print("-" * 50)
        
        # 写入数据库
        inserted = write_to_d1(deals, dry_run=args.dry_run)
        print(f"\n✅ Done! Inserted {inserted} new deals from TechCrunch")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
