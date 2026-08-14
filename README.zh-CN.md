# DSH Narrative Ledger

面向长篇小说、互动叙事和游戏剧情的只读可验证状态账本。它不是小说生成器或写作提示词包装；Novel Director、InkOS 等工具负责丰富写作流程，本插件只做互补的机器可复核连续性证据。

它核验外部 canon 文件哈希、连续不可变事件序列、单调剧情时间、事实断言/撤销、单值事实冲突、角色通过亲历或场景交流获得知识的边界，以及指定序号的 spoiler-safe 投影。报告只含 ID、哈希和判决，不含原稿正文；缺失/陈旧 canon、无效撤销、传播未知事实、时间倒退都会明确披露。

```sh
dsh plugin --profile web add github:dongsheng123132/dsh-narrative-ledger
dsh-narrative-ledger verify --workspace-root examples/basic --manifest narrative.manifest.json --events events.jsonl --artifact-dir artifacts
```

同时提供三个 DSH 工具和等价的 stdio MCP 工具。拒绝正文、章节、草稿、prompt、秘密字段、目录逃逸与符号链接；不运行 shell、不访问网络，只写显式 `artifactDir`。

MIT
