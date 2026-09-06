---
name: powershell-utf8
description: 排查 Windows PowerShell 中已出现的乱码、编码异常或文本兼容问题。常规 Windows 命令不触发。
license: MIT
metadata:
  category: coding
  version: "0.1"
---
# powershell-utf8：编码问题排查

仅处理已经出现的编码问题，不执行固定巡检或统一初始化。

- 只调整已确认不匹配的输入输出环节，保留文件和程序已有的编码约定。
- 保留显式的 `PYTHONIOENCODING` 及其错误处理策略，例如 `utf-8:surrogateescape`。
- Python 的 `-X utf8` 也会改变未指定编码的 `open()` 默认行为；仅需调整标准流时，考虑作用范围更小的 `PYTHONIOENCODING`。
