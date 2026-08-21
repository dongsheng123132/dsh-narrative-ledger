import { inspectNarrativeLedger, queryNarrativeLedger, verifyNarrativeLedger } from './lib/narrative-ledger.mjs'

export const name = 'dsh-narrative-ledger'
export const inject = ['tools']
const renderJson = (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }]
const base = (config, args) => ({ workspaceRoot: config.workspaceRoot ?? process.cwd(), manifestPath: args.manifestPath, eventsPath: args.eventsPath, artifactDir: args.artifactDir, throughSeq: args.throughSeq })

function defineJsonTool({ name, description, parameters, execute }) {
  const properties = Object.fromEntries(Object.entries(parameters).map(([key, value]) => [key, { type: value.type, ...(value.minimum === undefined ? {} : { minimum: value.minimum }) }]))
  const required = Object.entries(parameters).filter(([, value]) => value.required).map(([key]) => key)
  return {
    name, description, parameters: { type: 'object', properties, required, additionalProperties: false },
    output: { schema: {}, render: renderJson },
    execute(args = {}) {
      if (!args || typeof args !== 'object' || Array.isArray(args)) throw new TypeError('arguments must be an object')
      for (const key of Object.keys(args)) if (!parameters[key]) throw new TypeError(`unknown argument: ${key}`)
      for (const key of required) if (parameters[key].type === 'string' ? typeof args[key] !== 'string' || args[key].length === 0 : !Number.isSafeInteger(args[key])) throw new TypeError(`${key} is required`)
      for (const [key, value] of Object.entries(args)) {
        if (parameters[key].type === 'string' && typeof value !== 'string') throw new TypeError(`${key} must be a string`)
        if (parameters[key].type === 'integer' && (!Number.isSafeInteger(value) || value < (parameters[key].minimum ?? Number.MIN_SAFE_INTEGER))) throw new TypeError(`${key} must be an integer`)
      }
      return execute(args)
    }
  }
}

export function createDefinitions(_ctx, config = {}) {
  return [
    defineJsonTool({ name: 'dsh_narrative_ledger_inspect', description: 'Inspect story revision, entity/predicate schema and canon source hashes without returning prose.', parameters: { manifestPath: { type: 'string', required: true } }, execute(args) { return inspectNarrativeLedger(base(config, args)) } }),
    defineJsonTool({ name: 'dsh_narrative_ledger_verify', description: 'Verify ordered events, canon hashes, fact lifecycle, contradictions and character knowledge; write one content-addressed structural report.', parameters: { manifestPath: { type: 'string', required: true }, eventsPath: { type: 'string', required: true }, artifactDir: { type: 'string', required: true } }, execute(args) { return verifyNarrativeLedger(base(config, args)) } }),
    defineJsonTool({ name: 'dsh_narrative_ledger_query', description: 'Project active fact IDs and character knowledge IDs through a sequence number without returning canon prose.', parameters: { manifestPath: { type: 'string', required: true }, eventsPath: { type: 'string', required: true }, throughSeq: { type: 'integer', required: true, minimum: 0 } }, execute(args) { return queryNarrativeLedger(base(config, args)) } })
  ]
}

export function apply(ctx, config = {}) { for (const definition of createDefinitions(ctx, config)) ctx.tools.register(definition) }
