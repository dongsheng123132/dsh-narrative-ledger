# DSH Narrative Ledger

作者 / 维护者：He Fangsheng (贺方升 / 贺去病; Dosen)· [hequbing.com](https://www.hequbing.com)

[![CI](https://github.com/dongsheng123132/dsh-narrative-ledger/actions/workflows/ci.yml/badge.svg)](https://github.com/dongsheng123132/dsh-narrative-ledger/actions/workflows/ci.yml)
[![MIT 许可证](https://img.shields.io/github/license/dongsheng123132/dsh-narrative-ledger)](LICENSE)
[![Node.js 22+](https://img.shields.io/badge/Node.js-%E2%89%A522-339933?logo=nodedotjs&logoColor=white)](package.json)
[![Awesome DSH Plugins](https://img.shields.io/badge/Awesome_DSH-%E5%B7%B2%E9%AA%8C%E8%AF%81%E5%AE%9E%E9%AA%8C-0969da)](https://github.com/dongsheng123132/awesome-dsh-plugins/blob/main/README.zh-CN.md#2origin-%E6%8F%92%E4%BB%B6%E5%AE%9E%E9%AA%8C%E5%AE%A4)

面向长篇小说、互动叙事和游戏剧情的只读可验证状态账本。它不是小说生成器或写作提示词包装；Novel Director、InkOS 等工具负责丰富写作流程，本插件只做互补的机器可复核连续性证据。

它核验外部 canon 文件哈希、连续不可变事件序列、单调剧情时间、事实断言/撤销、单值事实冲突、角色通过亲历或场景交流获得知识的边界，以及指定序号的 spoiler-safe 投影。报告只含 ID、哈希和判决，不含原稿正文；缺失/陈旧 canon、无效撤销、传播未知事实、时间倒退都会明确披露。

```sh
dsh plugin --profile web add github:dongsheng123132/dsh-narrative-ledger
dsh-narrative-ledger verify --workspace-root examples/basic --manifest narrative.manifest.json --events events.jsonl --artifact-dir artifacts
```

同时提供三个 DSH 工具和三个仅处理内联数据的 stdio MCP 证明工具。MCP 不接收路径，不读写文件、不联网、不启动子进程；由于没有拿到 canon 源文件字节，它只判 `verified-structure`，并明确返回 `sourceBytesVerified: false`。只有 DSH/CLI 文件验证能核验 canon 哈希并把内容寻址报告写到显式 `artifactDir`，产物响应会证明写后回读成功。

v0.2.0 删除宿主私有运行时依赖和 default export，改为宿主中立 namespace 入口，已面向 stock Cordis Web Loader 加入防回归烟测。所有表面仍拒绝正文、章节、草稿、prompt、秘密字段、目录逃逸与符号链接。

MIT
