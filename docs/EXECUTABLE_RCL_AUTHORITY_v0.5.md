# Taowind Code v0.5｜Executable RCL Authority

## 北极星裁决

在 v0.4 自主目标闭合循环合并后，使用 `DWAC-main(6)` 重新观察当前系统。候选瓶颈排序：

1. `executable-rcl-authority-gate`：0.8526
2. `browser-observation-gate`：0.7440
3. `github-remote-provider`：0.7306
4. `persistent-pty-runtime`：0.6878

DWAC 选择 `executable-rcl-authority-gate`，模式为 `WHOLE_ARTIFACT（全工件）`。

## 目标

v0.4 虽然已经有 approval mode，但真实写文件、终端、changeset、验收与 Git commit 的最终授权仍散落在 JavaScript 条件判断中。v0.5 把 RCL 从“policy 文档”提升为**真实执行前的 Authority（权界）运行时**。

```text
候选动作
→ approval mode / workspace boundary / explicit approval
→ materialize RCL policy input facets
→ RCL compile + runReality
→ warrant / needs / preserve semantics
→ ALLOW / DENY
→ immutable-ish receipt file + Evidence Ledger
→ 只有 ALLOW 才调用真实副作用器官
```

## 复用现有 RCL，而不是重写一个伪 RCL

Taowind Code 通过 `TAOWIND_RCL_ROOT` 绑定正式 RCL 项目，并动态加载：

```text
<RCL_ROOT>/src/index.mjs → runReality()
```

`contracts/approval-policy.rcl` 已改成正式可执行 RCL，使用现有语言原语：

- conditional `warrant ... while ...`
- rule-level `needs`
- `realize`
- runtime `RCL_AUTHORITY_DENIED`
- transition authority evidence / witnesses

JavaScript 只负责把布尔输入 facet 写入政策副本并选择一个固定 rule；它不重新实现 warrant 判定。

## 当前动作权界

| 动作 | read_only | workspace | full_access |
|---|---:|---:|---:|
| `mission_advance` | 允许 | 允许 | 允许 |
| `workspace_write` | 拒绝 | 允许 | 允许 |
| `shell_execute` | 拒绝 | 允许 | 允许 |
| `changeset_apply/rollback` | 拒绝 | 允许 | 允许 |
| `validation_execute` | 拒绝 | 允许 | 允许 |
| `git_commit` | 拒绝 | 拒绝 | 允许 |
| `external_side_effect` | 仅显式授权 | 仅显式授权 | 仅显式授权 |

其中 changeset apply 同时需要 `changeset.apply` 与 `workspace.write`；validation 同时需要 `validation.execute` 与 `shell.execute`；Git commit 同时需要 `git.commit` 与 `workspace.write`。任何一个 need 没有 warrant 都整体拒绝，不做补偿。

`full_access` **不会**自动获得 `external.perform`。外部副作用仍要求单独 `explicitApproval=true`，为后续远端 GitHub push / PR / merge 留出独立主权 Gate。

## Authority Receipt

每次决策写入：

```text
runtime-data/authority-receipts/auth-*.json
```

记录至少包含：

- request / action / approval mode
- workspace 与 metadata
- policy SHA-256
- materialized RCL SHA-256
- RCL state root
- rule / actor
- needs / active warrants
- witnesses
- allow / deny reason

North Star Run 与 Autonomous Mission 会把 receipt 同步写进自己的 Evidence Ledger。

## Fail-closed

- RCL 未绑定：`RCL_RUNTIME_UNBOUND`，副作用不执行。
- RCL policy 缺失/损坏：拒绝。
- 条件 warrant 不成立：`RCL_AUTHORITY_DENIED`。
- read-only 模式：真实写入类动作拒绝。
- workspace boundary=false：即使 full_access 也拒绝 workspace mutation。

纯读取仍由 `safePath` / realpath 工作区边界承担，不要求 RCL 才能浏览代码；RCL Authority 负责 effectful（产生副作用的）动作。

## 本轮真实验证

使用用户上传的 `RCL-main (5)`（v0.94.0-alpha.1）作为真实 RCL runtime：

- `Foundation Contract`：4 / 4 PASS。
- RCL authority focused tests：3 / 3 PASS（缺 warrant 拒绝、conditional warrant 运行期拒绝、preserve 阻断）。
- Taowind Code Authority prototype：8 个授权/拒绝场景全部符合预期：read-only write deny、workspace write allow、validation dual-needs allow、workspace git deny、full-access git allow、external deny、explicit external allow、boundary false deny。

曾尝试 RCL 的完整 `language.test.mjs`，其中 reference-runtime 测试大量通过，但 Linux 环境缺少 `native/rclvm` / `native/rclvmd`（上传包包含 Windows `.exe`），因此 native 部分失败；本轮没有把这些环境性失败伪装成通过，也没有把它们作为 v0.5 Authority Gate 的通过证据。

## 下一轮候选

v0.5 完成后继续交回 DWAC 重跑 North Star。当前剩余高压瓶颈主要是：Browser observation non-compensatory gate、真实 PTY runtime、以及受 RCL 明确授权的 GitHub remote delivery provider。
