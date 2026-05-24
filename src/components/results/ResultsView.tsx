import { useState, useRef } from 'react'
import ExportPanel from '../export/ExportPanel'
import { ArrowRight, Copy, Check, Share2, ChevronDown, ChevronUp, Receipt, Users } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { calculateSummary, formatMoney, generateShareText, round2 } from '../../utils'
import type { Participant } from '../../types'

// ─── Аватар участника ─────────────────────────────────────────────────────────
function Avatar({ p, size = 9 }: { p: Participant; size?: number }) {
  const px = size * 4
  return (
    <div
      className={`w-${size} h-${size} rounded-full flex items-center justify-center font-bold text-white shrink-0`}
      style={{ backgroundColor: p.color, width: px, height: px, fontSize: px * 0.35 }}
    >
      {p.name[0].toUpperCase()}
    </div>
  )
}

// ─── Карточка участника ───────────────────────────────────────────────────────
function ParticipantCard({
  p, owed, paid, balance, transactions, allParticipants
}: {
  p: Participant
  owed: number
  paid: number
  balance: number
  transactions: { fromId: string; toId: string; amount: number }[]
  allParticipants: Participant[]
}) {
  const [expanded, setExpanded] = useState(false)

  // Транзакции касающиеся этого участника
  const myTx = transactions.filter(t => t.fromId === p.id || t.toId === p.id)

  const statusColor =
    balance > 0.5 ? 'text-green-400' :
    balance < -0.5 ? 'text-red-400' :
    'text-slate-400'

  const statusLabel =
    balance > 0.5 ? `получает ${formatMoney(balance)}` :
    balance < -0.5 ? `платит ${formatMoney(-balance)}` :
    '✓ квиты'

  const bgAccent =
    balance > 0.5 ? 'border-green-800/40' :
    balance < -0.5 ? 'border-red-800/40' :
    'border-slate-700'

  return (
    <div className={`rounded-2xl border bg-slate-800/60 overflow-hidden ${bgAccent}`}>
      {/* Основная строка */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => myTx.length > 0 && setExpanded(!expanded)}
      >
        <Avatar p={p} size={10} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-white font-semibold truncate">{p.name}</span>
            <span className={`font-bold text-base shrink-0 ${statusColor}`}>{statusLabel}</span>
          </div>

          {/* Прогресс-бар оплаты */}
          {paid > 0 && (
            <div className="mt-1.5 space-y-1">
              <div className="flex justify-between text-xs text-slate-500">
                <span>По счёту: {formatMoney(owed)}</span>
                <span>Заплатил: {formatMoney(paid)}</span>
              </div>
              <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${balance >= 0 ? 'bg-green-500' : 'bg-amber-500'}`}
                  style={{ width: `${Math.min(100, (paid / Math.max(owed, paid)) * 100)}%` }}
                />
              </div>
            </div>
          )}
          {paid === 0 && (
            <div className="text-xs text-slate-500 mt-0.5">по счёту: {formatMoney(owed)}</div>
          )}
        </div>

        {myTx.length > 0 && (
          <div className="text-slate-600 shrink-0">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        )}
      </div>

      {/* Развёрнутые транзакции участника */}
      {expanded && myTx.length > 0 && (
        <div className="border-t border-slate-700 px-4 py-3 space-y-2 bg-slate-900/30">
          {myTx.map((t, i) => {
            const other = allParticipants.find(x => x.id === (t.fromId === p.id ? t.toId : t.fromId))
            if (!other) return null
            const isDebtor = t.fromId === p.id
            return (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className={isDebtor ? 'text-red-400' : 'text-green-400'}>
                  {isDebtor ? '↗ перевести' : '↙ получить'}
                </span>
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ backgroundColor: other.color }}
                  >
                    {other.name[0].toUpperCase()}
                  </div>
                  <span className="text-slate-300">{other.name}</span>
                </div>
                <span className="text-white font-semibold ml-auto">{formatMoney(t.amount)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Главный экран ────────────────────────────────────────────────────────────
export default function ResultsView() {
  const { currentSession, navigate } = useApp()
  const [copied, setCopied] = useState(false)
  const [showReceiptBreakdown, setShowReceiptBreakdown] = useState(false)
  const summaryRef = useRef<HTMLDivElement>(null)

  if (!currentSession) return null
  const summary = calculateSummary(currentSession)
  const { participants, receipts } = currentSession

  const getP = (id: string) => participants.find(p => p.id === id)

  const handleCopy = async () => {
    const text = generateShareText(currentSession, summary)
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // fallback для старых браузеров
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  // Пустое состояние
  if (summary.totalAmount === 0) {
    return (
      <div className="p-4 flex flex-col items-center justify-center py-20 text-center gap-4">
        <div className="text-5xl">📊</div>
        <p className="text-white font-medium">Нет данных для расчёта</p>
        <p className="text-slate-400 text-sm">Добавь чеки с позициями, затем укажи кто сколько заплатил</p>
        <div className="flex gap-2 mt-2">
          <button onClick={() => navigate('table')} className="btn-secondary">← Чеки</button>
          <button onClick={() => navigate('payments')} className="btn-primary">Оплата →</button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4 pb-8" id="results-export-target">

      {/* ── Общая сумма ── */}
      <div className="card text-center py-5" ref={summaryRef}>
        <div className="text-slate-400 text-sm mb-1 flex items-center justify-center gap-1.5">
          <Receipt size={14} />
          {receipts.length} {receipts.length === 1 ? 'чек' : 'чека'} ·
          <Users size={14} />
          {participants.length} участника
        </div>
        <div className="text-4xl font-bold text-white mb-1">
          {formatMoney(summary.totalAmount)}
        </div>
        <div className="text-slate-500 text-sm">
          по {formatMoney(round2(summary.totalAmount / participants.length))} на человека
        </div>
      </div>

      {/* ── Карточки участников ── */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
          Кто сколько должен
        </h2>
        <div className="space-y-2">
          {participants.map(p => (
            <ParticipantCard
              key={p.id}
              p={p}
              owed={summary.owedByParticipant[p.id] ?? 0}
              paid={summary.paidByParticipant[p.id] ?? 0}
              balance={summary.balances[p.id] ?? 0}
              transactions={summary.transactions}
              allParticipants={participants}
            />
          ))}
        </div>
      </div>

      {/* ── Переводы ── */}
      {summary.transactions.length > 0 ? (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-white">
              Переводы
            </h2>
            <span className="text-xs text-slate-500 bg-slate-700 px-2 py-1 rounded-full">
              {summary.transactions.length} {summary.transactions.length === 1 ? 'перевод' : 'перевода'}
            </span>
          </div>

          <div className="space-y-2">
            {summary.transactions.map((t, i) => {
              const from = getP(t.fromId)
              const to = getP(t.toId)
              if (!from || !to) return null
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 bg-slate-700/40 rounded-2xl px-4 py-3"
                >
                  {/* От кого */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                      style={{ backgroundColor: from.color }}
                    >
                      {from.name[0].toUpperCase()}
                    </div>
                    <span className="text-white font-medium truncate">{from.name}</span>
                  </div>

                  {/* Стрелка + сумма */}
                  <div className="flex flex-col items-center gap-0.5 shrink-0 px-1">
                    <span className="text-green-400 font-bold text-sm">{formatMoney(t.amount)}</span>
                    <ArrowRight size={18} className="text-slate-500" />
                  </div>

                  {/* Кому */}
                  <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                    <span className="text-white font-medium truncate text-right">{to.name}</span>
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                      style={{ backgroundColor: to.color }}
                    >
                      {to.name[0].toUpperCase()}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="card text-center py-6 space-y-2">
          <div className="text-4xl">🎉</div>
          <p className="text-white font-semibold">Все квиты!</p>
          <p className="text-slate-400 text-sm">Переводы не нужны</p>
        </div>
      )}

      {/* ── Разбивка по чекам ── */}
      {receipts.length > 1 && (
        <div className="card">
          <button
            onClick={() => setShowReceiptBreakdown(!showReceiptBreakdown)}
            className="w-full flex items-center justify-between text-sm"
          >
            <span className="text-slate-300 font-medium">Разбивка по чекам</span>
            {showReceiptBreakdown ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
          </button>

          {showReceiptBreakdown && (
            <div className="mt-3 space-y-3 pt-3 border-t border-slate-700">
              {receipts.map(receipt => {
                const total = receipt.items
                  .filter(i => !i.excluded)
                  .reduce((acc, i) => acc + i.price, 0)
                if (total === 0) return null
                return (
                  <div key={receipt.id}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-300 font-medium">{receipt.name}</span>
                      <span className="text-green-400 font-semibold">{formatMoney(total)}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {participants.map(p => {
                        const amount = round2(
                          receipt.items
                            .filter(i => !i.excluded)
                            .reduce((acc, item) => acc + item.price * (item.shares[p.id] ?? 0), 0)
                        )
                        if (amount === 0) return null
                        return (
                          <div key={p.id} className="flex items-center gap-1.5 text-xs bg-slate-700 rounded-lg px-2 py-1">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                            <span className="text-slate-300">{p.name}:</span>
                            <span className="text-white font-medium">{formatMoney(amount)}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Кнопки копирования и шаринга ── */}
      <div className="space-y-2">
        <button
          onClick={handleCopy}
          className={`w-full py-3.5 rounded-2xl font-medium flex items-center justify-center gap-2 transition-all ${
            copied
              ? 'bg-green-600/20 border border-green-600/40 text-green-400'
              : 'btn-secondary'
          }`}
        >
          {copied
            ? <><Check size={18} /> Скопировано в буфер!</>
            : <><Copy size={18} /> Скопировать для мессенджера</>
          }
        </button>

        {/* Нативный Share API — на мобиле показывает "Поделиться" */}
        {typeof navigator.share === 'function' && (
          <button
            onClick={() => {
              navigator.share({
                title: currentSession.name,
                text: generateShareText(currentSession, summary),
              }).catch(() => {})
            }}
            className="w-full py-3.5 rounded-2xl font-medium flex items-center justify-center gap-2 btn-secondary"
          >
            <Share2 size={18} />
            Поделиться
          </button>
        )}
      </div>

      {/* ── Экспорт ── */}
      {summary.totalAmount > 0 && (
        <ExportPanel
          session={currentSession}
          summary={summary}
          exportTargetId="results-export-target"
        />
      )}

      {/* ── Превью текста для мессенджера ── */}
      <details className="cursor-pointer">
        <summary className="text-xs text-slate-600 hover:text-slate-400 transition-colors list-none flex items-center gap-1">
          <ChevronDown size={12} />
          Предпросмотр сообщения
        </summary>
        <pre className="mt-2 text-xs text-slate-400 bg-slate-900 rounded-xl p-3 whitespace-pre-wrap leading-relaxed">
          {generateShareText(currentSession, summary)}
        </pre>
      </details>

    </div>
  )
}
