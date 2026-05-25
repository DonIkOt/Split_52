import { useState } from 'react'
import { X, ClipboardPaste, Copy, Check, FileJson, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { formatMoney } from '../../utils'

// ─── Промпт для копирования в Claude/ChatGPT ────────────────────────────────
const AI_PROMPT = `Посмотри на этот чек и верни ТОЛЬКО JSON массив товаров без лишнего текста.
Формат строго такой:
[{"name":"название товара","price":цена},...]

Правила:
- name: название как в чеке, можно сократить если очень длинное
- price: итоговая цена позиции (если 2шт × 50р = 100р, то price = 100)
- Не включай строки: итого, скидка, НДС, кассир и подобные
- Только товары с ценами
- Числа без кавычек, точка как разделитель дробной части`

// ─── Парсер вставленного текста ──────────────────────────────────────────────
interface ImportedItem {
  name: string
  price: number
}

function parseImportText(text: string): ImportedItem[] {
  const t = text.trim()

  // Пробуем JSON
  try {
    // Ищем массив в тексте (Claude иногда добавляет пояснения вокруг)
    const jsonMatch = t.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      const arr = JSON.parse(jsonMatch[0])
      if (Array.isArray(arr)) {
        const items: ImportedItem[] = []
        for (const row of arr) {
          const name  = String(row.name || row.название || row.item || row.товар || '').trim()
          const price = parseFloat(String(row.price || row.цена || row.сумма || row.amount || 0))
          if (name && !isNaN(price) && price > 0) {
            items.push({ name, price: Math.round(price * 100) / 100 })
          }
        }
        if (items.length > 0) return items
      }
    }
  } catch {}

  // Пробуем CSV (название,цена)
  const csvItems: ImportedItem[] = []
  const lines = t.split('\n').map(l => l.trim()).filter(Boolean)
  for (const line of lines) {
    // Пропускаем заголовки
    if (/^(name|название|товар|item|price|цена)/i.test(line)) continue

    // Разделители: запятая, точка с запятой, таб
    const parts = line.split(/[,;\t]/)
    if (parts.length >= 2) {
      const name  = parts[0].replace(/^["']|["']$/g, '').trim()
      const priceStr = parts[parts.length - 1].replace(/[^\d.,]/g, '').replace(',', '.')
      const price = parseFloat(priceStr)
      if (name && !isNaN(price) && price > 0 && name.length >= 2) {
        csvItems.push({ name, price: Math.round(price * 100) / 100 })
      }
    }
  }
  if (csvItems.length > 0) return csvItems

  // Пробуем простой формат "название    цена" (как наш OCR парсер)
  const spaceItems: ImportedItem[] = []
  for (const line of lines) {
    const m = line.match(/^(.+?)\s{2,}(\d+[.,]\d{2})\s*$/)
    if (m) {
      const name  = m[1].trim()
      const price = parseFloat(m[2].replace(',', '.'))
      if (name && !isNaN(price) && price > 0) {
        spaceItems.push({ name, price: Math.round(price * 100) / 100 })
      }
    }
  }
  return spaceItems
}

// ─── Главный компонент ────────────────────────────────────────────────────────
interface TextImportProps {
  onConfirm: (items: { name: string; price: number }[]) => void
  onClose: () => void
}

export default function TextImport({ onConfirm, onClose }: TextImportProps) {
  const [text, setText]           = useState('')
  const [parsed, setParsed]       = useState<ImportedItem[] | null>(null)
  const [error, setError]         = useState('')
  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const [showPrompt, setShowPrompt]     = useState(true)
  const [selected, setSelected]   = useState<Set<number>>(new Set())

  const handleParse = () => {
    setError('')
    if (!text.trim()) { setError('Вставь данные от ИИ'); return }
    const items = parseImportText(text)
    if (items.length === 0) {
      setError('Не удалось распознать данные. Проверь формат — должен быть JSON массив или CSV.')
      return
    }
    setParsed(items)
    setSelected(new Set(items.map((_, i) => i)))
  }

  const handleCopyPrompt = async () => {
    try { await navigator.clipboard.writeText(AI_PROMPT) }
    catch { const ta = document.createElement('textarea'); ta.value = AI_PROMPT; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta) }
    setCopiedPrompt(true)
    setTimeout(() => setCopiedPrompt(false), 2500)
  }

  const toggleItem = (i: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  const handleConfirm = () => {
    if (!parsed) return
    const items = parsed.filter((_, i) => selected.has(i))
    onConfirm(items)
  }

  const selectedTotal = parsed
    ? parsed.filter((_, i) => selected.has(i)).reduce((acc, item) => acc + item.price, 0)
    : 0

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex flex-col z-50">
      {/* Шапка */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <FileJson size={20} className="text-green-400" />
          <h2 className="font-semibold text-white">Импорт из ИИ</h2>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">

        {/* Шаг 1: промпт для ИИ */}
        {!parsed && (
          <div className="card space-y-3">
            <button
              onClick={() => setShowPrompt(!showPrompt)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-green-600 text-white text-xs flex items-center justify-center font-bold shrink-0">1</span>
                <span className="text-white font-medium">Скопируй промпт для ИИ</span>
              </div>
              {showPrompt ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
            </button>

            {showPrompt && (
              <>
                <pre className="text-xs text-slate-300 bg-slate-900 rounded-xl p-3 whitespace-pre-wrap leading-relaxed border border-slate-700">
                  {AI_PROMPT}
                </pre>
                <button
                  onClick={handleCopyPrompt}
                  className={`w-full py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all ${
                    copiedPrompt
                      ? 'bg-green-900/30 border border-green-700/50 text-green-400'
                      : 'btn-primary'
                  }`}
                >
                  {copiedPrompt ? <><Check size={16} /> Скопировано!</> : <><Copy size={16} /> Скопировать промпт</>}
                </button>
              </>
            )}

            {/* Подсказка куда идти */}
            <div className="bg-slate-700/40 rounded-xl p-3 text-xs text-slate-400 space-y-1">
              <p>📋 <strong className="text-slate-300">Как использовать:</strong></p>
              <p>1. Скопируй промпт выше</p>
              <p>2. Открой Claude / ChatGPT / любой ИИ</p>
              <p>3. Вставь промпт + прикрепи фото чека</p>
              <p>4. Скопируй ответ (JSON массив) и вставь ниже</p>
            </div>
          </div>
        )}

        {/* Шаг 2: вставить ответ ИИ */}
        {!parsed && (
          <div className="card space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-green-600 text-white text-xs flex items-center justify-center font-bold shrink-0">2</span>
              <span className="text-white font-medium">Вставь ответ ИИ</span>
            </div>

            <textarea
              className="input min-h-[160px] resize-none font-mono text-sm leading-relaxed"
              placeholder={`Вставь сюда JSON от ИИ, например:\n[\n  {"name":"Молоко","price":89.90},\n  {"name":"Хлеб","price":45.00}\n]`}
              value={text}
              onChange={e => { setText(e.target.value); setError('') }}
            />

            {error && (
              <div className="flex items-start gap-2 text-red-400 text-sm bg-red-900/20 border border-red-800/40 px-3 py-2.5 rounded-xl">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <button
              onClick={handleParse}
              disabled={!text.trim()}
              className="btn-primary w-full py-3 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <ClipboardPaste size={18} />
              Разобрать данные
            </button>

            {/* Поддерживаемые форматы */}
            <details className="cursor-pointer">
              <summary className="text-xs text-slate-600 hover:text-slate-400 transition-colors list-none">
                ▼ Поддерживаемые форматы
              </summary>
              <div className="mt-2 space-y-2 text-xs text-slate-500">
                <div className="bg-slate-900 rounded-lg p-2 font-mono">
                  {`[{"name":"Молоко","price":89.9}]`}
                  <span className="ml-2 text-green-600">JSON (рекомендуется)</span>
                </div>
                <div className="bg-slate-900 rounded-lg p-2 font-mono">
                  Молоко,89.90<br/>Хлеб,45.00
                  <span className="ml-2 text-green-600">CSV</span>
                </div>
                <div className="bg-slate-900 rounded-lg p-2 font-mono">
                  Молоко{'    '}89.90<br/>Хлеб{'      '}45.00
                  <span className="ml-2 text-green-600">Пробельный</span>
                </div>
              </div>
            </details>
          </div>
        )}

        {/* Шаг 3: результат */}
        {parsed && (
          <div className="space-y-3">
            {/* Сводка */}
            <div className="card flex items-center justify-between">
              <div>
                <p className="text-white font-medium">Найдено позиций: <span className="text-green-400">{parsed.length}</span></p>
                <p className="text-slate-500 text-sm">Отмечено: {selected.size} на {formatMoney(Math.round(selectedTotal * 100) / 100)}</p>
              </div>
              <button
                onClick={() => { setParsed(null); setText('') }}
                className="btn-secondary text-sm py-1.5"
              >
                ← Назад
              </button>
            </div>

            {/* Список */}
            <div className="space-y-2">
              {parsed.map((item, i) => (
                <div
                  key={i}
                  onClick={() => toggleItem(i)}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-all ${
                    selected.has(i)
                      ? 'bg-slate-800 border-slate-600'
                      : 'bg-slate-800/40 border-slate-700/50 opacity-50'
                  }`}
                >
                  {/* Чекбокс */}
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                    selected.has(i) ? 'bg-green-500 border-green-500' : 'border-slate-600'
                  }`}>
                    {selected.has(i) && <Check size={12} strokeWidth={3} className="text-white" />}
                  </div>
                  <span className="flex-1 text-white text-sm">{item.name}</span>
                  <span className="text-green-400 font-semibold text-sm shrink-0">{formatMoney(item.price)}</span>
                </div>
              ))}
            </div>

            {/* Выбрать все / снять */}
            <div className="flex gap-2">
              <button
                onClick={() => setSelected(new Set(parsed.map((_, i) => i)))}
                className="btn-secondary flex-1 text-sm py-2"
              >Выбрать все</button>
              <button
                onClick={() => setSelected(new Set())}
                className="btn-secondary flex-1 text-sm py-2"
              >Снять все</button>
            </div>
          </div>
        )}
      </div>

      {/* Нижняя панель */}
      {parsed && (
        <div className="bg-slate-800 border-t border-slate-700 p-4 flex gap-3 shrink-0">
          <button onClick={onClose} className="btn-secondary flex-1">Отмена</button>
          <button
            onClick={handleConfirm}
            disabled={selected.size === 0}
            className="btn-primary flex-1 disabled:opacity-40 flex items-center justify-center gap-2 py-3"
          >
            <Check size={18} />
            Добавить {selected.size} поз.
          </button>
        </div>
      )}
    </div>
  )
}
