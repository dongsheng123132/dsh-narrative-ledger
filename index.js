import { defineTool } from '@deepseek-ai/dsh-tools'
import { inspectNarrativeLedger, queryNarrativeLedger, verifyNarrativeLedger } from './lib/narrative-ledger.mjs'

export const name = 'dsh-narrative-ledger'
export const inject = ['tools']
const renderJson = (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }]
const base = (config, args) => ({ workspaceRoot: config.workspaceRoot ?? process.cwd(), manifestPath: args.manifestPath, eventsPath: args.eventsPath, artifactDir: args.artifactDir, throughSeq: args.throughSeq })

export function createDefinitions(_ctx, config = {}) {
  return [
    defineTool({ name: 'dsh_narrative_ledger_inspect', description: 'Inspect story revision, entity/predicate schema and canon source hashes without returning prose.', parameters: { manifestPath: { type: 'string', required: true } }, output: { schema: { type: 'json' }, render: renderJson }, execute(args) { return inspectNarrativeLedger(base(config, args)) } }),
    defineTool({ name: 'dsh_narrative_ledger_verify', description: 'Verify ordered narrative events, canon hashes, fact lifecycle, single-value contradictions and character knowledge boundaries; writes only a content-addressed structural report.', parameters: { manifestPath: { type: 'string', required: true }, eventsPath: { type: 'string', required: true }, artifactDir: { type: 'string', required: true } }, output: { schema: { type: 'json' }, render: renderJson }, execute(args) { return verifyNarrativeLedger(base(config, args)) } }),
    defineTool({ name: 'dsh_narrative_ledger_query', description: 'Project active fact IDs and character knowledge IDs through a sequence number without returning canon prose.', parameters: { manifestPath: { type: 'string', required: true }, eventsPath: { type: 'string', required: true }, throughSeq: { type: 'integer', required: true } }, output: { schema: { type: 'json' }, render: renderJson }, execute(args) { return queryNarrativeLedger(base(config, args)) } })
  ]
}

export function apply(ctx, config = {}) { for (const definition of createDefinitions(ctx, config)) ctx.tools.register(definition) }
export default apply
