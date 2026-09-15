# Taowind Code v0.4.0-alpha.1

**DWAC × Tao AI · Autonomous North-Star Coding Agent Workbench**

Taowind Code 不是“IDE 里加聊天框”，而是把一个结果目标持续闭合为真实、可验证、可回滚的软件变化。

```text
结果目标
→ Persistent Autonomous Mission
→ DWAC North Star（Whole Artifact / Deep Development）
→ Semantic Repo Graph
→ 多文明 / 多 Provider 候选竞争
→ Transactional Changeset
→ Acceptance / Repair
→ Git Evidence
→ 三路 Goal Closure Audit
→ 未闭合则自动生成 nextGoal 并进入下一轮
→ GOAL_CLOSED / WAITING_* / BLOCKED / BUDGET_EXHAUSTED
```

## v0.4：自主目标闭合循环

- **Persistent Mission**：结果目标不再依赖单次 HTTP 请求；Mission 写入 `runtime-data/missions/`，重启后仍可读取和恢复。
- **Autonomous Scheduler**：服务运行期间自动推进 `ACTIVE` Mission；等待 Provider、等待审批和阻断状态不会被静默越权推进。
- **跨周期 Recompile**：一次 Run 通过真实验收后，不直接宣布成功；系统重新观察仓库与证据，未闭合就生成新的 `nextGoal` 继续下一轮。
- **三路闭合审计**：Evidence / Regression / Product 三种审计角色形成保守共识；只有全部认可且当前 Run 硬验收通过，Mission 才进入 `GOAL_CLOSED`。
- **有界自治**：默认最多 8 个周期、每轮最多 2 次 Repair；达到预算仍未闭合则 `BUDGET_EXHAUSTED`，不会无限自旋。
- **主权边界**：`read_only` 下生成 changeset 后停在 `WAITING_APPROVAL`；默认只做 Git delivery preview，不伪造 push / PR / merge。
- **自主 Mission UX**：主输入默认创建自主任务，右侧持续展示 Mission 周期、nextGoal、当前子 Run、阻断原因与 Evidence；仍保留“单轮”入口。

v0.3 的 Semantic Repo Graph、联邦候选竞争与联邦 Repair，以及 v0.2 的持久 Run、DWAC 原生桥接、SHA-256 preimage/postimage changeset、可证明回滚、symlink escape 防护、真实 Acceptance 与 Git Evidence 均继续保留。

## 运行

```bash
npm start
```

指定真实仓库：

```bash
TAOWIND_WORKSPACE=/path/to/repo npm start
```

绑定 DWAC：

```bash
TAOWIND_DWAC_ROOT=/path/to/DWAC-main npm start
```

绑定单一 Tao AI：

```bash
TAO_AI_ENDPOINT=http://127.0.0.1:11434 \
TAO_AI_MODEL=qwen3-coder \
TAOWIND_DWAC_ROOT=/path/to/DWAC-main \
npm start
```

绑定多个兼容端点并扩大候选池：

```bash
TAO_AI_ENDPOINTS=http://127.0.0.1:11434,http://127.0.0.1:8000 \
TAO_AI_CANDIDATE_COUNT=6 \
TAO_AI_MODEL=qwen3-coder \
TAOWIND_DWAC_ROOT=/path/to/DWAC-main \
npm start
```

如 Provider 需要 Key，设置 `TAO_AI_API_KEY`。

自主调度器默认约每 2.5 秒检查一次 ACTIVE Mission；可通过 `TAOWIND_AUTONOMY_INTERVAL_MS` 调整，最低 750ms。

## 验证

```bash
npm test
npm run check
```

本轮新增 targeted Gate 覆盖：

- 单周期真实验收后才允许闭合；
- 闭合审计发现缺口后自动生成下一周期；
- 循环预算耗尽 fail-closed；
- `read_only` 下在 apply 前暂停；
- Mission 持久状态可跨 Supervisor 重建恢复。

当前沙箱无法解析 github.com 域名，因此本轮没有把远端仓库完整 clone 到本地，也没有伪称完整 `npm run check` 已执行；隔离 targeted suite 为 5 / 5 PASS，修改后的关键 JS 文件均通过 `node --check`。没有调用 GitHub Actions。

## 权限边界

- `read_only`：禁止写文件、执行命令、应用 changeset；Autonomous Mission 停在 `WAITING_APPROVAL`。
- `workspace`：允许工作区内写入、测试与 Repair；禁止危险系统命令。
- `full_access`：额外允许本地 Git commit 等高影响操作。
- Mission 默认 `autoCommit=false`；即使打开自动 commit，也必须同时处于 `full_access`。
- push / PR / merge 仍属于明确外部副作用；本地 runtime 不把 preview / local commit 冒充远端完成。

## 当前真实边界

- Goal Closure Audit 是受真实 Acceptance 约束的保守模型审计，不是现实证据本身。
- Semantic Repo Graph 当前仍是轻量、可检查的语言无关图，不等于完整 AST/LSP。
- Tao AI 自动代码生成与闭合审计依赖已绑定的本地/外部 Provider；未绑定时停在 `WAITING_PROVIDER`。
- Terminal 仍是 bounded command execution，不是完整 PTY。
- Tao Browser DOM/Network/screenshot 尚未成为非补偿性 acceptance。
- RCL approval policy 尚未成为运行时唯一 Authority；可执行 RCL Gate 是当前下一候选瓶颈。
- 远端 GitHub branch / PR / merge 的 RCL 授权与 receipt 仍待产品内器官化。

详见 `docs/AUTONOMOUS_GOAL_CLOSURE_v0.4.md` 与 `evidence/dwac-autonomous-goal-closure-v0.4.json`。
