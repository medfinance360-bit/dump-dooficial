/**
 * Dump.do v1.2 - DumpApp page at /app
 * Design system: Dump.do / Plantão 360
 */

import { MessageList } from '../components/dump/MessageList';
import { DumpInput } from '../components/dump/DumpInput';
import { useDumpCore } from '../hooks/useDumpCore';

export function DumpApp() {
  const { messages, isLoading, error, sendMessage, clearError, isLoggedIn, isPersisted } = useDumpCore();

  return (
    <main
      className="min-h-screen flex flex-col max-w-[42rem] mx-auto px-6 py-8 md:px-8 md:py-10"
      style={{ background: 'var(--background)' }}
    >
      <header className="mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="ds-h1 mb-1" style={{ color: 'var(--foreground)' }}>
              Dump.do
            </h1>
            <p className="ds-font-serif text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Espaço pra despejar. Sem julgamento.
            </p>
          </div>
          <a
            href="/login"
            className="ds-btn-text ds-font-ui text-xs uppercase tracking-widest"
            style={{ color: 'var(--muted-foreground)' }}
          >
            {isLoggedIn ? 'Conta' : 'Entrar'}
          </a>
        </div>
        {isLoggedIn && isPersisted && (
          <p className="ds-label mt-3" style={{ color: 'var(--success)' }}>
            Conversa salva — depois você pode ver insights.
          </p>
        )}
        {isLoggedIn === false && (
          <p className="ds-label mt-3" style={{ color: 'var(--warning)' }}>
            Faça login para salvar e ver insights depois.
          </p>
        )}
      </header>

      <MessageList messages={messages} />

      {error && (
        <div
          className="mb-6 py-3 px-4 rounded-lg text-sm flex justify-between items-center"
          style={{
            background: 'rgba(206, 57, 57, 0.15)',
            border: '1px solid var(--destructive)',
            color: 'var(--destructive-foreground)',
          }}
        >
          <span>{error}</span>
          <button type="button" onClick={clearError} className="ds-btn-text underline">
            Fechar
          </button>
        </div>
      )}

      <div
        className="pt-6 mt-auto"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        {isLoading && (
          <p className="ds-font-serif text-sm mb-3 animate-pulse-text" style={{ color: 'var(--muted-foreground)' }}>
            Processando...
          </p>
        )}
        <DumpInput onSubmit={sendMessage} disabled={isLoading} />
      </div>
    </main>
  );
}
