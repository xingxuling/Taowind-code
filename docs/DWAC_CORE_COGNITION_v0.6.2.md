# DWAC Core Cognition v0.6.2

## 目标

Taowind Code 不再把 Tao AI / 任意外部 LLM 当作与 DWAC、RCL 平级的必需运行器。

核心定义：

```text
Taowind Code Core = DWAC Core + RCL Authority
```

外部语言模型属于 DWAC 可替换的 `External AI Accelerator（外部 AI 加速器）`，用于扩大语言、代码与结构化输出能力，但不能拥有执行权、完成权或 canonical reality（权威现实）状态。

## 执行链

```text
用户结果目标
→ DWAC North Star（北极星）
→ Semantic Repo Graph（语义仓库图）
→ DWAC Native Cognition（DWAC 原生认知）
→ [可选] External AI Accelerator 候选
→ Federated Proposal Selection（联邦候选选择）
→ RCL Authority Gate（RCL 权威门）
→ Changeset Apply（变更集应用）
→ Acceptance（真实验收）
→ Repair（修复）
→ DWAC Native Closure Gate（DWAC 原生闭合门）
→ Evidence Ledger（证据账本）
```

## DWAC 原生桥

`bridge/dwac_cognition_bridge.py` 直接绑定 DWAC 的 `NaturalConversationRuntime`。

当前提供两个模式：

- `changeset`：要求 DWAC 返回结构化候选变更；如果原生能力不能可靠生成，则返回空变更并明确 `UNRESOLVED`，不编造代码。
- `closure`：根据真实 validation、browser evidence（浏览器证据）和 delivery evidence（交付证据）执行非补偿性完成判定，不依赖模型投票才能关闭任务。

## 外部 AI 的新语义

新的环境变量：

```text
DWAC_LANGUAGE_ENDPOINT
DWAC_LANGUAGE_ENDPOINTS
DWAC_LANGUAGE_MODEL
DWAC_LANGUAGE_API_KEY
```

旧 `TAO_AI_*` 保留兼容，但只作为 External AI Accelerator 配置别名。

外部模型可以参与候选生成，但：

1. 不改变 DWAC Core 身份；
2. 不绕过 RCL；
3. 不把生成文本当作执行证据；
4. 不允许用模型 confidence（信心）补偿缺失的真实验收；
5. 未连接时 Core 仍应显示 `2/2 READY`，前提是 DWAC 与 RCL 均可用。

## 完成边界

v0.6.2 的原生闭合首先检查：

1. `validation.passed == true`；
2. 如果任务要求浏览器证据，则真实 browser observations（浏览器观察）全部通过；
3. Run 已达到可交付状态并存在 revision-bound delivery（版本绑定交付）证据。

任何硬门失败都强制 `closed=false`。

## 真实性边界

当前 DWAC 原生运行时已经具备自然对话、任务识别、北极星决策、语义上下文、若干有界程序/工件器官与证据运行时，但**没有被本次工作证明能够无外部 Provider 可靠生成任意复杂仓库的多文件代码**。

因此：

- 外部 AI 不是系统启动依赖；
- 但对某些复杂代码生成任务，它仍可能是当前能力图上的有效加速 Provider；
- 当 DWAC 原生代码合成不足时，Taowind Code 必须显示“能力未闭合”，而不是错误显示“Tao AI 没接所以整个系统不能用”，更不能生成伪 changeset。

这一区分是 v0.6.2 的核心：**核心可运行 ≠ 所有任务能力都已闭合。**
