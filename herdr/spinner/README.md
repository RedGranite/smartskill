# Windows Agent Spinner

本文说明如何运行、验证和停用 Windows 版 Herdr 工作状态动画。基于 [hasuwini77/herdr-spinner](https://github.com/hasuwini77/herdr-spinner) 的 MIT 实现适配，沿用其盲文环形帧及 display-only metadata 方案。

## 契约与边界

- 目标：在 Agents 面板的项目名前用单个状态位置替换原生圆点。`working` 显示黄色 `⣾ ⣽ ⣻ ⢿ ⡿ ⣟ ⣯ ⣷` 动画；`blocked` 为闪烁红点、`done` 为绿色 `OK`、`idle` 为灰色空心圆、`unknown` 为灰色小点。保留三行布局。
- 输入：Herdr 注入的 `HERDR_SOCKET_PATH`、`HERDR_PLUGIN_CONFIG_DIR` 和 `HERDR_PLUGIN_STATE_DIR`；需要 Windows 和 Node.js，无 npm 依赖。直接通过 Windows named pipe 发送 Herdr 官方 JSON API 请求。
- 输出：上报来源 `smartskill.spinner` 的状态及关注布局 metadata，TTL 为 2 秒；每次原子更新只保留一个状态标记。不改 agent 名、工作状态、标题或终端内容。
- 状态：每秒读取一次真实状态；进入 `working` 旋转，进入 `blocked` 闪烁，其他状态显示静态标记。读取或更新失败时记录错误并退出，残余图标由 TTL 清除。
- 并发：startup 和手动 start 都可能触发启动；以 Windows 用户及 Herdr socket 路径生成专属 named pipe，同一会话只允许一个持有者。重复 start 为 no-op；stop 请求让持有者清理后释放管道。动画帧和状态刷新串行执行。
- Critical path：取得单实例管道 → 获取状态 → 上报帧 → 等待下一帧。任何 API 失败均停止，避免持续使用旧状态；pane 已关闭时丢弃该 pane 的更新。
- 非目标：不修改 Herdr 二进制，不替换原生状态检测，不添加主题选择、自动重试或跨平台支持。

## 使用

### 关注布局

快捷键、视图切换和使用示例见 [新增快捷键与操作逻辑](../README.md#新增快捷键与操作逻辑)。`toggle-attention` 切换关注，`toggle-view` 切换视图；另保留 `expand-all` 命令供脚本单向展开，同时保留关注列表。

安装并启动插件后，用以下内容替换 `[ui.sidebar.agents]`，再添加主 README 中的 F/G 绑定。全部展开时每项三行；按关注折叠时，已关注项保留三行和动画，其他项只有一行静态状态、项目名及摘要。内置 `workspace` 始终保留，插件退出后仍可找到会话。

```toml
[ui.sidebar.agents]
row_gap = 0
rows = [
  [
    { token = "$spin", fg = "#e5b567", bold = true, dim = false },
    { token = "$spin_blocked", fg = "#f38ba8", dim = false },
    { token = "$spin_done", fg = "#a6e3a1", dim = false },
    { token = "$spin_idle", fg = "#7c828c", dim = false },
    { token = "$spin_unknown", fg = "#7c828c", dim = false },
    { token = "$parked_state", fg = "#7c828c" },
    { token = "workspace", fg = "#7c828c" },
    { token = "$parked_summary", fg = "#7c828c" },
  ],
  [{ token = "$focus_summary", fg = "#b8bdc7", bold = true, dim = false }],
  [{ token = "$focus_agent", fg = "#7c828c", bold = false, dim = false }],
]
```

状态文件按 Herdr socket 分开保存在插件状态目录，包含关注列表 `panes` 与视图开关 `expanded`。旧数组文件保留原关注列表并按关注折叠；旧 `null` 文件表示全部展开、关注列表为空。

快捷键和插件动作都是触发源，关注集合只由后台循环串行修改；先原子替换状态文件，再更新内存并重新读取布局。动画帧与这些操作共用一个消费者。状态写入或 API 失败时进程退出并清理 metadata，调用失败可查插件日志；恢复原始布局需把第二、三行换回内置 `tab`、`agent`。

### 启停

在 Herdr 内从仓库根目录运行：

```powershell
herdr plugin link ./herdr/spinner --enabled
herdr plugin action invoke start --plugin smartskill.spinner
herdr plugin action invoke status --plugin smartskill.spinner
herdr plugin action invoke stop --plugin smartskill.spinner
```

在 `[ui.sidebar.agents]` 第一行用下面这些 token **替换** `state_icon`，放在 `workspace` 前。每个 pane 同时只有一个 token 有值，Herdr 自动跳过其他空 token，不为它们占位。

```toml
{ token = "$spin", fg = "#e5b567", bold = true, dim = false },
{ token = "$spin_blocked", fg = "#f38ba8", dim = false },
{ token = "$spin_done", fg = "#a6e3a1", dim = false },
{ token = "$spin_idle", fg = "#7c828c", dim = false },
{ token = "$spin_unknown", fg = "#7c828c", dim = false },
```

`herdr config check` 通过后执行 `herdr server reload-config`。

这些标记是普通文字和 Unicode 字符，颜色由 `fg` 设置。`OK` 占两格；红点熄灭时使用一格宽的盲文空白字符（U+2800），保持项目名位置。

默认帧间隔 250 ms，状态轮询间隔 1 秒；每个工作或等待处理的 pane 每帧发送一次 API 请求，实际帧率受调用耗时影响。红点每两帧切换亮灭，默认亮、灭各约 500 ms。可在插件配置目录的 `config.json` 设置 `{"intervalMs": 500}` 降低开销，允许 250–1000 ms，动画和闪烁会随之变慢，修改后 stop/start 生效。退出 Herdr 后下一次状态读取失败会结束动画进程；开启的插件在下次 Herdr 服务启动时自动启动。禁用插件前先执行 stop。

日志追加写入插件状态目录的 `spinner.log`，start/status 输出进程标识。后台子进程均隐藏窗口。停止失败或异常退出时，显示 metadata 最迟在最后一次更新后约 2 秒过期，状态位置会消失，避免留下过期状态。彻底停用插件时，将上述五个 token 换回 `"state_icon"` 并重载配置。

Windows 管道地址按当前 Herdr 使用的 `interprocess::GenericNamespaced` 规则，在 `HERDR_SOCKET_PATH` 前加 `\\.\pipe\`。已核对 [Herdr b1ff4582e968 的 ipc.rs](https://github.com/herdrdev/herdr/blob/b1ff4582e968/src/ipc.rs)；版本升级若改变地址映射，连接失败会记录日志并退出。

## 结构与验证

`spinner.js` 包含动画状态处理与 Windows 启停；理解状态刷新失败后的退出和单实例管道，有助于修改后保持状态一致。`herdr-plugin.toml` 注册启动钩子、启停和关注视图动作。

```powershell
node herdr/spinner/spinner.test.js
```

预期显示 `PASS`，覆盖 F/G 状态分离、关注布局切换、旧状态格式读取、工作帧推进、红点亮灭、绿色 `OK`、状态切换清理、单位置互斥、API 失败后不再发送帧、配置边界，以及管道响应分片和异常断开。

2026-09-06 在上述 Herdr 版本完成启停实测：重复 start 返回 `already-running`；stop 清除显示 token；通过插件动作再次启动后，工作 pane 恢复更新 `⣾` 环形帧。

2026-09-07 完成关注布局实测：G/F 独立切换，往返操作后原关注集合和视图保留。
