# DSH Narrative Ledger

A read-only, verifiable story-state ledger for [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness). It is not a novel generator or writing-prompt wrapper. Existing tools such as Novel Director and InkOS manage writing workflows and rich story state; this plugin is the complementary evidence layer for machine-checkable continuity.

## What it verifies

- content-addressed external canon sources without copying manuscript prose into reports;
- contiguous immutable event sequence and monotonic story time;
- explicit fact assertion and retraction with resolvable subject, predicate, value and source IDs;
- single-value contradictions such as two simultaneous locations or mutually exclusive states;
- character knowledge acquired only by witnessing an assertion or participating in a scene that communicates an active fact;
- spoiler-safe projection at a sequence number, returning only fact IDs and knowledge IDs;
- stale/missing canon, inactive fact communication and invalid retraction disclosure;
- deterministic content-addressed JSON reports with atomic publication and SHA-256 read-back.

The ledger rejects prose-, chapter-, draft-, prompt- and secret-shaped fields. Paths must remain inside `workspaceRoot`; symlinks are rejected. It runs no shell and makes no network requests. Only an explicit `artifactDir` may be written.

## Install

```sh
dsh plugin --profile web add github:dongsheng123132/dsh-narrative-ledger
```

DSH tools: `dsh_narrative_ledger_inspect`, `dsh_narrative_ledger_verify`, `dsh_narrative_ledger_query`.

The Codex plugin also exposes a stdio MCP server with the equivalent `narrative_ledger_*` tools through `.mcp.json`.

## CLI

```sh
dsh-narrative-ledger verify --workspace-root examples/basic --manifest narrative.manifest.json --events events.jsonl --artifact-dir artifacts
dsh-narrative-ledger query --workspace-root examples/basic --manifest narrative.manifest.json --events events.jsonl --through-seq 2
```

See [`examples/basic`](examples/basic): Bob does not know the key-location fact at sequence 2 and learns it only in the disclosure scene at sequence 3.

## Development

```sh
npm test
npm run check
npm run smoke:mcp
```

MIT
