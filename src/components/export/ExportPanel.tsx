import { useState } from 'react'
import { FileImage, FileSpreadsheet, Loader2, Check, AlertCircle } from 'lucide-react'
import { exportToJpg, exportToExcel } from '../../utils/exportUtils'
import type { Session, SessionSummary } from '../../types'

type ExportState = 'idle' | 'loading' | 'done' | 'error'

interface ButtonState {
  jpg: ExportState
  xlsx: ExportState
}

interface ExportPanelProps {
  session: Session
  summary: SessionSummary
  exportTargetId: string   // id DOM-элемента для скриншота
}

export default function ExportPanel({ session, summary, exportTargetId }: ExportPanelProps) {
  const [state, setState] = useState<ButtonState>({ jpg: 'idle', xlsx: 'idle' })
  const [error, setError] = useState<string | null>(null)

  const filename = session.name.replace(/[^\wа-яёА-ЯЁ\s]/gi, '').trim().replace(/\s+/g, '_')

  const handleJpg = async () => {
    if (state.jpg === 'loading') return
    setState(s => ({ ...s, jpg: 'loading' }))
    setError(null)
    try {
      await exportToJpg(exportTargetId, `СплитЧек_${filename}.jpg`)
      setState(s => ({ ...s, jpg: 'done' }))
      setTimeout(() => setState(s => ({ ...s, jpg: 'idle' })), 2500)
    } catch (e) {
      console.error(e)
      setError('Не удалось сохранить изображение')
      setState(s => ({ ...s, jpg: 'error' }))
      setTimeout(() => setState(s => ({ ...s, jpg: 'idle' })), 3000)
    }
  }

  const handleXlsx = async () => {
    if (state.xlsx === 'loading') return
    setState(s => ({ ...s, xlsx: 'loading' }))
    setError(null)
    try {
      await exportToExcel(session, summary)
      setState(s => ({ ...s, xlsx: 'done' }))
      setTimeout(() => setState(s => ({ ...s, xlsx: 'idle' })), 2500)
    } catch (e) {
      console.error(e)
      setError('Не удалось создать Excel файл')
      setState(s => ({ ...s, xlsx: 'error' }))
      setTimeout(() => setState(s => ({ ...s, xlsx: 'idle' })), 3000)
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 uppercase tracking-widest font-medium">Экспорт</p>

      <div className="grid grid-cols-2 gap-2">
        {/* JPG */}
        <button
          onClick={handleJpg}
          disabled={state.jpg === 'loading'}
          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border font-medium text-sm transition-all ${
            state.jpg === 'done'
              ? 'bg-green-900/30 border-green-700/50 text-green-400'
              : state.jpg === 'error'
              ? 'bg-red-900/30 border-red-700/50 text-red-400'
              : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white'
          } disabled:cursor-not-allowed`}
        >
          {state.jpg === 'loading' && <Loader2 size={16} className="animate-spin" />}
          {state.jpg === 'done'    && <Check size={16} />}
          {state.jpg === 'error'   && <AlertCircle size={16} />}
          {state.jpg === 'idle'    && <FileImage size={16} />}
          <span>
            {state.jpg === 'loading' ? 'Сохраняю...'
           : state.jpg === 'done'    ? 'Сохранено!'
           : state.jpg === 'error'   ? 'Ошибка'
           : 'Картинка JPG'}
          </span>
        </button>

        {/* Excel */}
        <button
          onClick={handleXlsx}
          disabled={state.xlsx === 'loading'}
          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border font-medium text-sm transition-all ${
            state.xlsx === 'done'
              ? 'bg-green-900/30 border-green-700/50 text-green-400'
              : state.xlsx === 'error'
              ? 'bg-red-900/30 border-red-700/50 text-red-400'
              : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white'
          } disabled:cursor-not-allowed`}
        >
          {state.xlsx === 'loading' && <Loader2 size={16} className="animate-spin" />}
          {state.xlsx === 'done'    && <Check size={16} />}
          {state.xlsx === 'error'   && <AlertCircle size={16} />}
          {state.xlsx === 'idle'    && <FileSpreadsheet size={16} />}
          <span>
            {state.xlsx === 'loading' ? 'Создаю...'
           : state.xlsx === 'done'    ? 'Готово!'
           : state.xlsx === 'error'   ? 'Ошибка'
           : 'Таблица Excel'}
          </span>
        </button>
      </div>

      {/* Ошибка */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-xs bg-red-900/20 border border-red-800/40 px-3 py-2 rounded-xl">
          <AlertCircle size={13} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Подсказки */}
      <div className="text-xs text-slate-700 space-y-0.5 pt-1">
        <p>JPG — скриншот экрана итогов для отправки в чат</p>
        <p>Excel — полная таблица с долями, итогами и переводами</p>
      </div>
    </div>
  )
}
