import Dexie, { type Table } from 'dexie'
import type { Session } from '../types'

const MAX_SESSIONS = 5
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 дней

class SplitAppDB extends Dexie {
  sessions!: Table<Session, string>

  constructor() {
    super('SplitAppDB')
    this.version(1).stores({
      sessions: 'id, createdAt, updatedAt'
    })
  }
}

export const db = new SplitAppDB()

// ─── Авто-очистка при открытии БД ────────────────────────────────────────────
export async function runCleanup() {
  const now = Date.now()
  const cutoff = now - SESSION_TTL_MS

  // Удаляем сессии старше 30 дней
  await db.sessions
    .where('updatedAt')
    .below(cutoff)
    .delete()

  // Если после удаления всё ещё больше MAX_SESSIONS — удаляем самые старые
  const count = await db.sessions.count()
  if (count > MAX_SESSIONS) {
    const all = await db.sessions.orderBy('updatedAt').toArray()
    const toDelete = all.slice(0, count - MAX_SESSIONS)
    await db.sessions.bulkDelete(toDelete.map(s => s.id))
  }
}

// ─── CRUD операции ────────────────────────────────────────────────────────────
export async function getAllSessions(): Promise<Session[]> {
  return db.sessions.orderBy('updatedAt').reverse().toArray()
}

export async function getSession(id: string): Promise<Session | undefined> {
  return db.sessions.get(id)
}

export async function saveSession(session: Session): Promise<void> {
  await db.sessions.put({ ...session, updatedAt: Date.now() })
}

export async function deleteSession(id: string): Promise<void> {
  await db.sessions.delete(id)
}

export async function clearAllSessions(): Promise<void> {
  await db.sessions.clear()
}
