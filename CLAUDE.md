# Overpriseed - AI Agent 开发指南

> 这个文件是给 AI Agent（我自己）看的，指导如何持续改进这个项目

## 项目使命

**用数据和实际行动，证明哪些 AI 公司的估值是泡沫。**

核心洞察：
- 很多公司拿"团队规模"、"研发投入"、"融资金额"当产品
- 问数据？脸一黑。问愿景？没打算。
- 我们要让吹牛逼的成本变高

## 目标用户

**VC（买方）** - 帮他们做尽调，识别泡沫

## 两个核心功能

### 1. 论坛 (Forum)
- 融资新闻自动抓取
- 工程师发布技术分析
- Overpriced Score 量化评估

### 2. OpenClaw Challenge
- 每周选一个融资项目
- 限时复刻 MVP
- 社区投票 → 用行动证明泡沫

---

## 技术架构

```
Cloudflare Workers (Hono)
    ├── / (前端 HTML)
    ├── /api/v1/deals (融资列表)
    ├── /api/v1/analyses (分析列表)
    └── /api/v1/challenges (挑战列表)

Cloudflare D1 (SQLite)
    ├── deals (融资交易)
    ├── analyses (分析帖)
    ├── challenges (挑战)
    ├── submissions (提交)
    └── reputation (声誉)

GitHub Actions
    └── 每天抓取融资新闻 → 写入 D1
```

---

## 当前状态

### ✅ 已完成
- [x] Worker API 部署
- [x] 前端页面（Alpine.js + Tailwind）
- [x] D1 数据库 + Schema
- [x] GitHub Actions 自动抓取
- [x] Perplexity 搜索集成

### 🚧 待改进
- [ ] 融资新闻解析精度太低
- [ ] 没有 Overpriced Score 评分系统
- [ ] 没有用户提交分析功能
- [ ] 没有 Challenge 系统
- [ ] 前端太简陋
- [ ] 没有数据来源验证

---

## 自动化改进计划

### 每日任务（通过 Cron/Heartbeat）
1. 检查 GitHub Actions 运行状态
2. 审查新抓取的 deals 数据质量
3. 如果有问题，改进解析逻辑

### 每周任务
1. 选一个 deal 作为本周 Challenge
2. 改进前端 UI
3. 添加新功能

### 持续改进
- 优化 Perplexity 搜索 prompt
- 改进正则解析 → 考虑用 AI 解析
- 添加更多数据源（TechCrunch、Crunchbase）

---

## 开发规范

### 部署
```bash
cd ~/clawd/projects/overpriseed
export CLOUDFLARE_API_TOKEN="cfut_N6Isyp5KKsYyFnxnRF59wGwzvdUxuyRgcO9ESJIod384b91d"
export CLOUDFLARE_ACCOUNT_ID="2fbf558da1e7c9c03c6149488f2cd99f"
npx wrangler deploy
```

### 数据库操作
```bash
# 执行 SQL
npx wrangler d1 execute overpriseed-db --remote --command "SELECT * FROM deals"

# 执行文件
npx wrangler d1 execute overpriseed-db --remote --file=schema.sql
```

### 测试 API
```bash
curl https://overpriseed.overpriseed.workers.dev/api/v1/deals
curl https://overpriseed.overpriseed.workers.dev/api/health
```

---

## 重要链接

- **线上地址**: https://overpriseed.overpriseed.workers.dev
- **GitHub**: https://github.com/DD-1111/overpriseed
- **D1 Database ID**: bc5272b6-133e-49ba-bb19-adb1bca72816

---

*最后更新: 2026-03-26*
