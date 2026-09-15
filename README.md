# Taowind Code v0.5.0-alpha.1

**DWAC × Tao AI × RCL · Autonomous North-Star Coding Agent**

Taowind Code 的目标不是“给 IDE 加一个 AI 聊天框”，而是把结果目标持续闭合成真实、可验证、可回滚、受权界约束的软件变化。

```text
结果目标
→ Persistent Autonomous Mission
→ DWAC North Star（全工件 / 深度开发）
→ Semantic Repo Graph
→ 多文明 / 多 Provider 候选竞争
→ RCL Authority Gate
→ Transactional Changeset
→ Acceptance / Repair
→ Git Evidence
→ Goal Closure Audit
→ 未闭合则重新观察并进入下一周期
```

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

## 绑定三个核心运行器

```bash
TAOWIND_WORKSPACE=/path/to/target-repo \
TAOWIND_DWAC_ROOT=/path/to/DWAC-main \
TAOWIND_RCL_ROOT=/path/to/RCL-main \
TAO_AI_ENDPOINT=http://127.0.0.1:11434 \
TAO_AI_MODEL=qwen3-coder \
npm start
```

如果 Tao AI Provider 需要 Key，可设置 `TAO_AI_API_KEY`。多个兼容端点可使用 `TAO_AI_ENDPOINTS`，并通过 `TAO_AI_CANDIDATE_COUNT` 扩大候选池。

> v0.5 开始，RCL 未绑定时 effectful action 会 `fail closed（失败关闭）`；不会偷偷退回旧 JS 逻辑继续写代码。

## 自主北极星 Mission

主输入默认创建持久 Mission：

- 自动恢复与跨周期执行；
- DWAC 每轮重新观察瓶颈；
- Whole Artifact（全工件）与 Deep Development（深度开发）动态切换；
- Semantic Repo Graph 选择上下文；
- 联邦候选竞争生成 changeset；
- 真实 Acceptance 与 bounded Repair；
- Evidence / Regression / Product 三路闭合审计；
- 默认最多 8 周期、每轮最多 2 次 Repair；
- 未闭合继续生成 `nextGoal`，预算耗尽则 `BUDGET_EXHAUSTED`，不无限自旋。

## 验证

```bash
npm test
npm run check
TAOWIND_RCL_ROOT=/path/to/RCL-main npm run test:rcl-authority
```

本轮针对上传的 `RCL-main (5)`（v0.94.0-alpha.1）已经做了真实 reference-runtime 验证：

- Foundation Contract：4 / 4 PASS；
- RCL focused authority：3 / 3 PASS；
- Taowind Code Authority prototype：8 / 8 授权/拒绝场景符合预期。

上传的 RCL 包在当前 Linux 沙箱缺少 `native/rclvm` 与 `native/rclvmd`（存在 Windows `.exe`），因此完整 `language.test.mjs` 的 native 相关测试不能作为本轮通过证据；这部分没有伪造为 PASS。未调用 GitHub Actions。

## 真实边界

- RCL Authority 当前使用 RCL reference runtime；Linux native VM 绑定待后续独立闭合。
- Terminal 仍是 bounded command execution，不是完整 PTY。
- Tao Browser DOM / Network / screenshot 尚未成为非补偿性 Acceptance Gate。
- GitHub remote push / PR / merge 尚未作为产品内 Provider；本地 runtime 不把 preview/local commit 冒充远端完成。
- Goal Closure Audit 是硬验收后的保守模型审计，不是现实证据本身。

详见：

- `docs/AUTONOMOUS_GOAL_CLOSURE_v0.4.md`
- `docs/EXECUTABLE_RCL_AUTHORITY_v0.5.md`
- `evidence/dwac-autonomous-goal-closure-v0.4.json`
- `evidence/dwac-rcl-authority-v0.5.json`
