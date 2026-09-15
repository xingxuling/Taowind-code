# Taowind Code Game Forge v0.6

## 目标裁决

把游戏制造从“用户先选引擎，再让代码 Agent 改工程”升级为：

```text
游戏结果目标
→ Taowind Code
→ DWAC GameEngineRouter
→ Godot / Unity / Unreal 可执行探测
→ 主生产引擎 + 可选次级验证引擎
→ DWAC AAA Game Factory
→ 全工件 / 深度开发自主循环
→ RCL Authority
→ 真实引擎构建
→ 构建产物存在性检查
→ Evidence Ledger
→ 只有非补偿性证据通过才允许闭合
```

外部引擎是执行身体，不是 canonical authority（正式权威）。RCL 保留授权、证据与回滚语义，RNCS 保留权威世界状态边界，DWAC 保留生产编排。

## 影响模块

- `core/game-manufacturing.mjs`：游戏制造 Gateway、DWAC 路由调用、机器可读制造契约、构建证据门。
- `bridge/dwac_bridge.py`：游戏 Mission 进入 DWAC AAA Game Factory，而不是继续只按普通 application 编译。
- `server/main.mjs`：Game Forge API 与游戏感知闭合审计。
- `public/*`：引擎路由、分数、主/次引擎与制造入口。
- DWAC：`GameEngineRouter`、三引擎 Provider、AAA Game Factory bridge、Provider execute CLI。

## 多引擎语义

`hybrid=true`（多引擎模式）默认不是把 Godot、Unity、Unreal 强行塞进同一个运行时。

- `primary_engine`：正式生产构建。
- `secondary_engines`：独立原型、画质/性能基准、资产兼容验证、平台专用身体或技术比较。
- 只有存在明确、已验证的跨引擎桥时，才允许宣称跨引擎运行时集成。

## 非补偿性完成门

游戏 Mission 根目标中写入机器可读契约：

```text
[TAOWIND_GAME_MANUFACTURING=1]
[TAOWIND_GAME_PRIMARY=<engine>]
[TAOWIND_GAME_SECONDARY=<engines|none>]
[TAOWIND_GAME_BUILD_EVIDENCE_REQUIRED=1]
```

闭合审计会先执行 `assessGameBuildEvidence()`：

1. 普通 validation 必须整体通过；
2. 至少一条成功命令必须是真实主引擎构建/导出，或 DWAC `dwac_game_engine_provider.py execute` 的真实执行入口；
3. 至少一条成功命令必须检查真实构建产物存在；
4. 上述任一缺失，AI 即使判断“已经完成”也不能补偿通过；
5. 缺证据时返回 `closed=false`，并把下一轮切到 `DEEP_DEVELOPMENT（深度开发）` 去补真实构建链。

这使“单元测试通过”和“游戏真的能由目标引擎产出构建物”成为两个不同层级的事实。

## 推荐执行入口

优先让 validation 调用 DWAC Provider：

```text
python <DWAC>/scripts/dwac_game_engine_provider.py execute <project> <operation> ...
```

`execute` 会执行真实引擎计划并返回 measured receipt（测量回执）；Provider 本身在返回成功前检查引擎返回码、超时状态和声明的输出工件。

## API

- `GET /api/game/status`：Game Forge 与当前工程识别状态。
- `POST /api/game/route`：只做引擎裁决，不启动任务。
- `POST /api/game/manufacture`：裁决 READY 后启动持久自主 Mission。

## 验收标准

- Godot / Unity / Unreal 三种工程标记可识别。
- 歧义工程关闭式失败。
- DWAC Router 未绑定时关闭式失败。
- 无可执行引擎时不创建虚假制造任务。
- 已有工程保持原引擎主权锁，不静默迁移。
- 新工程可按目标自主选择主引擎。
- 多引擎模式只声明主生产 + 次级验证语义。
- 普通测试不能替代真实引擎构建证据。
- 主引擎构建成功但缺构建物检查时仍不能闭合。
- 真实主引擎构建 + 构建物检查后，才允许进入模型闭合审计。

## 风险与回滚

- 引擎 CLI / SDK / Export Template / License 缺失：保持 `BLOCKED` / `WAITING_PROVIDER`，不伪造成功。
- 路由错误：已有工程由项目标记锁定；新工程可重新路由，且变更仍受 changeset 与 RCL 回滚控制。
- 多引擎范围膨胀：次级引擎默认不承担正式生产，不自动复制完整工程。
- 真实构建过慢：仍受 validation timeout 与 Mission 周期预算约束。
- 回滚继续使用 Taowind Code transactional changeset（事务变更集）与 Git 本地证据链。

## 本轮验证边界

当前环境没有安装真实 Godot / Unity / Unreal Engine，因此本轮不声称完成真实游戏构建。

已验证的是路由逻辑、制造 Gateway、机器可读契约、非补偿性构建证据门、闭合审计包装器与桥接语法；真实引擎端到端构建必须在装有对应引擎和平台工具链的机器上完成。
