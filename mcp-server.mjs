#!/usr/bin/env node
import readline from 'node:readline'
import { inspectNarrativeLedgerInline, queryNarrativeLedgerInline, verifyNarrativeLedgerInline } from './lib/narrative-ledger.mjs'

const MAX_TEXT = 4_194_304
const text = { type: 'string', maxLength: MAX_TEXT }
const toolSchemas = [
  { name: 'narrative_ledger_inspect_inline', description: 'Inspect an inline narrative manifest without filesystem access or prose.', inputSchema: { type: 'object', required: ['manifestJson'], properties: { manifestJson: text }, additionalProperties: false } },
  { name: 'narrative_ledger_verify_inline', description: 'Verify inline event structure and spoiler-safe projection; canon source bytes remain explicitly unobserved.', inputSchema: { type: 'object', required: ['manifestJson', 'eventsJsonl'], properties: { manifestJson: text, eventsJsonl: text }, additionalProperties: false } },
  { name: 'narrative_ledger_query_inline', description: 'Project inline structural state through a sequence without filesystem access or prose.', inputSchema: { type: 'object', required: ['manifestJson', 'eventsJsonl', 'throughSeq'], properties: { manifestJson: text, eventsJsonl: text, throughSeq: { type: 'integer', minimum: 0 } }, additionalProperties: false } }
]

function call(name, args) {
  if (name === 'narrative_ledger_inspect_inline') return inspectNarrativeLedgerInline(args)
  if (name === 'narrative_ledger_verify_inline') return verifyNarrativeLedgerInline(args)
  if (name === 'narrative_ledger_query_inline') return queryNarrativeLedgerInline(args)
  throw Object.assign(new Error(`Unknown tool: ${name}`), { code: 'METHOD_NOT_FOUND' })
}

function send(value) { process.stdout.write(`${JSON.stringify(value)}\n`) }
const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity })
for await (const line of lines) {
  if (!line.trim() || Buffer.byteLength(line, 'utf8') > 10_000_000) continue
  let request
  try { request = JSON.parse(line) } catch { continue }
  if (request.id === undefined) continue
  try {
    if (request.method === 'initialize') send({ jsonrpc: '2.0', id: request.id, result: { protocolVersion: request.params?.protocolVersion ?? '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'dsh-narrative-ledger', version: '0.2.0' } } })
    else if (request.method === 'tools/list') send({ jsonrpc: '2.0', id: request.id, result: { tools: toolSchemas } })
    else if (request.method === 'tools/call') { const result = call(request.params?.name, request.params?.arguments ?? {}); send({ jsonrpc: '2.0', id: request.id, result: { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result } }) }
    else send({ jsonrpc: '2.0', id: request.id, error: { code: -32601, message: 'Method not found' } })
  } catch (error) { send({ jsonrpc: '2.0', id: request.id, error: { code: -32000, message: error.message, data: { code: error.code ?? 'ERROR' } } }) }
}
