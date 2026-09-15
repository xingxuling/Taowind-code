# Taowind Code v0.6.0-alpha.1

**DWAC × Tao AI × RCL · 自主北极星代码与游戏制造 Agent**

Taowind Code 的目标不是“给 IDE 加一个 AI 聊天框”，而是把结果目标持续闭合成真实、可验证、可回滚、受权界约束的软件变化。

```text
结果目标
→ Persistent Autonomous Mission（持久自主任务）
→ DWAC North Star（全工件 / 深度开发）
→ Semantic Repo Graph（语义仓库图）
→ 多文明 / 多 Provider 候选竞争
→ RCL Authority Gate（权威门）
→ Transactional Changeset（事务变更集）
→ Acceptance / Repair（验收 / 修复）
→ Git Evidence（Git 证据）
→ Goal Closure Audit（目标闭合审计）
→ 未闭合则重新观察并进入下一周期
```

## v0.6：Game Forge 三引擎制造入口

v0.6 直接消费 DWAC 的 Godot / Unity / Unreal Engine CLI Provider 与 `GameEngineRouter`。用户只需要给游戏目标，Taowind Code 不在前端硬编码“该用哪个引擎”，而是把目标、当前项目标记、目标平台与附加要求交给 DWAC 做证据化路由。

```text
游戏目标
→ Taowind Code Game Manufacturing Gateway
→ DWAC GameEngineRouter
→ Godot / Unity / Unreal readiness probe
→ 主引擎 + 可选次级引擎
→ 游戏制造契约
→ Autonomous North-Star Mission
→ 源码 / 资产 / 测试 / 构建 / 修复 / Evidence
```

### 三引擎语义

- **Godot**：偏向轻量、2D、独立、开源、Web 与快速制造。
- **Unity**：偏向移动端、跨平台、XR 与 C# 生态。
- **Unreal Engine**：偏向 AAA、超写实、电影级、开放世界与 C++/Nanite/Lumen。
- 已有项目拥有引擎锁：不会因为目标里出现“AAA”就把现有 Unity/Godot 项目静默迁移到别的引擎。
- 多引擎模式默认是“一个主生产引擎 + 独立原型/基准/资产验证/平台专用次级引擎”，**不宣称三个引擎共享同一个运行时**。
- 没有真实 CLI readiness probe，不启动可执行游戏制造 Mission；没有真实构建输出，不宣称游戏已完成。

### API

```text
GET  /api/game/status
POST /api/game/route
POST /api/game/manufacture
```

`/api/game/route` 只做 DWAC 引擎裁决；`/api/game/manufacture` 在裁决 READY 后把选择结果编译进自主北极星 Mission。

## v0.5：RCL 从文档变成真实 Authority

v0.4 已经能自主跨周期推进，但真实写文件、终端、changeset、验收与 Git commit 的授权仍散落在 JavaScript 判断中。v0.5 直接复用正式 RCL v0.94 的 `runReality()`，让 `contracts/approval-policy.rcl` 成为 effectful action（产生副作用动作）的可执行权界。

当前执行链：

```text
Action Request
→ approval mode + workspace boundary + explicit approval
→ materialize RCL input facets
→ RCL compile/runtime
→ warrant + needs
→ ALLOW / DENY
→ Authority Receipt
→ 真实副作用（仅 ALLOW）
```

### 非补偿性权限矩阵

- `read_only`：可浏览；写入、shell、changeset、validation、commit 均拒绝。
- `workspace`：允许 workspace write / shell / changeset / validation；Git commit 拒绝。
- `full_access`：额外允许本地 Git commit。
- `external_side_effect`：**无论 full_access 与否都必须独立 explicit approval**；为后续 GitHub push / PR / merge 等外部现实动作保留主权 Gate。
- workspace boundary=false：即使 full_access 也拒绝 workspace mutation。

每次判定都会生成 `runtime-data/authority-receipts/auth-*.json`，并记录 policy digest、materialized RCL digest、rule、needs、active warrants、witnesses、state root 与拒绝原因。North Star Run / Mission 会将 receipt 回写 Evidence Ledger。

## 绑定核心运行器

```bash
TAOWIND_WORKSPACE=/path/to/target-repo \
TAOWIND_DWAC_ROOT=/path/to/DWAC-main \
TAOWIND_RCL_ROOT=/path/to/RCL-main \
TAO_AI_ENDPOINT=http://127.0.0.1:11434 \
TAO_AI_MODEL=qwen3-coder \
npm start
```

Game Forge 额外要求 `TAOWIND_DWAC_ROOT` 指向包含：

```text
scripts/dwac_game_engine_route.py
structural_generation/dwac_structural/game_engine_router.py
```

的新版 DWAC。

如果 Tao AI Provider 需要 Key，可设置 `TAO_AI_API_KEY`。多个兼容端点可使用 `TAO_AI_ENDPOINTS`，并通过 `TAO_AI_CANDIDATE_COUNT` 扩大候选池。

> RCL 未绑定时 effectful action 会 `fail closed（失败关闭）`；不会偷偷退回旧 JS 逻辑继续写代码。Game Forge 同样遵守 fail-closed：引擎不可执行就保持 BLOCKED。

## 自主北极星 Mission

主输入默认创建持久 Mission：

- 自动恢复与跨周期执行；
- DWAC 每轮重新观察瓶颈；
- Whole Artifact（全工件）与 Deep Development（深度开发）动态切换；
- Semantic Repo Graph（语义仓库图）选择上下文；
- 联邦候选竞争生成 changeset；
- 真实 Acceptance 与 bounded Repair；
- Evidence / Regression / Product 三路闭合审计；
- 默认最多 8 周期、每轮最多 2 次 Repair；
- Game Forge 默认放宽到 10 周期 / 3 次 Repair，并把真实引擎构建证据加入完成边界；
- 未闭合继续生成 `nextGoal`，预算耗尽则 `BUDGET_EXHAUSTED`，不无限自旋。

## 验证

```bash
npm test
npm run check
npm run test:game-forge
TAOWIND_RCL_ROOT=/path/to/RCL-main npm run test:rcl-authority
```

Game Forge 新增的隔离单元验证覆盖：

- Godot / Unity / Unreal 项目标记识别；
- 多引擎标记歧义关闭式失败；
- 路由参数不经过 shell 拼接；
- DWAC route JSON 消费；
- BLOCKED 决策不伪造成 Mission；
- 多引擎契约不伪装共享运行时。

本轮没有调用 GitHub Actions。

## 真实边界

- RCL Authority 当前使用 RCL reference runtime；Linux native VM 绑定待后续独立闭合。
- Terminal 仍是 bounded command execution，不是完整 PTY。
- Tao Browser DOM / Network / screenshot 尚未成为非补偿性 Acceptance Gate。
- GitHub remote push / PR / merge 尚未作为产品内 Provider；本地 runtime 不把 preview/local commit 冒充远端完成。
- Game Forge 当前完成的是“目标 → DWAC 引擎裁决 → 自主 Mission”的产品闭环；真实 Godot/Unity/UE 构建仍取决于用户机器上对应 CLI / 授权 / SDK / export templates 是否存在。
- Goal Closure Audit 是硬验收后的保守模型审计，不是现实证据本身。

详见：

- `docs/AUTONOMOUS_GOAL_CLOSURE_v0.4.md`
- `docs/EXECUTABLE_RCL_AUTHORITY_v0.5.md`
- `docs/GAME_FORGE_v0.6.md`
- `evidence/dwac-autonomous-goal-closure-v0.4.json`
- `evidence/dwac-rcl-authority-v0.5.json`
- `evidence/game-forge-v0.6.json`
