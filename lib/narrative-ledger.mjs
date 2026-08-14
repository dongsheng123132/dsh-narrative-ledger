import { createHash, randomUUID } from 'node:crypto'
import { link, lstat, mkdir, readFile, realpath, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

const MAX_BYTES = 4_194_304
const FORBIDDEN_KEYS = /^(authorization|secret|token|password|credential|chat|prompt|message|content|text|prose|chapter|draft|manuscript)$/i
const ID = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/
const sha = (value) => createHash('sha256').update(value).digest('hex')
const isHash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value
const stableJson = (value) => `${JSON.stringify(stable(value), null, 2)}\n`

export class NarrativeLedgerError extends Error {
  constructor(code, message) { super(message); this.name = 'NarrativeLedgerError'; this.code = code }
}

function object(value, label) { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new NarrativeLedgerError('INVALID_SCHEMA', `${label} must be an object`) }
function noSecrets(value, at = '$') {
  if (Array.isArray(value)) return value.forEach((item, i) => noSecrets(item, `${at}[${i}]`))
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.test(key)) throw new NarrativeLedgerError('FORBIDDEN_FIELD', `Forbidden prose or secret-shaped field at ${at}.${key}`)
    noSecrets(child, `${at}.${key}`)
  }
}

async function workspaceRoot(root) {
  const resolved = await realpath(root)
  const info = await lstat(resolved)
  if (!info.isDirectory() || info.isSymbolicLink()) throw new NarrativeLedgerError('UNSAFE_PATH', 'workspaceRoot must be a real directory')
  return resolved
}

async function safeFile(rootValue, relativePath, label) {
  if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)) throw new NarrativeLedgerError('UNSAFE_PATH', `${label} must be workspace-relative`)
  const root = await workspaceRoot(rootValue)
  const target = path.resolve(root, relativePath)
  const rel = path.relative(root, target)
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new NarrativeLedgerError('UNSAFE_PATH', `${label} escapes workspaceRoot`)
  const info = await lstat(target)
  if (!info.isFile() || info.isSymbolicLink()) throw new NarrativeLedgerError('UNSAFE_PATH', `${label} must be a regular non-symlink file`)
  if (info.size > MAX_BYTES) throw new NarrativeLedgerError('INPUT_TOO_LARGE', `${label} exceeds ${MAX_BYTES} bytes`)
  const resolved = await realpath(target)
  const resolvedRel = path.relative(root, resolved)
  if (resolvedRel.startsWith('..') || path.isAbsolute(resolvedRel)) throw new NarrativeLedgerError('UNSAFE_PATH', `${label} resolves outside workspaceRoot`)
  return { root, target: resolved }
}

async function artifactDirectory(rootValue, relativePath) {
  if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)) throw new NarrativeLedgerError('UNSAFE_PATH', 'artifactDir must be workspace-relative')
  const root = await workspaceRoot(rootValue)
  const target = path.resolve(root, relativePath)
  const rel = path.relative(root, target)
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new NarrativeLedgerError('UNSAFE_PATH', 'artifactDir escapes workspaceRoot')
  await mkdir(target, { recursive: true })
  const info = await lstat(target)
  if (!info.isDirectory() || info.isSymbolicLink()) throw new NarrativeLedgerError('UNSAFE_PATH', 'artifactDir must be a real directory')
  const resolved = await realpath(target)
  if (path.relative(root, resolved).startsWith('..')) throw new NarrativeLedgerError('UNSAFE_PATH', 'artifactDir resolves outside workspaceRoot')
  return { root, target: resolved }
}

function validateManifest(manifest) {
  object(manifest, 'manifest'); noSecrets(manifest)
  if (manifest.schemaVersion !== 1) throw new NarrativeLedgerError('INVALID_SCHEMA', 'schemaVersion must be 1')
  object(manifest.story, 'story')
  if (!ID.test(manifest.story.id) || typeof manifest.story.revision !== 'string') throw new NarrativeLedgerError('INVALID_SCHEMA', 'story.id and revision are invalid')
  if (!Array.isArray(manifest.entities) || !Array.isArray(manifest.predicates) || !Array.isArray(manifest.sources)) throw new NarrativeLedgerError('INVALID_SCHEMA', 'entities, predicates and sources must be arrays')
  const entities = new Set()
  const characters = new Set()
  for (const [i, entity] of manifest.entities.entries()) {
    object(entity, `entities[${i}]`)
    if (!ID.test(entity.id) || entities.has(entity.id) || !['character', 'location', 'object', 'group'].includes(entity.type)) throw new NarrativeLedgerError('INVALID_SCHEMA', `entities[${i}] is invalid or duplicate`)
    entities.add(entity.id); if (entity.type === 'character') characters.add(entity.id)
  }
  const predicates = new Map()
  for (const [i, predicate] of manifest.predicates.entries()) {
    object(predicate, `predicates[${i}]`)
    if (!ID.test(predicate.id) || predicates.has(predicate.id) || !['single', 'multi'].includes(predicate.cardinality) || !['entity', 'hash'].includes(predicate.valueKind)) throw new NarrativeLedgerError('INVALID_SCHEMA', `predicates[${i}] is invalid or duplicate`)
    predicates.set(predicate.id, predicate)
  }
  const sources = new Set()
  for (const [i, source] of manifest.sources.entries()) {
    object(source, `sources[${i}]`)
    if (!ID.test(source.id) || sources.has(source.id) || typeof source.path !== 'string' || !isHash(source.sha256)) throw new NarrativeLedgerError('INVALID_SCHEMA', `sources[${i}] is invalid or duplicate`)
    sources.add(source.id)
  }
  return { manifest, entities, characters, predicates, sources }
}

async function loadManifest(root, manifestPath) {
  const { target } = await safeFile(root, manifestPath, 'manifestPath')
  const bytes = await readFile(target)
  let value
  try { value = JSON.parse(bytes.toString('utf8')) } catch { throw new NarrativeLedgerError('INVALID_JSON', 'manifestPath is not valid JSON') }
  return { ...validateManifest(value), manifestSha256: sha(bytes) }
}

function validateEvent(event, line, context, keys, eventIds) {
  object(event, `event line ${line}`); noSecrets(event, `$event[${line}]`)
  if (event.eventVersion !== 1 || typeof event.idempotencyKey !== 'string' || keys.has(event.idempotencyKey) || event.seq !== line || !ID.test(event.eventId) || eventIds.has(event.eventId)) throw new NarrativeLedgerError('INVALID_EVENT', `line ${line} needs version 1, contiguous seq, unique keys and eventId`)
  if (!['assert', 'retract', 'scene'].includes(event.kind)) throw new NarrativeLedgerError('INVALID_EVENT', `line ${line} has unsupported kind`)
  if (event.kind === 'assert') {
    if (!ID.test(event.factId) || !context.entities.has(event.subjectId) || !context.predicates.has(event.predicateId) || !context.sources.has(event.sourceId) || !Array.isArray(event.witnessIds) || event.witnessIds.some((id) => !context.characters.has(id))) throw new NarrativeLedgerError('INVALID_EVENT', `line ${line} assertion references are invalid`)
    object(event.valueRef, `line ${line}.valueRef`)
    const predicate = context.predicates.get(event.predicateId)
    if (predicate.valueKind === 'entity' ? !context.entities.has(event.valueRef.entityId) : !isHash(event.valueRef.valueSha256)) throw new NarrativeLedgerError('INVALID_EVENT', `line ${line} assertion valueRef is invalid`)
  } else if (event.kind === 'retract') {
    if (!ID.test(event.factId)) throw new NarrativeLedgerError('INVALID_EVENT', `line ${line} retract factId is invalid`)
  } else {
    if (!Number.isSafeInteger(event.storyTime) || event.storyTime < 0 || !context.entities.has(event.locationId) || !Array.isArray(event.participantIds) || event.participantIds.some((id) => !context.characters.has(id)) || !Array.isArray(event.communicatedFactIds) || event.communicatedFactIds.some((id) => !ID.test(id))) throw new NarrativeLedgerError('INVALID_EVENT', `line ${line} scene references are invalid`)
  }
  keys.add(event.idempotencyKey); eventIds.add(event.eventId)
  return event
}

async function loadEvents(root, eventsPath, context) {
  const { target } = await safeFile(root, eventsPath, 'eventsPath')
  const raw = await readFile(target, 'utf8')
  const keys = new Set(); const eventIds = new Set()
  const events = raw.split(/\r?\n/).filter((line) => line.trim()).map((line, i) => {
    let value
    try { value = JSON.parse(line) } catch { throw new NarrativeLedgerError('INVALID_JSONL', `eventsPath line ${i + 1} is invalid JSON`) }
    return validateEvent(value, i + 1, context, keys, eventIds)
  })
  return { events, eventsSha256: sha(raw) }
}

function project(events, context, throughSeq = Number.MAX_SAFE_INTEGER) {
  const active = new Map(); const allFacts = new Map(); const knowledge = new Map([...context.characters].map((id) => [id, new Set()])); const findings = []
  let lastStoryTime = -1
  for (const event of events.filter(({ seq }) => seq <= throughSeq)) {
    if (event.kind === 'assert') {
      if (allFacts.has(event.factId)) { findings.push({ code: 'DUPLICATE_FACT_ID', seq: event.seq, factId: event.factId }); continue }
      const predicate = context.predicates.get(event.predicateId)
      if (predicate.cardinality === 'single') {
        const conflicts = [...active.values()].filter((fact) => fact.subjectId === event.subjectId && fact.predicateId === event.predicateId).map(({ factId }) => factId)
        if (conflicts.length) findings.push({ code: 'SINGLE_VALUE_CONTRADICTION', seq: event.seq, factId: event.factId, conflictsWith: conflicts })
      }
      const fact = { factId: event.factId, subjectId: event.subjectId, predicateId: event.predicateId, sourceId: event.sourceId, assertedSeq: event.seq }
      allFacts.set(event.factId, fact); active.set(event.factId, fact)
      for (const id of event.witnessIds) knowledge.get(id).add(event.factId)
    } else if (event.kind === 'retract') {
      if (!active.has(event.factId)) findings.push({ code: 'RETRACTS_INACTIVE_FACT', seq: event.seq, factId: event.factId })
      else active.delete(event.factId)
    } else {
      if (event.storyTime < lastStoryTime) findings.push({ code: 'STORY_TIME_REGRESSION', seq: event.seq, previous: lastStoryTime, actual: event.storyTime })
      lastStoryTime = Math.max(lastStoryTime, event.storyTime)
      for (const factId of event.communicatedFactIds) {
        if (!active.has(factId)) findings.push({ code: 'COMMUNICATES_INACTIVE_OR_UNKNOWN_FACT', seq: event.seq, factId })
        else for (const characterId of event.participantIds) knowledge.get(characterId).add(factId)
      }
    }
  }
  return {
    status: findings.length ? 'failed' : 'verified',
    throughSeq: Math.min(throughSeq, events.length),
    activeFactIds: [...active.keys()].sort(),
    knowledge: [...knowledge.entries()].map(([characterId, facts]) => ({ characterId, factIds: [...facts].sort() })),
    findings
  }
}

async function sourceEvidence(root, sources) {
  const results = []
  for (const source of sources) {
    try {
      const { target } = await safeFile(root, source.path, `source ${source.id}.path`)
      const actualSha256 = sha(await readFile(target))
      results.push({ id: source.id, expectedSha256: source.sha256, actualSha256, status: actualSha256 === source.sha256 ? 'current' : 'stale' })
    } catch (error) {
      if (error?.code === 'ENOENT') results.push({ id: source.id, expectedSha256: source.sha256, actualSha256: null, status: 'missing' })
      else throw error
    }
  }
  return results
}

async function writeReport(rootValue, artifactDir, report) {
  const { root, target: directory } = await artifactDirectory(rootValue, artifactDir)
  const body = stableJson(report); const reportSha256 = sha(body); const filename = `narrative-ledger-${reportSha256}.json`; const target = path.join(directory, filename); const temporary = path.join(directory, `.${filename}.${randomUUID()}.tmp`)
  try {
    await writeFile(temporary, body, { encoding: 'utf8', flag: 'wx' })
    try { await link(temporary, target) } catch (error) { if (error.code !== 'EEXIST') throw error }
    const reread = await readFile(target, 'utf8')
    if (reread !== body || sha(reread) !== reportSha256) throw new NarrativeLedgerError('WRITE_VERIFY_FAILED', 'report read-back verification failed')
    return { path: path.relative(root, target).replaceAll(path.sep, '/'), sha256: reportSha256 }
  } finally { try { await unlink(temporary) } catch {} }
}

export async function inspectNarrativeLedger({ workspaceRoot: root = process.cwd(), manifestPath }) {
  const context = await loadManifest(root, manifestPath)
  return { schemaVersion: 1, operation: 'inspect', returnsProse: false, story: context.manifest.story, manifestSha256: context.manifestSha256, entities: context.manifest.entities, predicates: context.manifest.predicates, sources: context.manifest.sources.map(({ id, sha256 }) => ({ id, expectedSha256: sha256 })) }
}

export async function queryNarrativeLedger({ workspaceRoot: root = process.cwd(), manifestPath, eventsPath, throughSeq }) {
  if (!Number.isSafeInteger(throughSeq) || throughSeq < 0) throw new NarrativeLedgerError('INVALID_QUERY', 'throughSeq must be a non-negative integer')
  const context = await loadManifest(root, manifestPath); const { events, eventsSha256 } = await loadEvents(root, eventsPath, context)
  return { schemaVersion: 1, operation: 'query', returnsProse: false, story: context.manifest.story, eventsSha256, ...project(events, context, throughSeq) }
}

export async function verifyNarrativeLedger({ workspaceRoot: root = process.cwd(), manifestPath, eventsPath, artifactDir }) {
  const context = await loadManifest(root, manifestPath); const { events, eventsSha256 } = await loadEvents(root, eventsPath, context); const sources = await sourceEvidence(root, context.manifest.sources); const projection = project(events, context)
  const report = { schemaVersion: 1, operation: 'verify', returnsProse: false, story: context.manifest.story, inputs: { manifestSha256: context.manifestSha256, eventsSha256 }, status: sources.every(({ status }) => status === 'current') && projection.status === 'verified' ? 'verified' : 'failed', disclosure: { staleSourceIds: sources.filter(({ status }) => status === 'stale').map(({ id }) => id), missingSourceIds: sources.filter(({ status }) => status === 'missing').map(({ id }) => id) }, sources, projection }
  const artifact = await writeReport(root, artifactDir, report)
  return { ...report, artifact }
}
