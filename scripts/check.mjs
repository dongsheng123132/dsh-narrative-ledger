import { readFile } from 'node:fs/promises'

const required = ['package.json', '.codex-plugin/plugin.json', '.mcp.json', '.npmignore', 'index.js', 'lib/narrative-ledger.mjs', 'mcp-server.mjs', 'SECURITY.md', 'cordis.patch.yml', 'README.md', 'README.zh-CN.md', 'test/dsh-runtime-smoke.mjs', 'test/stock-web-loader-smoke.mjs']
const files = Object.fromEntries(await Promise.all(required.map(async file => [file, await readFile(new URL(`../${file}`, import.meta.url), 'utf8')])))
const pkg = JSON.parse(files['package.json']); const plugin = JSON.parse(files['.codex-plugin/plugin.json']); const mcp = JSON.parse(files['.mcp.json'])
if (pkg.dsh?.bundle?.patch !== './cordis.patch.yml') throw new Error('missing DSH bundle patch')
if (plugin.name !== pkg.name || plugin.version !== pkg.version || plugin.mcpServers !== './.mcp.json') throw new Error('package/plugin identity or MCP path mismatch')
if (!mcp.mcpServers?.['dsh-narrative-ledger']) throw new Error('MCP server declaration missing')
if (pkg.scripts?.preinstall || pkg.scripts?.install || pkg.scripts?.postinstall) throw new Error('lifecycle scripts are forbidden')
if (pkg.peerDependencies?.['@deepseek-ai/dsh-tools'] || pkg.devDependencies?.['@deepseek-ai/dsh-tools']) throw new Error('host-private dsh-tools dependency is forbidden')
if (/from ['"]@deepseek-ai\/dsh-tools/.test(files['index.js']) || /export default/.test(files['index.js'])) throw new Error('entry must be host-neutral and namespace-loadable')
for (const tool of ['dsh_narrative_ledger_inspect', 'dsh_narrative_ledger_verify', 'dsh_narrative_ledger_query']) if (!files['index.js'].includes(`name: '${tool}'`)) throw new Error(`missing DSH tool ${tool}`)
for (const tool of ['narrative_ledger_inspect_inline', 'narrative_ledger_verify_inline', 'narrative_ledger_query_inline']) if (!files['mcp-server.mjs'].includes(tool)) throw new Error(`missing MCP tool ${tool}`)
for (const unsafe of ['workspaceRoot', 'artifactDir', 'manifestPath', 'eventsPath']) if (files['mcp-server.mjs'].includes(unsafe)) throw new Error(`MCP server must not expose ${unsafe}`)
for (const proof of ['sourceBytesVerified: false', 'verifiedByReadBack: true', 'returnsProse: false']) if (!files['lib/narrative-ledger.mjs'].includes(proof)) throw new Error(`missing proof boundary ${proof}`)
console.log(JSON.stringify({ ok: true, requiredFiles: required.length, dshBundle: true, codexManifest: true, hostNeutral: true, mcpProofOnly: true, tools: 3, lifecycleScripts: false }))
