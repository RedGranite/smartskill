# 各 CLI 接入 MCP server

核验日期 2026-08-28。统一以 Tavily 为例：启动命令 `npx -y tavily-mcp`，环境变量 `TAVILY_API_KEY`。

| CLI | add 命令 | 主配置文件 | 重载 |
|---|---|---|---|
| Claude Code | `claude mcp add` | `~/.claude.json` / `.mcp.json` | 免重启 |
| Codex | `codex mcp add` | `~/.codex/config.toml` | 新开会话 |
| OpenCode | `opencode mcp add`（交互式） | `~/.config/opencode/opencode.json` | 重启 |
| Pi | 不支持 MCP | — | — |
| Hermes | `hermes mcp add`（无 `--env`） | `~/.hermes/config.yaml` | `/reload-mcp` |
| dsh | 无，改 patch YAML | `$DSH_HOME/cordis.patch.yml` | `patchReload: live` |

## Claude Code

```bash
claude mcp add --scope user --transport stdio --env TAVILY_API_KEY=tvly-xxx tavily -- npx -y tavily-mcp
```

scope：`user`（全局，存 `~/.claude.json`）、`project`（存仓库 `.mcp.json`，首次使用需批准）、`local`（默认，仅当前项目）。

`.mcp.json` 等价写法，支持 `${VAR}` 与 `${VAR:-default}` 展开：

```json
{
  "mcpServers": {
    "tavily": {
      "command": "npx",
      "args": ["-y", "tavily-mcp"],
      "env": { "TAVILY_API_KEY": "${TAVILY_API_KEY}" }
    }
  }
}
```

添加后无需重启，会话内 `/mcp` 查状态。

## Codex

```bash
codex mcp add tavily --env TAVILY_API_KEY=tvly-xxx -- npx -y tavily-mcp
```

等价 `~/.codex/config.toml`（项目级 `.codex/config.toml` 仅在项目 trusted 时加载）：

```toml
[mcp_servers.tavily]
command = "npx"
args = ["-y", "tavily-mcp"]
env = { TAVILY_API_KEY = "tvly-xxx" }
```

`env` 是直接注入的键值 map；`env_vars` 是转发宿主环境变量的白名单，写法不同（数组表 `[[mcp_servers.tavily.env_vars]]`，含 `name` 与 `source`）。配置在会话启动时读取，改完新开一个 codex 会话。

## OpenCode

写入 `~/.config/opencode/opencode.json`（项目级 `opencode.json`，配置为合并非替换）：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "tavily": {
      "type": "local",
      "command": ["npx", "-y", "tavily-mcp"],
      "enabled": true,
      "environment": { "TAVILY_API_KEY": "{env:TAVILY_API_KEY}" }
    }
  }
}
```

字段是 `environment` 不是 `env`；`command` 是数组，命令与参数合一。变量替换用 `{env:VAR}` 与 `{file:path}`。`opencode mcp add` 只有交互式，无文档化的非交互 flag。`enabled` 在启动时生效，改完重启。

## Pi

不支持。官方 README 原文：`No MCP. Build CLI tools with READMEs (see Skills), or build an extension that adds MCP support.`

Pi 上只能用 skill 型搜索源，或自写扩展（`~/.pi/agent/extensions/*.ts`）。网上流传的 `~/.pi/agent/mcp.json` 出自 issue 讨论，不是已发布特性。

## Hermes Agent

```bash
hermes mcp add tavily --command npx --args -y tavily-mcp
```

`hermes mcp add` 无 `--env`，环境变量事后补进 `~/.hermes/config.yaml`：

```yaml
mcp_servers:
  tavily:
    command: "npx"
    args: ["-y", "tavily-mcp"]
    env:
      TAVILY_API_KEY: "tvly-xxx"
    tools:
      include: [tavily-search, tavily-extract]
```

无项目级配置。会话内 `/reload-mcp` 生效。`hermes mcp catalog` 可浏览 Nous 审核过的 server。

## DeepSeek Harness

无 `dsh mcp add`。`@deepseek-ai/dsh-mcp-client` 随 CLI 一起 ship，无需另装；默认不启用任何 server（server 命令是沙箱外的可信代码）。

写入 `$DSH_HOME/cordis.patch.yml`（整个文件是 patch 操作列表）：

```yaml
- insert:
    - id: mcp-tavily
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: tavily
        transport: stdio
        command: npx
        args: ['-y', 'tavily-mcp']
        env:
          TAVILY_API_KEY: !!js process.env.TAVILY_API_KEY
```

一个 plugin 实例对应一个 server，`id` 与 `serverName` 必须唯一（`serverName` 限 `[A-Za-z0-9_-]{1,32}`）。工具暴露为 `mcp__tavily__tavily-search`。

stdio 子进程的环境会被清洗（剔除像凭据的 ambient 变量与所有 `DSH_*`），所以 key 必须显式写进 `config.env`，用 `!!js process.env.X` 避免密钥落盘。远程 server 改 `transport: streamable-http` + `url` + `headers`。只桥接 Tools，不支持 Resources 与 Prompts。

自定义 profile 默认 `patchReload: live`，改配置即热重载；新工具生效需要新 session，不需要重启 host。
