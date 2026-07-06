/**
 * Cliente Supabase (singleton).
 *
 * Carrega o SDK via CDN ESM — sem bundler no projeto.
 * Credenciais em js/config.js; use isSupabaseConfigured() antes de operações.
 *
 * Melhorias futuras:
 * - Mover SDK para npm + bundler para versionamento fixo
 * - Listener onAuthStateChange para refresh automático de sessão
 * - Retry com backoff em falhas de rede
 */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js'

let client = null

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.includes('xxxxxxxx'))
}

export function getSupabase() {
  if (!isSupabaseConfigured()) return null
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  }
  return client
}

export async function requireClient() {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase não configurado. Edite js/config.js com URL e chave anon.')
  return sb
}