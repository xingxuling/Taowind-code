# Taowind Code v0.6.2-alpha.1

**DWAC Core × RCL · 自主北极星代码与游戏制造 Agent**

Taowind Code 的目标不是“给 IDE 加一个 AI 聊天框”，而是把结果目标持续闭合成真实、可验证、可回滚、受权界约束的软件变化。

```text
结果目标
→ Persistent Autonomous Mission（持久自主任务）
→ DWAC Core Cognition（DWAC 核心认知）
→ North Star：Whole Artifact / Deep Development（北极星：全工件 / 深度开发）
→ Semantic Repo Graph（语义仓库图）
→ DWAC 原生能力 + 可选 Provider 联邦
→ RCL Authority Gate（权威门）
→ Transactional Changeset（事务变更集）
→ Acceptance / Repair（验收 / 修复）
→ Git Evidence（Git 证据）
→ Non-compensatory Closure Audit（非补偿性闭合审计）
→ 未闭合则重新观察并进入下一周期
```

## v0.6.2：DWAC 正式成为 AI Core（核心智能）

v0.6.2 移除了 `Tao AI` 作为 Taowind Code 必需“第三个脑”的产品与执行语义。

核心运行只要求：

```text
DWAC Core
+
RCL Authority
=
Core Ready 2/2
```

DWAC 负责认知、目标规划、全工件 / 深度开发决策、上下文组织、候选能力路由与闭合逻辑；RCL 负责真实副作用的授权、证据、回滚与提交边界。

外部模型现在降级为 **External AI Accelerator（可选外部 AI 加速器）**：

- 没有外部模型时，系统核心仍然是 READY；
- DWAC 原生 `NaturalConversationRuntime` 会优先处理认知请求；
- 如果某个复杂仓库变更超出当前已验证的 DWAC 原生代码合成能力，系统会明确返回能力缺口，不会把“没有外部模型”伪装成系统未启动；
- 用户可以选择接 OpenAI-compatible（OpenAI 兼容）模型扩大代码生成能力，但这只是 DWAC 的可替换 Provider，不拥有 Taowind Code 身份、执行权或完成判定权。

### 新的认知链

```text
Taowind Code
      │
      ▼
   DWAC Core
 ┌────┼───────────────┐
 │    │               │
原生认知  全工件制造     可选外部 AI 加速器
 │    │               │
 └────┴──────┬────────┘
             ▼
      Changeset / Repair
             ▼
       RCL Authority
             ▼
      Acceptance Evidence
             ▼
   DWAC Native Closure Gate
```

闭合审计现在优先由 DWAC 的本地硬证据门完成。真实 validation（验收）、所需 browser evidence（浏览器证据）与 revision-bound delivery（版本绑定交付证据）缺一项，都不能被模型“觉得完成了”补偿通过。

## v0.6：Game Forge 三引擎制造入口

Taowind Code 直接消费 DWAC 的 Godot / Unity / Unreal Engine CLI Provider 与 `GameEngineRouter`。用户只需要给游戏目标，前端不硬编码“该用哪个引擎”，而是把目标、当前项目标记、目标平台与附加要求交给 DWAC 做证据化路由。

```text
游戏目标
→ Taowind Code Game Manufacturing Gateway（游戏制造网关）
→ DWAC GameEngineRouter（游戏引擎路由器）
→ Godot / Unity / Unreal readiness probe（就绪探测）
→ 主引擎 + 可选次级引擎
→ 游戏制造契约
→ Autonomous North-Star Mission（自主北极星任务）
→ 源码 / 资产 / 测试 / 构建 / 修复 / Evidence（证据）
```

### 三引擎语义

- **Godot**：偏向轻量、2D、独立、开源、Web 与快速制造。
- **Unity**：偏向移动端、跨平台、XR 与 C# 生态。
- **Unreal Engine（虚幻引擎）**：偏向 AAA、超写实、电影级、开放世界与 C++ / Nanite / Lumen。
- 已有项目拥有引擎锁：不会因为目标里出现“AAA”就把现有 Unity / Godot 项目静默迁移到别的引擎。
- 多引擎模式默认是“一个主生产引擎 + 独立原型 / 基准 / 资产验证 / 平台专用次级引擎”，**不宣称三个引擎共享同一个运行时**。
- `Game Router · bound（游戏路由已绑定）` 只代表 DWAC 路由代码存在；只有真实 CLI readiness probe 通过后，具体引擎才能成为可执行生产身体。
- 没有真实构建输出，不宣称游戏已完成。

### API

```text
GET  /api/game/status
POST /api/game/route
POST /api/game/manufacture
```

`/api/game/route` 只做 DWAC 引擎裁决；`/api/game/manufacture` 在裁决 READY 后把选择结果编译进自主北极星 Mission。

## v0.5：RCL 从文档变成真实 Authority（权威运行时）

真实写文件、终端、changeset、验收与 Git commit 的授权不再散落在 JavaScript 判断中。Taowind Code 复用正式 RCL 的 `runReality()`，让 `contracts/approval-policy.rcl` 成为 effectful action（产生副作用动作）的可执行权界。

```text
Action Request（动作请求）
→ approval mode + workspace boundary + explicit approval
→ materialize RCL input facets（物化 RCL 输入面）
→ RCL compile/runtime（编译 / 运行）
→ warrant + needs（授权凭证与需要）
→ ALLOW / DENY（允许 / 拒绝）
→ Authority Receipt（权威回执）
→ 真实副作用（仅 ALLOW）
```

### 非补偿性权限矩阵

- `read_only（只读）`：可浏览；写入、shell、changeset、validation、commit 均拒绝。
- `workspace（工作区）`：允许 workspace write / shell / changeset / validation；Git commit 拒绝。
- `full_access（完全访问）`：额外允许本地 Git commit。
- `external_side_effect（外部副作用）`：无论 full_access 与否都必须独立 explicit approval（明确批准）。
- workspace boundary=false：即使 full_access 也拒绝 workspace mutation（工作区修改）。

每次判定都会生成 Authority Receipt（权威回执），并记录 policy digest（策略摘要）、materialized RCL digest（物化 RCL 摘要）、rule、needs、active warrants、witnesses、state root 与拒绝原因。North Star Run / Mission 会将回执写回 Evidence Ledger（证据账本）。

## 绑定核心运行器

最小运行：

```bash
TAOWIND_WORKSPACE=/path/to/target-repo \
TAOWIND_DWAC_ROOT=/path/to/DWAC-main \
TAOWIND_RCL_ROOT=/path/to/RCL-main \
npm start
```

可选外部 AI 加速器：

```bash
DWAC_LANGUAGE_ENDPOINT=http://127.0.0.1:11434 \
DWAC_LANGUAGE_MODEL=qwen3-coder \
npm start
```

兼容旧配置：`TAO_AI_ENDPOINT`、`TAO_AI_MODEL`、`TAO_AI_API_KEY` 仍可使用，但它们的产品语义已经是“可选外部加速器”，不是核心依赖。

Game Forge 额外要求 DWAC 包含：

```text
scripts/dwac_game_engine_route.py
structural_generation/dwac_structural/game_engine_router.py
```

> RCL 未绑定时 effectful action 会 fail closed（失败关闭）；DWAC Core 未绑定时不会伪造认知或执行。外部 AI 未绑定则不会让 Core 变红。

## 自主北极星 Mission

主输入默认创建持久 Mission：

- 自动恢复与跨周期执行；
- DWAC 每轮重新观察瓶颈；
- Whole Artifact（全工件）与 Deep Development（深度开发）动态切换；
- Semantic Repo Graph（语义仓库图）选择上下文；
- DWAC 原生候选与可选 Provider 候选进入统一候选选择；
- 真实 Acceptance（验收）与 bounded Repair（有界修复）；
- Evidence / Regression / Product 三路闭合语义收敛到非补偿性硬证据门；
- 默认最多 8 周期、每轮最多 2 次 Repair；
- Game Forge 默认 10 周期 / 3 次 Repair，并把真实引擎构建证据加入完成边界；
- 未闭合继续生成 `nextGoal`，预算耗尽则 `BUDGET_EXHAUSTED`，不无限自旋。

## 验证

```bash
npm test
npm run check
npm run test:dwac-cognition
npm run test:game-forge
TAOWIND_RCL_ROOT=/path/to/RCL-main npm run test:rcl-authority
```

## 真实边界

- **不宣称 DWAC 当前能在无任何外部 Provider 的情况下可靠生成任意复杂仓库代码。** 当前原生运行时可以承担对话、认知路由、北极星决策、上下文与硬证据闭合；通用大型代码合成能力仍是待继续闭合的原生能力缺口。
- 当原生能力无法产生结构化、可验证 changeset 时，系统返回 `DWAC_COGNITION_UNRESOLVED` 并说明能力缺口，不伪造代码。
- 可选 External AI Accelerator（外部 AI 加速器）可以扩大复杂代码生成能力，但不能替代 RCL 权威门、真实验收或完成证据。
- RCL Authority 当前可使用 reference runtime（参考运行时）；不同平台 native VM（原生虚拟机）的覆盖仍需独立验证。
- Terminal（终端）仍是 bounded command execution（有界命令执行），不是完整 PTY（伪终端）。
- Tao Browser 的 DOM / Network / screenshot（DOM / 网络 / 截图）只有在真实 observer（观察器）绑定时才能成为浏览器硬证据。
- GitHub remote push / PR / merge（远程推送 / 拉取请求 / 合并）尚未作为产品内默认自动副作用；本地 runtime 不把 preview / local commit 冒充远端完成。
- 真实 Godot / Unity / Unreal 构建取决于用户机器上的对应 CLI、授权、SDK 与 export templates（导出模板）。

详见：

- `docs/DWAC_CORE_COGNITION_v0.6.2.md`
- `docs/AUTONOMOUS_GOAL_CLOSURE_v0.4.md`
- `docs/EXECUTABLE_RCL_AUTHORITY_v0.5.md`
- `docs/GAME_FORGE_v0.6.md`
- `evidence/dwac-core-cognition-v0.6.2.json`
- `evidence/dwac-autonomous-goal-closure-v0.4.json`
- `evidence/dwac-rcl-authority-v0.5.json`
- `evidence/game-forge-v0.6.json`
