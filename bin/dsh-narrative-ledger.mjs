#!/usr/bin/env node
import { inspectNarrativeLedger, queryNarrativeLedger, verifyNarrativeLedger } from '../lib/narrative-ledger.mjs'

const [command, ...rest] = process.argv.slice(2)
const args = {}
for (let i = 0; i < rest.length; i += 1) if (rest[i].startsWith('--')) args[rest[i].slice(2)] = rest[i + 1]
const common = { workspaceRoot: args['workspace-root'] ?? process.cwd(), manifestPath: args.manifest, eventsPath: args.events, artifactDir: args['artifact-dir'], throughSeq: Number(args['through-seq']) }
try {
  let result
  if (command === 'inspect' && args.manifest) result = await inspectNarrativeLedger(common)
  else if (command === 'verify' && args.manifest && args.events && args['artifact-dir']) result = await verifyNarrativeLedger(common)
  else if (command === 'query' && args.manifest && args.events && Number.isSafeInteger(common.throughSeq)) result = await queryNarrativeLedger(common)
  else { process.stderr.write('Usage: dsh-narrative-ledger inspect|verify|query --workspace-root DIR --manifest FILE [--events FILE] [--artifact-dir DIR] [--through-seq N]\n'); process.exitCode = 1 }
  if (result) { process.stdout.write(`${JSON.stringify(result)}\n`); if (command === 'verify' && result.status !== 'verified') process.exitCode = 2 }
} catch (error) { process.stderr.write(`${JSON.stringify({ ok: false, code: error.code ?? 'ERROR', error: error.message })}\n`); process.exitCode = 1 }
