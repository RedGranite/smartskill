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
- MUST 会话第一条命令前执行编码预设（见输出要求）。
- MUST 先看 `$PSVersionTable`：PowerShell 5 无 `&&`、无 `utf8NoBOM`、`>` 重定向写 UTF-16；写文件改用 `[IO.File]::WriteAllText(path, text, (New-Object Text.UTF8Encoding $false))`。
- NEVER 混入 bash 语法（`export`、`[ -f ]`、backtick 命令替换、`2>/dev/null`）。
- MUST 给 python / git 子进程设编码：`PYTHONIOENCODING=utf-8`、`core.quotepath false`。
- NEVER 对已存在文件用 `New-Item -Force`（会清空）。

## 审问清单
1. 当前是 pwsh 7 还是 Windows PowerShell 5？
2. 编码预设执行了吗？
3. 这条命令里有 bash 语法吗？
4. 输出含中文吗？管道另一端（python / node / git）的编码设了吗？
5. 写文件时给编码参数了吗？here-string 结束符顶格了吗？

## 反模式
- 错误：`echo "中文" > out.txt`（PowerShell 5 写成 UTF-16）。→ 正确：`"中文" | Set-Content out.txt -Encoding utf8NoBOM`；PowerShell 5 用 `WriteAllText`。
- 错误：python 打印中文报 `UnicodeEncodeError: 'gbk'`。→ 正确：先 `$env:PYTHONIOENCODING='utf-8'`。

## 输出要求
会话首条命令：
```powershell
$u=[Text.Encoding]::UTF8; [Console]::OutputEncoding=$u; [Console]::InputEncoding=$u; $OutputEncoding=$u; $env:PYTHONIOENCODING='utf-8'; chcp 65001 | Out-Null
```
