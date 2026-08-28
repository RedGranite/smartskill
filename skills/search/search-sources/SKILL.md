---
name: search-sources
description: 第三方搜索 skill 与 MCP 的选择、安装与分流。用户要联网搜索、查资料、找论文、查文档、抓网页、问"用哪个搜索"、或现有搜索结果不够好时使用；按擅长领域、结果格式、价格选源，手动点名直接用，自动分流按规则选。
license: MIT
metadata:
  category: search
  version: "0.1"
---
# search-sources：选对搜索源

## 何时用
需要联网获取信息，且当前会话可用的第三方搜索 skill / MCP 不止一个，或一个都没装。

## 硬规则
- MUST 用户点名某个源时直接用，不劝改。
- MUST 自动选源按顺序比较：领域匹配 > 结果格式需求 > 已安装 > 价格低。
- MUST 所需源未安装时给出安装命令（见 references/catalog.md 与 references/install-mcp.md），不自行安装。
- MUST 时效类查询带日期约束；学术类返回 DOI 或 arXiv id；代码文档类优先版本匹配的源。
- MUST 结论性事实至少两个源；矛盾时列出差异，不裁决。
- NEVER 把 CLI 内置搜索工具当作本目录的源；本目录只收第三方。
- MUST 在 Pi 上只选「两者」类型的 skill（Exa、arXiv、Context7）；Pi 不支持 MCP。

## 审问清单
1. 查询属于哪个领域：通用网页 / 新闻时效 / 学术 / 代码与文档 / 社媒 / 中文站点？
2. 需要什么格式：摘要片段、全文抓取、结构化 JSON、引用链接？
3. 当前会话已装了哪些源？
4. 免费额度够这次用吗？是月度重置还是一次性试用？
5. 结果需要交叉验证吗？

## 反模式
- 错误：查"某库 3.2 版本的 API 变更"用通用网页搜索。→ 正确：用 Context7 按版本查文档。
- 错误：所有查询都走一个付费源。→ 正确：按领域分流，通用查询走 SearXNG 或 Tavily 免费额度。
- 错误：两个源结果矛盾，挑一个当结论。→ 正确：并列给出差异与各自链接。

## 输出要求
每次搜索后一行：`源：<名称>；选它因为：<一句>`，附原始链接。

目录摘要（完整字段、价格、安装命令见 references/catalog.md）：

| 源 | 类型 | 擅长 | 格式 | 免费额度 | key |
|---|---|---|---|---|---|
| SearXNG | MCP | 通用网页 / 新闻时效 | 摘要·全文·JSON·引用 | 自托管永久免费 | 不需要 |
| Tavily | MCP | 通用网页 / 新闻时效 | 摘要·全文·JSON·引用 | 1,000 credits/月 | 需要 |
| Brave Search | MCP | 通用网页 / 新闻时效 | 摘要·全文·JSON·引用 | $5 credits/月 | 需要 |
| Exa | 两者 | 通用网页 / 学术 | 摘要·全文·JSON·引用 | $20 注册 + $10/月 | 可选 |
| Firecrawl | MCP | 通用网页 / 代码与文档 | 全文·JSON·摘要 | 1,000 credits/月 | 可选 |
| Jina Reader | MCP | 通用网页 / 学术 | 全文·JSON·摘要·引用 | 新 key 1,000 万 tokens | 可选 |
| Perplexity Sonar | MCP | 新闻时效 / 通用网页 | 摘要·JSON·引用 | 无 | 需要 |
| mcp-news | MCP | 新闻时效 | 摘要·引用 | 永久免费 | 多数源不需要 |
| arXiv | 两者 | 学术 | JSON·全文·摘要·引用 | 永久免费 | 不需要 |
| AIRA-SemanticScholar | MCP | 学术 | JSON·引用·摘要 | 永久免费 | 可选 |
| Context7 | 两者 | 代码与文档 | 摘要·JSON | 1,000 次/月 | 可选 |
| hn-mcp-server | MCP | 社媒 / 代码与文档 | JSON·引用·摘要 | 永久免费 | 不需要 |
| Reddit MCP Buddy | MCP | 社媒 / 新闻时效 | JSON·引用·摘要 | 免费 100 QPM | 搜索必需 |
| 秘塔 Metaso | MCP | 中文站点 / 学术 | 摘要·全文·JSON·引用 | 5,000 点（一次性） | 需要 |
| 博查 Bocha | MCP | 中文站点 / 通用网页 | 摘要·JSON·引用 | 1,000 次（一次性） | 需要 |

中文站点两个源的免费额度是一次性试用，不是月度重置；长期免费可自托管 SearXNG 开中文引擎。X / Twitter 无免费方案，未收录，理由见 catalog.md。
