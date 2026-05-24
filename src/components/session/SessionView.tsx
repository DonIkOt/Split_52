import { ArrowLeft, Receipt, Users, CreditCard, BarChart3, Trash2 } from 'lucide-react'
import { useApp, type AppView } from '../../store/AppContext'
import TableView from '../table/TableView'
import PaymentsView from '../results/PaymentsView'
import ResultsView from '../results/ResultsView'
import ParticipantsView from '../participants/ParticipantsView'
import { calculateSummary, formatMoney } from '../../utils'
import { useState } from 'react'

const TABS: { id: AppView; label: string; icon: React.ReactNode }[] = [
  { id: 'table',    label: 'Чеки',      icon: <Receipt size={20} /> },
  { id: 'session',  label: 'Участники', icon: <Users size={20} /> },
  { id: 'payments', label: 'Оплата',    icon: <CreditCard size={20} /> },
  { id: 'results',  label: 'Итоги',     icon: <BarChart3 size={20} /> },
]

export default function SessionView() {
  const { state, currentSession, navigate, removeSession } = useApp()
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (!currentSession) {
    navigate('home')
    return null
  }

  const summary = calculateSummary(currentSession)
  const activeTab = (state.view === 'home' ? 'table' : state.view) as AppView

  return (
    <div className="min-h-screen flex flex-col max-w-2xl mx-auto">

      {/* ── Шапка ── */}
      <div className="bg-slate-800/95 backdrop-blur border-b border-slate-700 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={() => navigate('home')}
          className="text-slate-400 hover:text-white transition-colors p-1.5 -ml-1.5 rounded-lg hover:bg-slate-700"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white truncate leading-tight">{currentSession.name}</div>
          <div className="text-xs text-slate-500 truncate">
            {currentSession.participants.map(p => p.name).join(' · ')}
          </div>
        </div>

        {/* Итого в шапке */}
        {summary.totalAmount > 0 && (
          <span className="text-green-400 font-bold text-sm shrink-0">
            {formatMoney(summary.totalAmount)}
          </span>
        )}

        <button
          onClick={() => setConfirmDelete(true)}
          className="text-slate-600 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-slate-700 shrink-0"
          title="Удалить сессию"
        >
          <Trash2 size={18} />
        </button>
      </div>

      {/* ── Контент ── */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'table'    && <TableView />}
        {activeTab === 'session'  && <ParticipantsView />}
        {activeTab === 'payments' && <PaymentsView />}
        {activeTab === 'results'  && <ResultsView />}
      </div>

      {/* ── Навбар снизу ── */}
      <div className="bg-slate-800/95 backdrop-blur border-t border-slate-700 flex sticky bottom-0 safe-area-bottom">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => navigate(tab.id)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-green-400'
                : 'text-slate-500 hover:text-slate-300 active:text-slate-200'
            }`}
          >
            <span className={`transition-transform ${activeTab === tab.id ? 'scale-110' : ''}`}>
              {tab.icon}
            </span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Модалка удаления ── */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 z-50">
          <div className="card max-w-sm w-full space-y-4 mb-4 sm:mb-0">
            <h3 className="font-semibold text-white">Удалить сессию?</h3>
            <p className="text-slate-400 text-sm">
              «{currentSession.name}» и все данные будут удалены безвозвратно.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { removeSession(currentSession.id); setConfirmDelete(false) }}
                className="btn-danger flex-1"
              >
                Удалить
              </button>
              <button onClick={() => setConfirmDelete(false)} className="btn-secondary flex-1">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
