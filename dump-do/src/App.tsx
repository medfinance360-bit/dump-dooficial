import './index.css'
import { useState, useEffect } from 'react'
import { DumpApp } from './pages/DumpApp'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { OnboardingPage, hasOnboardingBeenSeen } from './pages/OnboardingPage'
import { supabase } from './services/supabaseClient'

function ProtectedApp() {
  const [ready, setReady] = useState(false)
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setAllowed(!!user)
      setReady(true)
    })
  }, [])

  useEffect(() => {
    if (!ready) return
    if (!allowed) window.location.replace('/login')
  }, [ready, allowed])

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <p style={{ color: 'var(--muted-foreground)' }}>Carregando…</p>
      </div>
    )
  }
  if (!allowed) return null
  return <DumpApp />
}

function App() {
  const path = window.location.pathname

  if (path === '/app') return <ProtectedApp />
  if (path === '/login') return <LoginPage />
  if (path === '/signup') return <SignupPage />

  if (path === '/' && !hasOnboardingBeenSeen()) return <OnboardingPage />
  return <LoginPage />
}

export default App 

