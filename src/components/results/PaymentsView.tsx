import { useState } from 'react'
import { ChevronRight, AlertCircle, CheckCircle2, Wallet } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { calculateSummary, formatMoney, round2 } from '../../utils'

export default function PaymentsView() {
  const { currentSession, setPayment, setPayments, navigate } = useApp()
  const [localValues, setLocalValues] = useState<Record<string, string>>({})

  if (!currentSession) return null

  const { participants } = currentSession
  const summary = calculateSummary(currentSession)

  const getPayment = (id: string) =>
    currentSession.payments.find(p => p.participantId === id)?.amount ?? 0

  const getDisplayValue = (id: string) =>
    localValues[id] !== undefined ? localValues[id] : (getPayment(id) || '')

  const totalPaid = round2(
    participants.reduce((acc, p) => acc + getPayment(p.id), 0)
  )
  const remaining = round2(summary.totalAmount - totalPaid)
  const isBalanced = Math.abs(remaining) < 0.5

  // Кто платил: быстрое заполнение
  // Один участник заплатил всё — один атомарный вызов
  const handlePayAll = (payerId: string) => {
    const newPayments = participants.map(p => ({
      participantId: p.id,
      amount: p.id === payerId ? summary.totalAmount : 0,
    }))
    setPayments(newPayments)
    const newLocal: Record<string, string> = {}
    participants.forEach(p => {
      newLocal[p.id] = p.id === payerId ? String(summary.totalAmount) : ''
    })
    setLocalValues(newLocal)
  }

  // Каждый заплатил свою долю — один атомарный вызов
  const handlePayOwn = () => {
    const newPayments = participants.map(p => ({
      participantId: p.id,
      amount: summary.owedByParticipant[p.id] ?? 0,
    }))
    setPayments(newPayments)
    const newLocal: Record<string, string> = {}
    participants.forEach(p => {
      const amount = summary.owedByParticipant[p.id] ?? 0
      newLocal[p.id] = amount > 0 ? String(amount) : ''
    })
    setLocalValues(newLocal)
  }

  // Сброс
  const handleReset = () => {
    setPayments([])
    setLocalValues({})
  }

  const handleChange = (id: string, raw: string) => {
    setLocalValues(prev => ({ ...prev, [id]: raw }))
    const num = parseFloat(raw)
    setPayment(id, isNaN(num) || num < 0 ? 0 : num)
  }

  // Пустое состояние — нет чеков
  if (summary.totalAmount === 0) {
    return (
      <div className="p-4 flex flex-col items-center justify-center py-20 text-center gap-4">
        <div className="text-5xl">🧾</div>
        <p className="text-white font-medium">Нет данных для расчёта</p>
        <p className="text-slate-400 text-sm">Сначала добавь чеки и позиции на вкладке «Чеки»</p>
        <button onClick={() => navigate('table')} className="btn-primary mt-2">
          Перейти к чекам →
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4 pb-8">

      {/* ── Заголовок с общей суммой ── */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-white text-lg">Кто сколько заплатил?</h2>
            <p className="text-slate-400 text-sm mt-0.5">Укажи реальные суммы на кассе</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-green-400">{formatMoney(summary.totalAmount)}</div>
            <div className="text-xs text-slate-500">общий счёт</div>
          </div>
        </div>

        {/* Прогресс-бар сколько уже введено */}
        {totalPaid > 0 && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Введено: {formatMoney(totalPaid)}</span>
              <span className={remaining > 0.5 ? 'text-amber-400' : remaining < -0.5 ? 'text-red-400' : 'text-green-400'}>
                {remaining > 0.5 ? `осталось ${formatMoney(remaining)}` :
                 remaining < -0.5 ? `превышение ${formatMoney(-remaining)}` :
                 '✓ сходится'}
              </span>
            </div>
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isBalanced ? 'bg-green-500' : totalPaid > summary.totalAmount ? 'bg-red-500' : 'bg-amber-500'
                }`}
                style={{ width: `${Math.min(100, (totalPaid / summary.totalAmount) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Быстрые пресеты ── */}
      <div className="card space-y-3">
        <p className="text-sm font-medium text-slate-300">⚡ Быстрое заполнение</p>

        {/* Весь счёт платил один */}
        <div>
          <p className="text-xs text-slate-500 mb-2">Один заплатил за всех:</p>
          <div className="flex flex-wrap gap-2">
            {participants.map(p => (
              <button
                key={p.id}
                onClick={() => handlePayAll(p.id)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 transition-colors text-sm"
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: p.color }}
                >
                  {p.name[0].toUpperCase()}
                </div>
                <span className="text-white">{p.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Каждый платил своё */}
        <div className="flex gap-2">
          <button
            onClick={handlePayOwn}
            className="flex-1 btn-secondary text-sm flex items-center justify-center gap-2"
          >
            <Wallet size={15} />
            Каждый заплатил свою долю
          </button>
          <button
            onClick={handleReset}
            className="btn-secondary text-sm px-4 text-slate-500"
          >
            Сброс
          </button>
        </div>
      </div>

      {/* ── Ввод сумм ── */}
      <div className="card space-y-1">
        <p className="text-sm font-medium text-slate-300 mb-3">Или введи вручную:</p>
        {participants.map(p => {
          const paid = getPayment(p.id)
          const owed = summary.owedByParticipant[p.id] ?? 0
          const diff = round2(paid - owed)

          return (
            <div key={p.id} className="flex items-center gap-3 py-2 border-b border-slate-700/50 last:border-0">
              {/* Аватар */}
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                style={{ backgroundColor: p.color }}
              >
                {p.name[0].toUpperCase()}
              </div>

              {/* Имя + подсказка */}
              <div className="flex-1 min-w-0">
                <div className="text-white font-medium">{p.name}</div>
                <div className="text-xs text-slate-500">
                  по счёту: {formatMoney(owed)}
                  {paid > 0 && diff !== 0 && (
                    <span className={`ml-2 ${diff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {diff > 0 ? `переплата ${formatMoney(diff)}` : `недоплата ${formatMoney(-diff)}`}
                    </span>
                  )}
                </div>
              </div>

              {/* Инпут */}
              <div className="relative shrink-0">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input w-32 text-right pr-7"
                  placeholder="0"
                  value={getDisplayValue(p.id)}
                  onChange={e => handleChange(p.id, e.target.value)}
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm pointer-events-none">₽</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Предупреждение если суммы не сходятся ── */}
      {totalPaid > 0 && !isBalanced && (
        <div className={`flex items-start gap-3 rounded-xl px-4 py-3 text-sm border ${
          remaining > 0
            ? 'bg-amber-900/20 border-amber-700/40 text-amber-300'
            : 'bg-red-900/20 border-red-700/40 text-red-300'
        }`}>
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <div>
            {remaining > 0
              ? `Не хватает ${formatMoney(remaining)} — кто-то ещё платил?`
              : `Введено на ${formatMoney(-remaining)} больше суммы чеков`
            }
          </div>
        </div>
      )}

      {/* ── Кнопка перехода к итогам ── */}
      <button
        onClick={() => navigate('results')}
        disabled={summary.totalAmount === 0}
        className={`w-full py-4 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 transition-all ${
          isBalanced && totalPaid > 0
            ? 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/40'
            : 'btn-secondary'
        }`}
      >
        {isBalanced && totalPaid > 0
          ? <><CheckCircle2 size={20} /> Посчитать итоги</>
          : <>Посчитать итоги <ChevronRight size={20} /></>
        }
      </button>

      {totalPaid === 0 && (
        <p className="text-center text-xs text-slate-600">
          Можно пропустить этот шаг — расчёт будет без оптимизации переводов
        </p>
      )}
    </div>
  )
}
