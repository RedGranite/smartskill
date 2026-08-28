---
name: before-build
description: 实现前关卡。设计或 brainstorm 已定、准备脚手架、demo、新项目、新子系统、首次写代码、进入实现阶段时使用；按八个工程维度逐一判断并写出「建设前判断记录」，经用户确认后才动手。
license: MIT
metadata:
  category: coding
  version: "0.1"
---
# before-build：动手前的判断关卡

## 何时用
设计已定、代码还没写：新项目脚手架、demo、新子系统、大功能首次实现。实现中途遇到具体问题时直接用对应维度 skill。

## 硬规则
- MUST 写第一行实现代码前完成判断记录并交用户确认。
- MUST 八个维度逐一给结论，每条三态之一：`适用（证据）`、`不适用（一句理由）`、`待定（谁回答什么）`。
- NEVER 写"已考虑""无明显问题"这类无证据结论。
- MUST 判断记录含 MVP 边界与验证计划（见 minimal-viable）。
- MUST 判断记录写入 spec 末尾或 `docs/pre-build.md`；后续实现以它为约束，偏离时先改记录。
- NEVER 因维度 skill 未安装而跳过该维度；按下表核心问题作答。

## 审问清单
| 维度 | 核心问题 | 细则 skill |
|---|---|---|
| 自研边界 | 哪部分是 commodity、哪部分是 core differentiation？官方 SDK / 库 / 成品查过没？ | build-vs-buy |
| 复用 | 已有哪些定义可复用？新定义是否重复？做接口还是一次性方法？ | ssot-reuse |
| 并发 | 会并发跑吗？同一状态会被多 request / webhook / worker 同时改吗？竞态怎么建模？ | concurrency-modeling |
| 工程评审 | 异常路径？组件间状态一致？可观测？tech debt 在哪、谁维护？ | engineering-review |
| spec | 接口、状态、critical path、非目标写清了吗？ | spec-first |
| 守卫 | 哪些规则应确定化：lint、CI、e2e、状态机约束？ | guardrails |
| MVP | 边界在哪？edge case 与复杂度如何取舍？验证做哪几项？ | minimal-viable |
| 平台 | Windows 会话？PowerShell 语法与 UTF-8 已预设？ | powershell-utf8 |

## 反模式
- 错误：brainstorm 完直接起项目，并发问题上线后暴露。→ 正确：先答"同一订单状态会被支付回调和用户操作同时改吗"，答"会"就先定状态机。
- 错误：判断记录写"并发：已考虑，暂不处理"。→ 正确："并发：不适用——单进程 CLI，无共享状态"或"待定——需产品确认是否多设备同时登录"。
- 错误：八个维度全写"适用"，堆一页分析。→ 正确：不适用的一句带过，适用的给证据与决策。

## 输出要求
判断记录格式固定：
```
## 建设前判断记录（YYYY-MM-DD）
| 维度 | 结论 | 证据 / 理由 |
|---|---|---|
| 自研边界 | 适用 | 支付用 Stripe SDK；核心是分账规则引擎，自研 |
| 复用 | 不适用 | 新仓库，无既有定义 |
| ... | ... | ... |
### 决策
1. 订单状态用状态机，转移表见 spec §x
### MVP 边界
做：…；不做：…
### 验证计划
1. e2e：下单 → 支付回调 → 状态 paid，跑一次
```
末尾一句：`请确认以上判断，确认后进入实现。`
