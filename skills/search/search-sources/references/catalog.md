# 第三方搜索源目录

核验日期 2026-08-28。只收第三方 skill 与 MCP，不收 CLI 内置工具。条目失效即删。

MCP 接入语法见 [install-mcp.md](install-mcp.md)。Pi 不支持 MCP，其上只能用「两者」类型里的 skill。

| 源 | 类型 | 领域 | 格式 | 免费额度 | key |
|---|---|---|---|---|---|
| SearXNG | MCP | 通用网页 / 新闻时效 | 摘要·全文·JSON·引用 | 自托管永久免费 | 不需要 |
| Tavily | MCP | 通用网页 / 新闻时效 | 摘要·全文·JSON·引用 | 1,000 credits/月 | 需要 |
| Brave Search | MCP | 通用网页 / 新闻时效 | 摘要·全文·JSON·引用 | $5 credits/月（≈1,000 次） | 需要 |
| Exa | 两者 | 通用网页 / 学术 | 摘要·全文·JSON·引用 | $20 注册 + $10/月 | 可选 |
| Firecrawl | MCP | 通用网页 / 代码与文档 | 全文·JSON·摘要 | 1,000 credits/月 + keyless 层 | 可选 |
| Jina Reader | MCP | 通用网页 / 学术 | 全文·JSON·摘要·引用 | 新 key 1,000 万 tokens | 可选 |
| Perplexity Sonar | MCP | 新闻时效 / 通用网页 | 摘要·JSON·引用 | 无免费额度 | 需要 |
| mcp-news | MCP | 新闻时效 | 摘要·引用 | 永久免费 | 多数源不需要 |
| arXiv | 两者 | 学术 | JSON·全文·摘要·引用 | 永久免费 | 不需要 |
| AIRA-SemanticScholar | MCP | 学术 | JSON·引用·摘要 | 永久免费 | 可选 |
| Context7 | 两者 | 代码与文档 | 摘要·JSON | 1,000 次/月 | 可选 |
| hn-mcp-server | MCP | 社媒 / 代码与文档 | JSON·引用·摘要 | 永久免费 | 不需要 |
| Reddit MCP Buddy | MCP | 社媒 / 新闻时效 | JSON·引用·摘要 | 免费，100 QPM | 搜索必需 |
| 秘塔 Metaso | MCP | 中文站点 / 学术 | 摘要·全文·JSON·引用 | 新用户 5,000 点（一次性） | 需要 |
| 博查 Bocha | MCP | 中文站点 / 通用网页 | 摘要·JSON·引用 | 1,000 次（一次性） | 需要 |

## 通用网页

### SearXNG
`mcp-searxng` · https://github.com/ihor-sokoliuk/mcp-searxng · MIT · 最近提交 2026-08-25

聚合 70+ 搜索服务的元搜索。`web_url_read` 把 URL 转 Markdown，支持 HTML / PDF / JSON / text。自托管永久免费，公共实例目录见 https://searx.space。不需要 API key，只需 `SEARXNG_URL`。

安装：`npx -y mcp-searxng`

### Tavily
https://github.com/tavily-ai/tavily-mcp · 最近提交 2026-08-20

免费 1,000 credits/月，无需信用卡。按量 $0.008/credit；Project $30/月 4,000 credits，Bootstrap $100/月 15,000，Startup $220/月 38,000。Basic 搜索 1 credit，Advanced 2 credits。key：`TAVILY_API_KEY`。

MCP 的 `topic` 参数只支持 `general`，**没有 `news` 选项**（与 Tavily REST API 本体不同）；查时效靠 `time_range` 参数。

安装：`npx -y tavily-mcp@latest`

### Brave Search
`@brave/brave-search-mcp-server` · https://github.com/brave/brave-search-mcp-server · 最近提交 2026-08-20

Search $5/1,000 次，每月赠 $5 credits（约合 1,000 次），50 QPS。Answers $4/1,000 次 + $5/百万 token，2 QPS。`brave_llm_context` 预抽取正文。key：`BRAVE_API_KEY` 或 `BRAVE_API_KEY_FILE`。

安装：`npx -y @brave/brave-search-mcp-server --transport stdio`

### Exa
https://github.com/exa-labs/exa-mcp-server · 最近提交 2026-08-21

`skills/` 下自带 `search` 与 `exa-agent` 两个 SKILL.md，可作 skill 装（Pi 可用）。注册送 $20（约 2,800 次搜索），此后每月再送 $10，无订阅无最低消费。Search $7/1k，Contents $1/1k pages，Answer $5/1k，Deep Search $12–15/1k。托管端点匿名可用但限速。

安装：`claude mcp add --transport http exa https://mcp.exa.ai/mcp`，或本地 `npx -y exa-mcp-server`（key `EXA_API_KEY`，仓库 README 未写，见 exa.ai/docs）

### Firecrawl
https://github.com/mendableai/firecrawl-mcp-server · 最近提交 2026-08-27

抓取为主：scrape / crawl / map 1 credit/页，search 2 credits/10 条。Free 1,000 credits/月；Hobby $16/月 5,000 pages，Standard $83/月 100,000，Growth $333/月 500,000（年付价）。keyless 免费层可用 `scrape` / `search` / `parse`，限速数值未找到。key：`FIRECRAWL_API_KEY`。

安装：`npx -y firecrawl-mcp`

### Jina Reader
https://github.com/jina-ai/MCP · 远程 HTTP，22 个工具 · 最近提交 2026-08-26

正文抽取见长，另带 `search_arxiv` / `search_ssrn` / `search_bibtex`。新 key 送 1,000 万 tokens。限速：无 key 20 RPM，免费 key 500 RPM，Premium 5,000 RPM。纯充值无月度订阅。单价 $0.02/1M tokens 仅有二手来源，官网公开页未渲染定价表。key：`JINA_API_KEY`（走 `Authorization: Bearer`）。

安装：`{"url":"https://mcp.jina.ai/v1","headers":{"Authorization":"Bearer ${JINA_API_KEY}"}}`

## 新闻时效

### mcp-news
https://github.com/zavora-ai/mcp-news · Rust，20 个工具 · Apache-2.0 · 最近提交 2026-08-13

GDELT、RSS（BBC / DW / France24 / Al Jazeera / CGTN 等）、Hacker News、Yahoo Finance、CoinGecko、arXiv、NIST NVD、CISA KEV、NASA EONET，全部免费无 key。可选 `GNEWS_API_KEY`、`NEWSAPI_KEY`，两者免费层各 100 req/day。README 未明示输出格式。

安装：`cargo install mcp-news`

### Perplexity Sonar
`@perplexity-ai/mcp-server`（官方）· https://github.com/perplexityai/modelcontextprotocol · 最近提交 2026-08-27

**API 无免费额度**。Sonar $1/1M in + $1/1M out；Sonar Pro $3/$15 per 1M。请求费按 context size 低 / 中 / 高：Sonar $5/$8/$12 per 1k，Sonar Pro $6/$10/$14 per 1k。Deep Research 另计 citation token $2/1M、reasoning token $3/1M、search query $5/1k。Max 订阅含每月 10,000 credits。含 `.claude-plugin/marketplace.json`，Claude Code 可作 plugin 装。key：`PERPLEXITY_API_KEY`。

安装：`npx -y @perplexity-ai/mcp-server`

## 学术

### arXiv
https://github.com/blazickjp/arxiv-mcp-server · Apache-2.0 · PyPI v0.7.2 · 最近提交 2026-08-26

19 个工具，自带 `skills/arxiv-mcp-server/SKILL.md`（Pi 可用）。全文按 Markdown 分页，默认 12,000 字符/次；`export_citations` 生成 BibTeX。完全免费，无 key。arXiv ToU 要求每 3 秒不超过 1 次请求、单连接，server 内置节流。可选 `SEMANTIC_SCHOLAR_API_KEY` 给 `citation_graph` 提速。

安装：`uvx arxiv-mcp-server`

### AIRA-SemanticScholar
https://github.com/hamid-vakilzadeh/AIRA-SemanticScholar · 最近提交 2026-03-13 · 28 stars

支持 arXiv / Wiley / DOI 全文与 PDF 提取。免费：未鉴权用户共享 1,000 req/s 池，申请 key 后为 1 RPS/端点。无订阅无按次费。key 可选：`SEMANTIC_SCHOLAR_API_KEY`。

安装：`npx -y aira-semanticscholar`

备选 `xiuyechen/semantic-scholar-mcp`（2026-05-01，env `S2_API_KEY`，内置 1 req/s 令牌桶，4 stars）。

## 代码与文档

### Context7
https://github.com/upstash/context7 · 最近提交 2026-08-27

按版本查库文档。MCP server + Claude Code plugin（含 `skills/context7-mcp/SKILL.md`、`docs-researcher` agent、`/context7:docs` 命令）+ `ctx7` CLI。Free 1,000 次/月，仅公开仓库，超额阻断不可加购；Pro $10/seat/月含 5,000 次，超额 $10/1,000 次，私有仓库解析 $5/1M tokens；Enterprise $30/user/月起。匿名调用可用但限额更低。key 可选：`CONTEXT7_API_KEY`（前缀 `ctx7sk`）。

安装：`npx ctx7 setup --claude`，或 `npx -y @upstash/context7-mcp --api-key KEY`

## 社媒

### hn-mcp-server
`@cyanheads/hn-mcp-server` · https://github.com/cyanheads/hn-mcp-server · Apache-2.0 · 最近提交 2026-08-25

Hacker News。stdio + Streamable HTTP 两种传输。`hn_get_thread` 返回完整评论树，Algolia `highlights.text` 提供片段。完全免费无 key（底层 HN Firebase API 与 Algolia HN Search API 均公开不计费，Algolia 限速数值未找到）。

安装：`npx -y @cyanheads/hn-mcp-server`，或远程 `{"type":"streamable-http","url":"https://hn.caseyjhand.com/mcp"}`

### Reddit MCP Buddy
https://github.com/karanb192/reddit-mcp-buddy · MIT · 最近提交 2026-08-04 · 807 stars

`get_post_details` 返回完整评论树。MCP 自身免费。Reddit Data API 免费层：OAuth 认证 100 QPM，未走 OAuth 10 QPM。无凭据时只有 `browse_subreddit` 与 `reddit_explain` 可用，且 score、num_comments 等字段返回 `null`——**搜索必须配凭据**。变量：`REDDIT_CLIENT_ID`、`REDDIT_CLIENT_SECRET`、`REDDIT_USERNAME`、`REDDIT_PASSWORD`。

安装：`npx -y reddit-mcp-buddy`

**X / Twitter 无收录**：X API 2026-02-06 起 pay-per-use（读取 $0.005/post），Basic $200/月档 2026-06-01 下线，full-archive search 需 Enterprise 合同起价 $42,000/月，搜索接口无任何免费额度。活跃的免费方案只有走浏览器自动化绕过 API 的项目，违反 X ToS 且有封号风险，不收录。

## 中文站点

两个中文源的免费额度都是**一次性试用**，不是月度重置，用完即需付费。长期免费的中文检索可自托管 SearXNG 并启用中文引擎（其中文引擎可用性未逐项核验）。

### 秘塔 Metaso
https://metaso.cn/search-api · 官方远程端点 https://metaso.cn/api/mcp · 社区 stdio https://github.com/SecretRichGarden/metasota-API-MCP（2026-03-05）

搜索范围含网页、文库、学术、图片、视频、播客六类，另有 reader 取全文。0.03 元/次（2025-07-27 官方公布，多源一致）；新用户送 5,000 点。订阅价未找到（官方价格页 404，控制台需登录）。key：`METASO_API_KEY`（`mk-...`）或 `Authorization: Bearer`。

安装：`npx metaso-search-mcp`，或 `claude mcp add --transport http metaso https://metaso.cn/api/mcp --header "Authorization: Bearer KEY"`

### 博查 Bocha
https://github.com/BochaAI/bocha-search-mcp · https://open.bochaai.com · 最近提交 **2025-04-14**（超一年停更）· 177 stars

输出 Markdown 或原始 JSON。免费试用 1,000 次调用资源包。**按次单价未能从官方核验**：官方价格页跳转飞书登录，二手来源冲突（3.6 元/千次 与 0.036 元/次），两说并列。key：`BOCHA_API_KEY`（`sk-` 前缀）。

安装：需先 git clone，再 `uv --directory /path/to/bocha-search-mcp run bocha-search-mcp`

停更超一年，保留是因为社区替代（aweffr/bocha-mcp 等）质量更弱。选它前先确认仓库仍可用。

## 数据说明

- 各源的「擅长领域」「结果格式」是依据 README 与工具描述所作的分类，不是官方标注字段。
- 单价存疑项：博查（来源冲突）、Jina $0.02/1M tokens（仅二手来源）、Brave 1,000 次/月（按 $5 单价折算）、Tavily Project $30/月（官网渲染为占位符，取自 docs.tavily.com）。
- 已剔除：`JackKuo666/semanticscholar-MCP-Server`（2025-03-25 起无更新）、`csrts/metaso-mcp` 与 `HundunOnline/mcp-metaso`（2025 年中停更）。
