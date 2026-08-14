import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { cp, mkdtemp, readFile, symlink, unlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { inspectNarrativeLedger, NarrativeLedgerError, queryNarrativeLedger, verifyNarrativeLedger } from '../lib/narrative-ledger.mjs'

const hash = (value) => createHash('sha256').update(value).digest('hex')
async function fixture() { const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-narrative-ledger-')); await cp(new URL('../examples/basic/', import.meta.url), root, { recursive: true }); return root }

test('inspect returns schema and hashes but no canon prose', async () => {
  const root = await fixture(); const result = await inspectNarrativeLedger({ workspaceRoot: root, manifestPath: 'narrative.manifest.json' })
  assert.equal(result.returnsProse, false); assert.equal(result.story.id, 'tower-key'); assert.equal(JSON.stringify(result).includes('canon-shard-a'), false)
})

test('verify emits a content-addressed structural report', async () => {
  const root = await fixture(); const result = await verifyNarrativeLedger({ workspaceRoot: root, manifestPath: 'narrative.manifest.json', eventsPath: 'events.jsonl', artifactDir: 'artifacts' })
  assert.equal(result.status, 'verified'); assert.deepEqual(result.disclosure, { staleSourceIds: [], missingSourceIds: [] }); assert.match(result.artifact.path, /^artifacts\/narrative-ledger-[a-f0-9]{64}\.json$/); assert.equal(hash(await readFile(path.join(root, result.artifact.path))), result.artifact.sha256)
})

test('query enforces spoiler-safe character knowledge by sequence', async () => {
  const root = await fixture(); const before = await queryNarrativeLedger({ workspaceRoot: root, manifestPath: 'narrative.manifest.json', eventsPath: 'events.jsonl', throughSeq: 2 }); const after = await queryNarrativeLedger({ workspaceRoot: root, manifestPath: 'narrative.manifest.json', eventsPath: 'events.jsonl', throughSeq: 3 })
  assert.deepEqual(before.knowledge.find(({ characterId }) => characterId === 'bob').factIds, []); assert.deepEqual(after.knowledge.find(({ characterId }) => characterId === 'bob').factIds, ['key-at-tower']); assert.equal(JSON.stringify(after).includes('canon-shard-a'), false)
})

test('detects single-value contradictions and story-time regression', async () => {
  const root = await fixture(); const file = path.join(root, 'events.jsonl'); const lines = (await readFile(file, 'utf8')).trim().split(/\r?\n/).map(JSON.parse)
  lines[3] = { eventVersion: 1, idempotencyKey: 'e4', seq: 4, eventId: 'early-village', kind: 'assert', factId: 'alice-at-village-early', subjectId: 'alice', predicateId: 'location', valueRef: { entityId: 'village' }, sourceId: 'canon-a', witnessIds: ['alice'] }; lines[5].storyTime = 5
  await writeFile(file, `${lines.map(JSON.stringify).join('\n')}\n`); const result = await verifyNarrativeLedger({ workspaceRoot: root, manifestPath: 'narrative.manifest.json', eventsPath: 'events.jsonl', artifactDir: 'artifacts' })
  assert.equal(result.status, 'failed'); assert.equal(result.projection.findings.some(({ code }) => code === 'SINGLE_VALUE_CONTRADICTION'), true); assert.equal(result.projection.findings.some(({ code }) => code === 'STORY_TIME_REGRESSION'), true)
})

test('discloses stale and missing canon sources', async () => {
  const root = await fixture(); await writeFile(path.join(root, 'canon', 'shard-a.txt'), 'changed\n'); let result = await verifyNarrativeLedger({ workspaceRoot: root, manifestPath: 'narrative.manifest.json', eventsPath: 'events.jsonl', artifactDir: 'artifacts' }); assert.deepEqual(result.disclosure.staleSourceIds, ['canon-a'])
  await unlink(path.join(root, 'canon', 'shard-a.txt')); result = await verifyNarrativeLedger({ workspaceRoot: root, manifestPath: 'narrative.manifest.json', eventsPath: 'events.jsonl', artifactDir: 'artifacts-2' }); assert.deepEqual(result.disclosure.missingSourceIds, ['canon-a'])
})

test('rejects prose or secret-shaped event fields', async () => {
  const root = await fixture(); const file = path.join(root, 'events.jsonl'); const lines = (await readFile(file, 'utf8')).trim().split(/\r?\n/); const first = JSON.parse(lines[0]); first.prose = 'must never enter ledger'; lines[0] = JSON.stringify(first); await writeFile(file, `${lines.join('\n')}\n`)
  await assert.rejects(() => verifyNarrativeLedger({ workspaceRoot: root, manifestPath: 'narrative.manifest.json', eventsPath: 'events.jsonl', artifactDir: 'artifacts' }), (error) => error instanceof NarrativeLedgerError && error.code === 'FORBIDDEN_FIELD')
})

test('rejects traversal and symlink inputs', async () => {
  const root = await fixture(); await assert.rejects(() => inspectNarrativeLedger({ workspaceRoot: root, manifestPath: '../narrative.manifest.json' }), /escapes workspaceRoot/); const linkPath = path.join(root, 'events-link.jsonl')
  try { await symlink(path.join(root, 'events.jsonl'), linkPath); await assert.rejects(() => queryNarrativeLedger({ workspaceRoot: root, manifestPath: 'narrative.manifest.json', eventsPath: 'events-link.jsonl', throughSeq: 1 }), /non-symlink file/) } catch (error) { if (error.code !== 'EPERM') throw error }
})
