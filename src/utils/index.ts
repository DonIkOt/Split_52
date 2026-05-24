import type { Session, SessionSummary, Transaction, ReceiptItem } from '../types'

// ─── Округление до 2 знаков ───────────────────────────────────────────────────
export const round2 = (n: number) => Math.round(n * 100) / 100

// ─── Генерация ID ─────────────────────────────────────────────────────────────
export const genId = () => crypto.randomUUID()

// ─── Цвета для аватаров участников ───────────────────────────────────────────
export const AVATAR_COLORS = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
]

// ─── Дефолтные доли: поровну на всех участников ──────────────────────────────
export function defaultShares(participantIds: string[]): Record<string, number> {
  const share = round2(1 / participantIds.length)
  const shares: Record<string, number> = {}
  participantIds.forEach((id, i) => {
    // Последнему отдаём остаток чтобы сумма была ровно 1
    if (i === participantIds.length - 1) {
      const sum = participantIds.slice(0, -1).reduce((acc) => acc + share, 0)
      shares[id] = round2(1 - sum)
    } else {
      shares[id] = share
    }
  })
  return shares
}

// ─── Логика "установил 1 → остальные 0" ──────────────────────────────────────
export function applyExclusiveShare(
  item: ReceiptItem,
  participantId: string,
  value: number
): Record<string, number> {
  const shares = { ...item.shares }
  if (value === 1) {
    // Ставим 1 этому, остальным 0
    Object.keys(shares).forEach(id => {
      shares[id] = id === participantId ? 1 : 0
    })
  } else {
    shares[participantId] = value
  }
  return shares
}

// ─── Считаем итоги сессии ─────────────────────────────────────────────────────
export function calculateSummary(session: Session): SessionSummary {
  const { participants, receipts, payments } = session
  const ids = participants.map(p => p.id)

  // Инициализируем нули
  const owedByParticipant: Record<string, number> = {}
  const paidByParticipant: Record<string, number> = {}
  ids.forEach(id => {
    owedByParticipant[id] = 0
    paidByParticipant[id] = 0
  })

  let totalAmount = 0

  // Считаем что должен каждый по долям
  for (const receipt of receipts) {
    for (const item of receipt.items) {
      if (item.excluded) continue
      totalAmount += item.price
      for (const id of ids) {
        const share = item.shares[id] ?? 0
        owedByParticipant[id] = round2(owedByParticipant[id] + item.price * share)
      }
    }
  }

  // Считаем кто сколько заплатил
  for (const payment of payments) {
    paidByParticipant[payment.participantId] = round2(
      (paidByParticipant[payment.participantId] ?? 0) + payment.amount
    )
  }

  // Балансы
  const balances: Record<string, number> = {}
  ids.forEach(id => {
    balances[id] = round2(paidByParticipant[id] - owedByParticipant[id])
  })

  // Алгоритм минимизации транзакций
  const transactions = minimizeTransactions(balances)

  return {
    owedByParticipant,
    paidByParticipant,
    balances,
    transactions,
    totalAmount: round2(totalAmount),
  }
}

// ─── Алгоритм минимизации количества переводов ───────────────────────────────
// Жадный алгоритм: самый большой должник → самому большому кредитору
function minimizeTransactions(balances: Record<string, number>): Transaction[] {
  const transactions: Transaction[] = []

  const debtors = Object.entries(balances)
    .filter(([, b]) => b < -0.01)
    .map(([id, b]) => ({ id, amount: -b }))
    .sort((a, b) => b.amount - a.amount)

  const creditors = Object.entries(balances)
    .filter(([, b]) => b > 0.01)
    .map(([id, b]) => ({ id, amount: b }))
    .sort((a, b) => b.amount - a.amount)

  let i = 0, j = 0
  while (i < debtors.length && j < creditors.length) {
    const debt = debtors[i]
    const credit = creditors[j]
    const amount = round2(Math.min(debt.amount, credit.amount))

    transactions.push({ fromId: debt.id, toId: credit.id, amount })

    debt.amount = round2(debt.amount - amount)
    credit.amount = round2(credit.amount - amount)

    if (debt.amount < 0.01) i++
    if (credit.amount < 0.01) j++
  }

  return transactions
}

// ─── Форматирование суммы ─────────────────────────────────────────────────────
export function formatMoney(amount: number): string {
  return amount.toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }) + ' ₽'
}

// ─── Форматирование даты ──────────────────────────────────────────────────────
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// ─── Текст для мессенджера ────────────────────────────────────────────────────
export function generateShareText(session: Session, summary: SessionSummary): string {
  const lines: string[] = [
    `💰 ${session.name}`,
    `📋 Итого: ${formatMoney(summary.totalAmount)}`,
    '',
    '👥 Кто сколько должен:',
  ]

  session.participants.forEach(p => {
    const owed = summary.owedByParticipant[p.id] ?? 0
    lines.push(`  ${p.name}: ${formatMoney(owed)}`)
  })

  if (summary.transactions.length > 0) {
    lines.push('', '💸 Переводы:')
    summary.transactions.forEach(t => {
      const from = session.participants.find(p => p.id === t.fromId)?.name ?? '?'
      const to = session.participants.find(p => p.id === t.toId)?.name ?? '?'
      lines.push(`  ${from} → ${to}: ${formatMoney(t.amount)}`)
    })
  }

  return lines.join('\n')
}
