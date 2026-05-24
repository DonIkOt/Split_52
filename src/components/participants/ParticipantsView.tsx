import { useState } from 'react'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { useApp } from '../../store/AppContext'

export default function ParticipantsView() {
  const { currentSession, addParticipant, removeParticipant, renameParticipant } = useApp()
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  if (!currentSession) return null

  const handleAdd = async () => {
    const name = newName.trim()
    if (!name) return
    await addParticipant(name)
    setNewName('')
  }

  const startEdit = (id: string, name: string) => {
    setEditingId(id)
    setEditName(name)
  }

  const confirmEdit = async () => {
    if (!editingId || !editName.trim()) return
    await renameParticipant(editingId, editName.trim())
    setEditingId(null)
  }

  return (
    <div className="p-4 space-y-4">
      <div className="card">
        <h2 className="font-semibold text-white mb-4">Участники</h2>
        <div className="space-y-2">
          {currentSession.participants.map(p => (
            <div key={p.id} className="flex items-center gap-3">
              {/* Аватар */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                style={{ backgroundColor: p.color }}
              >
                {p.name[0].toUpperCase()}
              </div>

              {editingId === p.id ? (
                <>
                  <input
                    className="input flex-1"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && confirmEdit()}
                    autoFocus
                  />
                  <button onClick={confirmEdit} className="text-green-400 hover:text-green-300 p-1">
                    <Check size={18} />
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-white p-1">
                    <X size={18} />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-white">{p.name}</span>
                  <button
                    onClick={() => startEdit(p.id, p.name)}
                    className="text-slate-500 hover:text-slate-300 p-1 transition-colors"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => removeParticipant(p.id)}
                    className="text-slate-500 hover:text-red-400 p-1 transition-colors"
                    disabled={currentSession.participants.length <= 2}
                    title={currentSession.participants.length <= 2 ? 'Минимум 2 участника' : ''}
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Добавить участника */}
        <div className="flex gap-2 mt-4">
          <input
            className="input flex-1"
            placeholder="Имя нового участника"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <button onClick={handleAdd} disabled={!newName.trim()} className="btn-primary disabled:opacity-40">
            <Plus size={18} />
          </button>
        </div>
      </div>

      <div className="card bg-slate-800/50 text-slate-400 text-sm space-y-1">
        <p>💡 При удалении участника его доли в позициях обнуляются.</p>
        <p>💡 Минимальное количество участников — 2.</p>
      </div>
    </div>
  )
}
