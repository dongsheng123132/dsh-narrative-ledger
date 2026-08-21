import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'

const manifestJson = await readFile(new URL('../examples/basic/narrative.manifest.json', import.meta.url), 'utf8')
const eventsJsonl = await readFile(new URL('../examples/basic/events.jsonl', import.meta.url), 'utf8')
const child = spawn(process.execPath, ['mcp-server.mjs'], { cwd: new URL('../', import.meta.url), shell: false, stdio: ['pipe', 'pipe', 'pipe'], env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot } })
let buffer = ''; const responses = []
child.stdout.setEncoding('utf8'); child.stdout.on('data', chunk => { buffer += chunk; let index; while ((index = buffer.indexOf('\n')) >= 0) { const line = buffer.slice(0, index); buffer = buffer.slice(index + 1); if (line) responses.push(JSON.parse(line)) } })
const requests = [
  { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } },
  { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
  { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'narrative_ledger_verify_inline', arguments: { manifestJson, eventsJsonl } } },
  { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'narrative_ledger_query_inline', arguments: { manifestJson, eventsJsonl, throughSeq: 2 } } }
]
for (const request of requests) child.stdin.write(`${JSON.stringify(request)}\n`)
const deadline = Date.now() + 5000
while (responses.length < requests.length && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20))
child.stdin.end(); if (!child.killed) child.kill()
assert.equal(responses.length, 4); assert.equal(responses[0].result.serverInfo.version, '0.2.0')
assert.deepEqual(responses[1].result.tools.map(({ name }) => name), ['narrative_ledger_inspect_inline', 'narrative_ledger_verify_inline', 'narrative_ledger_query_inline'])
assert.equal(responses[2].result.structuredContent.status, 'verified-structure'); assert.equal(responses[2].result.structuredContent.disclosure.sourceBytesVerified, false)
assert.deepEqual(responses[3].result.structuredContent.knowledge.find(({ characterId }) => characterId === 'bob').factIds, [])
assert.equal(JSON.stringify(responses).includes('canon-shard-a'), false); assert.equal(JSON.stringify(responses).includes('workspaceRoot'), false)
console.log(JSON.stringify({ ok: true, protocol: '2025-06-18', tools: 3, proofOnly: true, filesystemAccess: false, rawProseIncluded: false }))
