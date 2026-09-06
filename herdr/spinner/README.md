# Windows Agent Spinner

本文说明如何运行、验证和停用 Windows 版 Herdr 工作状态动画。基于 [hasuwini77/herdr-spinner](https://github.com/hasuwini77/herdr-spinner) 的 MIT 实现适配，沿用其盲文环形帧及 display-only metadata 方案。

## 契约与边界

- 目标：在 Agents 面板的项目名前增加 `⣾ ⣽ ⣻ ⢿ ⡿ ⣟ ⣯ ⣷` 动画，仅 `working` 时显示；保留原生状态圆点、配色及三行布局。
- 输入：Herdr 注入的 `HERDR_SOCKET_PATH`、`HERDR_PLUGIN_CONFIG_DIR` 和 `HERDR_PLUGIN_STATE_DIR`；需要 Windows 和 Node.js，无 npm 依赖。直接通过 Windows named pipe 发送 Herdr 官方 JSON API 请求。
- 输出：只上报来源 `smartskill.spinner` 的 `$spin` metadata，TTL 为 2 秒；不改 agent 名、工作状态、标题或终端内容。
- 状态：每秒读取一次真实状态；进入 `working` 开始旋转，离开则清除。读取或更新失败时记录错误并退出，残余图标由 TTL 清除。
- 并发：startup 和手动 start 都可能触发启动；以 Windows 用户及 Herdr socket 路径生成专属 named pipe，同一会话只允许一个持有者。重复 start 为 no-op；stop 请求让持有者清理后释放管道。动画帧和状态刷新串行执行。
- Critical path：取得单实例管道 → 获取状态 → 上报帧 → 等待下一帧。任何 API 失败均停止，避免持续使用旧状态；pane 已关闭时丢弃该 pane 的更新。
- 非目标：不修改 Herdr 二进制，不替换原生状态检测，不添加主题选择、自动重试或跨平台支持。

## 使用

在 Herdr 内从仓库根目录运行：

```powershell
herdr plugin link ./herdr/spinner --enabled
herdr plugin action invoke start --plugin smartskill.spinner
herdr plugin action invoke status --plugin smartskill.spinner
herdr plugin action invoke stop --plugin smartskill.spinner
```

将 `{ token = "$spin", fg = "#89b4fa", bold = true, dim = false }` 加到 `[ui.sidebar.agents]` 第一行的 `state_icon` 后、`workspace` 前。`herdr config check` 通过后执行 `herdr server reload-config`。

默认帧间隔 250 ms，状态轮询间隔 1 秒；每个工作 pane 每帧发送一次 API 请求，实际帧率受调用耗时影响。可在插件配置目录的 `config.json` 设置 `{"intervalMs": 500}` 降低开销，允许 250–1000 ms，修改后 stop/start 生效。退出 Herdr 后下一次状态读取失败会结束动画进程；开启的插件在下次 Herdr 服务启动时自动启动。禁用插件前先执行 stop。

日志追加写入插件状态目录的 `spinner.log`，start/status 输出进程标识。后台子进程均隐藏窗口。停止失败或异常退出时，显示 metadata 最迟在最后一次更新后约 2 秒过期；原生状态圆点继续显示。

Windows 管道地址按当前 Herdr 使用的 `interprocess::GenericNamespaced` 规则，在 `HERDR_SOCKET_PATH` 前加 `\\.\pipe\`。已核对 [Herdr b1ff4582e968 的 ipc.rs](https://github.com/herdrdev/herdr/blob/b1ff4582e968/src/ipc.rs)；版本升级若改变地址映射，连接失败会记录日志并退出。

## 结构与验证

`spinner.js` 包含动画状态处理与 Windows 启停；理解状态刷新失败后的退出和单实例管道，有助于修改后保持状态一致。`herdr-plugin.toml` 注册启动钩子及 start/stop/status 动作。

```powershell
node herdr/spinner/spinner.test.js
```

预期显示 `PASS`，覆盖工作帧推进、非工作状态清除、API 失败后不再发送帧、配置边界，以及管道响应分片和异常断开。

2026-09-06 在上述 Herdr 版本完成实测：重复 start 返回 `already-running`；stop 清除当前 pane 的 `spin`；通过插件动作再次启动后，工作 pane 恢复更新 `⣾` 环形帧。单个工作 pane、约 9 秒采样中，动画 Node 进程约占单核 0.18% CPU；该数值不包含 Herdr 服务及界面的开销，也不代表长期或多 pane 场景。
