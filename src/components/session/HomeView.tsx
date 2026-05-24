import { useState } from 'react'
import { Plus, Trash2, ChevronRight, Receipt, Users, Calendar, AlertCircle } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { formatDate, formatMoney, calculateSummary } from '../../utils'

const MAX_SESSIONS = 5

// Подсказки для названия сессии
const NAME_HINTS = [
  'Шашлыки на даче', 'Поход в кафе', 'Совместные покупки',
  'Вечеринка у Димы', 'Поездка на море', 'Корпоратив',
]

export default function HomeView() {
  const { state, createSession, openSession, removeSession, clearAll } = useApp()
  const [showCreate, setShowCreate] = useState(state.sessions.length === 0)
  const [sessionName, setSessionName] = useState('')
  const [participantInput, setParticipantInput] = useState('')
  const [participants, setParticipants] = useState<string[]>([])
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [error, setError] = useState('')

  const hint = NAME_HINTS[Math.floor(Math.random() * NAME_HINTS.length)]

  const addParticipant = () => {
    const name = participantInput.trim()
    if (!name) return
    if (participants.map(p => p.toLowerCase()).includes(name.toLowerCase())) {
      setError('Участник с таким именем уже добавлен')
      return
    }
    setParticipants([...participants, name])
    setParticipantInput('')
    setError('')
  }

  const handleCreate = async () => {
    if (!sessionName.trim()) { setError('Введи название сессии'); return }
    if (participants.length < 2) { setError('Нужно минимум 2 участника'); return }
    if (state.sessions.length >= MAX_SESSIONS) {
      setError(`Максимум ${MAX_SESSIONS} сессий. Удали старую.`); return
    }
    const session = await createSession(sessionName.trim(), participants)
    setShowCreate(false)
    setSessionName('')
    setParticipants([])
    setError('')
    openSession(session.id)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') addParticipant()
  }

  const openCreate = () => {
    setShowCreate(true)
    setError('')
    setSessionName('')
    setParticipants([])
    setParticipantInput('')
  }

  const canCreate = state.sessions.length < MAX_SESSIONS

  return (
    <div className="min-h-screen max-w-lg mx-auto px-4 py-6 pb-12">

      {/* ── Шапка ── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">💰 СплитЧек</h1>
          <p className="text-slate-400 text-sm mt-1">Делим счёт честно и без обид</p>
        </div>
        {state.sessions.length > 0 && canCreate && (
          <button onClick={openCreate} className="btn-primary flex items-center gap-2 shadow-lg shadow-green-900/30">
            <Plus size={18} />
            Новая
          </button>
        )}
      </div>

      {/* ── Лимит сессий ── */}
      {!canCreate && (
        <div className="flex items-start gap-3 bg-amber-900/30 border border-amber-700/50 rounded-xl px-4 py-3 mb-5 text-sm text-amber-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>Достигнут лимит в {MAX_SESSIONS} сессий. Удали одну чтобы создать новую.</span>
        </div>
      )}

      {/* ── Форма создания ── */}
      {showCreate && (
        <div className="card mb-6 space-y-4 border-green-800/50 shadow-lg shadow-green-900/10">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-white text-lg">Новая сессия</h2>
            <span className="text-xs text-slate-500">{state.sessions.length}/{MAX_SESSIONS}</span>
          </div>

          {/* Название */}
          <div>
            <label className="label">Название мероприятия</label>
            <input
              className="input"
              placeholder={hint}
              value={sessionName}
              onChange={e => { setSessionName(e.target.value); setError('') }}
              autoFocus
            />
          </div>

          {/* Участники */}
          <div>
            <label className="label">
              Участники
              <span className="text-slate-600 ml-1">(мин. 2)</span>
            </label>
            <div className="flex gap-2">
              <input
                className="input"
                placeholder="Введи имя и нажми Enter"
                value={participantInput}
                onChange={e => { setParticipantInput(e.target.value); setError('') }}
                onKeyDown={handleKeyDown}
              />
              <button
                onClick={addParticipant}
                disabled={!participantInput.trim()}
                className="btn-secondary shrink-0 disabled:opacity-40"
              >
                <Plus size={18} />
              </button>
            </div>

            {/* Теги участников */}
            {participants.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {participants.map((name, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-1.5 bg-slate-700 text-slate-200 px-3 py-1.5 rounded-full text-sm"
                  >
                    <span className="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center text-xs font-bold">
                      {name[0].toUpperCase()}
                    </span>
                    {name}
                    <button
                      onClick={() => setParticipants(participants.filter((_, j) => j !== i))}
                      className="text-slate-400 hover:text-red-400 transition-colors leading-none ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Ошибка */}
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 px-3 py-2 rounded-xl">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {/* Кнопки */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCreate}
              disabled={!sessionName.trim() || participants.length < 2}
              className="btn-primary flex-1 py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Создать →
            </button>
            {state.sessions.length > 0 && (
              <button onClick={() => setShowCreate(false)} className="btn-secondary px-5">
                Отмена
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Список сессий ── */}
      {state.sessions.length > 0 && !showCreate && (
        <>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
              Сессии ({state.sessions.length}/{MAX_SESSIONS})
            </h2>
            <button
              onClick={() => setConfirmClear(true)}
              className="text-slate-600 hover:text-red-400 text-xs flex items-center gap-1 transition-colors"
            >
              <Trash2 size={12} />
              Очистить всё
            </button>
          </div>

          <div className="space-y-3">
            {state.sessions.map(session => {
              const summary = calculateSummary(session)
              const totalItems = session.receipts.reduce((acc, r) => acc + r.items.length, 0)
              const receiptCount = session.receipts.length

              return (
                <div
                  key={session.id}
                  className="card cursor-pointer hover:border-slate-500 transition-all duration-150 group active:scale-[0.99]"
                  onClick={() => openSession(session.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white truncate text-lg leading-tight">
                        {session.name}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Users size={11} />
                          {session.participants.length} участника
                        </span>
                        {receiptCount > 0 && (
                          <span className="flex items-center gap-1">
                            <Receipt size={11} />
                            {receiptCount} {receiptCount === 1 ? 'чек' : 'чека'}, {totalItems} поз.
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar size={11} />
                          {formatDate(session.updatedAt)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {summary.totalAmount > 0 && (
                        <div className="text-right">
                          <div className="text-green-400 font-bold">{formatMoney(summary.totalAmount)}</div>
                          <div className="text-xs text-slate-500">итого</div>
                        </div>
                      )}
                      <div className="flex flex-col gap-1">
                        <ChevronRight size={18} className="text-slate-600 group-hover:text-slate-300 transition-colors" />
                        <button
                          onClick={e => { e.stopPropagation(); setConfirmDelete(session.id) }}
                          className="text-slate-600 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Аватары участников */}
                  <div className="flex items-center gap-1.5 mt-3">
                    {session.participants.map((p, i) => (
                      <div
                        key={p.id}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ring-2 ring-slate-800"
                        style={{ backgroundColor: p.color, marginLeft: i > 0 ? '-4px' : '0' }}
                        title={p.name}
                      >
                        {p.name[0].toUpperCase()}
                      </div>
                    ))}
                    <span className="text-xs text-slate-500 ml-2">
                      {session.participants.map(p => p.name).join(', ')}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── Пустое состояние ── */}
      {state.sessions.length === 0 && !showCreate && (
        <div className="text-center py-20">
          <div className="text-6xl mb-5">🧾</div>
          <div className="text-white font-semibold text-xl mb-2">Нет сессий</div>
          <div className="text-slate-400 mb-8 text-sm max-w-xs mx-auto">
            Создай сессию, добавь участников и чеки — приложение само посчитает кто кому должен
          </div>
          <button onClick={openCreate} className="btn-primary px-8 py-3 text-base shadow-lg shadow-green-900/30">
            <Plus size={20} className="inline mr-2" />
            Создать первую сессию
          </button>
        </div>
      )}

      {/* ── Подсказка про автоудаление ── */}
      {state.sessions.length > 0 && !showCreate && (
        <p className="text-center text-xs text-slate-700 mt-8">
          Сессии удаляются автоматически через 30 дней
        </p>
      )}

      {/* ── Модалка: удалить одну сессию ── */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 z-50">
          <div className="card max-w-sm w-full space-y-4 mb-4 sm:mb-0">
            <h3 className="font-semibold text-white">Удалить сессию?</h3>
            <p className="text-slate-400 text-sm">
              «{state.sessions.find(s => s.id === confirmDelete)?.name}» будет удалена безвозвратно.
            </p>
            <div className="flex gap-2">
              <button
                onClick={async () => { await removeSession(confirmDelete); setConfirmDelete(null) }}
                className="btn-danger flex-1"
              >
                Удалить
              </button>
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary flex-1">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Модалка: очистить всё ── */}
      {confirmClear && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 z-50">
          <div className="card max-w-sm w-full space-y-4 mb-4 sm:mb-0">
            <h3 className="font-semibold text-white">Удалить все сессии?</h3>
            <p className="text-slate-400 text-sm">
              Все {state.sessions.length} сессий будут удалены. Это действие нельзя отменить.
            </p>
            <div className="flex gap-2">
              <button
                onClick={async () => { await clearAll(); setConfirmClear(false) }}
                className="btn-danger flex-1"
              >
                Удалить всё
              </button>
              <button onClick={() => setConfirmClear(false)} className="btn-secondary flex-1">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
