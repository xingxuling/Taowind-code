# Taowind Code Semantic Repository Graph v0.3

## 北极星裁决

DWAC 在 v0.2 完成可回滚执行闭环后，下一轮 `WHOLE_ARTIFACT` 诊断把最高分瓶颈选为 `semantic-repository-graph`：Code Agent 不应靠“目录里哪些文件看起来重要”猜上下文，而要拥有仓库级结构感知。

## 当前图谱原语

```text
File
├─ symbols: function / class / type / callable / export
├─ imports → File
├─ reverse dependents ← File
└─ test flag
```

生成器同时形成：

- 文件节点；
- JS/TS/Python/Go 等轻量符号抽取；
- JS/TS/Python 本地 import 解析；
- 反向依赖；
- 测试文件识别；
- 内容哈希 fingerprint；
- goal → seed matches → dependencies → dependents → tests → anchors 的 Context Pack；
- bounded impact traversal。

## Agent 接线

North Star synthesize / repair 在请求 Tao AI changeset 前：

1. 扫描当前工作区；
2. 构建最新语义仓库图；
3. 用目标搜索高相关符号与文件；
4. 扩展直接依赖、反向依赖、测试；
5. 只把目标相关 Context Pack 投喂给 Provider；
6. 把 graph fingerprint 与结构摘要写入 repository context。

当语义图无有效命中时，才回退 v0.2 的路径启发式。

## API

- `GET /api/repo/graph`：图谱摘要与 fingerprint；
- `GET /api/repo/search?q=`：按目标/符号/路径查询；
- `GET /api/repo/context?q=`：查看 Agent 会选择的上下文；
- `POST /api/repo/impact`：对文件集合做有界双向影响遍历。

## 证据边界

v0.3 是“轻量静态语义图”，不是完整语言服务器（LSP）或编译器 AST。它对动态 import、反射、生成代码、宏与跨包运行时依赖只能给保守候选；下一轮可接 RCL/LSP/编译器前端成为更高精度器官。
