# Taowind Code v0.1.0-alpha.1

**DWAC × Tao AI · Native Coding Agent Workbench**

这不是 Tao Work 的开发者皮肤，而是面向长期日用的 Code Agent 产品骨架：一句目标进入后，产品围绕仓库理解、DWAC 任务图、代码修改、终端、Diff、浏览器预览/研究与 Git 交付组织工作。

## 当前可运行

- 无构建依赖的 Web Workbench：`npm start` 或 `node server/main.mjs`
- Workspace 文件树、读取、编辑、保存
- Git status / diff
- 工作区命令执行（受 workspace 边界限制）
- Agent 任务规划与状态面板
- Browser Preview
- DWAC / Tao AI / Tao Browser Provider 状态接口
- Approval Mode：Read only / Workspace / Full access（产品状态已接线，后续深化命令级策略）
- Electron 可选桌面壳（安装 Electron 后 `npm run desktop`）

默认工作区是 `examples/demo-workspace`。可通过：

```bash
TAOWIND_WORKSPACE=/path/to/repo node server/main.mjs
```

## 真实边界

- 当前编辑器为轻量原生编辑面；Monaco/LSP 尚未接入。
- Terminal 当前是命令执行通道，不冒充 PTY；后续直接复用 TaoOS PTY/VT。
- Tao AI 与 DWAC 提供 Provider Contract，但本包不会伪造已连接的模型/运行时。
- Browser Preview 是 URL/本地端口预览；Tao Browser 深层 DOM/Network 回传待后续器官化。
- GitHub PR/merge 由 DWAC Fast Delivery 器官对接，当前 UI 先呈现交付状态与本地 Git 证据。

## 工程基线

`evidence/` 保留针对性验证与构建摘要；完整 DWAC Software Production Plan / Adaptive Large Software Build Graph 属于可再生工件，保留在交付包与 Evidence Ledger 中，不要求常驻主仓库。版本号只是交付快照，不是功能阶段边界。
