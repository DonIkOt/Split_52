// ─── Универсальный парсер российских чеков ───────────────────────────────────
//
// Поддерживаемые форматы:
//
// [A] Однострочный с НДС (Лента, Пятёрочка, Магнит, АТОЛ):
//     ПИВО ВОЛКОВ 104.99 *1 =104.99 НДС 22%
//     ШАШЛЫК КУР  529.99 *1.559 =826.25 НДС 10%   ← весовой
//     КОЛА        109.99 *3 =329.97 НДС 22%        ← несколько штук
//
// [B] Двухстрочный ресторанный (ШТРИХ-М, iiko):
//     картофель печёный
//         115.00 * 1шт. = 115.00
//
// [C] Стандартный однострочный (пробелы между названием и ценой):
//     Молоко 3.2% 1л          89.90
//
// [D] С количеством в начале:
//     2 x Кола 2л             398.00
//
// [E] Табличный (заголовок + строки):
//     Молоко    89.90   1    89.90
//
// [F] Цена через дефис:
//     ПИВО БАЛТИКА       110-00
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedItem {
  name: string
  price: number
  raw: string
  confidence: 'high' | 'medium' | 'low'
}

// ─── Стоп-слова ───────────────────────────────────────────────────────────────
const STOP_RE = /итого|к оплате|наличными|картой|безналичными|сдача|кэшбэк|скидк|бонус|баллы|без ндс|сумма ндс|спасибо|кассир|чек №|чек#|место расчет|сно:|усн |приход|возврат|receipt|total|cash|sale|павильон|документ на продаж|смена n|касса:|кассовый чек|ваша скидка|начислено|баланс|скидка по карте|субитого/i

const SERVICE_RE = /^[\d\s.,\-*=_:/\\|<>(){}[\]]{4,}$|^\d{6,}|^(инн|кпп|фн|фд|фп|рн|ккт|снилс)\s|\d{2}\.\d{2}\.\d{4}/i

function isStop(line: string)    { return STOP_RE.test(line.trim()) }
function isService(line: string) { return SERVICE_RE.test(line.trim()) }

function toPrice(s: string): number | null {
  const v = parseFloat(s.replace(',', '.').replace(/\s/g, ''))
  if (isNaN(v) || v <= 0 || v > 999999) return null
  return Math.round(v * 100) / 100
}

function cleanName(s: string): string {
  return s
    .replace(/^\d+\s*[x×х]\s*/i, '')  // "2 x " в начале
    .replace(/^\d+[\s.)]\s*/,   '')    // "1. " номер строки
    .replace(/[*×х]\s*[\d.,]+.*$/i, '') // "* 2" в конце
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function confidence(name: string, price: number): ParsedItem['confidence'] {
  if (name.length >= 4 && price >= 5 && price <= 50000) return 'high'
  if (name.length >= 2 && price > 0) return 'medium'
  return 'low'
}

// ─── Паттерн A: однострочный с *кол =итог [НДС XX%] ─────────────────────────
// "ПИВО ВОЛКОВ 104.99 *1 =104.99 НДС 22%"
// "ШАШЛЫК КУР  529.99 *1.559 =826.25 НДС 10%"
// * может быть пропущен OCR или заменён на »] х и другие символы
const RE_A = /^(.+?)\s+(\d+[.,]\d{2,3})\s*(?:[*×хx»\]\[|]{0,3}\s*)[\d.,]+\s*=\s*(\d+[.,]\d{2})/i

// Формат без * совсем: "НАЗВАНИЕ ЦЕНА =ИТОГ НДС"
const RE_A2 = /^(.+?)\s+(\d+[.,]\d{2,3})\s+=\s*(\d+[.,]\d{2})\s*(?:НДС|НАС|HDC|HДС)/i

// ─── Паттерн B: строка цены двухстрочного формата ────────────────────────────
// "    115.00 * 1шт. = 115.00"  или  "85.00 * 1 = 85.00"
const RE_B = /^\s*(\d+[.,]\d{2})\s*[*×х]\s*[\d.,]+\s*(?:шт\.?)?\s*=\s*(\d+[.,]\d{2})\s*$/i

// Просто "= 115.00" в конце (упрощённый двухстрочный)
const RE_B2 = /=\s*(\d+[.,]\d{2})\s*(?:руб\.?)?\s*$/i

// ─── Паттерн C: название + пробелы + цена ────────────────────────────────────
// "Молоко 3.2%          89.90"
const RE_C = /^(.{3,35}?)\s{2,}(\d+[.,]\d{2})\s*$/

// ─── Паттерн D: кол-во + название + цена ─────────────────────────────────────
// "2 x Кола 2л   398.00"
const RE_D = /^\d+\s*[xх×]\s*(.+?)\s{2,}(\d+[.,]\d{2})\s*$/i

// ─── Паттерн E: табличный (название пробелы цена пробелы кол пробелы итог) ───
// "Молоко    89.90   1    89.90"
const RE_E = /^(.+?)\s{2,}(\d+[.,]\d{2})\s+[\d.,]+\s+(\d+[.,]\d{2})\s*$/

// ─── Паттерн F: цена через дефис ─────────────────────────────────────────────
// "ПИВО БАЛТИКА       110-00"
const RE_F = /^(.+?)\s{2,}(\d{2,4})-(\d{2})\s*$/

// ─── Паттерн G: цена с буквой р/₽ ───────────────────────────────────────────
// "Хлеб белый        55р"
const RE_G = /^(.+?)\s{2,}(\d+[.,]?\d*)\s*[р₽руб]\b/i

// ─── Главная функция ──────────────────────────────────────────────────────────
export function parseReceiptText(text: string): ParsedItem[] {
  const lines = text.split('\n').map(l => l.trimEnd())
  const items: ParsedItem[] = []
  let prevName = ''   // для двухстрочного формата
  let prevRaw  = ''

  for (const line of lines) {
    const t = line.trim()
    if (!t || isService(t) || isStop(t)) {
      prevName = ''; prevRaw = ''; continue
    }

    // ── Формат A: однострочный с *кол =итог ─────────────────────────────────
    {
      const m = t.match(RE_A) || t.match(RE_A2)
      if (m) {
        const name  = cleanName(m[1])
        const price = toPrice(m[3])  // берём итоговую цену (после =)
        if (name.length >= 2 && price) {
          items.push({ name, price, raw: t, confidence: confidence(name, price) })
          prevName = ''; prevRaw = ''; continue
        }
      }
    }

    // ── Формат B: строка цены двухстрочного ─────────────────────────────────
    {
      const m = t.match(RE_B)
      if (m && prevName) {
        const price = toPrice(m[2])
        if (price) {
          const name = cleanName(prevName)
          items.push({ name, price, raw: `${prevRaw} | ${t}`, confidence: confidence(name, price) })
          prevName = ''; prevRaw = ''; continue
        }
      }
      // Упрощённый B2: строка начинается с отступа + число
      if (/^\s{2,}\d/.test(line) && prevName) {
        const m2 = t.match(RE_B2)
        if (m2) {
          const price = toPrice(m2[1])
          if (price) {
            const name = cleanName(prevName)
            items.push({ name, price, raw: `${prevRaw} | ${t}`, confidence: confidence(name, price) })
            prevName = ''; prevRaw = ''; continue
          }
        }
      }
    }

    // ── Формат E: табличный с тремя числами ─────────────────────────────────
    {
      const m = t.match(RE_E)
      if (m) {
        const name  = cleanName(m[1])
        const price = toPrice(m[3])  // последнее число = итоговая цена
        if (name.length >= 2 && price) {
          items.push({ name, price, raw: t, confidence: confidence(name, price) })
          prevName = ''; prevRaw = ''; continue
        }
      }
    }

    // ── Формат D: кол-во × название ─────────────────────────────────────────
    {
      const m = t.match(RE_D)
      if (m) {
        const name  = cleanName(m[1])
        const price = toPrice(m[2])
        if (name.length >= 2 && price) {
          items.push({ name, price, raw: t, confidence: confidence(name, price) })
          prevName = ''; prevRaw = ''; continue
        }
      }
    }

    // ── Формат C: стандартный пробельный ────────────────────────────────────
    {
      const m = t.match(RE_C)
      if (m) {
        const name  = cleanName(m[1])
        const price = toPrice(m[2])
        if (name.length >= 2 && price) {
          items.push({ name, price, raw: t, confidence: confidence(name, price) })
          prevName = ''; prevRaw = ''; continue
        }
      }
    }

    // ── Формат F: цена через дефис ──────────────────────────────────────────
    {
      const m = t.match(RE_F)
      if (m) {
        const name  = cleanName(m[1])
        const price = toPrice(`${m[2]}.${m[3]}`)
        if (name.length >= 2 && price) {
          items.push({ name, price, raw: t, confidence: confidence(name, price) })
          prevName = ''; prevRaw = ''; continue
        }
      }
    }

    // ── Формат G: цена с р/₽ ────────────────────────────────────────────────
    {
      const m = t.match(RE_G)
      if (m) {
        const name  = cleanName(m[1])
        const price = toPrice(m[2])
        if (name.length >= 2 && price) {
          items.push({ name, price, raw: t, confidence: confidence(name, price) })
          prevName = ''; prevRaw = ''; continue
        }
      }
    }

    // ── Не распознали — запоминаем как потенциальное название (для формата B)
    if (t.length >= 2 && t.length <= 60 && !/^\d/.test(t)) {
      prevName = t
      prevRaw  = t
    } else {
      prevName = ''; prevRaw = ''
    }
  }

  // Дедупликация по ключу имя+цена
  const seen = new Set<string>()
  return items.filter(item => {
    const key = `${item.name.toLowerCase()}|${item.price}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ─── Пре-обработка OCR текста ─────────────────────────────────────────────────
export function preprocessOcrText(raw: string): string {
  return raw
    .replace(/[—–]/g, '-')
    .replace(/[ \t]{3,}/g, '   ')  // нормализуем пробелы, сохраняем двойные
    .replace(/[|¦]/g, 'I')         // вертикальная черта → I (часто путается)
    .replace(/\bO\b/g, '0')        // одиночная O → 0 в числах
    .trim()
}

