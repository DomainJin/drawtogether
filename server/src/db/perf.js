/** Lưu trữ Performance mode. Tách khỏi db/index.js (whiteboard) — hai mode
 *  không dùng chung bảng nào. Config trong DB luôn đi qua sanitizeConfig lúc
 *  đọc, nên thêm field mới vào schema không cần migration. */
import { getPool } from './index.js'
import { sanitizeConfig } from '../perf/configSchema.js'

export async function setupPerfTables() {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS perf_events (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      admin_key TEXT NOT NULL,
      config JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS perf_signatures (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES perf_events(id) ON DELETE CASCADE,
      cid TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      color TEXT,
      aspect REAL NOT NULL,
      strokes JSONB NOT NULL,
      status TEXT NOT NULL DEFAULT 'visible',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (event_id, cid)
    );

    CREATE INDEX IF NOT EXISTS idx_perf_sig_event ON perf_signatures(event_id, created_at);
  `)
}

const toEvent = (row) => row && { id: row.id, name: row.name }

const toSignature = (row) => ({
  id: row.id,
  cid: row.cid,
  name: row.name,
  color: row.color,
  aspect: row.aspect,
  strokes: row.strokes,
  status: row.status,
  createdAt: new Date(row.created_at).getTime(),
})

export async function createPerfEvent(id, name, adminKey, config) {
  const { rows } = await getPool().query(
    'INSERT INTO perf_events (id, name, admin_key, config) VALUES ($1, $2, $3, $4) RETURNING *',
    [id, name, adminKey, JSON.stringify(config)],
  )
  return toEvent(rows[0])
}

/** @returns {{event, adminKey, config} | null} */
export async function getPerfEvent(id) {
  const { rows } = await getPool().query('SELECT * FROM perf_events WHERE id = $1', [id])
  const row = rows[0]
  if (!row) return null
  return { event: toEvent(row), adminKey: row.admin_key, config: sanitizeConfig(row.config) }
}

export async function savePerfConfig(id, config) {
  await getPool().query('UPDATE perf_events SET config = $2 WHERE id = $1', [id, JSON.stringify(config)])
}

export async function listSignatures(eventId, limit) {
  const { rows } = await getPool().query(
    `SELECT * FROM perf_signatures WHERE event_id = $1
     ORDER BY created_at ASC, id ASC LIMIT $2`,
    [eventId, limit],
  )
  return rows.map(toSignature)
}

export async function countSignatures(eventId) {
  const { rows } = await getPool().query('SELECT COUNT(*)::int AS n FROM perf_signatures WHERE event_id = $1', [eventId])
  return rows[0].n
}

/** Retry cùng `cid` (client chưa nhận được ack) trả lại bản đã lưu thay vì tạo
 *  bản thứ hai — màn LED không hiện một chữ ký hai lần.
 *  @returns {{signature, created: boolean}} */
export async function insertSignature(eventId, id, sig, status) {
  const { rows } = await getPool().query(
    `INSERT INTO perf_signatures (id, event_id, cid, name, color, aspect, strokes, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (event_id, cid) DO NOTHING RETURNING *`,
    [id, eventId, sig.cid, sig.name, sig.color, sig.aspect, JSON.stringify(sig.strokes), status],
  )
  if (rows[0]) return { signature: toSignature(rows[0]), created: true }
  const existing = await getPool().query(
    'SELECT * FROM perf_signatures WHERE event_id = $1 AND cid = $2', [eventId, sig.cid],
  )
  return { signature: toSignature(existing.rows[0]), created: false }
}

export async function setSignatureStatus(eventId, id, status) {
  const { rowCount } = await getPool().query(
    'UPDATE perf_signatures SET status = $3 WHERE event_id = $1 AND id = $2', [eventId, id, status],
  )
  return rowCount > 0
}

export async function deleteSignature(eventId, id) {
  const { rowCount } = await getPool().query(
    'DELETE FROM perf_signatures WHERE event_id = $1 AND id = $2', [eventId, id],
  )
  return rowCount > 0
}

export async function clearSignatures(eventId) {
  const { rowCount } = await getPool().query('DELETE FROM perf_signatures WHERE event_id = $1', [eventId])
  return rowCount
}
