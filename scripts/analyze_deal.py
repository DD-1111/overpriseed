#!/usr/bin/env python3
"""
Overpriseed - 自动评估脚本
使用 AI 对融资项目进行 Overpriced Score 评估

用法:
    python analyze_deal.py "Company Name" "Series A" 50000000
    python analyze_deal.py --deal-id 1
"""

import os
import sys
import json
import argparse
import requests
from typing import Dict, Optional

# 导入 Perplexity 搜索
sys.path.insert(0, os.path.dirname(__file__))
from fetch_deals import search_perplexity, get_perplexity_token


def analyze_deal(company: str, round: str, amount_usd: int) -> Dict:
    """
    使用 AI 分析一个融资 deal，生成 Overpriced Score
    """
    
    prompt = f"""Analyze this AI startup funding deal and score how "overpriced" it is:

Company: {company}
Round: {round}
Amount: ${amount_usd:,}

Score each dimension (be harsh and skeptical like a critical VC):

1. **Technical Replicability (0-30)**: How long would it take a single engineer + AI to replicate the MVP?
   - < 1 week = 30 (no moat, pure GPT wrapper)
   - 1-4 weeks = 20
   - 1-3 months = 10
   - > 3 months = 0 (real tech moat)

2. **AI Replacement Risk (0-20)**: Will the next GPT/Claude version make this obsolete?
   - Very high = 20 (will be built into ChatGPT)
   - High = 15
   - Medium = 10
   - Low = 0

3. **Valuation Reasonableness (0-25)**: Is the valuation justified by team size, traction, revenue?
   - > 5x overvalued = 25
   - 3-5x = 15
   - 1.5-3x = 8
   - Reasonable = 0

4. **Market Size Issues (0-15)**: Is the market too small to justify the valuation?
   - TAM < $100M = 15
   - $100M-1B = 10
   - $1-10B = 5
   - > $10B = 0

5. **Competition Moat (0-10)**: How fast could Google/Microsoft replicate this?
   - 1 week = 10
   - 1 month = 7
   - 3+ months = 4
   - Hard to replicate = 0

Return ONLY a JSON object with this exact format:
{{
  "company": "{company}",
  "round": "{round}",
  "amount_usd": {amount_usd},
  "scores": {{
    "technical_replicability": {{"score": 0, "reason": "..."}},
    "ai_replacement_risk": {{"score": 0, "reason": "..."}},
    "valuation_reasonableness": {{"score": 0, "reason": "..."}},
    "market_size_issues": {{"score": 0, "reason": "..."}},
    "competition_moat": {{"score": 0, "reason": "..."}}
  }},
  "total_score": 0,
  "verdict": "one sentence conclusion",
  "replication_estimate": "X days/weeks",
  "fair_valuation_estimate": "$XM"
}}
"""
    
    result = search_perplexity(prompt)
    
    # 解析 JSON
    try:
        # 尝试找到 JSON 对象
        import re
        json_match = re.search(r'\{[\s\S]*\}', result)
        if json_match:
            analysis = json.loads(json_match.group())
            return analysis
    except json.JSONDecodeError:
        pass
    
    # 解析失败，返回原始结果
    return {
        "company": company,
        "round": round,
        "amount_usd": amount_usd,
        "raw_analysis": result,
        "error": "Failed to parse structured response"
    }


def format_analysis(analysis: Dict) -> str:
    """格式化分析结果为 Markdown"""
    
    if "error" in analysis:
        return f"""## {analysis['company']} - {analysis['round']} ${analysis['amount_usd']:,}

⚠️ 解析失败，原始分析：
{analysis.get('raw_analysis', 'N/A')}
"""
    
    scores = analysis.get('scores', {})
    total = analysis.get('total_score', 0)
    
    # 评级
    if total <= 20:
        rating = "✅ 合理估值"
    elif total <= 40:
        rating = "⚠️ 略微高估"
    elif total <= 60:
        rating = "🟠 明显高估"
    elif total <= 80:
        rating = "🔴 严重高估"
    else:
        rating = "💀 纯粹炒作"
    
    output = f"""## {analysis['company']} - {analysis['round']} ${analysis['amount_usd']:,}

### Overpriced Score: {total}/100 {rating}

### 分项评分

| 维度 | 分数 | 理由 |
|------|------|------|
| 技术可复刻性 | {scores.get('technical_replicability', {}).get('score', 'N/A')}/30 | {scores.get('technical_replicability', {}).get('reason', 'N/A')} |
| AI 替代风险 | {scores.get('ai_replacement_risk', {}).get('score', 'N/A')}/20 | {scores.get('ai_replacement_risk', {}).get('reason', 'N/A')} |
| 估值合理性 | {scores.get('valuation_reasonableness', {}).get('score', 'N/A')}/25 | {scores.get('valuation_reasonableness', {}).get('reason', 'N/A')} |
| 市场规模 | {scores.get('market_size_issues', {}).get('score', 'N/A')}/15 | {scores.get('market_size_issues', {}).get('reason', 'N/A')} |
| 竞争护城河 | {scores.get('competition_moat', {}).get('score', 'N/A')}/10 | {scores.get('competition_moat', {}).get('reason', 'N/A')} |

### 关键指标
- **复刻时间估计**: {analysis.get('replication_estimate', 'N/A')}
- **合理估值**: {analysis.get('fair_valuation_estimate', 'N/A')}
- **实际估值**: ${analysis['amount_usd']:,}

### 结论
{analysis.get('verdict', 'N/A')}
"""
    return output


def save_analysis_to_d1(analysis: Dict) -> bool:
    """保存分析结果到 D1 数据库"""
    
    cf_token = os.getenv("CLOUDFLARE_API_TOKEN")
    account_id = os.getenv("CLOUDFLARE_ACCOUNT_ID", "2fbf558da1e7c9c03c6149488f2cd99f")
    database_id = os.getenv("D1_DATABASE_ID", "bc5272b6-133e-49ba-bb19-adb1bca72816")
    
    if not cf_token:
        print("⚠️ CLOUDFLARE_API_TOKEN not set, skipping database save")
        return False
    
    url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/d1/database/{database_id}/query"
    headers = {
        "Authorization": f"Bearer {cf_token}",
        "Content-Type": "application/json"
    }
    
    # 首先找到对应的 deal_id
    find_sql = "SELECT id FROM deals WHERE company = ? LIMIT 1"
    resp = requests.post(url, headers=headers, json={
        "sql": find_sql,
        "params": [analysis['company']]
    })
    
    deal_id = None
    if resp.status_code == 200:
        results = resp.json().get("result", [{}])[0].get("results", [])
        if results:
            deal_id = results[0].get("id")
    
    if not deal_id:
        print(f"⚠️ Deal not found in database: {analysis['company']}")
        return False
    
    # 插入分析
    total_score = analysis.get('total_score', 0)
    scores = analysis.get('scores', {})
    
    insert_sql = """
        INSERT INTO analyses (deal_id, author, overpriced_score, tech_complexity, ai_replaceability, moat_assessment, content, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    """
    
    params = [
        deal_id,
        "AI_Analyzer",
        total_score,
        30 - scores.get('technical_replicability', {}).get('score', 15),  # 反转：高分=低复杂度
        scores.get('ai_replacement_risk', {}).get('score', 10),
        10 - scores.get('competition_moat', {}).get('score', 5),  # 反转：高分=低护城河
        json.dumps(analysis, ensure_ascii=False)
    ]
    
    resp = requests.post(url, headers=headers, json={
        "sql": insert_sql,
        "params": params
    })
    
    if resp.status_code == 200 and resp.json().get("success"):
        print(f"✅ Analysis saved to database")
        return True
    else:
        print(f"❌ Failed to save: {resp.text[:100]}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Analyze AI funding deals")
    parser.add_argument("company", nargs="?", help="Company name")
    parser.add_argument("round", nargs="?", help="Funding round")
    parser.add_argument("amount", nargs="?", type=int, help="Amount in USD")
    parser.add_argument("--deal-id", type=int, help="Analyze deal by ID from database")
    parser.add_argument("--save", action="store_true", help="Save analysis to database")
    
    args = parser.parse_args()
    
    if args.deal_id:
        # TODO: 从数据库获取 deal 信息
        print("--deal-id not implemented yet")
        sys.exit(1)
    
    if not args.company or not args.round or not args.amount:
        parser.print_help()
        sys.exit(1)
    
    print(f"🔍 Analyzing: {args.company} - {args.round} ${args.amount:,}")
    print("-" * 50)
    
    try:
        analysis = analyze_deal(args.company, args.round, args.amount)
        
        # 格式化输出
        output = format_analysis(analysis)
        print(output)
        
        # 保存到数据库
        if args.save:
            save_analysis_to_d1(analysis)
        
        # 输出 JSON
        print("\n--- JSON ---")
        print(json.dumps(analysis, indent=2, ensure_ascii=False))
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
