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

### 3. 改进搜索 prompt ✅ DONE
**状态**: 已完成 - 结构化 prompt + JSON 提取

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
- [x] 接入 TechCrunch RSS ✅ (2026-03-29)
- [ ] 接入 Crunchbase API（如果有免费额度）
- [x] 接入 Twitter/X 融资新闻 ✅ (2026-04-02) — 手动工具，需要浏览器 cookies

### 9. 数据可视化
- [x] 融资金额趋势图 ✅ (2026-03-30)
- [x] 融资轮次分布饼图 ✅ (2026-03-30)
- [x] 行业分布饼图 ✅ (2026-03-31)
- [x] Overpriced Score 排行榜 ✅ (2026-03-29)

---

## 🔵 P3 - 未来

### ~~10. AI 自动分析~~ ✅ DONE
**状态**: 已完成 (2026-03-29)
- [x] 对每个新 deal 自动生成初步分析
- [x] 估算"复刻成本"（需要多少人、多少时间）
- [x] `scripts/auto_analyze.py` 批量分析脚本
- [x] GitHub Actions 自动运行（fetch 后分析新 deals）

### 11. 邮件订阅
- [ ] 每周发送 Overpriced Top 10

### 12. API 开放
- [x] 提供公开 API 给其他工具使用 ✅ (2026-04-05)
- [x] API 文档页面 /docs ✅ (2026-04-05)
- [x] MCP endpoints 文档 ✅ (2026-04-05)
- [ ] Rate limiting (pending)

### 13. "复刻挑战" 提交系统
- [ ] 允许用户提交自己的复刻项目 demo
- [ ] 记录完成时间、人数、技术栈
- [ ] 与原 deal 融资额对比，计算"真实成本"
- [ ] 社区投票评选最佳复刻

---

## ✅ 已完成

- [x] 2026-03-26: 部署 Worker + D1
- [x] 2026-03-26: 前端页面上线
- [x] 2026-03-26: GitHub Actions 自动抓取
- [x] 2026-03-26: GitHub Secrets 配置
- [x] 2026-03-26: 改进解析逻辑（结构化 prompt + JSON 提取）

---

## 进度记录

### 2026-04-05 (早上 6:00)
- **API 文档完善**：添加 MCP endpoints 说明
  - 新增 MCP section 到 /docs 页面
  - 文档化 /mcp/manifest, /mcp/deals, /mcp/deals/:id
  - 添加 AI assistant 使用示例
  - 紫色标签区分 MCP 端点
  - ✅ 线上验证通过

### 2026-04-05 (凌晨 3:00)
- **JSON 解析修复**：修复 enrich_deals.py 截断问题 ✅
  - 新增 `repair_truncated_json()` 修复不完整 JSON
  - 新增 `parse_json_robust()` 多策略解析
  - 使用紧凑 prompt 减少 token 截断
  - 添加重试机制（简化 prompt 重试一次）
  - 测试：3 个 deals 全部成功 enriched（Trayd, Obin AI, Manifold）
  - 线上验证通过

### 2026-04-04 (中午 12:00)
- **Enrichment 问题排查**：发现解析错误
  - 触发 enrich-deals workflow，只处理了 3 个 deals（默认 limit）
  - 其中 2 个解析失败（Nomadic, Builder.ai）— Perplexity 返回的 JSON 被截断
  - 1 个成功（ScaleOps）
  - 清理 BACKLOG 重复条目（P0-3）
  - ✅ 已修复：JSON 解析逻辑

### 2026-04-04 (早上 6:00)
- **Deal Enrichment 功能**：新增 AI 增强分析
  - 新增 `scripts/enrich_deals.py` 批量 enrichment 脚本
  - 为每个 deal 生成：description, target_users, core_features, tech_stack, mvp_effort_days, ai_summary
  - 新增 GitHub Actions `enrich-deals.yml` workflow
  - 在 fetch-deals 成功后自动运行
  - 支持手动触发 + --deal-id 参数

### 2026-04-02 (中午 12:00)
- **Twitter/X 融资新闻抓取**：P2-8 补充完成
  - 新增 `scripts/fetch_twitter.py`
  - 使用 bird CLI 搜索 Twitter
  - 5 个搜索查询组合覆盖不同融资关键词
  - 黑名单过滤：新闻账号、国家名、通用词
  - 跳过估值讨论，只捕获实际融资
  - 支持环境变量认证（TWITTER_AUTH_TOKEN, TWITTER_CT0）
  - ⚠️ 手动工具：cookies 会过期，不适合 CI 自动化
  - 用法：`python3 scripts/fetch_twitter.py --dry-run`

### 2026-04-01 (中午 12:00)
- **行业分类优化**：消除所有 "Other" 类别
  - 新增 "AI Infrastructure" 类别（OpenAI 等基础模型公司）
  - 新增 "Defense & Aerospace" 类别（Shield AI, Aetherflux 等）
  - 重命名：Robotics → Robotics & Hardware, Creative → Creative & Content
  - 添加 50+ 新关键词覆盖更多场景
  - 改进分类逻辑：同时分析公司名 + source_url 关键词
  - 重新分类 18 个 deals：Other → 9 个不同行业
  - ✅ 线上验证：当前 20 个 deals 全部有明确行业分类

### 2026-04-01 (早上 6:00)
- **数据库清理**：清理脏数据
  - 新增 `scripts/clean_deals.py` 清理脚本
  - 新增 `clean-deals.yml` workflow（每周一自动运行 + 手动触发）
  - 清理 37 条脏数据（句子片段、非公司名等）
  - 改进 `fetch_deals.py` 的 `is_valid_company_name()` 验证函数
  - 添加黑名单模式：介词开头、投资人名字、金额词汇等
  - 数据从 59 条 → 22 条有效 deals

### 2026-04-01 (凌晨 3:00)
- **自动行业分类**：完成遗留任务
  - 将 `classify_industry.py` 添加到 `fetch-deals.yml` workflow
  - 每次抓取后自动分类无行业标签的 deals
  - 手动触发测试：59 个 deals 已分类
  - 行业分布：Data & Analytics (8), Healthcare (2), Enterprise (2), Creative (2), Security (1), Developer Tools (1), Agents (1)
  - ⚠️ 发现：数据库有脏数据（如 "Biggest rounds", "Big" 等误入的公司名）

### 2026-03-31 (中午 12:00)
- **行业分布图**：P2-9 完成
  - 新增 `industry` 字段到 deals 表 (migration 002)
  - 新增 `/api/v1/stats/industries` endpoint
  - 新增横向柱状图显示各行业 deal 数量
  - 新增 `scripts/classify_industry.py` 自动分类脚本
  - 新增 GitHub Actions `migrate.yml` 自动执行迁移
  - 分类规则：Healthcare/Developer Tools/Enterprise/Security/Fintech/Robotics/Agents/Creative/Data & Analytics/NLP & Search/Vision
  - ✅ classify_industry.py 已集成到 fetch-deals.yml workflow

### 2026-03-31 (早上 6:00)
- **NEW 标签功能**：新增功能
  - 最近 24 小时内新增的 deals 显示绿色 "NEW" 标签
  - 带脉冲动画效果，吸引用户注意
  - 24 小时后自动隐藏
  - 帮助用户快速发现新内容

### 2026-03-31 (凌晨)
- **X/Twitter 分享按钮**：新增功能
  - Deal 卡片添加 "Share" 按钮（hover 变蓝）
  - Modal 详情页添加 "Share on X" 按钮
  - 点击后打开 Twitter intent，预填推文内容
  - 推文模板：公司名 + 金额 + 轮次 + 网站链接
  - 帮助用户传播 + 增加项目曝光

### 2026-03-30 (中午)
- **RSS Feed 订阅功能**：新增功能
  - 添加 `/feed.xml` endpoint，返回标准 RSS 2.0 格式
  - 输出最近 50 个 deals，包含公司名、融资轮次、金额
  - 每条 item 包含标题、链接、GUID、发布日期、描述
  - Header 导航栏添加橙色 RSS 图标
  - 1 小时缓存，减少数据库查询

### 2026-03-30 (早上)
- **融资轮次分布饼图**：P2-9 补充完成
  - 新增 Doughnut Chart 显示各轮次 deal 数量占比
  - 自动归一化轮次名称（Pre-Seed/Seed/Series A-D+/Other）
  - 响应式 grid 布局：趋势图 2/3，饼图 1/3
  - 颜色编码按轮次阶段区分
  - Tooltip 显示数量和百分比

### 2026-03-30 (凌晨)
- **月度融资趋势图**：P2-9 部分完成
  - 新增 Chart.js 依赖（CDN）
  - 添加 bar+line combo chart 到首页 Stats 下方
  - 红色柱状图显示月度融资金额（单位：$M）
  - 蓝色折线图显示月度 deal 数量
  - 显示最近 6 个月数据
  - 深色主题适配，与网站风格一致
  - 支持双 Y 轴（左: 金额, 右: 数量）

### 2026-03-29 (中午)
- **TechCrunch RSS 数据源**：P2-8 部分完成
  - 新增 `scripts/fetch_techcrunch.py`
  - 抓取 TechCrunch Startups + Venture RSS feeds
  - 自动过滤 AI 相关 + 融资相关文章
  - 从标题提取公司名、金额、轮次
  - 黑名单过滤误报（"VCs"、"Why" 等）
  - GitHub Actions 集成：每日自动抓取

### 2026-03-29 (早上)
- **AI 自动分析**：P3-10 完成
  - 新增 `scripts/auto_analyze.py` 批量分析脚本
  - 查询没有分析的 deals (LEFT JOIN + IS NULL)
  - 调用现有 `analyze_deal()` 生成 AI 分析
  - 保存到 analyses 表，分数映射到 1-10 分制
  - GitHub Actions 集成：fetch 后自动分析最多 3 个新 deals
  - 支持 --limit, --dry-run, --delay 参数

### 2026-03-29 (凌晨)
- **Leaderboard 排行榜**：P2-9 部分完成
  - 新增 API: `GET /api/v1/leaderboard` 返回按平均 overpriced score 排名的 deals
  - SQL 聚合查询：JOIN analyses 表计算平均分数
  - 前端排行榜页面：金银铜牌样式、圆形进度条可视化
  - 点击排行榜项目可打开 deal 详情模态框
  - 响应式布局（移动端隐藏部分分数列）

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
