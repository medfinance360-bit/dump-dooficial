import './index.css'
import { DumpApp } from './pages/DumpApp'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'

function App() {
  const path = window.location.pathname

  if (path === '/app') return <DumpApp />
  if (path === '/login') return <LoginPage />
  if (path === '/signup') return <SignupPage />

  return <LandingPage />
}

export default App 

