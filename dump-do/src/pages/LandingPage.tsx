/**
 * Dump.do - Landing page
 * Design system: Dump.do / Plantão 360
 */

export function LandingPage() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12 animate-fade-in"
      style={{ background: 'var(--background)' }}
    >
      <div className="w-full max-w-[28rem] text-center">
        <h1 className="ds-h1 mb-3" style={{ color: 'var(--foreground)' }}>
          Dump.do
        </h1>
        <p
          className="ds-font-serif text-lg mb-10"
          style={{ color: 'var(--muted-foreground)', lineHeight: 1.6 }}
        >
          Espaço pra tirar da cabeça o que está pesando. Sem julgamento, sem conselho não pedido.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <a
            href="/app"
            className="ds-btn-primary inline-flex items-center justify-center no-underline"
          >
            Começar
          </a>
          <a
            href="/login"
            className="ds-btn-secondary inline-flex items-center justify-center no-underline"
          >
            Entrar
          </a>
        </div>
      </div>
    </main>
  );
}
