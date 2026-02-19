/**
 * Dump.do - Onboarding (first visit)
 * Design system: Dump.do / Plantão 360 — mobile-first
 */

import { useState } from 'react'

const ONBOARDING_DONE_KEY = 'dumpdo_onboarding_done'

const SLIDES = [
  {
    title: 'Espaço pra despejar',
    body: 'Tire da cabeça o que está pesando. Sem precisar explicar tudo.',
  },
  {
    title: 'Sem julgamento',
    body: 'Ninguém vai te dar conselho não pedido. Só escuta e uma pergunta na hora certa.',
  },
  {
    title: 'Quando fizer sentido',
    body: 'Às vezes uma microação. Às vezes só organizar o que você já disse.',
  },
]

export function OnboardingPage() {
  const [step, setStep] = useState(0)
  const isLast = step === SLIDES.length - 1

  const handleNext = () => {
    if (isLast) {
      try {
        localStorage.setItem(ONBOARDING_DONE_KEY, '1')
      } catch {
        // ignore
      }
      window.location.href = '/login'
      return
    }
    setStep((s) => s + 1)
  }

  const handleSkip = () => {
    try {
      localStorage.setItem(ONBOARDING_DONE_KEY, '1')
    } catch {
      // ignore
    }
    window.location.href = '/login'
  }

  return (
    <main
      className="min-h-screen flex flex-col justify-between px-6 py-8 pb-10"
      style={{
        background: 'var(--background)',
        paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))',
      }}
    >
      <div className="flex-1 flex flex-col justify-center max-w-[28rem] mx-auto w-full">
        <div className="mb-10">
          <span
            className="ds-h1 tracking-tight"
            style={{ color: 'var(--foreground)' }}
            aria-hidden
          >
            Dump.do
          </span>
        </div>

        <div className="min-h-[12rem]">
          <h2
            className="ds-h2 mb-4"
            style={{ color: 'var(--foreground)' }}
          >
            {SLIDES[step].title}
          </h2>
          <p
            className="ds-font-serif text-lg leading-relaxed"
            style={{ color: 'var(--muted-foreground)' }}
          >
            {SLIDES[step].body}
          </p>
        </div>
      </div>

      <footer className="flex flex-col items-center gap-6 mt-8">
        <div className="flex gap-2" role="tablist" aria-label="Passos">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-selected={i === step}
              aria-label={`Passo ${i + 1}`}
              className="w-2 h-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--background)]"
              style={{
                background: i === step ? 'var(--foreground)' : 'var(--muted)',
              }}
              onClick={() => setStep(i)}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={handleNext}
          className="w-full max-w-[20rem] min-h-[3rem] rounded-lg ds-font-ui text-sm font-medium uppercase tracking-widest transition-opacity active:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--background)]"
          style={{
            background: 'var(--foreground)',
            color: 'var(--background)',
          }}
        >
          {isLast ? 'Começar' : 'Próximo'}
        </button>

        <button
          type="button"
          onClick={handleSkip}
          className="ds-btn-text ds-font-ui text-xs uppercase tracking-widest"
          style={{ color: 'var(--muted-foreground)' }}
        >
          Pular
        </button>
      </footer>
    </main>
  )
}

export function hasOnboardingBeenSeen(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return !!localStorage.getItem(ONBOARDING_DONE_KEY)
  } catch {
    return true
  }
}
