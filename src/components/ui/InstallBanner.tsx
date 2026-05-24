import { useState, useEffect } from 'react'
import { X, Download } from 'lucide-react'

// BeforeInstallPromptEvent не входит в стандартные типы
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallBanner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [showIosTip, setShowIosTip] = useState(false)

  useEffect(() => {
    // Не показываем если файл открыт локально
    if (window.location.protocol === 'file:') return
    // Не показываем если уже установлено
    if (window.matchMedia('(display-mode: standalone)').matches) return
    // Не показываем если уже закрыли
    if (localStorage.getItem('install-dismissed')) return

    // Android/Desktop Chrome — ловим событие
    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // iOS Safari — показываем ручную инструкцию
    const isIosBrowser = /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      !(window.navigator as Navigator & { standalone?: boolean }).standalone
    if (isIosBrowser) setIsIos(true)

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setPrompt(null)
  }

  const handleDismiss = () => {
    setDismissed(true)
    localStorage.setItem('install-dismissed', '1')
  }

  // Ничего не показываем
  if (dismissed) return null
  if (!prompt && !isIos) return null

  // iOS инструкция
  if (isIos) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-40 slide-up">
        <div className="card border-green-800/50 shadow-xl shadow-black/40">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-white font-medium text-sm mb-1">📱 Установить на экран</p>
              {!showIosTip ? (
                <button onClick={() => setShowIosTip(true)} className="text-green-400 text-xs underline">
                  Как это сделать?
                </button>
              ) : (
                <p className="text-slate-400 text-xs leading-relaxed">
                  Нажми <strong className="text-white">⎙ Поделиться</strong> внизу экрана →
                  <strong className="text-white"> «На экран Домой»</strong>
                </p>
              )}
            </div>
            <button onClick={handleDismiss} className="text-slate-600 hover:text-white p-1 shrink-0">
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Android / Desktop
  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 slide-up">
      <div className="card border-green-800/50 shadow-xl shadow-black/40 flex items-center gap-3">
        <div className="text-2xl select-none">💰</div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-sm">Установить СплитЧек</p>
          <p className="text-slate-400 text-xs">Работает офлайн, как обычное приложение</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleInstall}
            className="btn-primary text-sm py-1.5 flex items-center gap-1.5"
          >
            <Download size={14} />
            Установить
          </button>
          <button onClick={handleDismiss} className="text-slate-600 hover:text-white p-1">
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
