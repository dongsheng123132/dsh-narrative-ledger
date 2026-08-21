import assert from 'node:assert/strict'
import { cp, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const plugin = process.env.PLUGIN_ENTRY ? await import(pathToFileURL(resolve(process.env.PLUGIN_ENTRY)).href) : await import('../index.js')
const checkout = process.env.DSH_CHECKOUT
if (!checkout) throw new Error('DSH_CHECKOUT must point to a built DeepSeek Harness checkout')
const importBuilt = async relativePath => import(pathToFileURL(resolve(checkout, relativePath)).href)
const { Context } = await importBuilt('vendor/cordis/lib/index.js'); const { default: SystemPrompt } = await importBuilt('packages/core/system-prompt/lib/index.js'); const { default: ToolRuntime } = await importBuilt('packages/core/tools/lib/index.js')
const root = await mkdtemp(join(tmpdir(), 'dsh-narrative-runtime-')); await cp(new URL('../examples/basic/', import.meta.url), root, { recursive: true })
const ctx = new Context()
try {
  await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime); await ctx.plugin(plugin, { workspaceRoot: root })
  const tools = ctx.get('tools'); const names = tools.schemas().filter(({ name }) => name.startsWith('dsh_narrative_')).map(({ name }) => name); const signal = new AbortController().signal
  assert.deepEqual(names, ['dsh_narrative_ledger_inspect', 'dsh_narrative_ledger_verify', 'dsh_narrative_ledger_query'])
  const before = await tools.execute({ signal, callId: 'query-before', name: names[2], arguments: { manifestPath: 'narrative.manifest.json', eventsPath: 'events.jsonl', throughSeq: 2 } })
  const after = await tools.execute({ signal, callId: 'query-after', name: names[2], arguments: { manifestPath: 'narrative.manifest.json', eventsPath: 'events.jsonl', throughSeq: 3 } })
  const verified = await tools.execute({ signal, callId: 'verify', name: names[1], arguments: { manifestPath: 'narrative.manifest.json', eventsPath: 'events.jsonl', artifactDir: 'artifacts' } })
  assert.equal(before.isError, false); assert.deepEqual(before.value.knowledge.find(({ characterId }) => characterId === 'bob').factIds, []); assert.deepEqual(after.value.knowledge.find(({ characterId }) => characterId === 'bob').factIds, ['key-at-tower']); assert.equal(verified.value.status, 'verified'); assert.equal(verified.value.artifact.verifiedByReadBack, true)
  assert.equal(JSON.stringify({ before: before.value, after: after.value, verified: verified.value }).includes('canon-shard-a'), false)
  console.log(JSON.stringify({ ok: true, tools: names, status: verified.value.status, artifactReadBack: true, rawProseIncluded: false }))
} finally { await ctx.fiber.dispose(); await rm(root, { recursive: true, force: true }) }
