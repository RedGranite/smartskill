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
- MUST 用 PowerShell 7 语法：命令链 `;` 或 `&&`；变量 `$x`；子表达式 `$(...)`；插值 `"$($obj.Prop)"`。
- NEVER 混入 bash：`export`、`[ -f x ]`、`for x in *`、backtick 命令替换、`2>/dev/null`（用 `2>$null`）。
- MUST 含空格路径加引号；调用含空格路径的 exe 用 `& "path" args`。
- MUST 多行字符串用 here-string `@'...'@`（字面）或 `@"..."@`（插值），结束符顶格。
- MUST 写文件指定 `-Encoding utf8NoBOM`；Windows PowerShell 5 用 `[IO.File]::WriteAllText(path, text, (New-Object Text.UTF8Encoding $false))`。
- MUST Python 子进程设 `PYTHONIOENCODING=utf-8`；git 设 `core.quotepath false`。
- NEVER 对已存在文件用 `New-Item -Force`（会清空）。

## 审问清单
1. 当前是 pwsh 7 还是 Windows PowerShell 5？（`$PSVersionTable.PSVersion`）
2. 编码预设执行了吗？
3. 这条命令里有 bash 语法吗？
4. 输出含中文吗？管道另一端（python / node / git）的编码设了吗？
5. 写文件时给编码参数了吗？

## 反模式
- 错误：`export FOO=1 && python x.py`。→ 正确：`$env:FOO='1'; python x.py`。
- 错误：`echo "中文" > out.txt`（PowerShell 5 写成 UTF-16）。→ 正确：`"中文" | Set-Content out.txt -Encoding utf8NoBOM`。
- 错误：python 打印中文报 `UnicodeEncodeError: 'gbk'`。→ 正确：先 `$env:PYTHONIOENCODING='utf-8'`。

## 输出要求
会话首条命令：
```powershell
$u=[Text.Encoding]::UTF8; [Console]::OutputEncoding=$u; [Console]::InputEncoding=$u; $OutputEncoding=$u; $env:PYTHONIOENCODING='utf-8'; chcp 65001 | Out-Null
```
