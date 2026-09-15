# Taowind Code North Star

Taowind Code 是由 **DWAC × Tao AI** 组成的旗舰 Code Agent，而不是“带 AI 的 IDE”或 Tao Work 的开发者模式。

用户给出目标后，系统应尽可能完成：

`理解仓库 → 建立任务/工件图 → 搜索/研究 → 多文件修改 → 终端执行 → 验证 → Repair → Diff 审查 → Git 交付`

## 角色边界

- **Tao AI**：人类意图、对话协作、解释、交互编排。
- **DWAC**：全工件编译、深度开发、执行、验证、Repair、Evidence、Git Delivery。
- **Tao Browser Organ**：搜索、索引、Frontier、页面抽取、开放知识获取。
- **TaoOS 能力层**：后续提供 PTY/VT、原生文件、进程、Preview、系统能力。
- **RCL**：审批、权限、执行契约和 Evidence Gate。

## 非妥协原则

1. 不能把“计划生成”说成“代码已经完成”。
2. 未连接 Provider 必须明确显示 UNBOUND，而不是模拟成功。
3. 所有写文件、命令、Git 交付必须尊重 Workspace / Approval 边界。
4. UI 第一目标是每天连续使用 8 小时仍然高效，不为概念图牺牲工作密度。
5. 全工件与深度开发是执行模式，不是 UI 装饰。
