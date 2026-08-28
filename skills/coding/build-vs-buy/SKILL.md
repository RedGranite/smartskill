---
name: build-vs-buy
description: 自研边界判断。动手写任何通用能力（认证、支付、队列、解析、爬虫、格式转换、UI 组件）前使用；先查官方 SDK、成熟库、可直接购买的产品，区分 commodity 与 core differentiation，压缩自研范围，少造轮子。
license: MIT
metadata:
  category: coding
  version: "0.1"
---
# build-vs-buy：少造轮子

## 何时用
需求或需求的一部分看起来"别人也需要"时。

## 硬规则
- MUST 写代码前查三层：官方 SDK → 成熟开源库 → 可购买的产品。每层写一行查到什么。
- MUST 需求涉及让 agent 调用某个成熟产品时，先查该产品是否已提供官方 MCP server；有则直接接入，不自写工具封装其 API。
- MUST 把需求拆成 commodity（别人做得比我们好）与 core differentiation（我们存在的理由），只对后者自研。
- NEVER 因"库太重""想自己控制"重写成熟实现，除非给出可测量理由（体积、许可证、缺失功能）。
- MUST 自研范围写成一句边界："只做 X，Y 与 Z 用 __"。
- NEVER 为未来可能的替换提前抽象适配层；直接用库的接口。

## 审问清单
1. 有官方 SDK 吗？版本、语言支持？
2. 开源库：最近提交、许可证、覆盖我们的需求几成？
3. 有可直接买的产品吗？价格与自研人天比？它有官方 MCP server 吗？
4. 我们的 core differentiation 是什么？这个能力在其中吗？
5. 自研的话，一年后谁维护？
6. 库不够的部分能靠配置或薄包装解决吗？

## 反模式
- 错误：自写 JWT 签发与校验。→ 正确：用 jose / PyJWT 等主流库，自研只剩 claims 定义。
- 错误：自写 Markdown 解析器"因为只要几个功能"。→ 正确：用 markdown-it / mistune，禁用不需要的规则。
- 错误：为将来可能换数据库写 Repository 抽象层。→ 正确：直接用 ORM，真要换时再抽。
- 错误：让 agent 查 GitHub issue，自写一组调 REST API 的工具函数。→ 正确：接官方 GitHub MCP server。

## 输出要求
一张表：能力 | commodity / core | 方案（SDK / 库 / 产品 / 自研） | 依据一句。
