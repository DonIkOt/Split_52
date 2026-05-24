// ─── Парсер текста русского чека ─────────────────────────────────────────────
// Извлекает пары "название товара — цена" из сырого OCR текста

export interface ParsedItem {
  name: string
  price: number
  raw: string       // исходная строка для отладки
  confidence: 'high' | 'medium' | 'low'
}

// Слова-стоп: строки с ними не являются товарами
const STOP_WORDS = [
  'итого', 'итог', 'сумма', 'итого:', 'к оплате', 'наличными', 'картой',
  'сдача', 'кэшбэк', 'скидка', 'бонус', 'баллы', 'ндс', 'нал', 'безнал',
  'спасибо', 'телефон', 'кассир', 'чек №', 'чек#', 'дата', 'время',
  'магазин', 'адрес', 'инн', 'кпп', 'огрн', 'фн:', 'фд:', 'фп:',
  'смена', 'кассовый', 'фискальный', 'документ', 'рецепт', 'receipt',
  'total', 'subtotal', 'change', 'cash', 'sale',
]

// Регулярки для разных форматов строк чека:
const PRICE_PATTERNS = [
  // "Молоко 3.2% 1л       89.90"  — название + пробелы + цена в конце
  /^(.+?)\s{2,}(\d+[.,]\d{2})\s*$/,
  // "Хлеб белый       1  45.00  45.00"  — с количеством и суммой
  /^(.+?)\s+\d+\s+\d+[.,]\d{2}\s+(\d+[.,]\d{2})\s*$/,
  // "ПИВО БАЛТ 0.5     110-00"  — цена через дефис
  /^(.+?)\s{2,}(\d+)-(\d{2})\s*$/,
  // "Чипсы Lays 75г    1x120.00"  — с 1x
  /^(.+?)\s+1[xх×](\d+[.,]\d{2})\s*$/,
  // "Кола 2л  199р"  — с буквой р
  /^(.+?)\s{2,}(\d+[.,]?\d*)\s*[рр₽]\s*$/i,
  // "Позиция 250.00"  — минимум 2 пробела перед ценой
  /^(.{3,40}?)\s{1,}(\d{2,4}[.,]\d{2})\s*$/,
]

function parsePrice(raw: string): number | null {
  // Заменяем запятую на точку
  const normalized = raw.replace(',', '.')
  const val = parseFloat(normalized)
  if (isNaN(val) || val <= 0 || val > 100000) return null
  return Math.round(val * 100) / 100
}

function cleanName(raw: string): string {
  return raw
    .replace(/^\d+[\s.)\-]+/, '')   // убираем номер строки "1. Молоко"
    .replace(/[*×x]\s*\d+.*$/, '')  // убираем "x2" в конце
    .replace(/\s{2,}/g, ' ')
    .replace(/[^\w\sа-яёА-ЯЁ%.,&()/-]/gi, '')
    .trim()
}

function isStopLine(line: string): boolean {
  const lower = line.toLowerCase()
  return STOP_WORDS.some(w => lower.includes(w))
}

function isLikelyServiceLine(line: string): boolean {
  // Строки только с цифрами/символами — не товары
  if (/^[\d\s.,\-*=_]+$/.test(line)) return true
  // Очень короткие строки
  if (line.trim().length < 3) return true
  // Штрихкоды
  if (/^\d{8,}/.test(line.trim())) return true
  return false
}

export function parseReceiptText(text: string): ParsedItem[] {
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)

  const items: ParsedItem[] = []

  for (const line of lines) {
    if (isStopLine(line)) continue
    if (isLikelyServiceLine(line)) continue

    let matched = false

    for (const pattern of PRICE_PATTERNS) {
      const m = line.match(pattern)
      if (!m) continue

      let nameRaw = m[1]
      // Для паттерна с дефисом (110-00) собираем цену
      const priceRaw = pattern.source.includes(')-((') 
        ? `${m[2]}.${m[3]}` 
        : m[2]

      const price = parsePrice(priceRaw)
      if (!price) continue

      const name = cleanName(nameRaw)
      if (name.length < 2) continue

      // Определяем уверенность
      let confidence: ParsedItem['confidence'] = 'medium'
      if (name.length >= 4 && price >= 5 && price <= 5000) confidence = 'high'
      if (name.length < 4 || price < 5 || price > 10000) confidence = 'low'

      items.push({ name, price, raw: line, confidence })
      matched = true
      break
    }

    // Fallback: строка следующая за ценой (некоторые чеки разбивают на 2 строки)
    if (!matched) {
      // Просто цена в строке — запоминаем для связки с предыдущей
    }
  }

  // Дедупликация по имени+цене
  const seen = new Set<string>()
  return items.filter(item => {
    const key = `${item.name}|${item.price}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ─── Нормализация OCR артефактов ──────────────────────────────────────────────
export function preprocessOcrText(raw: string): string {
  return raw
    // OCR часто путает: О→0, З→3, l→1, I→1
    .replace(/\bO\b/g, '0')
    // Нормализуем разделители
    .replace(/[—–]/g, '-')
    // Убираем повторяющиеся пробелы (но сохраняем двойные — они разделители)
    .replace(/[ \t]{3,}/g, '  ')
    // Убираем символы которые OCR читает как мусор
    .replace(/[|¦]/g, '')
    .trim()
}
