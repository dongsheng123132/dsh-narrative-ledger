#!/usr/bin/env node
import readline from 'node:readline'
import { inspectNarrativeLedger, queryNarrativeLedger, verifyNarrativeLedger } from './lib/narrative-ledger.mjs'

const toolSchemas = [
  { name: 'narrative_ledger_inspect', description: 'Inspect narrative ledger schema and hashes without prose.', inputSchema: { type: 'object', required: ['workspaceRoot', 'manifestPath'], properties: { workspaceRoot: { type: 'string' }, manifestPath: { type: 'string' } }, additionalProperties: false } },
  { name: 'narrative_ledger_verify', description: 'Verify timeline, canon sources, fact lifecycle and knowledge boundaries.', inputSchema: { type: 'object', required: ['workspaceRoot', 'manifestPath', 'eventsPath', 'artifactDir'], properties: { workspaceRoot: { type: 'string' }, manifestPath: { type: 'string' }, eventsPath: { type: 'string' }, artifactDir: { type: 'string' } }, additionalProperties: false } },
  { name: 'narrative_ledger_query', description: 'Project spoiler-safe structural state through a sequence.', inputSchema: { type: 'object', required: ['workspaceRoot', 'manifestPath', 'eventsPath', 'throughSeq'], properties: { workspaceRoot: { type: 'string' }, manifestPath: { type: 'string' }, eventsPath: { type: 'string' }, throughSeq: { type: 'integer', minimum: 0 } }, additionalProperties: false } }
]

async function call(name, args) {
  if (name === 'narrative_ledger_inspect') return inspectNarrativeLedger(args)
  if (name === 'narrative_ledger_verify') return verifyNarrativeLedger(args)
  if (name === 'narrative_ledger_query') return queryNarrativeLedger(args)
  throw Object.assign(new Error(`Unknown tool: ${name}`), { code: 'METHOD_NOT_FOUND' })
}

function send(value) { process.stdout.write(`${JSON.stringify(value)}\n`) }
const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity })
for await (const line of lines) {
  if (!line.trim()) continue
  let request
  try { request = JSON.parse(line) } catch { continue }
  if (request.id === undefined) continue
  try {
    if (request.method === 'initialize') send({ jsonrpc: '2.0', id: request.id, result: { protocolVersion: request.params?.protocolVersion ?? '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'dsh-narrative-ledger', version: '0.1.0' } } })
    else if (request.method === 'tools/list') send({ jsonrpc: '2.0', id: request.id, result: { tools: toolSchemas } })
    else if (request.method === 'tools/call') {
      const result = await call(request.params?.name, request.params?.arguments ?? {})
      send({ jsonrpc: '2.0', id: request.id, result: { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result } })
    } else send({ jsonrpc: '2.0', id: request.id, error: { code: -32601, message: 'Method not found' } })
  } catch (error) { send({ jsonrpc: '2.0', id: request.id, error: { code: -32000, message: error.message, data: { code: error.code ?? 'ERROR' } } }) }
}
