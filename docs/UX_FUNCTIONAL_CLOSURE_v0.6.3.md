# Taowind Code v0.6.3｜用户体验与功能闭环

本轮目标：让 Taowind Code 从“多个工程面板的集合”收敛为一个可理解、可执行、可恢复、可诊断的目标驱动工作台。

## DWAC 四段手动开发循环

1. **North Star（北极星裁决）**：优先解决跨视图工作流状态机，而不是继续堆功能入口。
2. **Whole Artifact（全工件）**：重新编译 Agent / Code / Preview / Game / Git / Setup 六个工作面的关系，所有关键动作必须有入口、状态、下一步和失败反馈。
3. **Deep Development（深度开发）**：集中处理共享目标、任务执行、Game Forge 独立目标、文件编辑、终端、Git 交付、Provider 阻断等微交互死角。
4. **Extreme Full Artifact（极端全工件验收）**：把剩余编译预算投入视觉层级、响应式、键盘操作、空态、错误态、状态真实性与跨视图连续性。

> DWAC 当前原生 `DevelopmentMode` 枚举仍只有 `WHOLE_ARTIFACT` 与 `DEEP_DEVELOPMENT`；North Star 和 Extreme Full Artifact 在本轮作为外层人工编排/验收阶段，不伪装成新的原生枚举。

## 产品原则

- 一个目标贯穿所有视图，不让用户在 Agent 和 Game 之间来回复制。
- 一个时刻只有一个主要动作，避免多个“看起来都能开始”的按钮互相竞争。
- Core Ready 只看 DWAC + RCL；External AI 始终是可选加速器。
- Game Router bound 只代表路由器已绑定，不代表 Godot / Unity / Unreal 已安装。
- 任何动作都必须有结果：成功、阻断、失败、下一步，不允许静默无反应。
- 运行状态和真实证据优先于“看起来完成”。

## 主要改动

- 新的单目标命令面：目标输入、执行模式、主要动作收敛到一个区域。
- 共享 Goal Store：Agent 与 Game Forge 使用同一份目标，自动持久化到本地。
- 新任务会清理前端上下文，不再只是聚焦输入框。
- Agent 右侧改为“任务状态 + 下一步 + 执行节点”，降低噪音。
- Game Forge 有自己的完整目标编辑与路由/制造流程，不再要求用户返回 Agent 填目标。
- Setup 分成 Required Core 与 Optional Accelerators，并支持复制诊断摘要。
- Git 页补齐 Delivery Preview；Preview 页补齐打开/刷新/外部打开。
- Code 页加入未保存标记、Ctrl/Cmd+S、终端快捷键与更清晰的编辑状态。
- Ctrl/Cmd+Enter 执行当前主动作；Ctrl/Cmd+K 聚焦目标输入。
- 大屏、窄屏、移动端重新布局；关键状态使用文字 + 颜色双编码。

## 非补偿性 UX Gate

以下任何一项失败，都不能宣称本轮用户体验闭合：

- 主导航存在死入口；
- Agent / Game 目标不同步；
- Core / Optional / Game Router 状态语义混淆；
- 主要动作无反馈；
- 阻断后无下一步；
- 编辑器修改无未保存提示；
- Git 交付状态不可见；
- 键盘主路径缺失；
- 移动端核心操作不可达。

GitHub Actions 不作为本轮验证链的一部分。