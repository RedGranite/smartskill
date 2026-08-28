# smartskill

让 agent 在动手之前把问题想清楚的 Agent Skills。三个组件，按需安装到 Claude Code、Codex、OpenCode、Pi、Hermes Agent、DeepSeek Harness。

## 安装

**1. Claude Code**

```
/plugin marketplace add RedGranite/smartskill
/plugin install coding@smartskill        # 或 thinking@smartskill、search@smartskill
```

**2. Codex**

```bash
npx skills add RedGranite/smartskill -a codex -g                  # 全部
npx skills add RedGranite/smartskill -a codex -g -s before-build  # 单个
```

**3. 其他遵循 Agent Skills 标准的 CLI**（OpenCode、Pi、Hermes Agent、DeepSeek Harness 等）

```bash
npx skills add RedGranite/smartskill -a opencode -g    # -a 可选 opencode / pi / hermes / universal
```

`universal` 装到 `~/.agents/skills`，DeepSeek Harness 读这个目录。无 Node 时用仓库脚本：

```powershell
./install.ps1 -Component coding -Agent dsh,hermes      # Windows
./install.sh --component coding --agent dsh,hermes     # macOS / Linux
```

去掉 `-g` 装到当前项目的 `.agents/skills`。更新即重跑。

## 注入片段

贴进 `CLAUDE.md` / `AGENTS.md` / `DSH.md` / `SOUL.md`，让关卡与平台预设在会话开头生效：

```
- 进入实现阶段（脚手架、demo、首次写代码）前，先执行 skill `before-build`，在回复里产出判断记录并经我确认。
- Windows 会话第一条命令前，先执行：`$u=[Text.Encoding]::UTF8; [Console]::OutputEncoding=$u; [Console]::InputEncoding=$u; $OutputEncoding=$u; $env:PYTHONIOENCODING='utf-8'`；命令一律用 PowerShell 7 语法，细则见 skill `powershell-utf8`。
```

## Skill 索引

<table>
<tr><th>类目</th><th>skill</th><th>用途</th></tr>
<tr><td rowspan="9">coding</td><td><code>before-build</code></td><td>实现前关卡：八维度判断记录，确认后动手</td></tr>
<tr><td><code>build-vs-buy</code></td><td>先查 SDK / 库 / 成品，压缩自研范围</td></tr>
<tr><td><code>ssot-reuse</code></td><td>一处定义，主动抽象，接口优先</td></tr>
<tr><td><code>concurrency-modeling</code></td><td>并发与竞态：状态机 / 幂等键 / event-driven</td></tr>
<tr><td><code>engineering-review</code></td><td>异常路径、状态一致性、可观测性、tech debt</td></tr>
<tr><td><code>spec-first</code></td><td>六节 spec：目标 / 非目标 / 接口 / 状态 / critical path / 验证</td></tr>
<tr><td><code>guardrails</code></td><td>lint / 类型 / CI / e2e 把规则确定化</td></tr>
<tr><td><code>minimal-viable</code></td><td>MVP 推进，验证只做一次</td></tr>
<tr><td><code>powershell-utf8</code></td><td>Windows 会话语法与编码预设</td></tr>
<tr><td rowspan="3">thinking</td><td><code>doc-writing</code></td><td>文档写作标准</td></tr>
<tr><td><code>decision-analysis</code></td><td>有标准、有证据的方案取舍</td></tr>
<tr><td><code>plain-language</code></td><td>中文表达，去 AI 味</td></tr>
<tr><td>search</td><td><code>search-sources</code></td><td>第三方搜索源目录与分流，见下节</td></tr>
</table>

## search-sources

只收第三方搜索 skill 与 MCP，不写检索逻辑。agent 按「领域匹配 > 结果格式 > 已安装 > 价格低」选源；用户点名则直接用；未安装时给出安装命令，不自行安装；结论性事实至少两源，矛盾时并列不裁决。Pi 不支持 MCP，只能用标「两者」的源。

| 源 | 类型 | 擅长 | 免费额度 | 安装 |
|---|---|---|---|---|
| SearXNG | MCP | 通用网页 / 新闻 | 自托管永久免费，无 key | `npx -y mcp-searxng` |
| Tavily | MCP | 通用网页 / 新闻 | 1,000 credits/月 | `npx -y tavily-mcp@latest` |
| Brave Search | MCP | 通用网页 / 新闻 | $5 credits/月 | `npx -y @brave/brave-search-mcp-server` |
| Exa | 两者 | 通用网页 / 学术 | $20 注册 + $10/月 | `npx -y exa-mcp-server` |
| Firecrawl | MCP | 抓取 / 代码文档 | 1,000 credits/月 | `npx -y firecrawl-mcp` |
| Jina Reader | MCP | 正文抽取 / 学术 | 新 key 1,000 万 tokens | 远程 `https://mcp.jina.ai/v1` |
| Perplexity Sonar | MCP | 新闻 / 通用网页 | 无 | `npx -y @perplexity-ai/mcp-server` |
| mcp-news | MCP | 新闻（GDELT / RSS / HN） | 永久免费，无 key | `cargo install mcp-news` |
| arXiv | 两者 | 学术 | 永久免费，无 key | `uvx arxiv-mcp-server` |
| AIRA-SemanticScholar | MCP | 学术 | 永久免费 | `npx -y aira-semanticscholar` |
| Context7 | 两者 | 代码文档（按版本） | 1,000 次/月 | `npx -y @upstash/context7-mcp` |
| hn-mcp-server | MCP | Hacker News | 永久免费，无 key | `npx -y @cyanheads/hn-mcp-server` |
| Reddit MCP Buddy | MCP | Reddit | 免费 100 QPM，搜索需凭据 | `npx -y reddit-mcp-buddy` |
| 秘塔 Metaso | MCP | 中文 / 学术 | 5,000 点（一次性） | `npx metaso-search-mcp` |
| 博查 Bocha | MCP | 中文 | 1,000 次（一次性，仓库停更） | 需 clone，见 catalog |

价格、key 变量名、各 CLI 的 MCP 接入语法见 `skills/search/search-sources/references/`。X / Twitter 无免费方案，未收录。

## 兼容

Claude Code、Codex、DeepSeek Harness 已实测（2026-08-28）；OpenCode、Pi、Hermes Agent 按其官方 skill 目录写入，未实测。

MIT
