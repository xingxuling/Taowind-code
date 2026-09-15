# Taowind Code North Star v0.3｜语义仓库图 × 联邦候选竞争

## 北极星裁决

目标保持不变：**用户给出明确软件目标后，Taowind Code 持续把它闭合成真实、可验证、可回滚、可交付的仓库状态变化，并逐轮减少人类干预。**

本轮将 DWAC `NorthStarSelfDevelopmentController` 对 v0.2 的四个已知缺口重新观测。结果：

- selected: `federated-candidate-competition`
- mode: `WHOLE_ARTIFACT`
- sovereignty gate: `AUTONOMOUS`
- cycle: `NSC-c994c26f70e14d2a0e9b`

原因不是“再多写几个按钮”，而是规划、生成、验证仍彼此耦合：仓库上下文选择太浅，代码生成依赖单一路径，浏览器验收和远端交付仍未闭合。DWAC 因此先扩系统图，再对高中心性瓶颈做深开发。

## 本轮新增器官

### 1. Semantic Repo Graph

`core/semantic-repo-graph.mjs`

把仓库从“文件清单”升级为轻量语义图：symbols、imports、tests、entry-like role、goal lexical relevance、local centrality。

上下文选择改为：goal relevance + symbol/entry importance + import neighborhood + test neighborhood。

这仍不是完整 LSP/AST 索引，但已经把 v0.2 的 manifest-only 盲选推进到可测试的语义层。

### 2. Federated Candidate Competition

`core/federated-generation.mjs`

候选变化不再默认“第一个 Provider 输出就是答案”。候选经过 workspace path 安全归一化、changeset 结构约束、goal coverage、validation completeness、scope size、risky path penalty 与 deterministic ranking。只有包含真实 changeset 与 validation command 的候选才可优先进入执行链。

### 3. Tao AI Multi-Candidate Runtime

`core/tao-ai-adapter.mjs`

支持 `TAO_AI_ENDPOINT`、`TAO_AI_ENDPOINTS=a,b,c` 和 `TAO_AI_CANDIDATE_COUNT=1..9`。即使只有一个端点，也会以 architecture / implementation / verifier 三种文明角色生成竞争候选；多个端点则轮询分配角色并并发生成。

### 4. North Star Runner v0.3

`synthesize` 与 `repair` 均进入：

```text
manifest
→ broad bounded corpus
→ semantic repo graph
→ goal-aware context
→ multi-candidate generation
→ federation ranking
→ winner changeset
→ transactional apply
→ acceptance
→ evidence
```

每轮同时写入 `semantic-context` 与 `federated-generation` evidence，保留候选、评分和赢家来源。

## 多文明联邦审查

- Founder Twin：不改变产品北极星；拒绝退化为“IDE + Chat”。
- 柳清莲 Gate：候选无 validation、越界 path、plan-only 均不得成为 READY。
- 洞哥 Grounding：上下文与候选必须落到真实仓库文件与可执行验证命令。
- 产品文明：减少人工告诉 Agent“该看哪些文件”。
- UX 文明：本轮不扩首屏复杂度；能力默认在 North Star Run 内自动发生。
- 工程文明：语义图、候选联邦、Provider、Runner 分层，保持可替换。
- 测试文明：新增两个独立测试文件，覆盖图关系、上下文选择、路径安全和候选竞争。
- 安全文明：联邦候选在 changeset staging 之前先拒绝 traversal/build-output 路径。
- 发布文明：仅源码/测试/文档/evidence；不使用 GitHub Actions 额度。
- Integration Court：本地 targeted Node tests + syntax gates。
- Evidence Ledger：本文件与 `evidence/dwac-north-star-v0.3.json`。

## 验收与真实边界

本轮已本地执行 4 个 syntax check 与 3 个 targeted tests，结果 3/3 PASS。

尚未宣称：完整 LSP/AST 级符号索引；真 PTY/长期进程恢复；Tao Browser DOM/Network/screenshot 成为非补偿性 acceptance；GitHub remote branch/PR/merge 已被本地 runtime 自动执行；外部 Tao AI Provider 在本环境完成真实在线候选生成。

## 下一轮 DWAC 候选

1. Tao Browser acceptance organ：DOM / Console / Network / screenshot evidence；
2. 真 PTY + persistent session；
3. 远端 GitHub delivery contract 与 RCL sovereignty receipt；
4. 从 regex semantic graph 升级到语言适配器 / AST / LSP symbol index。
