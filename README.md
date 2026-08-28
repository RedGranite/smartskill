# smartskill

让 agent 在动手之前把问题想清楚的 Agent Skills。三个组件，按需安装到 Claude Code、Codex、OpenCode、Pi、Hermes Agent、DeepSeek Harness。

## 安装

**任意 CLI（需 Node）**

```bash
npx skills add RedGranite/smartskill                         # 交互选择
npx skills add RedGranite/smartskill -s before-build -a codex -g   # 单个，装到用户级
npx skills add https://github.com/RedGranite/smartskill/tree/main/skills/coding   # 整类
```

不加 `-g` 装到项目级 `.agents/skills`；`-g` 装到该 CLI 的用户级目录。

**Claude Code 整类安装**

```
/plugin marketplace add RedGranite/smartskill
/plugin install coding@smartskill
```

**脚本（无 Node、DSH、整类到任意 CLI）**

```powershell
git clone https://github.com/RedGranite/smartskill; cd smartskill
./install.ps1 -Component coding -Agent claude,codex,dsh
./install.ps1 -Skill before-build -Scope project
```

```bash
./install.sh --component thinking --agent hermes
```

更新：重跑安装命令。

## 注入片段

贴进 `CLAUDE.md` / `AGENTS.md` / `DSH.md` / `SOUL.md`，让关卡与平台预设在会话开头生效：

```
- 进入实现阶段（脚手架、demo、首次写代码）前，先执行 skill `before-build`，在回复里产出判断记录并经我确认。
- Windows 会话第一条命令前，先执行：`$u=[Text.Encoding]::UTF8; [Console]::OutputEncoding=$u; [Console]::InputEncoding=$u; $OutputEncoding=$u; $env:PYTHONIOENCODING='utf-8'`；命令一律用 PowerShell 7 语法，细则见 skill `powershell-utf8`。
```

## Skill 索引

| 类目 | skill | 用途 |
|---|---|---|
| coding | `before-build` | 实现前关卡：八维度判断记录，确认后动手 |
| coding | `build-vs-buy` | 先查 SDK / 库 / 成品，压缩自研范围 |
| coding | `ssot-reuse` | 一处定义，主动抽象，接口优先 |
| coding | `concurrency-modeling` | 并发与竞态：状态机 / 幂等键 / event-driven |
| coding | `engineering-review` | 异常路径、状态一致性、可观测性、tech debt |
| coding | `spec-first` | 六节 spec：目标 / 非目标 / 接口 / 状态 / critical path / 验证 |
| coding | `guardrails` | lint / 类型 / CI / e2e 把规则确定化 |
| coding | `minimal-viable` | MVP 推进，验证只做一次 |
| coding | `powershell-utf8` | Windows 会话语法与编码预设 |
| thinking | `doc-writing` | 文档写作标准 |
| thinking | `decision-analysis` | 有标准、有证据的方案取舍 |
| thinking | `plain-language` | 中文表达，去 AI 味 |
| search | `search-sources` | 第三方搜索源目录与分流 |

## 兼容表

| CLI | skill 目录（user） | 实测 |
|---|---|---|
| Claude Code | `~/.claude/skills` | 2026-08-28 实测：脚本 + marketplace 均可 |
| Codex | `~/.codex/skills` | 2026-08-28 实测：脚本 + `npx skills` 均可 |
| DeepSeek Harness | `~/.dsh/skills`、`~/.agents/skills` | 2026-08-28 实测：脚本可 |
| OpenCode | `~/.config/opencode/skills` | 未实测，按官方文档 |
| Pi | `~/.pi/agent/skills` | 未实测，按官方文档 |
| Hermes Agent | `~/.hermes/skills` | 未实测，按官方文档 |

`search-sources` 推荐的搜索源多为 MCP。Pi 官方不支持 MCP，其上只能用 skill 型源（Exa、arXiv、Context7），详见 `skills/search/search-sources/references/install-mcp.md`。

## 贡献

- 新增 skill 放 `skills/<category>/<name>/SKILL.md`，结构见 `docs/superpowers/specs/2026-08-28-smartskill-design.md` §4。
- 提交前 `python scripts/validate.py` 必须通过；索引表手动加一行。
- 不得与既有 skill 重复规则；重叠处一行引用。

MIT
