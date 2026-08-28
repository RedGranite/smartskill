---
name: concurrency-modeling
description: 并发与竞态建模。写状态更新、token refresh、订单或任务状态流转、webhook 处理、定时任务、多 worker 队列、缓存刷新时使用；遇 race condition 用状态机、幂等键、event-driven 重新建模，禁止用 retry、fallback、try/catch 掩盖。
license: MIT
metadata:
  category: coding
  version: "0.1"
---
# concurrency-modeling：先问会不会同时发生

## 何时用
任何"读 - 改 - 写"共享状态的代码；任何可能被多个触发源（请求、回调、定时器、worker）执行的逻辑。

## 硬规则
- MUST 写状态更新前回答：这段逻辑会被几个触发源同时执行？共享状态存在哪？
- NEVER 用 retry、fallback、try/catch、sleep 掩盖竞态；它们改变概率，不改变正确性。
- MUST 竞态用建模解决，三选一或组合：状态机（合法转移表 + 原子 compare-and-set）、幂等键（同一操作重复执行结果不变）、event-driven（单一消费者串行处理）。
- MUST 外部回调（webhook、支付通知）按"至少一次投递"设计，必须幂等。
- MUST 共享凭证刷新（token refresh）由单一持有者执行，其他等待者复用结果。
- NEVER 依赖"这个操作很快，不会撞上"。
- MUST 状态转移表或幂等键定义写进设计文档，不只在代码里。

## 审问清单
1. 会在并发环境跑吗（多进程、多线程、多实例、serverless）？
2. 这个状态更新会被多个 request 或 webhook 同时触发吗？
3. 这个 token refresh 会被多个 worker 同时执行吗？
4. 两个触发源交错执行，终态是哪个？都是合法状态吗？
5. 同一事件投递两次，结果相同吗？
6. 靠什么保证原子性：唯一约束、乐观锁版本号、CAS、单消费者？
7. 转移表里有没有"从任意状态到 X"的漏洞？
8. 出错后卡在中间态怎么恢复？谁负责？

## 反模式
- 错误：`if order.status == 'pending': order.status = 'paid'; save()`，回调重放导致重复发货。→ 正确：`UPDATE orders SET status='paid' WHERE id=? AND status='pending'`，受影响行数为 0 则忽略；回调按 `event_id` 唯一约束去重。
- 错误：token 过期时每个 worker 各自刷新，互相覆盖，随机 401。→ 正确：刷新走单一锁持有者，其他 worker 等待并读取新 token；轮换时旧 token 立即失效。
- 错误：竞态偶发失败，加 `retry(3)` 与 `except: pass`。→ 正确：找到共享状态，加唯一约束或状态机，让第二次执行确定性地成为 no-op。

## 输出要求
回复必须包含：触发源列表、共享状态位置、选用的建模方式、状态转移表或幂等键定义。
