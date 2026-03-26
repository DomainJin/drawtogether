import pg from 'pg'

const { Pool } = pg

let pool

export async function setupDatabase() {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://whiteboard:whiteboard@localhost:5432/whiteboard',
    max: 20,
    idleTimeoutMillis: 30000,
  })

  // Test connection
  const client = await pool.connect()
  client.release()

  await runMigrations()
  console.log('✅ Database connected')
}

export function getPool() {
  return pool
}

async function runMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      display_name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#3B8BD4',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_id UUID REFERENCES users(id),
      is_public BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      last_active_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS strokes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id),
      tool TEXT NOT NULL DEFAULT 'pen',
      color TEXT NOT NULL,
      width REAL NOT NULL,
      opacity REAL NOT NULL DEFAULT 1,
      points JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_strokes_room_id ON strokes(room_id);
    CREATE INDEX IF NOT EXISTS idx_strokes_created_at ON strokes(created_at);
  `)
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function createUser(displayName, color) {
  const { rows } = await pool.query(
    'INSERT INTO users (display_name, color) VALUES ($1, $2) RETURNING *',
    [displayName, color]
  )
  return rows[0]
}

export async function createRoom(id, name, ownerId) {
  const { rows } = await pool.query(
    'INSERT INTO rooms (id, name, owner_id) VALUES ($1, $2, $3) RETURNING *',
    [id, name, ownerId]
  )
  return rows[0]
}

export async function getRoomById(id) {
  const { rows } = await pool.query('SELECT * FROM rooms WHERE id = $1', [id])
  return rows[0] || null
}

export async function touchRoom(id) {
  await pool.query('UPDATE rooms SET last_active_at = NOW() WHERE id = $1', [id])
}

export async function saveStroke(stroke) {
  const { roomId, userId, tool, color, width, opacity, points } = stroke
  const { rows } = await pool.query(
    `INSERT INTO strokes (room_id, user_id, tool, color, width, opacity, points)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [roomId, userId, tool, color, width, opacity, JSON.stringify(points)]
  )
  return rows[0].id
}

export async function getRoomStrokes(roomId, limit = 5000) {
  const { rows } = await pool.query(
    `SELECT id, user_id, tool, color, width, opacity, points, created_at
     FROM strokes
     WHERE room_id = $1
     ORDER BY created_at ASC
     LIMIT $2`,
    [roomId, limit]
  )
  return rows
}

export async function undoLastStroke(roomId, userId) {
  const { rows } = await pool.query(
    `DELETE FROM strokes
     WHERE id = (
       SELECT id FROM strokes
       WHERE room_id = $1 AND user_id = $2
       ORDER BY created_at DESC LIMIT 1
     )
     RETURNING id`,
    [roomId, userId]
  )
  return rows[0]?.id || null
}

export async function clearRoom(roomId) {
  await pool.query('DELETE FROM strokes WHERE room_id = $1', [roomId])
}
