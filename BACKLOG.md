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

### ~~4. Overpriced Score 系统~~ ✅ DONE
**状态**: 已完成 (2026-03-28)
- [x] 设计评分维度（5 维度，满分 100）
- [x] 创建评估框架文档 `docs/SCORING_FRAMEWORK.md`
- [x] 创建自动评估脚本 `scripts/analyze_deal.py`
- [x] 添加 API endpoint: POST /api/v1/analyses (2026-03-28)
- [x] 前端添加提交分析表单 (2026-03-28)

### 5. 用户系统（简单版）
- [ ] GitHub OAuth 登录
- [ ] 用户可以提交分析
- [ ] 关联 reputation 表

### 6. 前端改进
- [x] 搜索和筛选功能 (2026-03-27)
- [x] Deal 详情模态框 (2026-03-27)
- [x] 显示分析列表 (2026-03-27)
- [x] Overpriced Score 可视化 (2026-03-28)

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

### 2026-03-28 (中午)
- **分析提交表单**：P1-4 完成！用户现在可以在 Deal 详情页提交分析
  - 滑块输入 4 个评分维度（Overpriced/Tech Complexity/AI Replaceability/Moat）
  - 表单验证 + loading 状态
  - 提交成功后自动刷新分析列表
  - 通过 GitHub Actions 自动部署

### 2026-03-28 (早上)
- **分析提交 API**：添加 POST /api/v1/analyses 端点
  - 验证必填字段 (deal_id, author, content)
  - 分数范围校验 (1-10)
  - 检查 deal 是否存在
  - 返回创建的分析记录

### 2026-03-28 (凌晨)
- **Score 可视化**：为分析分数添加圆形进度条
  - 4 个维度分数改用 SVG 圆形进度条显示
  - Overpriced 分数根据高低动态变色（红/黄/绿）
  - 进度条填充比例对应分数值
  - 更直观的数据展示

### 2026-03-27 (中午)
- **Deal 详情模态框**：点击卡片/按钮打开详情页
  - 新增 API: `GET /api/v1/deals/:id` 返回 deal + analyses
  - 模态框显示公司名、融资轮次、金额
  - 展示社区分析列表（含 4 维度评分）
  - 支持 ESC 键和点击背景关闭

### 2026-03-27 (早上)
- **搜索和筛选**：新增前端功能
  - 公司名搜索框
  - 融资轮次筛选（Pre-Seed/Seed/Series A/B/C+）
  - 排序选项（最新/金额最高/金额最低）
  - 筛选结果计数显示

### 2026-03-27 (凌晨)
- **前端改进**：添加统计面板
  - 显示 Total Deals、Total Funding、This Week 三个指标
  - 响应式 3 列布局
  - 使用已有的 formatNumber() 格式化金额
- **CI 改进**：添加 deploy.yml workflow
  - push 到 main 时自动部署
  - 支持手动触发

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
