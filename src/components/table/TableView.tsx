import { useState, useRef } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp, Receipt, Pencil, Check, X, Ban, ScanLine } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { round2, formatMoney, defaultShares } from '../../utils'
import type { ReceiptItem, Receipt as ReceiptType } from '../../types'
import OcrScanner from '../ocr/OcrScanner'

// ─── Пресеты долей ────────────────────────────────────────────────────────────
type Preset = 'equal' | 'only' | 'zero'

function applyPreset(
  item: ReceiptItem,
  participantId: string,
  preset: Preset,
  allIds: string[]
): Record<string, number> {
  const shares = { ...item.shares }
  if (preset === 'equal') {
    const share = round2(1 / allIds.length)
    allIds.forEach(id => { shares[id] = share })
  } else if (preset === 'only') {
    allIds.forEach(id => { shares[id] = id === participantId ? 1 : 0 })
  } else {
    shares[participantId] = 0
  }
  return shares
}

// ─── Строка товара ────────────────────────────────────────────────────────────
interface ItemRowProps {
  item: ReceiptItem
  receiptId: string
  participantIds: string[]
  participantColors: Record<string, string>
  participantNames: Record<string, string>
  onUpdate: (item: ReceiptItem) => void
  onRemove: () => void
}

function ItemRow({ item, receiptId: _receiptId, participantIds, participantColors, participantNames, onUpdate, onRemove }: ItemRowProps) {
  const [editingName, setEditingName] = useState(false)
  const [editingPrice, setEditingPrice] = useState(false)
  const [nameVal, setNameVal] = useState(item.name)
  const [priceVal, setPriceVal] = useState(String(item.price))
  const nameRef = useRef<HTMLInputElement>(null)
  const priceRef = useRef<HTMLInputElement>(null)

  const sharesSum = round2(participantIds.reduce((acc, id) => acc + (item.shares[id] ?? 0), 0))
  const isOverLimit = sharesSum > 1.005

  const handleShareChange = (id: string, val: string) => {
    const num = parseFloat(val)
    const value = isNaN(num) ? 0 : round2(Math.max(0, Math.min(1, num)))
    // Если ввели 1 — логика эксклюзивности
    if (value === 1) {
      const shares = { ...item.shares }
      participantIds.forEach(pid => { shares[pid] = pid === id ? 1 : 0 })
      onUpdate({ ...item, shares })
    } else {
      onUpdate({ ...item, shares: { ...item.shares, [id]: value } })
    }
  }

  const handlePreset = (id: string, preset: Preset) => {
    onUpdate({ ...item, shares: applyPreset(item, id, preset, participantIds) })
  }

  const confirmName = () => {
    if (nameVal.trim()) onUpdate({ ...item, name: nameVal.trim() })
    else setNameVal(item.name)
    setEditingName(false)
  }

  const confirmPrice = () => {
    const p = parseFloat(priceVal)
    if (!isNaN(p) && p > 0) onUpdate({ ...item, price: p })
    else setPriceVal(String(item.price))
    setEditingPrice(false)
  }

  return (
    <div className={`rounded-xl border transition-colors ${
      item.excluded
        ? 'border-slate-700/50 bg-slate-800/30 opacity-50'
        : isOverLimit
          ? 'border-red-500/50 bg-red-900/10'
          : 'border-slate-700 bg-slate-800/60'
    }`}>
      {/* ── Первая строка: название + цена + кнопки ── */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">

        {/* Название */}
        <div className="flex-1 min-w-0">
          {editingName ? (
            <div className="flex items-center gap-1">
              <input
                ref={nameRef}
                className="input text-sm py-1 flex-1"
                value={nameVal}
                onChange={e => setNameVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') confirmName(); if (e.key === 'Escape') { setNameVal(item.name); setEditingName(false) } }}
                autoFocus
              />
              <button onClick={confirmName} className="text-green-400 p-1"><Check size={14} /></button>
              <button onClick={() => { setNameVal(item.name); setEditingName(false) }} className="text-slate-500 p-1"><X size={14} /></button>
            </div>
          ) : (
            <button
              onClick={() => { setEditingName(true); setTimeout(() => nameRef.current?.select(), 50) }}
              className="text-left text-white text-sm font-medium hover:text-green-300 transition-colors flex items-center gap-1 group w-full"
            >
              <span className="truncate">{item.name}</span>
              <Pencil size={11} className="text-slate-600 group-hover:text-slate-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}
        </div>

        {/* Цена */}
        <div className="shrink-0">
          {editingPrice ? (
            <div className="flex items-center gap-1">
              <input
                ref={priceRef}
                className="input text-sm py-1 w-24 text-right"
                type="number"
                value={priceVal}
                onChange={e => setPriceVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') confirmPrice(); if (e.key === 'Escape') { setPriceVal(String(item.price)); setEditingPrice(false) } }}
                autoFocus
              />
              <button onClick={confirmPrice} className="text-green-400 p-1"><Check size={14} /></button>
            </div>
          ) : (
            <button
              onClick={() => { setEditingPrice(true); setTimeout(() => priceRef.current?.select(), 50) }}
              className="text-green-400 font-semibold text-sm hover:text-green-300 transition-colors flex items-center gap-1 group"
            >
              {formatMoney(item.price)}
              <Pencil size={11} className="text-slate-600 group-hover:text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}
        </div>

        {/* Исключить / удалить */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => onUpdate({ ...item, excluded: !item.excluded })}
            title={item.excluded ? 'Включить в расчёт' : 'Исключить из расчёта'}
            className={`p-1.5 rounded-lg transition-colors ${item.excluded ? 'text-amber-400 bg-amber-900/30' : 'text-slate-600 hover:text-amber-400'}`}
          >
            <Ban size={14} />
          </button>
          <button
            onClick={onRemove}
            className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* ── Вторая строка: доли участников ── */}
      {!item.excluded && (
        <div className="px-3 pb-3 flex flex-wrap gap-2">
          {participantIds.map(id => {
            const share = item.shares[id] ?? 0
            const amount = round2(item.price * share)
            return (
              <div key={id} className="flex flex-col items-center gap-1">
                {/* Аватар */}
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: participantColors[id] }}
                  title={participantNames[id]}
                >
                  {participantNames[id]?.[0]?.toUpperCase()}
                </div>

                {/* Инпут доли */}
                <input
                  type="number"
                  min="0" max="1" step="0.25"
                  value={share}
                  onChange={e => handleShareChange(id, e.target.value)}
                  className={`w-14 text-center rounded-lg py-1 px-1 text-sm border
                    focus:outline-none focus:border-green-500 transition-colors bg-slate-700
                    ${isOverLimit ? 'border-red-500 text-red-300' : 'border-slate-600 text-white'}`}
                />

                {/* Сумма */}
                <span className="text-xs text-slate-500">{amount > 0 ? formatMoney(amount) : '—'}</span>

                {/* Пресеты */}
                <div className="flex gap-0.5">
                  <button
                    onClick={() => handlePreset(id, 'only')}
                    title="Только я"
                    className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 hover:bg-green-800 text-slate-400 hover:text-green-300 transition-colors"
                  >1</button>
                  <button
                    onClick={() => handlePreset(id, 'zero')}
                    title="Не участвую"
                    className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 hover:bg-red-900 text-slate-400 hover:text-red-300 transition-colors"
                  >0</button>
                </div>
              </div>
            )
          })}

          {/* Пресет "поровну" для всей строки */}
          <div className="flex flex-col justify-end pb-1 ml-1">
            <button
              onClick={() => onUpdate({ ...item, shares: defaultShares(participantIds) })}
              className="text-[10px] px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white transition-colors whitespace-nowrap"
              title="Разделить поровну"
            >
              ÷ поровну
            </button>
          </div>

          {/* Предупреждение о превышении */}
          {isOverLimit && (
            <div className="w-full text-xs text-red-400 flex items-center gap-1 mt-1">
              ⚠ Сумма долей {sharesSum.toFixed(2)} &gt; 1
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Компонент одного чека ─────────────────────────────────────────────────────
interface ReceiptCardProps {
  receipt: ReceiptType
  participantIds: string[]
  participantColors: Record<string, string>
  participantNames: Record<string, string>
  onRemove: () => void
  onRename: (name: string) => void
  onAddItem: (name: string, price: number) => void
  onUpdateItem: (item: ReceiptItem) => void
  onRemoveItem: (itemId: string) => void
}

function ReceiptCard({
  receipt, participantIds, participantColors, participantNames,
  onRemove, onRename, onAddItem, onUpdateItem, onRemoveItem
}: ReceiptCardProps) {
  const [expanded, setExpanded] = useState(true)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleVal, setTitleVal] = useState(receipt.name)
  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  const total = receipt.items.filter(i => !i.excluded).reduce((a, i) => a + i.price, 0)

  // Итого по участникам для этого чека
  const participantTotals = participantIds.map(id => {
    const amount = receipt.items
      .filter(i => !i.excluded)
      .reduce((acc, item) => acc + item.price * (item.shares[id] ?? 0), 0)
    return { id, amount: round2(amount) }
  })

  const handleAddItem = () => {
    const n = newName.trim()
    const p = parseFloat(newPrice)
    if (!n || isNaN(p) || p <= 0) return
    onAddItem(n, p)
    setNewName('')
    setNewPrice('')
    nameInputRef.current?.focus()
  }

  const confirmTitle = () => {
    if (titleVal.trim()) onRename(titleVal.trim())
    else setTitleVal(receipt.name)
    setEditingTitle(false)
  }

  return (
    <div className="card space-y-3">
      {/* ── Заголовок чека ── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Receipt size={16} className="text-green-400 shrink-0" />
          {editingTitle ? (
            <div className="flex items-center gap-1 flex-1">
              <input
                className="input text-sm py-1 flex-1"
                value={titleVal}
                onChange={e => setTitleVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') confirmTitle(); if (e.key === 'Escape') { setTitleVal(receipt.name); setEditingTitle(false) } }}
                autoFocus
              />
              <button onClick={confirmTitle} className="text-green-400 p-1"><Check size={14} /></button>
            </div>
          ) : (
            <button
              onClick={() => setEditingTitle(true)}
              className="font-semibold text-white hover:text-green-300 transition-colors text-left group flex items-center gap-1"
            >
              {receipt.name}
              <Pencil size={11} className="text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}
          <span className="text-sm text-slate-500 shrink-0">({receipt.items.length})</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {total > 0 && <span className="text-green-400 font-semibold text-sm">{formatMoney(total)}</span>}
          <button onClick={onRemove} className="text-slate-600 hover:text-red-400 transition-colors p-1">
            <Trash2 size={15} />
          </button>
          <button onClick={() => setExpanded(!expanded)} className="text-slate-500 p-1">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {expanded && (
        <>
          {/* ── Список позиций ── */}
          <div className="space-y-2">
            {receipt.items.length === 0 && (
              <div className="text-center py-4 text-slate-600 text-sm">
                Добавь первую позицию ↓
              </div>
            )}
            {receipt.items.map(item => (
              <ItemRow
                key={item.id}
                item={item}
                receiptId={receipt.id}
                participantIds={participantIds}
                participantColors={participantColors}
                participantNames={participantNames}
                onUpdate={onUpdateItem}
                onRemove={() => onRemoveItem(item.id)}
              />
            ))}
          </div>

          {/* ── Итого по участникам ── */}
          {receipt.items.length > 0 && total > 0 && (
            <div className="bg-slate-700/30 rounded-xl px-3 py-2.5 flex flex-wrap gap-x-4 gap-y-1">
              {participantTotals.map(({ id, amount }) => (
                <div key={id} className="flex items-center gap-1.5 text-sm">
                  <div
                    className="w-4 h-4 rounded-full shrink-0"
                    style={{ backgroundColor: participantColors[id] }}
                  />
                  <span className="text-slate-400">{participantNames[id]}:</span>
                  <span className="text-white font-medium">{amount > 0 ? formatMoney(amount) : '—'}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Добавить позицию ── */}
          <div className="flex gap-2">
            <input
              ref={nameInputRef}
              className="input flex-1 text-sm"
              placeholder="Название товара"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && document.getElementById(`price-${receipt.id}`)?.focus()}
            />
            <input
              id={`price-${receipt.id}`}
              className="input w-28 text-sm text-right"
              type="number"
              placeholder="Цена ₽"
              value={newPrice}
              onChange={e => setNewPrice(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddItem()}
            />
            <button
              onClick={handleAddItem}
              disabled={!newName.trim() || !newPrice}
              className="btn-primary shrink-0 disabled:opacity-40"
            >
              <Plus size={18} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Главный компонент ─────────────────────────────────────────────────────────
export default function TableView() {
  const { currentSession, addReceipt, removeReceipt, renameReceipt, addItem, addItems, updateItem, removeItem } = useApp()
  const [newReceiptName, setNewReceiptName] = useState('')
  const [showAddReceipt, setShowAddReceipt] = useState(false)
  const [showOcr, setShowOcr] = useState(false)
  const [ocrTargetReceiptId, setOcrTargetReceiptId] = useState<string | null>(null)

  if (!currentSession) return null
  const { participants, receipts } = currentSession

  const participantIds = participants.map(p => p.id)
  const participantColors = Object.fromEntries(participants.map(p => [p.id, p.color]))
  const participantNames = Object.fromEntries(participants.map(p => [p.id, p.name]))

  const grandTotal = receipts.reduce((acc, r) =>
    acc + r.items.filter(i => !i.excluded).reduce((a, i) => a + i.price, 0), 0)

  // Итого по каждому участнику по всем чекам
  const grandTotals = participantIds.map(id => {
    const amount = receipts.reduce((acc, r) =>
      acc + r.items.filter(i => !i.excluded).reduce((a, item) => a + item.price * (item.shares[id] ?? 0), 0), 0)
    return { id, amount: round2(amount) }
  })

  const handleAddReceipt = async () => {
    const name = newReceiptName.trim() || `Чек ${receipts.length + 1}`
    await addReceipt(name)
    setNewReceiptName('')
    setShowAddReceipt(false)
  }

  return (
    <div className="p-4 space-y-4 pb-8">

      {/* ── Общий итог ── */}
      {grandTotal > 0 && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm">Общая сумма</span>
            <span className="text-2xl font-bold text-green-400">{formatMoney(grandTotal)}</span>
          </div>
          {/* Доли каждого */}
          <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1 border-t border-slate-700">
            {grandTotals.map(({ id, amount }) => (
              <div key={id} className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: participantColors[id] }}
                >
                  {participantNames[id]?.[0]?.toUpperCase()}
                </div>
                <div>
                  <div className="text-white text-sm font-medium">{formatMoney(amount)}</div>
                  <div className="text-slate-500 text-xs">{participantNames[id]}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Чеки ── */}
      {receipts.map(receipt => (
        <ReceiptCard
          key={receipt.id}
          receipt={receipt}
          participantIds={participantIds}
          participantColors={participantColors}
          participantNames={participantNames}
          onRemove={() => removeReceipt(receipt.id)}
          onRename={name => renameReceipt(receipt.id, name)}
          onAddItem={(name, price) => addItem(receipt.id, name, price)}
          onUpdateItem={item => updateItem(receipt.id, item)}
          onRemoveItem={itemId => removeItem(receipt.id, itemId)}
        />
      ))}

      {/* ── Добавить чек ── */}
      {showAddReceipt ? (
        <div className="card flex gap-2">
          <input
            className="input flex-1 text-sm"
            placeholder="Название чека (Магнит, Кафе...)"
            value={newReceiptName}
            onChange={e => setNewReceiptName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddReceipt()}
            autoFocus
          />
          <button onClick={handleAddReceipt} className="btn-primary shrink-0">
            Добавить
          </button>
          <button onClick={() => setShowAddReceipt(false)} className="btn-secondary shrink-0 px-3">
            <X size={16} />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {/* Ввод вручную */}
          <button
            onClick={() => setShowAddReceipt(true)}
            className="py-4 rounded-2xl border-2 border-dashed border-slate-700
                       hover:border-green-700 hover:bg-green-900/10 transition-all
                       flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-green-400"
          >
            <Plus size={22} />
            <span className="font-medium text-sm">Добавить чек</span>
            <span className="text-xs opacity-70">ввод вручную</span>
          </button>

          {/* Сканировать чек */}
          <button
            onClick={async () => {
              // Создаём чек и сразу открываем сканер для него
              const receipt = await addReceipt('Сканированный чек')
              setOcrTargetReceiptId(receipt.id)
              setShowOcr(true)
            }}
            className="py-4 rounded-2xl border-2 border-dashed border-slate-700
                       hover:border-green-700 hover:bg-green-900/10 transition-all
                       flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-green-400"
          >
            <ScanLine size={22} />
            <span className="font-medium text-sm">Сканировать</span>
            <span className="text-xs opacity-70">фото чека</span>
          </button>
        </div>
      )}

      {/* ── Пустое состояние ── */}
      {receipts.length === 0 && (
        <div className="text-center py-8 text-slate-500 text-sm">
          <div className="text-4xl mb-3">🧾</div>
          <p>Добавь первый чек и начни вносить покупки</p>
        </div>
      )}

      {/* ── Подсказка ── */}
      {receipts.length > 0 && (
        <div className="text-xs text-slate-700 text-center space-y-1">
          <p>Кнопка <strong className="text-slate-600">1</strong> — только этот участник платит за позицию</p>
          <p>Кнопка <strong className="text-slate-600">0</strong> — участник не участвует в позиции</p>
          <p>Иконка <strong className="text-slate-600">⊘</strong> — исключить позицию из расчёта</p>
        </div>
      )}

      {/* ── OCR Сканер ── */}
      {showOcr && ocrTargetReceiptId && (
        <OcrScanner
          onConfirm={async (scannedItems) => {
            // addItems добавляет все позиции за один раз — избегаем stale closure
            await addItems(ocrTargetReceiptId, scannedItems)
            setShowOcr(false)
            setOcrTargetReceiptId(null)
          }}
          onClose={() => {
            setShowOcr(false)
            setOcrTargetReceiptId(null)
          }}
        />
      )}
    </div>
  )
}

