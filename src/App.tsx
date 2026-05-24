import { useEffect } from 'react'
import { AppProvider, useApp } from './store/AppContext'
import HomeView from './components/session/HomeView'
import SessionView from './components/session/SessionView'
import InstallBanner from './components/ui/InstallBanner'

function Router() {
  const { state } = useApp()

  // Блокируем pull-to-refresh на мобиле
  useEffect(() => {
    document.body.style.overscrollBehavior = 'none'
  }, [])

  if (state.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center fade-in">
          <div className="text-6xl mb-4 select-none">💰</div>
          <div className="text-slate-400 text-sm">Загрузка...</div>
          <div className="mt-4 flex justify-center gap-1">
            {[0,1,2].map(i => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-green-500"
                style={{ animation: `fadeIn 0.6s ease ${i * 0.2}s infinite alternate` }}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div key={state.view} className="fade-in">
        {state.view === 'home' ? <HomeView /> : <SessionView />}
      </div>
      <InstallBanner />
    </>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Router />
    </AppProvider>
  )
}
