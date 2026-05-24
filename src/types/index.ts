// ─── Участник ────────────────────────────────────────────────────────────────
export interface Participant {
  id: string
  name: string
  color: string  // hex цвет аватара
}

// ─── Позиция в чеке ───────────────────────────────────────────────────────────
export interface ReceiptItem {
  id: string
  name: string
  price: number
  // Доли каждого участника: { participantId: 0..1 }
  // Сумма долей может быть < 1 (никто не оплачивает остаток) или = 1
  shares: Record<string, number>
  // Флаг: оплачено отдельно (исключить из расчёта)
  excluded?: boolean
  // Категория: food | drink | alcohol | other
  category?: ItemCategory
}

export type ItemCategory = 'food' | 'drink' | 'alcohol' | 'other'

// ─── Чек (один из нескольких в сессии) ───────────────────────────────────────
export interface Receipt {
  id: string
  name: string       // "Магнит", "Кафе Уют" и т.д.
  items: ReceiptItem[]
  createdAt: number  // timestamp
}

// ─── Информация о том, кто сколько заплатил ──────────────────────────────────
export interface Payment {
  participantId: string
  amount: number
}

// ─── Итоговая транзакция: кто → кому → сколько ───────────────────────────────
export interface Transaction {
  fromId: string
  toId: string
  amount: number
}

// ─── Сессия (главная единица) ─────────────────────────────────────────────────
export interface Session {
  id: string
  name: string           // "Шашлыки 24 мая"
  participants: Participant[]
  receipts: Receipt[]
  payments: Payment[]    // кто сколько реально заплатил на кассе
  createdAt: number
  updatedAt: number
}

// ─── Вычисленные итоги (не хранятся в БД, считаются на лету) ─────────────────
export interface SessionSummary {
  // Сколько каждый должен заплатить по своим долям
  owedByParticipant: Record<string, number>
  // Сколько каждый уже заплатил
  paidByParticipant: Record<string, number>
  // Баланс: отрицательный = должен, положительный = ему должны
  balances: Record<string, number>
  // Оптимальные транзакции для погашения долгов
  transactions: Transaction[]
  // Общая сумма всех чеков
  totalAmount: number
}
