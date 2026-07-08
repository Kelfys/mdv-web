import { readFileSync, existsSync } from 'node:fs'
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
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  return vars
}

const dbUrl = loadEnv('.env.local').DATABASE_URL
let client
for (const { label, config } of connectionAttempts(dbUrl)) {
  const c = new pg.Client(config)
  try {
    await c.connect()
    client = c
    console.log('conectado via', label)
    break
  } catch (err) {
    console.warn(label, err.message)
    await c.end().catch(() => {})
  }
}
if (!client) throw new Error('sem conexão')

const table = await client.query("SELECT to_regclass('public.content_reports') AS tbl")
const mig = await client.query("SELECT version FROM supabase_migrations.schema_migrations WHERE version = '042'")
console.log('content_reports:', table.rows[0].tbl ?? 'AUSENTE')
console.log('migration 042:', mig.rowCount > 0 ? 'registrada' : 'não registrada')
await client.end()