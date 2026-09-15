# Taowind Code v0.3.0-alpha.1

**DWAC × Tao AI · North-Star Coding Agent Workbench**

Taowind Code 不是“IDE 里加聊天框”，而是把结果目标持续闭合为真实、可验证、可回滚的软件变更：

```text
目标
→ DWAC North Star（Whole Artifact / Deep Development）
→ Semantic Repo Graph
→ 多文明 / 多 Provider 候选竞争
→ Transactional Changeset
→ Acceptance / Repair
→ Evidence
→ Git delivery
```

## v0.3：仓库语义图与联邦候选竞争

- **Semantic Repo Graph**：提取文件 symbols、imports、test 关系、入口角色和 goal relevance；上下文不再只靠文件名盲选。
- **Goal-aware Context**：自动把相关实现文件、依赖邻居和测试邻居带入生成上下文。
- **Federated Generation**：architecture / implementation / verifier 三种候选角色竞争，按 goal coverage、验收完整度、scope 与风险确定赢家。
- **多 Provider**：`TAO_AI_ENDPOINTS` 可绑定多个 OpenAI-compatible 端点；单端点也可生成多角色候选。
- **联邦 Repair**：验收失败后的 Deep Development 修复同样经过语义上下文和候选竞争。
- **Evidence Ledger**：保存 semantic context、候选排名、winner 与 changeset lineage，不把“第一条模型输出”直接当真。

v0.2 的持久 North Star Run、DWAC 原生桥接、SHA-256 preimage/postimage changeset、可证明回滚、symlink escape 防护、真实 Acceptance、Git Evidence 均继续保留。

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

## 验证

```bash
npm test
npm run check
```

本轮新增 targeted Gate 覆盖：语义 import/test 图、目标相关上下文、路径越界/构建输出拒绝、候选联邦确定性选择。上传本轮时未使用 GitHub Actions。

## 权限边界

- `read_only`：禁止写文件、执行命令、应用 changeset。
- `workspace`：允许工作区内写入、测试与 Repair；禁止危险系统命令。
- `full_access`：额外允许本地 Git commit 等高影响操作。
- push / PR / merge 仍属于明确外部副作用；本地 runtime 不把 preview / local commit 冒充远端完成。

## 当前真实边界

- Semantic Repo Graph 当前是轻量、可检查的语言无关图，不等于完整 AST/LSP。
- Tao AI 自动代码生成依赖已绑定的本地/外部 Provider；未绑定时停在 `WAITING_PROVIDER`。
- Terminal 仍是 bounded command execution，不是完整 PTY。
- Tao Browser DOM/Network/screenshot 尚未成为非补偿性 acceptance。
- 远端 GitHub branch / PR / merge 的 RCL 授权与 receipt 是下一轮器官。

详见 `docs/NORTH_STAR_FEDERATED_CONTEXT_v0.3.md` 与 `evidence/dwac-north-star-v0.3.json`。
