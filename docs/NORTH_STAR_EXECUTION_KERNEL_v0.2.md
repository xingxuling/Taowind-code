# Taowind Code North Star Execution Kernel v0.2

## 目标裁决

北极星：**用户给出一个软件目标后，Taowind Code 应持续把它闭合成经过真实验收、可回滚、可交付的仓库状态变化；如果现实证据不足，必须停在 Candidate / Blocked，而不是用文字补完。**

DWAC 本轮先在多域高压状态下选择 `WHOLE_ARTIFACT`，随后把瓶颈收敛到 transactional workspace，并选择 `DEEP_DEVELOPMENT`。对应证据：

- `evidence/dwac-north-star-bridge-v0.2.json`
- `evidence/dwac-deep-development-v0.2.json`

## 多文明联邦归位

- Founder Twin：冻结“真实代码变更 + 验收 + 回滚 + Git 证据”为不可降级目标。
- 柳清莲 Gate：拒绝 plan-only = completed、provider-unbound = connected、delivery-preview = pushed。
- 洞哥 Grounding：要求真实文件 preimage、真实命令 exit code、真实 Git 状态。
- 产品文明：用户主路径收敛为“目标 → 自动循环 → 只在 Gate 需要时介入”。
- UX 文明：首屏直接显示 North Star mode / status / blocker / Evidence。
- 工程文明：RunStore、ChangesetStore、Acceptance、Provider、Git Evidence 分层。
- 代码文明：实现本轮 v0.2 source changes。
- 测试文明：Node built-in test，无新增运行依赖。
- 安全文明：realpath symlink gate、preimage/postimage conflict、approval mode。
- 发布文明：本轮只推源码、测试与 evidence；不消耗 GitHub Actions。
- Integration Court：`npm run check` 为非补偿性本地 Gate。
- Evidence Ledger：DWAC mode receipts + test receipt + bridge receipt。

## 执行状态机

```text
OBSERVING
→ PLANNED
→ CHANGESET_STAGED
→ CHANGES_APPLIED
→ VALIDATING
├─ PASS → READY_FOR_DELIVERY
└─ FAIL → REPAIR_REQUIRED
             ↓
      DEEP_DEVELOPMENT repair cycle
             ↓
          VALIDATING

任意已应用 changeset
→ ROLLED_BACK（仅在 postimage 未被用户再次修改时）
```

如果 DWAC 或 Tao AI 未绑定：

```text
WAITING_PROVIDER
```

这不是失败伪装，而是明确的现实阻断。

## Transactional Changeset

每个文件变更保存：

```text
path
op = write | delete
before.exists
before.sha256
before.contentBase64

after.sha256
after.contentBase64
```

应用时：当前文件必须仍等于 `before.sha256`。

回滚时：当前文件必须仍等于 `after.sha256`。

所以 Agent 不会把 staging 之后的人类修改覆盖掉，也不会把 apply 之后的人类修改“回滚掉”。

## Provider Contract

Tao AI Provider 使用 OpenAI-compatible chat completion 接口，但输出不是自由文本，而是：

```json
{
  "summary": "...",
  "changes": [
    {"op":"write","path":"core/example.mjs","content":"...","expectedSha256":"..."}
  ],
  "validation_commands": ["npm test"],
  "risks": [],
  "needs_more_context": []
}
```

若第一次上下文不足，允许一次 `needs_more_context` 补取；仍无 changeset 就停在 Provider blocker。

## Acceptance / Repair

- 验收命令是真实子进程，不使用模拟 PASS。
- 命令失败即 fail-fast，并保存 command / exit code / timeout / duration 作为 Evidence。
- Repair 最多有界循环；每次重新形成独立 changeset，保留 lineage。
- 没有 validation command 时不能进入 READY。

## Git 交付语义

严格区分：

1. `git diff/status`：观察；
2. delivery preview：候选交付证据；
3. local commit：本地仓库状态变化；
4. push / PR / merge：外部副作用，必须由明确授权链路完成。

v0.2 local runtime 不会把 2 或 3 说成 4。

## 下一北极星候选

当前最值得下一轮继续压的瓶颈：

- 真 PTY / 长运行进程与可恢复 session；
- 更强仓库语义索引（符号、依赖、测试映射），减少上下文盲选；
- Tao Browser DOM / Network / screenshot observation 进入 acceptance；
- GitHub Provider 远端 branch / PR / merge 的 RCL 授权与 Evidence receipt；
- 将 changeset generation 从单 Provider 扩为 DWAC worker graph / 多文明并行候选竞争。
