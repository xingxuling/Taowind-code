# Taowind Code v0.3.0-alpha.1

**DWAC × Tao AI · North-Star Coding Agent Workbench**

Taowind Code 的目标不是“给 IDE 加一个聊天框”，而是把一个结果目标持续闭合成真实、可验证、可回滚的软件变更：

```text
目标
→ DWAC North Star 判断（Whole Artifact / Deep Development）
→ 仓库上下文
→ Tao AI 候选 changeset
→ preimage / workspace gate
→ 多文件应用
→ Acceptance
→ Repair
→ Evidence
→ Git delivery preview / local commit
```

## v0.3 当前真实执行内核

- **Semantic Repository Graph（语义仓库图）**：抽取文件、符号、import、反向依赖与测试拓扑，目标上下文不再只靠路径猜。
- **North Star Run**：每个目标拥有持久 run、cycle、mode、event 与 evidence。
- **DWAC 原生桥接**：调用 `NorthStarSelfDevelopmentController` + `SoftwareProductionPipelineCompiler`，不再只返回“已规划”。
- **Transactional Changeset**：最多 128 文件；写入前绑定 SHA-256 preimage；应用前检测冲突。
- **可证明回滚**：回滚前再次检查 postimage，避免覆盖用户在 Agent 之后的新修改。
- **Symlink Escape 防护**：工作区边界从单纯 `path.resolve` 升级为 realpath / 最近存在祖先检查。
- **Tao AI OpenAI-compatible Provider**：两轮上下文补取能力；输出结构化 changeset 与验证命令。
- **自动 Acceptance / Repair**：运行真实命令；失败即进入 `REPAIR_REQUIRED`，最多执行有界修复循环。
- **Git Evidence**：区分工作树 diff、local commit、push、PR；绝不把“准备交付”冒充“已经推送”。
- **北极星 UI**：直接展示 mode、run status、blocker、Evidence 数与手动 Gate 操作。

## 运行

```bash
npm start
```

默认工作区为 `examples/demo-workspace`。指定真实仓库：

```bash
TAOWIND_WORKSPACE=/path/to/repo npm start
```

绑定本地 DWAC：

```bash
TAOWIND_DWAC_ROOT=/path/to/DWAC-main npm start
```

绑定 OpenAI-compatible Tao AI：

```bash
TAO_AI_ENDPOINT=http://127.0.0.1:11434 \
TAO_AI_MODEL=qwen3-coder \
TAOWIND_DWAC_ROOT=/path/to/DWAC-main \
npm start
```

如 Provider 需要 Key，可额外设置 `TAO_AI_API_KEY`。

## 验证

```bash
npm test
npm run check
```

v0.3 的本地 Gate 当前为 16 项：覆盖 changeset apply/rollback、preimage/postimage conflict、symlink escape、run durability、validation/Repair、路径限定 Git commit，以及 Semantic Repository Graph 的符号/import/测试拓扑、目标 Context Pack 与 impact traversal。

## 权限边界

- `read_only`：禁止写文件、执行命令、应用 changeset。
- `workspace`：允许工作区内写入、测试与 Repair；禁止危险系统命令。
- `full_access`：额外允许本地 Git commit 等高影响操作；**push / PR 不在本地 runtime 中伪装完成**。

## 当前真实边界

- Tao AI 自动代码生成依赖外部或本地模型 Provider；未绑定时 run 停在 `WAITING_PROVIDER`。
- Terminal 仍是 bounded command execution，不是完整 PTY；TaoOS PTY/VT 仍是下一器官。
- GitHub push / PR / merge 属于外部副作用，当前本地产品只做可审计的 delivery preview / local commit；平台连接器可在授权后承担远端交付。
- Web 预览仍以 URL / 本地端口为主，Tao Browser DOM/Network 深层回传继续器官化。

详见 `docs/NORTH_STAR_EXECUTION_KERNEL_v0.2.md`、`docs/SEMANTIC_REPOSITORY_GRAPH_v0.3.md` 与 `evidence/`。
