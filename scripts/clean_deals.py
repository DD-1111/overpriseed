#!/usr/bin/env python3
"""
清理 deals 表中的脏数据

脏数据特征：
- 公司名包含换行符
- 公司名是句子片段（包含空格超过3个词）
- 公司名以小写字母开头（除非是知名公司）
- 公司名包含明显的非公司词汇
- 公司名过短或过长
"""

import os
import re
import argparse
import requests
from typing import List, Dict

# 明显不是公司名的词汇/模式
BLACKLIST_PATTERNS = [
    r'^(Big|Biggest|Former|Legal|Defense|Other|Series|Round|Funding|Unknown)$',
    r'^(M|K|B)\s',  # "M legal", "B for"
    r'^\d',  # 以数字开头
    r'^(a|an|the|for|and|or|with|from)\s',  # 以介词开头
    r'\n',  # 包含换行
    r'billion|million',  # 包含金额词
    r'notable|activity|details|rounds',  # 描述性词汇
    r'^[a-z]',  # 以小写字母开头
    r'\s(and|or|for|with|from|to|in|of|the|a|an)\s',  # 包含常见介词/冠词
    r'startups?|companies?|raised|funding',  # 融资相关词汇
    r'^(AI|ML|NLP)\s\w+$',  # "AI wrapper" 等
    r'wrapper',  # wrapper 不是公司名
    r'enterprise\s*(health|AI)?$',  # "enterprise health" 等
]

# 已知合法公司名（即使匹配黑名单也保留）
WHITELIST = {
    'openai', 'anthropic', 'writer', 'shield ai', 'builder.ai',
    'qodo', 'scaleops', 'nomadic', 'aetherflux', 'trayd', 'cluely',
    'conntour', 'serval', 'doss', 'granola', 'manifold', 'littlebird',
    'highlight ai', 'deccan ai', 'obin ai', 'obin', 'frore systems',
    'oasis security', 'qualified health', 'agentmail', 'higgsfield',
    'nexthop ai'
}


def get_cloudflare_config():
    """获取 Cloudflare 配置"""
    cf_token = os.getenv("CLOUDFLARE_API_TOKEN")
    account_id = os.getenv("CLOUDFLARE_ACCOUNT_ID", "2fbf558da1e7c9c03c6149488f2cd99f")
    database_id = os.getenv("D1_DATABASE_ID", "bc5272b6-133e-49ba-bb19-adb1bca72816")
    
    if not cf_token:
        # 尝试从 ~/.env 读取
        env_file = os.path.expanduser("~/.env")
        if os.path.exists(env_file):
            with open(env_file) as f:
                for line in f:
                    if line.startswith("CLOUDFLARE_API_TOKEN="):
                        cf_token = line.strip().split("=", 1)[1]
                        break
    
    if not cf_token:
        raise ValueError("CLOUDFLARE_API_TOKEN not found")
    
    return cf_token, account_id, database_id


def query_d1(sql: str, params: list = None):
    """执行 D1 查询"""
    cf_token, account_id, database_id = get_cloudflare_config()
    
    url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/d1/database/{database_id}/query"
    headers = {
        "Authorization": f"Bearer {cf_token}",
        "Content-Type": "application/json"
    }
    
    payload = {"sql": sql}
    if params:
        payload["params"] = params
    
    resp = requests.post(url, headers=headers, json=payload)
    
    if resp.status_code != 200:
        raise Exception(f"D1 query failed: {resp.text}")
    
    result = resp.json()
    if not result.get("success"):
        raise Exception(f"D1 query failed: {result}")
    
    return result.get("result", [{}])[0].get("results", [])


def is_dirty_company_name(name: str) -> bool:
    """判断是否为脏数据"""
    # 白名单检查
    if name.lower().strip() in WHITELIST:
        return False
    
    # 长度检查
    if len(name) < 2 or len(name) > 50:
        return True
    
    # 词数检查（超过4个词很可能是句子片段）
    words = name.split()
    if len(words) > 4:
        return True
    
    # 黑名单模式检查
    for pattern in BLACKLIST_PATTERNS:
        if re.search(pattern, name, re.IGNORECASE):
            return True
    
    return False


def fetch_all_deals() -> List[Dict]:
    """获取所有 deals"""
    results = query_d1("SELECT id, company, round, amount_usd FROM deals ORDER BY id")
    return results


def delete_deal(deal_id: int) -> bool:
    """删除一条 deal"""
    try:
        query_d1("DELETE FROM deals WHERE id = ?", [deal_id])
        return True
    except Exception as e:
        print(f"  ❌ Failed to delete {deal_id}: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Clean dirty deals from database")
    parser.add_argument("--dry-run", action="store_true", help="Only show what would be deleted")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show all deals being checked")
    
    args = parser.parse_args()
    
    print("🔍 Fetching all deals...")
    deals = fetch_all_deals()
    print(f"📊 Found {len(deals)} deals")
    print("-" * 60)
    
    dirty_deals = []
    
    for deal in deals:
        company = deal.get("company", "")
        is_dirty = is_dirty_company_name(company)
        
        if args.verbose:
            status = "❌ DIRTY" if is_dirty else "✅ OK"
            print(f"  {status}: {company}")
        
        if is_dirty:
            dirty_deals.append(deal)
    
    print("-" * 60)
    print(f"🗑️  Found {len(dirty_deals)} dirty deals:")
    
    for deal in dirty_deals:
        print(f"  • [{deal['id']}] {deal['company']}: ${deal['amount_usd']:,}")
    
    if not dirty_deals:
        print("✨ Database is clean!")
        return
    
    print("-" * 60)
    
    if args.dry_run:
        print(f"[DRY RUN] Would delete {len(dirty_deals)} deals")
        return
    
    print(f"🗑️  Deleting {len(dirty_deals)} dirty deals...")
    deleted = 0
    for deal in dirty_deals:
        if delete_deal(deal['id']):
            print(f"  ✅ Deleted: {deal['company']}")
            deleted += 1
    
    print("-" * 60)
    print(f"✅ Done! Deleted {deleted}/{len(dirty_deals)} dirty deals")


if __name__ == "__main__":
    main()
