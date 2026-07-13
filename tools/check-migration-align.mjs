import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { connectionAttempts } from './db-connect.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
function loadEnv(name) {
  const path = resolve(root, name)
  if (!existsSync(path)) return {}
  const vars = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    vars[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
  return vars
}

const local = readdirSync(resolve(root, 'supabase/migrations'))
  .filter((f) => /^\d+_.*\.sql$/.test(f))
  .map((f) => f.match(/^(\d+)_/)[1])
  .sort()

const dbUrl = { ...loadEnv('.env'), ...loadEnv('.env.local') }.DATABASE_URL
let client
for (const { label, config } of connectionAttempts(dbUrl)) {
  const c = new pg.Client(config)
  try {
    await c.connect()
    client = c
    console.log('via', label)
    break
  } catch (e) {
    console.warn(label, e.message)
    await c.end().catch(() => {})
  }
}
if (!client) process.exit(1)

const { rows } = await client.query(
  `SELECT version FROM supabase_migrations.schema_migrations ORDER BY version`,
)
const remote = rows.map((r) => r.version)
const localSet = new Set(local)
const remoteSet = new Set(remote)

const onlyRemote = remote.filter((v) => !localSet.has(v))
const onlyLocal = local.filter((v) => !remoteSet.has(v))

console.log('local count', local.length, 'remote count', remote.length)
console.log('only remote:', onlyRemote.join(', ') || '(none)')
console.log('only local:', onlyLocal.join(', ') || '(none)')
console.log(onlyRemote.length === 0 && onlyLocal.length === 0 ? 'ALIGNED' : 'DRIFT')
await client.end()
process.exit(onlyRemote.length === 0 ? 0 : 1)
