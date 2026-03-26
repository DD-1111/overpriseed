# Overpriseed - 任务积压

> AI Agent 自主改进任务列表

---

## 🔥 P0 - 紧急（本周）

### ~~1. 改进融资新闻解析~~ ✅ DONE
**状态**: 已完成 (2026-03-26)
- 使用结构化 Perplexity prompt
- 添加 JSON 提取函数
- 改进正则回退

### 2. 添加数据去重逻辑 ✅ DONE
**状态**: 已完成 - 用 company + amount 做唯一键

### 3. 改进搜索 prompt
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
- [x] 2026-03-26: 改进解析逻辑（结构化 prompt + JSON 提取）

---

## 进度记录

### 2026-03-26
- 初始部署完成
- 首次自动抓取成功
- 发现解析精度问题，列入 P0
- **P0-1 完成**：改进解析逻辑
  - 使用结构化 Perplexity prompt 直接要求 JSON 输出
  - 添加 `extract_json_from_text()` 函数
  - 改进正则回退方案
  - 测试成功：`AgentMail: $6,000,000 (Seed)`

---

*下次检查: 2026-03-27*
