#!/usr/bin/env python3
"""
Overpriseed - 行业分类
根据公司名和描述自动分类 AI 创业公司行业

用法:
    python classify_industry.py              # 分类所有无行业的 deals
    python classify_industry.py --dry-run    # 只预览，不更新
    python classify_industry.py --all        # 重新分类所有 deals
"""

import os
import sys
import re
import argparse
import requests
from typing import Optional

# 行业分类规则（按优先级排序）
INDUSTRY_RULES = {
    'Healthcare': [
        'health', 'medical', 'biotech', 'pharma', 'drug', 'clinical',
        'patient', 'hospital', 'diagnostic', 'therapy', 'therapeutic',
        'genomic', 'disease', 'healthcare', 'wellness', 'mental health',
        'qualified health'
    ],
    'Developer Tools': [
        'developer', 'code', 'coding', 'sdk', 'api', 'devops', 'ci/cd',
        'github', 'git', 'ide', 'programming', 'software development',
        'database', 'serverless', 'verification', 'testing', 'debug',
        'kubernetes', 'k8s', 'container', 'docker', 'terraform',
        'build', 'deploy', 'qodo', 'scaleops', 'builder.ai'
    ],
    'AI Infrastructure': [
        'openai', 'anthropic', 'llm', 'foundation model', 'gpu', 'tpu',
        'inference', 'training', 'compute', 'cluster', 'model serving',
        'ml ops', 'mlops', 'ai infrastructure', 'ai platform'
    ],
    'Enterprise': [
        'enterprise', 'b2b', 'saas', 'crm', 'erp', 'workflow',
        'productivity', 'collaboration', 'business', 'corporate',
        'management', 'operations', 'hr', 'recruiting', 'sales',
        'construction', 'real estate', 'trayd', 'doss'
    ],
    'Security': [
        'security', 'cybersecurity', 'infosec', 'identity', 'auth',
        'encryption', 'privacy', 'compliance', 'fraud', 'threat',
        'vulnerability', 'penetration', 'firewall', 'soc', 'oasis security',
        'conntour', 'surveillance'
    ],
    'Fintech': [
        'finance', 'fintech', 'banking', 'payment', 'lending', 'credit',
        'insurance', 'insuretech', 'crypto', 'blockchain', 'defi',
        'trading', 'investment', 'wealth', 'accounting'
    ],
    'Defense & Aerospace': [
        'defense', 'defence', 'military', 'aerospace', 'satellite',
        'space', 'shield ai', 'aetherflux', 'missile', 'weapon',
        'national security', 'government', 'dod'
    ],
    'Robotics & Hardware': [
        'robot', 'robotic', 'autonomous', 'drone', 'automation',
        'manufacturing', 'industrial', 'warehouse', 'logistics',
        'hardware', 'chip', 'semiconductor', 'cooling', 'frore',
        'sensor', 'device', 'av', 'self-driving', 'nomadic'
    ],
    'Agents': [
        'agent', 'agentic', 'autonomous agent', 'ai agent', 'copilot',
        'assistant', 'chatbot', 'conversational', 'cluely'
    ],
    'Creative & Content': [
        'image', 'video', 'audio', 'music', 'art', 'design', 'creative',
        'content', 'media', 'animation', 'vfx', 'gaming', 'game',
        'writer', 'writing', 'copy', 'marketing', 'advertising',
        'highlight ai', 'highlight'
    ],
    'Data & Analytics': [
        'data', 'analytics', 'bi', 'visualization', 'warehouse',
        'etl', 'pipeline', 'observability', 'monitoring', 'logging',
        'manifold', 'intelligence', 'insight'
    ],
    'NLP & Search': [
        'nlp', 'search', 'language', 'text', 'document', 'translation',
        'semantic', 'embedding', 'rag', 'retrieval', 'knowledge',
        'serval'
    ],
    'Vision': [
        'vision', 'image recognition', 'ocr', 'object detection',
        'face', 'camera', 'visual', 'computer vision'
    ],
}

# 默认行业
DEFAULT_INDUSTRY = 'Other'


def classify_industry(company: str, description: str = '', source_url: str = '') -> str:
    """根据公司名、描述和来源 URL 分类行业
    
    source_url 通常包含有用的关键词，例如：
    - techcrunch.com/.../kubernetes-efficiency... → Developer Tools
    - techcrunch.com/.../security-video... → Security
    """
    # 清理 URL 中的特殊字符，转为空格分隔的词
    url_text = source_url.replace('-', ' ').replace('_', ' ').replace('/', ' ')
    text = f"{company} {description} {url_text}".lower()
    
    for industry, keywords in INDUSTRY_RULES.items():
        for keyword in keywords:
            if keyword in text:
                return industry
    
    return DEFAULT_INDUSTRY


def get_unclassified_deals(all_deals: bool = False):
    """获取需要分类的 deals"""
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
    
    if all_deals:
        sql = "SELECT id, company, source_url, industry FROM deals ORDER BY id"
    else:
        sql = "SELECT id, company, source_url, industry FROM deals WHERE industry IS NULL OR industry = 'Other' ORDER BY id"
    
    resp = requests.post(url, headers=headers, json={"sql": sql})
    
    if resp.status_code == 200:
        result = resp.json()
        if result.get("success"):
            return result.get("result", [{}])[0].get("results", [])
    
    print(f"❌ Failed to fetch deals: {resp.text[:200]}")
    return []


def update_deal_industry(deal_id: int, industry: str, dry_run: bool = False) -> bool:
    """更新 deal 的行业分类"""
    if dry_run:
        return True
        
    cf_token = os.getenv("CLOUDFLARE_API_TOKEN")
    account_id = os.getenv("CLOUDFLARE_ACCOUNT_ID", "2fbf558da1e7c9c03c6149488f2cd99f")
    database_id = os.getenv("D1_DATABASE_ID", "bc5272b6-133e-49ba-bb19-adb1bca72816")
    
    url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/d1/database/{database_id}/query"
    headers = {
        "Authorization": f"Bearer {cf_token}",
        "Content-Type": "application/json"
    }
    
    sql = "UPDATE deals SET industry = ? WHERE id = ?"
    resp = requests.post(url, headers=headers, json={
        "sql": sql,
        "params": [industry, deal_id]
    })
    
    return resp.status_code == 200 and resp.json().get("success", False)


def main():
    parser = argparse.ArgumentParser(description="Classify deal industries")
    parser.add_argument("--dry-run", action="store_true", help="Don't update database")
    parser.add_argument("--all", action="store_true", help="Reclassify all deals")
    
    args = parser.parse_args()
    
    print("🏭 Industry Classification")
    print("=" * 50)
    
    try:
        deals = get_unclassified_deals(all_deals=args.all)
        
        if not deals:
            print("✅ No deals to classify")
            return
        
        print(f"Found {len(deals)} deals to classify")
        print()
        
        # 统计
        stats = {}
        updated = 0
        
        for deal in deals:
            company = deal.get('company', '')
            deal_id = deal.get('id')
            old_industry = deal.get('industry', 'None')
            source_url = deal.get('source_url', '')
            
            # 分类（使用公司名 + source URL 的关键词）
            industry = classify_industry(company, source_url=source_url)
            stats[industry] = stats.get(industry, 0) + 1
            
            if industry != old_industry:
                prefix = "[DRY RUN] " if args.dry_run else ""
                print(f"  {prefix}{company}: {old_industry} → {industry}")
                
                if update_deal_industry(deal_id, industry, dry_run=args.dry_run):
                    updated += 1
        
        print()
        print("📊 Industry Distribution:")
        for industry, count in sorted(stats.items(), key=lambda x: -x[1]):
            print(f"  {industry}: {count}")
        
        print()
        print(f"✅ {'Would update' if args.dry_run else 'Updated'} {updated} deals")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
