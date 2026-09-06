---
name: powershell-utf8
description: Windows 下 PowerShell 7 语法与 UTF-8 中文编码预设。在 Windows 会话执行任何命令前使用；避免 bash 语法混入导致的解析错误，避免中文输出与文件写入乱码。
license: MIT
metadata:
  category: coding
  version: "0.1"
---
# powershell-utf8：Windows 会话预设

## 何时用
检测到 Windows（`$env:OS`、路径含盘符、shell 为 pwsh / powershell）时，第一条命令前。

## 硬规则
- MUST 首次执行命令时确认 PowerShell 版本与当前编码；已有宿主配置或检查结果可复用，只补当前命令需要且尚未满足的编码设置。不要给每条命令机械拼接完整预设。
- MUST 区分对话与 shell 进程：进程内变量和编码设置只在该进程及其子进程有效。工具每次启动新进程时，不得假定上一次设置仍然存在；持久 shell 内无需重复初始化。
- NEVER 覆盖已有的 `PYTHONIOENCODING`（有些宿主预设 `utf-8:surrogateescape`，改成 `utf-8` 是降级）。
- MUST 先看 `$PSVersionTable`：PowerShell 5 无 `&&`、无 `utf8NoBOM`、`>` 重定向写 UTF-16，写文件用 `[IO.File]::WriteAllText(path, text, (New-Object Text.UTF8Encoding $false))`；pwsh 7 写文件默认就是 UTF-8 无 BOM，不必指定编码。
- NEVER 混入 bash 语法（`export`、`[ -f ]`、backtick 命令替换、`2>/dev/null`）。
- Python 需要 UTF-8 且没有已有编码配置时，优先使用 `python -X utf8 ...` 或 `py -3.10 -X utf8 ...`；`PYTHONIOENCODING` 的显式设置仍优先，不覆盖它。
- Git 需要显示中文路径时，使用 `git -c core.quotepath=false ...`，不要为一次命令修改全局配置。
- 仅在涉及的标准流编码不匹配时设置 `[Console]::OutputEncoding`、`[Console]::InputEncoding` 或 `$OutputEncoding`；只有依赖控制台代码页的程序确有需要时才运行 `chcp 65001`。
- NEVER 对已存在文件用 `New-Item -Force`（会清空）。

## 审问清单
1. 当前是 pwsh 7 还是 Windows PowerShell 5？
2. 当前命令需要的编码已满足吗？依据来自宿主配置、同一进程，还是不会保留设置的上一次调用？
3. 这条命令里有 bash 语法吗？
4. 输出含中文吗？管道另一端（python / node / git）的编码设了吗？
5. PowerShell 5 写文件走 `WriteAllText` 了吗？here-string 结束符顶格了吗？

## 反模式
- 错误：`echo "中文" > out.txt`（PowerShell 5 写成 UTF-16）。→ 正确：`"中文" | Set-Content out.txt -Encoding utf8NoBOM`；PowerShell 5 用 `WriteAllText`。
- 错误：每条命令前重复完整编码预设，即使只是读取 UTF-8 文件。→ 正确：`Get-Content -LiteralPath '文件.md' -Encoding utf8`；仅补缺失的标准流设置。
- 错误：python 打印中文报 `UnicodeEncodeError: 'gbk'`，直接覆盖已有 `PYTHONIOENCODING`。→ 正确：无显式配置时用 `python -X utf8 ...`；已有配置时先确认其用途。

## 输出要求
无需单独播报编码初始化。没有可复用的环境信息时，在首次相关命令中检查：
```powershell
$PSVersionTable.PSVersion
[Console]::OutputEncoding.WebName
[Console]::InputEncoding.WebName
$OutputEncoding.WebName
$env:PYTHONIOENCODING
```

按检查结果补设置，不把检查或预设当作每条命令的固定前缀。例如运行 Python 校验：
```powershell
py -3.10 -X utf8 scripts/validate.py
```
