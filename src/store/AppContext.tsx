import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react'
import type { Session, Participant, Receipt, ReceiptItem } from '../types'
import { db, getAllSessions, saveSession, deleteSession, runCleanup } from '../db'
import { genId, defaultShares, AVATAR_COLORS } from '../utils'

// ─── Состояние ────────────────────────────────────────────────────────────────
interface AppState {
  sessions: Session[]
  currentSessionId: string | null
  view: AppView
  loading: boolean
}

export type AppView = 'home' | 'session' | 'table' | 'payments' | 'results'

// ─── Экшены ───────────────────────────────────────────────────────────────────
type Action =
  | { type: 'SET_SESSIONS'; sessions: Session[] }
  | { type: 'SET_CURRENT'; id: string | null }
  | { type: 'SET_VIEW'; view: AppView }
  | { type: 'UPSERT_SESSION'; session: Session }
  | { type: 'REMOVE_SESSION'; id: string }
  | { type: 'SET_LOADING'; loading: boolean }

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_SESSIONS':
      return { ...state, sessions: action.sessions }
    case 'SET_CURRENT':
      return { ...state, currentSessionId: action.id }
    case 'SET_VIEW':
      return { ...state, view: action.view }
    case 'UPSERT_SESSION': {
      const exists = state.sessions.find(s => s.id === action.session.id)
      const sessions = exists
        ? state.sessions.map(s => s.id === action.session.id ? action.session : s)
        : [action.session, ...state.sessions]
      return { ...state, sessions }
    }
    case 'REMOVE_SESSION':
      return { ...state, sessions: state.sessions.filter(s => s.id !== action.id) }
    case 'SET_LOADING':
      return { ...state, loading: action.loading }
    default:
      return state
  }
}

const initialState: AppState = {
  sessions: [],
  currentSessionId: null,
  view: 'home',
  loading: true,
}

// ─── Контекст ─────────────────────────────────────────────────────────────────
interface AppContextValue {
  state: AppState
  currentSession: Session | null
  // Навигация
  navigate: (view: AppView) => void
  // Сессии
  createSession: (name: string, participantNames: string[]) => Promise<Session>
  openSession: (id: string) => void
  removeSession: (id: string) => Promise<void>
  clearAll: () => Promise<void>
  // Участники
  addParticipant: (name: string) => Promise<void>
  removeParticipant: (id: string) => Promise<void>
  renameParticipant: (id: string, name: string) => Promise<void>
  // Чеки и позиции
  addReceipt: (name: string) => Promise<Receipt>
  removeReceipt: (receiptId: string) => Promise<void>
  renameReceipt: (receiptId: string, name: string) => Promise<void>
  addItem: (receiptId: string, name: string, price: number) => Promise<void>
  addItems: (receiptId: string, items: { name: string; price: number }[]) => Promise<void>
  updateItem: (receiptId: string, item: ReceiptItem) => Promise<void>
  removeItem: (receiptId: string, itemId: string) => Promise<void>
  // Оплата
  setPayment: (participantId: string, amount: number) => Promise<void>
  setPayments: (payments: { participantId: string; amount: number }[]) => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  // Загрузка при старте
  useEffect(() => {
    ;(async () => {
      await runCleanup()
      const sessions = await getAllSessions()
      dispatch({ type: 'SET_SESSIONS', sessions })
      dispatch({ type: 'SET_LOADING', loading: false })
    })()
  }, [])

  const currentSession = state.currentSessionId
    ? state.sessions.find(s => s.id === state.currentSessionId) ?? null
    : null

  // Хелпер: обновить сессию
  const updateSession = useCallback(async (session: Session) => {
    const updated = { ...session, updatedAt: Date.now() }
    await saveSession(updated)
    dispatch({ type: 'UPSERT_SESSION', session: updated })
    return updated
  }, [])

  const navigate = useCallback((view: AppView) => {
    dispatch({ type: 'SET_VIEW', view })
  }, [])

  // ─── Сессии ────────────────────────────────────────────────────────────────
  const createSession = useCallback(async (name: string, participantNames: string[]): Promise<Session> => {
    const participants: Participant[] = participantNames.map((pName, i) => ({
      id: genId(),
      name: pName.trim(),
      color: AVATAR_COLORS[i % AVATAR_COLORS.length],
    }))
    const session: Session = {
      id: genId(),
      name,
      participants,
      receipts: [],
      payments: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await saveSession(session)
    dispatch({ type: 'UPSERT_SESSION', session })
    dispatch({ type: 'SET_CURRENT', id: session.id })
    return session
  }, [])

  const openSession = useCallback((id: string) => {
    dispatch({ type: 'SET_CURRENT', id })
    dispatch({ type: 'SET_VIEW', view: 'session' })
  }, [])

  const removeSession = useCallback(async (id: string) => {
    await deleteSession(id)
    dispatch({ type: 'REMOVE_SESSION', id })
    if (state.currentSessionId === id) {
      dispatch({ type: 'SET_CURRENT', id: null })
      dispatch({ type: 'SET_VIEW', view: 'home' })
    }
  }, [state.currentSessionId])

  const clearAll = useCallback(async () => {
    await db.sessions.clear()
    dispatch({ type: 'SET_SESSIONS', sessions: [] })
    dispatch({ type: 'SET_CURRENT', id: null })
    dispatch({ type: 'SET_VIEW', view: 'home' })
  }, [])

  // ─── Участники ─────────────────────────────────────────────────────────────
  const addParticipant = useCallback(async (name: string) => {
    if (!currentSession) return
    const participant: Participant = {
      id: genId(),
      name,
      color: AVATAR_COLORS[currentSession.participants.length % AVATAR_COLORS.length],
    }
    const updated = {
      ...currentSession,
      participants: [...currentSession.participants, participant],
    }
    await updateSession(updated)
  }, [currentSession, updateSession])

  const removeParticipant = useCallback(async (id: string) => {
    if (!currentSession) return
    const updated = {
      ...currentSession,
      participants: currentSession.participants.filter(p => p.id !== id),
      receipts: currentSession.receipts.map(r => ({
        ...r,
        items: r.items.map(item => {
          const { [id]: _, ...shares } = item.shares
          return { ...item, shares }
        })
      })),
      payments: currentSession.payments.filter(p => p.participantId !== id),
    }
    await updateSession(updated)
  }, [currentSession, updateSession])

  const renameParticipant = useCallback(async (id: string, name: string) => {
    if (!currentSession) return
    const updated = {
      ...currentSession,
      participants: currentSession.participants.map(p =>
        p.id === id ? { ...p, name } : p
      ),
    }
    await updateSession(updated)
  }, [currentSession, updateSession])

  // ─── Чеки ──────────────────────────────────────────────────────────────────
  const addReceipt = useCallback(async (name: string): Promise<Receipt> => {
    if (!currentSession) throw new Error('No session')
    const receipt: Receipt = {
      id: genId(),
      name,
      items: [],
      createdAt: Date.now(),
    }
    const updated = {
      ...currentSession,
      receipts: [...currentSession.receipts, receipt],
    }
    await updateSession(updated)
    return receipt
  }, [currentSession, updateSession])

  const removeReceipt = useCallback(async (receiptId: string) => {
    if (!currentSession) return
    const updated = {
      ...currentSession,
      receipts: currentSession.receipts.filter(r => r.id !== receiptId),
    }
    await updateSession(updated)
  }, [currentSession, updateSession])

  const renameReceipt = useCallback(async (receiptId: string, name: string) => {
    if (!currentSession) return
    const updated = {
      ...currentSession,
      receipts: currentSession.receipts.map(r =>
        r.id === receiptId ? { ...r, name } : r
      ),
    }
    await updateSession(updated)
  }, [currentSession, updateSession])

  // ─── Позиции ───────────────────────────────────────────────────────────────
  const addItem = useCallback(async (receiptId: string, name: string, price: number) => {
    if (!currentSession) return
    const ids = currentSession.participants.map(p => p.id)
    const item: ReceiptItem = {
      id: genId(),
      name,
      price,
      shares: defaultShares(ids),
    }
    const updated = {
      ...currentSession,
      receipts: currentSession.receipts.map(r =>
        r.id === receiptId ? { ...r, items: [...r.items, item] } : r
      ),
    }
    await updateSession(updated)
  }, [currentSession, updateSession])

  // Добавить несколько позиций за один раз (для OCR — избегаем stale closure)
  const addItems = useCallback(async (receiptId: string, newItems: { name: string; price: number }[]) => {
    if (!currentSession) return
    const ids = currentSession.participants.map(p => p.id)
    const items: ReceiptItem[] = newItems.map(({ name, price }) => ({
      id: genId(),
      name,
      price,
      shares: defaultShares(ids),
    }))
    const updated = {
      ...currentSession,
      receipts: currentSession.receipts.map(r =>
        r.id === receiptId ? { ...r, items: [...r.items, ...items] } : r
      ),
    }
    await updateSession(updated)
  }, [currentSession, updateSession])

  const updateItem = useCallback(async (receiptId: string, item: ReceiptItem) => {
    if (!currentSession) return
    const updated = {
      ...currentSession,
      receipts: currentSession.receipts.map(r =>
        r.id === receiptId
          ? { ...r, items: r.items.map(i => i.id === item.id ? item : i) }
          : r
      ),
    }
    await updateSession(updated)
  }, [currentSession, updateSession])

  const removeItem = useCallback(async (receiptId: string, itemId: string) => {
    if (!currentSession) return
    const updated = {
      ...currentSession,
      receipts: currentSession.receipts.map(r =>
        r.id === receiptId
          ? { ...r, items: r.items.filter(i => i.id !== itemId) }
          : r
      ),
    }
    await updateSession(updated)
  }, [currentSession, updateSession])

  // ─── Оплата ────────────────────────────────────────────────────────────────
  const setPayment = useCallback(async (participantId: string, amount: number) => {
    if (!currentSession) return
    const payments = currentSession.payments.filter(p => p.participantId !== participantId)
    if (amount > 0) payments.push({ participantId, amount })
    await updateSession({ ...currentSession, payments })
  }, [currentSession, updateSession])

  // Установить несколько оплат за один раз (избегаем stale closure при цикле)
  const setPayments = useCallback(async (newPayments: { participantId: string; amount: number }[]) => {
    if (!currentSession) return
    const payments = newPayments.filter(p => p.amount > 0)
    await updateSession({ ...currentSession, payments })
  }, [currentSession, updateSession])

  const value: AppContextValue = {
    state,
    currentSession,
    navigate,
    createSession,
    openSession,
    removeSession,
    clearAll,
    addParticipant,
    removeParticipant,
    renameParticipant,
    addReceipt,
    removeReceipt,
    renameReceipt,
    addItem,
    addItems,
    updateItem,
    removeItem,
    setPayment,
    setPayments,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
