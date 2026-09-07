# Herdr 配置与维护说明

本文说明如何在 Windows 上配置 Herdr 的 pane 信息更新、自定义快捷键、已有会话合并与拆出，以及如何迁移和验收。需要 PowerShell 7（`pwsh`）；在 Herdr 内完成安装和检查，以使用其注入的环境变量。

核对日期：2026-09-07。已核对的 Herdr 版本为 `0.8.2-preview.2026-08-31-b1ff4582e968`；其他版本请检查对应的 CLI 和配置语法。

## 文档定位

这是一份一次性配置与后续维护文档，无需注册为 Skill，也不需要每轮加载全文。

配置写入后，Herdr 和 CLI hook 持续执行各自的自动化。每轮生成一句任务结论仍需要模型参与，因此只把这项行为约定留在 `AGENTS.md` 或 `CLAUDE.md` 中。

| 内容 | 配置位置 | 谁执行 |
| --- | --- | --- |
| 侧栏、pane 边框信息和快捷键 | Herdr `config.toml` | Herdr |
| pane 与原生 agent 会话的关联 | Herdr 官方 integration | CLI 的 SessionStart hook |
| agent 名随模型和 effort 更新 | 自定义命名脚本及 CLI hooks 配置 | CLI hook |
| 每轮用中文结论更新标签页名称 | `AGENTS.md` / `CLAUDE.md` | 当前模型 |
| 合并已有 pane、拆出并恢复名称 | `merge-left.ps1` 和两条按键绑定 | Herdr 启动的后台脚本 |

文件只写入一次，不代表运行时只执行一次。仅复制 Herdr 配置和 Markdown 规则，无法代替被它们引用的脚本与 hook 注册。

Agents 面板的动画与关注折叠由 [Windows Agent Spinner](spinner/README.md) 提供，使用显示 metadata，不改变会话运行状态。

## 文件位置与归属

以下使用默认用户目录。`%USERPROFILE%` 表示用户主目录，`%APPDATA%` 表示漫游配置目录；PowerShell 中分别写作 `$env:USERPROFILE`、`$env:APPDATA`。使用自定义配置目录时，相应调整路径，保留其他配置项和已有 hooks。

本目录提供三个自定义脚本。两个命名脚本安装后都使用 `herdr-agent-name.ps1`，分别放在各 CLI 的 hooks 目录：

| 仓库文件 | 安装位置 |
| --- | --- |
| [merge-left.ps1](merge-left.ps1) | `%APPDATA%\herdr\merge-left.ps1` |
| [codex-agent-name.ps1](codex-agent-name.ps1) | `%USERPROFILE%\.codex\hooks\herdr-agent-name.ps1` |
| [claude-agent-name.ps1](claude-agent-name.ps1) | `%USERPROFILE%\.claude\hooks\herdr-agent-name.ps1` |

| 文件 | 用途与维护方 |
| --- | --- |
| `%APPDATA%\herdr\config.toml` | Herdr UI 与按键配置 |
| `%USERPROFILE%\.codex\hooks.json` | Codex hook 注册 |
| `%USERPROFILE%\.codex\herdr-agent-state.ps1` | Herdr 托管的 Codex integration 脚本 |
| `%USERPROFILE%\.claude\settings.json` | Claude Code hook 注册 |
| `%USERPROFILE%\.claude\hooks\herdr-agent-state.ps1` | Herdr 托管的 Claude integration 脚本 |
| `%USERPROFILE%\.codex\AGENTS.md` | Codex 全局行为约定 |
| 项目根目录的 `CLAUDE.md` | Claude 项目范围的行为约定 |

`herdr-agent-state.ps1` 的文件头明确标记由 Herdr 管理，integration 重装或升级可能覆盖它。自定义命名逻辑保存在旁边的独立脚本中，不写进托管文件。

## Herdr UI 与快捷键

以下是无需插件的基础三行布局及导航、移动绑定。启用动画与关注折叠时，用 [插件布局配置](spinner/README.md#关注布局) 替换 `[ui.sidebar.agents]`，并添加下文 F/G 绑定。合并到现有同名 TOML 表，避免重复创建 `[ui]`、`[keys]` 或相同快捷键；保留现有主题、通知和其他设置。

```toml
[ui]
agent_panel_sort = "spaces"
show_agent_labels_on_pane_borders = true

[ui.sidebar.agents]
row_gap = 0
rows = [
  ["state_icon", { token = "workspace", fg = "#89b4fa", bold = true, dim = false }],
  [{ token = "tab", fg = "#b8bdc7", bold = true, dim = false }],
  [{ token = "agent", fg = "#7c828c", bold = false, dim = false }],
]

[keys]
previous_agent = "prefix+up"
next_agent = "prefix+down"
previous_tab = "prefix+left"
next_tab = "prefix+right"

[[keys.command]]
key = "prefix+m"
type = "shell"
command = 'pwsh.exe -NoProfile -NonInteractive -WindowStyle Hidden -File "%APPDATA%\herdr\merge-left.ps1" 1> "%APPDATA%\herdr\merge-left-error.log" 2>&1'
description = "将当前分屏移到前一标签页右侧"

[[keys.command]]
key = "prefix+t"
type = "shell"
command = 'pwsh.exe -NoProfile -NonInteractive -WindowStyle Hidden -File "%APPDATA%\herdr\merge-left.ps1" -NewTab 1> "%APPDATA%\herdr\detach-tab-error.log" 2>&1'
description = "当前分屏恢复为独立标签页"
```

### Agents 面板布局与配色

展开的桌面侧栏中，每个条目按三行显示：

| 行 | 内容 | 显示方式 |
| --- | --- | --- |
| 第一行 | 状态图标、项目名（`workspace`） | 项目名浅蓝、加粗 |
| 第二行 | session 总结，即标签页名称（`tab`） | 浅灰、加粗 |
| 第三行 | 模型、effort 与 pane 后缀，即命名 hook 生成的 `agent` | 中灰、不加粗、不淡化 |

模型名独占一行，减少与项目名挤在同一行造成的末尾截断；侧栏过窄时仍可能截断。配色值统一写在上面的 TOML 中。

`row_gap = 0` 取消条目之间的空白行，三行内容本身不受影响。改为 `1` 会在条目之间增加一整行。该参数不能把空行压成半行高，token 样式也没有独立字号设置。

当前核对的配置提供 `fg`、`bold`、`dim`，未提供按项目自动配色或项目组分割线的选项。`rows_by_agent` 按 `codex`、`claude` 等 agent 类型覆盖布局，不按项目区分。这些布局只影响展开的桌面侧栏，折叠和移动端保留紧凑布局。[Herdr 侧栏配置说明](https://herdr.dev/docs/configuration/#sidebar-row-layouts)

## 新增快捷键与操作逻辑

这里的 `type = "shell"` 在后台运行脚本。Windows 的自定义命令经过 `cmd.exe /d /c`，因此配置字符串中的 `%APPDATA%` 是有意使用的 CMD 环境变量语法；脚本本体由 `pwsh.exe` 执行。[Herdr 配置说明](https://herdr.dev/docs/configuration/#terminal-defaults)

默认先按 `Ctrl+B`，松开，再按下表中的键。如果修改过前缀，请使用自己的配置。

| 后续按键 | 当前行为 | 来源 |
| --- | --- | --- |
| `←` / `→` | 切换前一个 / 后一个标签页 | 自定义映射 |
| `↑` / `↓` | 切换前一个 / 后一个 Agent | 自定义映射 |
| `h` / `j` / `k` / `l` | 切换左 / 下 / 上 / 右 pane 焦点 | 内置 |
| `v` | 新建左右分屏 | 内置 |
| `-` | 新建上下分屏 | 内置 |
| `m` | 将当前 pane 移到前一标签页右侧 | 自定义脚本 |
| `t` | 将当前 pane 移出为独立标签页 | 自定义脚本 |
| `f` | 关注或取消关注当前 Agent，已关注摘要前显示 `★` | `smartskill.spinner` 插件 |
| `g` | 切换全部展开或按关注折叠，保留关注列表 | `smartskill.spinner` 插件 |

### F/G：关注与展开分开控制

F 只修改当前会话的关注标记，G 只切换列表视图。先选中一个 Agent，再按快捷键；普通终端没有 Agent 时，F 会提示错误。

| 当前视图 | 按 F | 按 G |
| --- | --- | --- |
| 全部展开 | 加入或取消 `★`，所有会话仍为三行 | 已关注项保留三行，其余压成一行 |
| 按关注折叠 | 加入关注后展开当前项；取消关注后收起当前项 | 所有会话展开为三行，关注标记保留 |

例如有 10 个会话，只需要处理其中 3 个：按 G 切到全部展开，依次选中这 3 个会话并按 F 加星，再按 G 收起其余 7 个。之后可随时用 G 展开查看，再按 G 回到原来的关注布局，无需重新选择。

关注列表和展开状态会保存，重启插件后保留。新会话默认未关注；关注列表为空时，按关注折叠会把所有条目压成一行。折叠只减少显示内容，不关闭、暂停或移动会话，也不置顶或改变排序。

启用 [插件及关注布局](spinner/README.md#关注布局) 后，将以下绑定合并到 `config.toml`；已有 F/G 绑定时替换原条目：

```toml
[[keys.command]]
key = "prefix+f"
type = "plugin_action"
command = "smartskill.spinner.toggle-attention"
description = "切换当前会话关注"

[[keys.command]]
key = "prefix+g"
type = "plugin_action"
command = "smartskill.spinner.toggle-view"
description = "切换全部展开或按关注折叠"
```

### M/T：合并与拆出已有会话

`v` 和 `-` 创建新终端。合并两个已经运行的会话使用 `m`。

```text
原来：标签 A ｜ 标签 B（当前）
在 B 按 m：标签 A 内 [ A ｜ B ]，焦点随 B 移动
选中 B 按 t：B 成为独立标签页，恢复保存的名称
```

脚本只移动当前 pane。源标签页有其他 pane 时，它们留在原处。处于第一个标签页时，`m` 提示“左侧没有标签页”，不移动。

合并前，若源标签页只有一个 pane，脚本把原标签名保存到 `pane.label`；拆出时优先使用这个名称。此前已经丢失的名称需要手动恢复；合并后对整个标签页的新命名也不会自动回写到各个 pane 的已保存名称。

## 自动更新的边界

### 会话识别、agent 名与 pane 名

这三项有不同用途：

- 官方 integration 的现有脚本通过 `pane report-agent-session` 上报原生会话标识，本身不生成任务摘要，也不重命名 agent。该 API 不上报生命周期状态。[Herdr CLI 说明](https://herdr.dev/docs/cli-reference/#panes)
- 自定义命名 hook 更新 agent 名，供侧栏和 pane 边框显示模型信息。
- `pane.label` 在当前移动脚本中还承担保存原标签名的用途。不要把它与 agent 名、标签页名称视为同一个字段。

文档核对时使用 Codex integration v8、Claude integration v9。安装后以 `herdr integration status` 的结果为准。

| CLI | 自定义命名事件 | 名称来源与实际行为 |
| --- | --- | --- |
| Codex | `SessionStart`，包括 startup / resume | 从 hook payload 获取模型，effort 可从 Codex 配置补充；保留模型层级并组合 pane 后缀。当前配置没有按每轮刷新，也没有保证会话中切换模型后立即刷新 |
| Claude Code | `UserPromptSubmit`、`Stop` | 从当前 transcript 最近的 assistant 消息获取模型，从 `settings.json` 读取 `effortLevel`；首轮没有模型记录时跳过，切换模型后可能到本轮 Stop 才纠正 |

自定义 hook 均以 `command` 类型注册，timeout 为 10 秒。下面的 JSON 只包含自定义 hook，合并到已有配置，保留官方 SessionStart integration 和其他 hooks；同一事件已有数组时追加条目。将 `YOUR_USER` 替换为实际用户名，或使用脚本安装位置的完整绝对路径。

Codex：合并到 `%USERPROFILE%\.codex\hooks.json`。

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "pwsh -NoProfile -File \"C:\\Users\\YOUR_USER\\.codex\\hooks\\herdr-agent-name.ps1\"",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

Claude Code：合并到 `%USERPROFILE%\.claude\settings.json`。

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "pwsh -NoProfile -ExecutionPolicy Bypass -File \"C:\\Users\\YOUR_USER\\.claude\\hooks\\herdr-agent-name.ps1\"",
            "timeout": 10
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "pwsh -NoProfile -ExecutionPolicy Bypass -File \"C:\\Users\\YOUR_USER\\.claude\\hooks\\herdr-agent-name.ps1\"",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

### 标签页结论与移动后的 ID

标签页的一句中文结论由模型在有新结论时更新。它不是上述命名 hook 自动生成的内容。

pane 移动后，进程继承的 `HERDR_TAB_ID` 仍可能指向旧标签页。应使用 `pane current --current` 取得当前 `tab_id`，不要把启动时的标签 ID 当作实时位置。当前 pane 的解析方式和跨工作区移动行为见 [Herdr CLI 说明](https://herdr.dev/docs/cli-reference/#panes)。

将下列行为片段合并到实际生效的 `AGENTS.md` 或 `CLAUDE.md`。

```markdown
## Herdr

- agent 名由已安装的 CLI hook 维护，不手动重复命名。
- 处于 Herdr 中且本轮产生实质性新结论时，在最终回复前将当前标签页改为一句中文结论（≤20字）；纯闲聊或无新结论时跳过。
- 通过 HERDR_BIN_PATH 调用本机 CLI；用 pane current --current 取得当前标签页，避免 pane 移动后仍使用旧的 HERDR_TAB_ID。
- 确认标题更新后丢弃成功 JSON，不单独播报改名；失败时保留错误信息并说明。
```

## 一次性设置与迁移顺序

1. 备份现有 Herdr 配置、CLI hooks 配置、行为规则和三个自定义脚本。
2. 新机器先安装 Herdr 的 Codex / Claude integration。现有机器若 `integration status` 已显示 `current`，不必重新安装。
3. 按“文件位置与归属”表复制本目录的三个脚本，两个命名脚本在各自目标目录中改名为 `herdr-agent-name.ps1`；按各 CLI 的事件追加命名 hook。
4. 合并 Herdr UI 和快捷键配置。只把上一节的短行为片段放入实际生效的 `AGENTS.md` / `CLAUDE.md`。
5. 执行配置重载，再按下一节验收。修改 CLI hooks 后，在新会话中检查是否已加载。

新机器的官方 integration 安装命令如下；它们会写入对应 CLI 配置，不属于只读检查：

```powershell
& $env:HERDR_BIN_PATH integration install codex
& $env:HERDR_BIN_PATH integration install claude
```

先检查配置，通过后再重载：

```powershell
& $env:HERDR_BIN_PATH config check
if ($LASTEXITCODE -ne 0) { throw 'Herdr config check failed' }
& $env:HERDR_BIN_PATH server reload-config
```

检查响应中的状态与诊断信息。多数 UI 配置可以重载生效，无需重建已有 pane；启动时读取的设置另按其要求处理。[Herdr 重载说明](https://herdr.dev/docs/configuration/#reload-config)

## 验收与排查

发布时核对了脚本与现用版本的一致性。`-SelfTest` 不执行改名或移动；它不能替代真实快捷键的合并与拆出验收。

| 项目 | 验收方式 | 预期 |
| --- | --- | --- |
| 官方 integration | `herdr integration status` | Codex / Claude 显示 `current` |
| Agents 面板 | 展开桌面侧栏，检查项目名、总结和模型名 | 三行显示，无额外空行；配色与示例一致，模型名独占一行 |
| 自定义按键 | 在 Herdr 按 `Ctrl+B → ?` 查看，再使用方向键切换 | 绑定与本文表格一致 |
| 移动脚本内部检查 | 运行下面的 `-SelfTest` | `PASS: tab order, first tab, missing tab` |
| Codex 命名 | 运行下面的 `-SelfTest` | 显示计算出的名称及检查结果，不执行改名 |
| Claude 命名 | 在有 Claude 会话记录的项目目录运行 `-SelfTest` | 显示模型与名称；没有模型记录时说明跳过 |
| 合并与拆出 | 用两个可用于验证的会话执行 `m → t` | 终端会话保留，中文及带引号的原名称保留 |
| 关注与折叠 | 全部展开时按 F，再按 G 两次 | F 只改变星标；G 往返后关注列表保留 |
| 插件内部检查 | `node herdr/spinner/spinner.test.js` | `PASS`，包含 F/G 状态分离与旧状态格式读取 |

```powershell
pwsh -NoProfile -File "$env:APPDATA\herdr\merge-left.ps1" -SelfTest
pwsh -NoProfile -File "$env:USERPROFILE\.codex\hooks\herdr-agent-name.ps1" -SelfTest -InputJson '{}'
pwsh -NoProfile -File "$env:USERPROFILE\.claude\hooks\herdr-agent-name.ps1" -SelfTest
```

`merge-left.ps1 -DryRun` 也不移动 pane，但需要快捷键注入的 `HERDR_ACTIVE_WORKSPACE_ID`、`HERDR_ACTIVE_TAB_ID`、`HERDR_ACTIVE_PANE_ID`。普通 shell 不一定具有这些变量，不能把缺少快捷键上下文误判为移动功能损坏。

已确认的故障边界：

- **后台中文 JSON 解码**：快捷键脚本曾继承代码页 936，错误解码 Herdr 的 UTF-8 JSON。修复已写在 `merge-left.ps1` 内，Claude 命名 hook 也显式按 UTF-8 读取 stdin。这类修复留在实际读取数据的脚本中，无需让每条 agent 命令重复初始化编码。
- **启动命令引号**：快捷键实际经过 CMD 和 PowerShell 两层。当前配置使用 `-File` 调用脚本，验收需覆盖真实快捷键路径，单独在 PowerShell 中调用成功不等于后台绑定可用。
- **标签 ID 过期**：移动后可能出现 `tab_not_found`，用当前 pane 的实时位置更新标题。
- **名称已丢失**：新版本脚本可以保留之后的往返名称，无法推回此前已丢失的名称。
- **沙箱权限**：agent 沙箱中可能出现命令不可见或 Herdr 访问被拒绝。使用 `HERDR_BIN_PATH` 定位；确需用户环境时走工具审批流程。

快捷键错误日志分别为 `%APPDATA%\herdr\merge-left-error.log` 和 `%APPDATA%\herdr\detach-tab-error.log`，当前绑定每次覆盖对应日志。

后续修改保持这三个自定义脚本与其注册关系一致；官方 integration 文件由 Herdr 维护，通用 PowerShell 知识不继续堆入行为规则。
