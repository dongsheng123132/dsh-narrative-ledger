import assert from 'node:assert/strict'
import { createDefinitions } from '../index.js'
const tools = createDefinitions({}, {}).map(({ name }) => name)
assert.deepEqual(tools, ['dsh_narrative_ledger_inspect', 'dsh_narrative_ledger_verify', 'dsh_narrative_ledger_query'])
process.stdout.write(`${JSON.stringify({ ok: true, tools })}\n`)
