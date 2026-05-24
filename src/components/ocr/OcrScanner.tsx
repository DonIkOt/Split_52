import { useRef, useState, useCallback } from 'react'
import { Camera, Upload, X, Check, RefreshCw, AlertTriangle, ScanLine, Pencil, Trash2 } from 'lucide-react'
import { useOcr } from '../../hooks/useOcr'
import type { ParsedItem } from '../../utils/receiptParser'
import { formatMoney } from '../../utils'

interface OcrScannerProps {
  onConfirm: (items: { name: string; price: number }[]) => void
  onClose: () => void
}

// ─── Строка результата с возможностью редактирования ─────────────────────────
function ResultItem({
  item,
  index,
  onUpdate,
  onRemove,
}: {
  item: ParsedItem & { selected: boolean }
  index: number
  onUpdate: (index: number, field: 'name' | 'price' | 'selected', value: string | number | boolean) => void
  onRemove: (index: number) => void
}) {
  const [editName, setEditName] = useState(false)
  const [editPrice, setEditPrice] = useState(false)
  const [nameVal, setNameVal] = useState(item.name)
  const [priceVal, setPriceVal] = useState(String(item.price))

  const confidenceColor = {
    high: 'bg-green-900/40 border-green-700/50',
    medium: 'bg-slate-800 border-slate-700',
    low: 'bg-amber-900/20 border-amber-700/40',
  }[item.confidence]

  return (
    <div className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-opacity ${confidenceColor} ${!item.selected ? 'opacity-40' : ''}`}>
      {/* Чекбокс */}
      <button
        onClick={() => onUpdate(index, 'selected', !item.selected)}
        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
          item.selected ? 'bg-green-500 border-green-500' : 'border-slate-600'
        }`}
      >
        {item.selected && <Check size={12} strokeWidth={3} className="text-white" />}
      </button>

      {/* Название */}
      <div className="flex-1 min-w-0">
        {editName ? (
          <input
            className="input text-sm py-0.5 w-full"
            value={nameVal}
            onChange={e => setNameVal(e.target.value)}
            onBlur={() => { onUpdate(index, 'name', nameVal.trim() || item.name); setEditName(false) }}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') { onUpdate(index, 'name', nameVal.trim() || item.name); setEditName(false) } }}
            autoFocus
          />
        ) : (
          <button
            onClick={() => setEditName(true)}
            className="text-sm text-white text-left truncate w-full hover:text-green-300 transition-colors"
          >
            {item.name}
            {item.confidence === 'low' && <span className="ml-1 text-amber-500 text-xs">⚠</span>}
          </button>
        )}
      </div>

      {/* Цена */}
      <div className="shrink-0">
        {editPrice ? (
          <input
            className="input text-sm py-0.5 w-20 text-right"
            type="number"
            value={priceVal}
            onChange={e => setPriceVal(e.target.value)}
            onBlur={() => {
              const p = parseFloat(priceVal)
              if (!isNaN(p) && p > 0) onUpdate(index, 'price', p)
              else setPriceVal(String(item.price))
              setEditPrice(false)
            }}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') { const p = parseFloat(priceVal); if (!isNaN(p) && p > 0) onUpdate(index, 'price', p); setEditPrice(false) } }}
            autoFocus
          />
        ) : (
          <button
            onClick={() => setEditPrice(true)}
            className="text-green-400 font-semibold text-sm hover:text-green-300 transition-colors flex items-center gap-1"
          >
            {formatMoney(item.price)}
            <Pencil size={10} className="text-slate-600" />
          </button>
        )}
      </div>

      {/* Удалить */}
      <button onClick={() => onRemove(index)} className="text-slate-600 hover:text-red-400 transition-colors p-0.5 shrink-0">
        <Trash2 size={14} />
      </button>
    </div>
  )
}

// ─── Главный компонент сканера ────────────────────────────────────────────────
export default function OcrScanner({ onConfirm, onClose }: OcrScannerProps) {
  const { state, recognize, reset } = useOcr()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [items, setItems] = useState<(ParsedItem & { selected: boolean })[]>([])
  const [showRaw, setShowRaw] = useState(false)

  // Синхронизируем items при получении результата
  const handleFileSelect = useCallback(async (file: File) => {
    const url = URL.createObjectURL(file)
    setPreview(url)
    await recognize(file)
  }, [recognize])

  // Когда OCR завершён — инициализируем items
  if (state.status === 'done' && state.result && items.length === 0) {
    setItems(state.result.items.map(item => ({ ...item, selected: item.confidence !== 'low' })))
  }

  const updateItem = (index: number, field: 'name' | 'price' | 'selected', value: string | number | boolean) => {
    setItems(prev => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ))
  }

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  const handleReset = () => {
    reset()
    setPreview(null)
    setItems([])
    setShowRaw(false)
  }

  const handleConfirm = () => {
    const selected = items
      .filter(i => i.selected)
      .map(i => ({ name: i.name, price: i.price }))
    onConfirm(selected)
  }

  const selectedCount = items.filter(i => i.selected).length
  const selectedTotal = items.filter(i => i.selected).reduce((acc, i) => acc + i.price, 0)

  // ── Офлайн заглушка ──
  if (state.status === 'error' && state.error === 'offline') {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 z-50">
        <div className="card max-w-sm w-full space-y-4 mb-4 sm:mb-0">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Сканирование чека</h3>
            <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={20} /></button>
          </div>
          <div className="text-center py-4">
            <div className="text-4xl mb-3">📷</div>
            <p className="text-slate-300 font-medium mb-2">OCR недоступен в офлайн-режиме</p>
            <p className="text-slate-500 text-sm">
              Сканирование чеков работает только при открытии через сервер (GitHub Pages или <code className="bg-slate-700 px-1 rounded">npm run dev</code>).
              В автономном HTML-файле используй ручной ввод.
            </p>
          </div>
          <button onClick={onClose} className="btn-secondary w-full">Закрыть</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex flex-col z-50">
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <ScanLine size={20} className="text-green-400" />
          <h2 className="font-semibold text-white">Сканирование чека</h2>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">

        {/* ── Шаг 1: выбор фото ── */}
        {state.status === 'idle' && (
          <div className="space-y-4">
            <p className="text-slate-400 text-sm text-center">
              Сфотографируй чек или загрузи фото — приложение автоматически распознает товары и цены
            </p>

            <div className="grid grid-cols-2 gap-3">
              {/* Камера */}
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="card flex flex-col items-center gap-3 py-6 hover:border-green-700 hover:bg-green-900/10 transition-all cursor-pointer"
              >
                <Camera size={32} className="text-green-400" />
                <span className="text-white font-medium">Сфотографировать</span>
                <span className="text-slate-500 text-xs">открыть камеру</span>
              </button>

              {/* Файл */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="card flex flex-col items-center gap-3 py-6 hover:border-slate-500 transition-all cursor-pointer"
              >
                <Upload size={32} className="text-slate-400" />
                <span className="text-white font-medium">Загрузить фото</span>
                <span className="text-slate-500 text-xs">из галереи</span>
              </button>
            </div>

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            />

            <div className="bg-slate-800/50 rounded-xl p-3 space-y-1.5 text-xs text-slate-500">
              <p>💡 <strong className="text-slate-400">Советы для лучшего результата:</strong></p>
              <p>• Держи телефон прямо над чеком, без наклона</p>
              <p>• Убедись что текст в фокусе и хорошо освещён</p>
              <p>• Чем короче чек — тем лучше результат</p>
              <p>• Распознавание займёт 5–15 секунд</p>
            </div>
          </div>
        )}

        {/* ── Прогресс распознавания ── */}
        {(state.status === 'loading' || state.status === 'recognizing' || state.status === 'parsing') && (
          <div className="space-y-4">
            {/* Превью фото */}
            {preview && (
              <div className="relative rounded-xl overflow-hidden max-h-48">
                <img src={preview} alt="Чек" className="w-full object-cover" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="text-center text-white">
                    <ScanLine size={32} className="mx-auto mb-2 animate-pulse text-green-400" />
                    <p className="font-medium">Распознаю текст...</p>
                  </div>
                </div>
              </div>
            )}

            {/* Прогресс-бар */}
            <div className="card space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">
                  {state.status === 'loading' && 'Загружаю движок OCR...'}
                  {state.status === 'recognizing' && 'Распознаю текст...'}
                  {state.status === 'parsing' && 'Разбираю позиции...'}
                </span>
                <span className="text-green-400 font-medium">{state.progress}%</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-300"
                  style={{ width: `${state.progress}%` }}
                />
              </div>
              <p className="text-xs text-slate-600 text-center">
                Первый запуск загружает языковые данные (~3 МБ) — занимает дольше
              </p>
            </div>
          </div>
        )}

        {/* ── Ошибка ── */}
        {state.status === 'error' && state.error !== 'offline' && (
          <div className="space-y-4">
            <div className="card border-red-700/50 bg-red-900/20 text-center py-6 space-y-3">
              <AlertTriangle size={32} className="text-red-400 mx-auto" />
              <p className="text-white font-medium">Не удалось распознать чек</p>
              <p className="text-slate-400 text-sm">{state.error}</p>
            </div>
            <button onClick={handleReset} className="btn-secondary w-full flex items-center justify-center gap-2">
              <RefreshCw size={16} />
              Попробовать снова
            </button>
          </div>
        )}

        {/* ── Результаты ── */}
        {state.status === 'done' && (
          <div className="space-y-4">
            {/* Превью + кнопка пересканировать */}
            {preview && (
              <div className="flex items-center gap-3">
                <img src={preview} alt="Чек" className="w-14 h-14 object-cover rounded-xl border border-slate-700" />
                <div className="flex-1">
                  <p className="text-white text-sm font-medium">
                    Найдено позиций: <span className="text-green-400">{items.length}</span>
                  </p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    Отмечены: {selectedCount} на {formatMoney(selectedTotal)}
                  </p>
                </div>
                <button onClick={handleReset} className="btn-secondary p-2" title="Сканировать другой чек">
                  <RefreshCw size={16} />
                </button>
              </div>
            )}

            {items.length === 0 ? (
              <div className="card text-center py-8 space-y-3">
                <div className="text-4xl">🤔</div>
                <p className="text-white font-medium">Позиции не распознаны</p>
                <p className="text-slate-400 text-sm">
                  Попробуй переснять чек с лучшим освещением или введи товары вручную
                </p>
                <button onClick={handleReset} className="btn-secondary mx-auto flex items-center gap-2">
                  <RefreshCw size={16} />
                  Попробовать снова
                </button>
              </div>
            ) : (
              <>
                {/* Легенда */}
                <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-green-900/60 border border-green-700/50 inline-block" />
                    Точно
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-slate-800 border border-slate-700 inline-block" />
                    Нормально
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-amber-900/30 border border-amber-700/50 inline-block" />
                    Проверь ⚠
                  </span>
                </div>

                {/* Список позиций */}
                <div className="space-y-2">
                  {items.map((item, i) => (
                    <ResultItem
                      key={i}
                      item={item}
                      index={i}
                      onUpdate={updateItem}
                      onRemove={removeItem}
                    />
                  ))}
                </div>

                {/* Выбрать всё / снять всё */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setItems(prev => prev.map(i => ({ ...i, selected: true })))}
                    className="btn-secondary flex-1 text-sm py-2"
                  >
                    Выбрать все
                  </button>
                  <button
                    onClick={() => setItems(prev => prev.map(i => ({ ...i, selected: false })))}
                    className="btn-secondary flex-1 text-sm py-2"
                  >
                    Снять все
                  </button>
                </div>

                {/* Сырой текст OCR (для отладки) */}
                <button
                  onClick={() => setShowRaw(!showRaw)}
                  className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
                >
                  {showRaw ? '▲' : '▼'} Сырой текст OCR
                </button>
                {showRaw && state.result && (
                  <pre className="text-xs text-slate-500 bg-slate-900 rounded-xl p-3 overflow-auto max-h-40 whitespace-pre-wrap">
                    {state.result.rawText}
                  </pre>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Нижняя панель ── */}
      {state.status === 'done' && items.length > 0 && (
        <div className="bg-slate-800 border-t border-slate-700 p-4 flex gap-3 shrink-0">
          <button onClick={onClose} className="btn-secondary flex-1">
            Отмена
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedCount === 0}
            className="btn-primary flex-1 disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Check size={18} />
            Добавить {selectedCount} поз.
          </button>
        </div>
      )}
    </div>
  )
}
