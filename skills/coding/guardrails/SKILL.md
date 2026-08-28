---
name: guardrails
description: 把规则确定化。建 CI、定代码规范、补测试、同类错误反复出现时使用；优先 lint rules、deterministic rules、状态机约束、e2e tests、CI checks 等机器可执行的守卫，而非口头约定或 review 人工把关。
license: MIT
metadata:
  category: coding
  version: "0.1"
---
# guardrails：能机器判的不靠人

## 何时用
同类错误出现第二次；定规范；建仓库 CI。

## 硬规则
- MUST 每条规范先问"能否机器判定"：能则写成 lint rule / 类型约束 / schema / CI check，不写进文档让人记。
- MUST critical path 有 e2e test，至少能本地一条命令跑；有 CI 则必跑。
- MUST 环境可复现：依赖锁定版本，一条命令启动；密钥只走环境变量，`.env` 进 gitignore 且有 `.env.example`。
- MUST 状态机合法转移用代码约束（枚举 + 转移表 + 断言），非法转移直接抛错。
- MUST 确定性优先：同样输入同样输出；随机、时间、环境依赖注入化。
- NEVER 靠 code review 拦机器能拦的问题。
- NEVER 在 CI 放会偶尔失败的测试；flaky 就修或删。

## 审问清单
1. 这条规则违反时机器能发现吗？用什么工具？
2. critical path 的 e2e 在 CI 上跑了吗？多久？
3. 非法状态转移在哪一层被拦？
4. 这个测试确定吗？依赖时间 / 网络 / 顺序吗？
5. CI 失败时开发者一分钟内能看懂原因吗？

## 反模式
- 错误：README 写"请勿直接修改 status 字段"。→ 正确：status 只能经 `transition(from, to)` 改，其他写入被类型或 lint 拦。
- 错误：review 反复提醒"记得处理 None"。→ 正确：开 strict 类型检查，未处理直接失败。
- 错误：e2e 靠人记得手动跑。→ 正确：一条命令 `npm run e2e`；有 CI 则失败阻断合并。
- 错误：API key 写在代码里，`.env` 提交进仓库。→ 正确：代码只读 `process.env.KEY`，`.env` 在 gitignore，`.env.example` 列出需要哪些变量。

## 输出要求
守卫清单：规则 | 执行层（lint / 类型 / schema / test / CI） | 工具 | 状态（已有 / 待加）。
