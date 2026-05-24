import { useState, useCallback } from 'react'
import { parseReceiptText, preprocessOcrText, type ParsedItem } from '../utils/receiptParser'

export type OcrStatus = 'idle' | 'loading' | 'recognizing' | 'parsing' | 'done' | 'error'

export interface OcrResult {
  items: ParsedItem[]
  rawText: string
}

export interface OcrState {
  status: OcrStatus
  progress: number      // 0–100
  result: OcrResult | null
  error: string | null
}

// Проверяем — это single-file сборка? (нет воркеров Tesseract)
const isSingleFile = () => {
  try {
    // В single file сборке путь к воркеру не резолвится
    return window.location.protocol === 'file:'
  } catch {
    return false
  }
}

export function useOcr() {
  const [state, setState] = useState<OcrState>({
    status: 'idle',
    progress: 0,
    result: null,
    error: null,
  })

  const recognize = useCallback(async (imageSource: File | string) => {
    // Если запущено как file:// — OCR недоступен
    if (isSingleFile()) {
      setState(s => ({ ...s, status: 'error', error: 'offline' }))
      return
    }

    setState({ status: 'loading', progress: 0, result: null, error: null })

    try {
      // Динамический импорт — не грузим Tesseract если не нужен
      const Tesseract = await import('tesseract.js')

      setState(s => ({ ...s, status: 'recognizing', progress: 10 }))

      const { data } = await Tesseract.recognize(
        imageSource,
        'rus+eng',  // Русский + английский (цифры, латинские бренды)
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              setState(s => ({
                ...s,
                progress: Math.round(10 + m.progress * 80),
              }))
            }
          },
        }
      )

      setState(s => ({ ...s, status: 'parsing', progress: 95 }))

      const cleaned = preprocessOcrText(data.text)
      const items = parseReceiptText(cleaned)

      setState({
        status: 'done',
        progress: 100,
        result: { items, rawText: cleaned },
        error: null,
      })
    } catch (err) {
      console.error('OCR error:', err)
      setState({
        status: 'error',
        progress: 0,
        result: null,
        error: err instanceof Error ? err.message : 'Ошибка распознавания',
      })
    }
  }, [])

  const reset = useCallback(() => {
    setState({ status: 'idle', progress: 0, result: null, error: null })
  }, [])

  return { state, recognize, reset }
}
