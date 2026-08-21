import assert from 'node:assert/strict'
import { cp, mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as plugin from '../index.js'

const root = await mkdtemp(join(tmpdir(), 'dsh-narrative-plugin-'))
await cp(new URL('../examples/basic/', import.meta.url), root, { recursive: true })
const tools = plugin.createDefinitions({}, { workspaceRoot: root })
assert.deepEqual(tools.map(({ name }) => name), ['dsh_narrative_ledger_inspect', 'dsh_narrative_ledger_verify', 'dsh_narrative_ledger_query'])
assert.deepEqual(plugin.inject, ['tools']); assert.equal('default' in plugin, false)
assert.deepEqual(tools[2].parameters.required, ['manifestPath', 'eventsPath', 'throughSeq'])
const inspected = await tools[0].execute({ manifestPath: 'narrative.manifest.json' })
const queried = await tools[2].execute({ manifestPath: 'narrative.manifest.json', eventsPath: 'events.jsonl', throughSeq: 2 })
const verified = await tools[1].execute({ manifestPath: 'narrative.manifest.json', eventsPath: 'events.jsonl', artifactDir: 'artifacts' })
assert.equal(inspected.returnsProse, false); assert.deepEqual(queried.knowledge.find(({ characterId }) => characterId === 'bob').factIds, []); assert.equal(verified.status, 'verified'); assert.equal(verified.artifact.verifiedByReadBack, true)
assert.equal(JSON.stringify({ inspected, queried, verified }).includes('canon-shard-a'), false)
console.log(JSON.stringify({ ok: true, hostNeutral: true, rawProseIncluded: false, tools: tools.map(({ name }) => name) }))
