import type { Session, SessionSummary } from '../types'
import { formatMoney, formatDate, round2 } from './index'

// ─── JPG: рендерим скрытый красивый блок и снимаем его ───────────────────────
export async function exportToJpg(elementId: string, filename: string): Promise<void> {
  const html2canvas = (await import('html2canvas')).default

  // Создаём отдельный красивый блок специально для экспорта
  const wrapper = document.createElement('div')
  wrapper.style.cssText = `
    position: fixed; top: -9999px; left: -9999px;
    width: 480px; padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `

  const source = document.getElementById(elementId)
  if (!source) throw new Error('Export target not found')

  // Клонируем контент итогов
  const clone = source.cloneNode(true) as HTMLElement
  clone.style.cssText = `
    background: #0f172a;
    padding: 20px;
    border-radius: 0;
    max-width: 480px;
    width: 480px;
  `

  // Убираем кнопки из клона
  clone.querySelectorAll('button, details').forEach(el => el.remove())

  wrapper.appendChild(clone)
  document.body.appendChild(wrapper)

  try {
    const canvas = await html2canvas(wrapper, {
      backgroundColor: '#0f172a',
      scale: 2,
      useCORS: true,
      logging: false,
      width: 480,
      windowWidth: 480,
    })

    const link = document.createElement('a')
    link.download = filename
    link.href = canvas.toDataURL('image/jpeg', 0.93)
    link.click()
  } finally {
    document.body.removeChild(wrapper)
  }
}

// ─── Excel экспорт через SheetJS ─────────────────────────────────────────────
export async function exportToExcel(session: Session, summary: SessionSummary): Promise<void> {
  const XLSX = await import('xlsx')

  const { participants, receipts } = session
  const wb = XLSX.utils.book_new()

  // ─── Лист 1: Детальная таблица ────────────────────────────────────────────
  type CellValue = string | number
  const detailRows: CellValue[][] = []

  // Шапка документа
  detailRows.push([`СплитЧек: ${session.name}`])
  detailRows.push([`Дата: ${formatDate(session.createdAt)}`])
  detailRows.push([`Участники: ${participants.map(p => p.name).join(', ')}`])
  detailRows.push([])

  let docGrandTotal = 0

  for (const receipt of receipts) {
    const receiptItems = receipt.items.filter(i => !i.excluded)
    const receiptTotal = receiptItems.reduce((acc, i) => acc + i.price, 0)
    docGrandTotal += receiptTotal

    // Заголовок чека
    detailRows.push([`Чек: ${receipt.name}`, '', `Итого: ${formatMoney(receiptTotal)}`])

    // Заголовки колонок
    detailRows.push([
      '№', 'Товар', 'Цена, ₽',
      ...participants.map(p => `${p.name} (доля)`),
      ...participants.map(p => `${p.name} (сумма, ₽)`),
    ])

    // Строки позиций
    receiptItems.forEach((item, idx) => {
      detailRows.push([
        idx + 1,
        item.name,
        item.price,
        ...participants.map(p => item.shares[p.id] ?? 0),
        ...participants.map(p => round2(item.price * (item.shares[p.id] ?? 0))),
      ])
    })

    // Итого по чеку
    const totals = participants.map(p =>
      round2(receiptItems.reduce((acc, item) => acc + item.price * (item.shares[p.id] ?? 0), 0))
    )
    detailRows.push([
      '', 'ИТОГО по чеку:', receiptTotal,
      ...participants.map(() => ''),
      ...totals,
    ])
    detailRows.push([])
  }

  // Общий итог
  detailRows.push([
    '', 'ОБЩИЙ ИТОГ:', docGrandTotal,
    ...participants.map(() => ''),
    ...participants.map(p => summary.owedByParticipant[p.id] ?? 0),
  ])

  const wsDetail = XLSX.utils.aoa_to_sheet(detailRows)

  // Ширины колонок
  const colWidths = [
    { wch: 4 },
    { wch: 30 },
    { wch: 12 },
    ...participants.flatMap(() => [{ wch: 14 }, { wch: 14 }]),
  ]
  wsDetail['!cols'] = colWidths

  XLSX.utils.book_append_sheet(wb, wsDetail, 'Детали')

  // ─── Лист 2: Итоги ────────────────────────────────────────────────────────
  const summaryRows: CellValue[][] = []

  summaryRows.push([`Итоги: ${session.name}`])
  summaryRows.push([`Общая сумма: ${formatMoney(docGrandTotal)}`])
  summaryRows.push([`На каждого (поровну): ${formatMoney(round2(docGrandTotal / participants.length))}`])
  summaryRows.push([])

  summaryRows.push(['Участник', 'По счёту, ₽', 'Заплатил, ₽', 'Баланс, ₽', 'Статус'])
  participants.forEach(p => {
    const owed  = summary.owedByParticipant[p.id] ?? 0
    const paid  = summary.paidByParticipant[p.id] ?? 0
    const bal   = summary.balances[p.id] ?? 0
    summaryRows.push([
      p.name, owed, paid, bal,
      bal > 0.01 ? `получает ${formatMoney(bal)}` :
      bal < -0.01 ? `должен ${formatMoney(-bal)}` : 'квиты',
    ])
  })

  summaryRows.push([])
  summaryRows.push(['Минимальные переводы для погашения долгов:'])

  if (summary.transactions.length === 0) {
    summaryRows.push(['Переводы не нужны — все квиты!'])
  } else {
    summaryRows.push(['От кого', 'Кому', 'Сумма, ₽'])
    summary.transactions.forEach(t => {
      const from = participants.find(p => p.id === t.fromId)?.name ?? '?'
      const to   = participants.find(p => p.id === t.toId)?.name ?? '?'
      summaryRows.push([from, to, t.amount])
    })
  }

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows)
  wsSummary['!cols'] = [{ wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 26 }]

  XLSX.utils.book_append_sheet(wb, wsSummary, 'Итоги')

  // Имя файла
  const safeName = session.name.replace(/[^\wа-яёА-ЯЁ\s]/gi, '').trim().replace(/\s+/g, '_')
  const dateStr  = new Date().toLocaleDateString('ru-RU').replace(/\./g, '-')
  XLSX.writeFile(wb, `СплитЧек_${safeName}_${dateStr}.xlsx`)
}
