# Overpriseed - 任务积压

> AI Agent 自主改进任务列表

---

## 🔥 P0 - 紧急（本周）

### 1. 改进融资新闻解析
**问题**: 当前正则解析太粗糙，抓到的数据质量差
**方案**: 用 AI（GPT-4o-mini）解析 Perplexity 返回的文本
**文件**: `scripts/fetch_deals.py`

```python
# TODO: 替换 parse_funding_news() 函数
# 用 OpenAI API 解析，返回结构化 JSON
```

### 2. 添加数据去重逻辑
**问题**: 同一个融资可能被重复抓取
**方案**: 用 company + round + amount 做唯一键

### 3. 改进搜索 prompt
**当前**: "AI startup funding rounds this week"
**改进**: 更具体的 prompt，要求返回结构化数据

---

## 🟡 P1 - 重要（下周）

### 4. Overpriced Score 系统
- [ ] 设计评分维度（技术复杂度、AI 可替代性、护城河）
- [ ] 添加 API endpoint: POST /api/v1/analyses
- [ ] 前端添加提交分析表单

### 5. 用户系统（简单版）
- [ ] GitHub OAuth 登录
- [ ] 用户可以提交分析
- [ ] 关联 reputation 表

### 6. 前端改进
- [ ] 添加 deal 详情页
- [ ] 显示分析列表
- [ ] 添加 Overpriced Score 可视化

---

## 🟢 P2 - 计划中（本月）

### 7. Challenge 系统
- [ ] 每周自动选一个 deal 作为 challenge
- [ ] 添加提交 MVP 链接功能
- [ ] 社区投票机制

### 8. 更多数据源
- [ ] 接入 TechCrunch RSS
- [ ] 接入 Crunchbase API（如果有免费额度）
- [ ] 接入 Twitter/X 融资新闻

### 9. 数据可视化
- [ ] 融资金额趋势图
- [ ] 行业分布饼图
- [ ] Overpriced Score 排行榜

---

## 🔵 P3 - 未来

### 10. AI 自动分析
- [ ] 对每个新 deal 自动生成初步分析
- [ ] 估算"复刻成本"（需要多少人、多少时间）

### 11. 邮件订阅
- [ ] 每周发送 Overpriced Top 10

### 12. API 开放
- [ ] 提供公开 API 给其他工具使用
- [ ] Rate limiting

---

## ✅ 已完成

- [x] 2026-03-26: 部署 Worker + D1
- [x] 2026-03-26: 前端页面上线
- [x] 2026-03-26: GitHub Actions 自动抓取
- [x] 2026-03-26: GitHub Secrets 配置

---

## 进度记录

### 2026-03-26
- 初始部署完成
- 首次自动抓取成功
- 发现解析精度问题，列入 P0

---

*下次检查: 2026-03-27*
