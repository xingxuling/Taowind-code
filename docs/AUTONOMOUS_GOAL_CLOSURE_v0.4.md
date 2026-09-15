# Taowind Code v0.4｜自主目标闭合循环

## 北极星裁决

DWAC-main(6) 对当前 Taowind Code v0.3 重新观察后，在以下候选中选择：

1. autonomous-goal-closure-loop
2. executable-rcl-authority-gate
3. browser-observation-gate
4. github-remote-provider
5. persistent-pty-runtime

最高分瓶颈为 `autonomous-goal-closure-loop`，模式为 `WHOLE_ARTIFACT`。原因是当前仍存在多个耦合的高压域，单次请求内的 `autoAdvance()` 不能代表持续自主开发。

## v0.4 的产品行为

用户建立一个 Mission 后，Mission 不依赖单次 HTTP 请求存在：

```text
结果目标
→ 持久 Mission
→ DWAC 子 Run
→ Semantic Repo Graph
→ 联邦候选 Changeset
→ Apply
→ Acceptance
→ bounded Repair
→ Git Delivery Evidence
→ 三路 Goal Closure Audit
→ 未闭合：生成 nextGoal，重新进入下一周期
→ 已闭合：GOAL_CLOSED
```

服务进程内有一个有界调度器，只自动推进 `ACTIVE` Mission；`WAITING_PROVIDER`、`WAITING_APPROVAL`、`BLOCKED` 不会被静默越权推进。

## 三路闭合审计

闭合审计由三种独立角色组成：

- Evidence Auditor：只承认硬验收和交付证据；
- Regression Auditor：主动寻找回归、未测试路径和假完成；
- Product Auditor：判断用户的结果目标是否真的实现，而不是只看代码是否发生变化。

只有审计票全部返回 `closed=true` 且每票置信度至少 0.75，同时当前 Run 的真实 Acceptance 已通过，Mission 才允许进入 `GOAL_CLOSED`。

模型审计不是现实证据，它只能在硬 Gate 已通过后判断“是否仍存在未闭合缺口”。

## Mission 状态机

```text
ACTIVE
├─ WAITING_PROVIDER
├─ WAITING_APPROVAL
├─ BLOCKED
├─ BUDGET_EXHAUSTED
├─ FAILED
└─ GOAL_CLOSED
```

每个 Mission 保存：

- rootGoal / nextGoal
- cycle / maxCycles / maxRepairs
- currentRunId
- cycles[]
- events[]
- evidence[]
- closure assessment
- blocker

所有状态写入 `runtime-data/missions/*.json`，采用临时文件 + rename 的本地原子写入。

## API

- `GET /api/agent/missions`
- `POST /api/agent/missions`
- `GET /api/agent/missions/:id`
- `POST /api/agent/missions/:id/tick`
- `POST /api/agent/missions/:id/run`
- `POST /api/agent/missions/:id/resume`

## UX

主输入默认建立 Autonomous Mission；仍保留“单轮”入口。右侧新增 Mission 状态、周期、当前 nextGoal、阻断原因、恢复和立即推进一轮控制。

## 安全与不妥协边界

- `read_only` 下若生成 changeset，Mission 停在 `WAITING_APPROVAL`。
- Repair 预算耗尽后进入 `BLOCKED`，不无限自旋。
- 最大循环数默认 8，可配置但有硬上限 64。
- 默认只生成 Git delivery preview；只有 `autoCommit=true` 且 `full_access` 才允许本地 commit。
- 不在产品内伪造远端 push / PR / merge。
- 未绑定 DWAC / Tao AI 或闭合审计无法形成 quorum 时停在 `WAITING_PROVIDER`。

## 本轮验证

本地隔离 targeted verification：

- `core/tao-ai-adapter.mjs` syntax：PASS
- `core/autonomous-supervisor.mjs` syntax：PASS
- 修改后的 `server/main.mjs` syntax：PASS
- 修改后的 `public/app.js` syntax：PASS
- `tests/autonomous-supervisor.test.mjs`：5 / 5 PASS

覆盖：单周期闭合、跨周期重新编译、预算耗尽 fail-closed、read-only 审批暂停、Mission 持久恢复。

由于当前执行沙箱无法解析 github.com 域名，本轮没有把远端仓库完整 clone 到本地，因此没有声称执行了完整 `npm run check`；PR 合并前使用 GitHub diff 与现有回归结构做集成审查，不调用 GitHub Actions。
