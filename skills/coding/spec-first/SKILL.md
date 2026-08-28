---
name: spec-first
description: 先写 spec 再写代码。开新功能、新模块、新接口，或用户要求 production quality、系统性思考时使用；spec 必须写清接口、状态、critical path、非目标；写法遵循 doc-writing。
license: MIT
metadata:
  category: coding
  version: "0.1"
---
# spec-first：写清楚再动手

## 何时用
改动涉及接口或状态、或会被别人依赖时。文件数不是触发条件。

## 硬规则
- MUST spec 至多六节：目标一句、非目标、接口（输入 / 输出 / 错误）、状态与转移、critical path、验证方式。不适用的节直接省略，不写"无"；一节一句话即可。
- MUST critical path 单独列出：从入口到核心结果必经的步骤，每步失败的后果。
- NEVER 在 spec 写实现细节（循环、变量名）；写契约与结构。
- MUST 非目标明确列出。
- MUST spec 与代码不一致时先改 spec。
- 写法见 doc-writing。

## 审问清单
1. 没读过代码的人能从 spec 知道它对外是什么样吗？
2. 每个接口的错误情况写了吗？
3. 状态有几个？合法转移列出来了吗？
4. critical path 上哪一步最脆弱？
5. 哪些明确不做？
6. 怎么证明做完了？

## 反模式
- 错误：spec 是需求原文加"技术上用 X 实现"。→ 正确：接口签名、状态表、非目标、验证清单。
- 错误：spec 三十页，把每个函数怎么写都定了。→ 正确：契约与结构，实现留给代码。

## 输出要求
spec 按需取六节：目标 / 非目标 / 接口 / 状态 / critical path / 验证，长度随 MVP 边界。
