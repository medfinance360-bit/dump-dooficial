/**
 * Dump.do - Login page
 * Design system: Dump.do / Plantão 360
 */

import { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (err) {
        setError(err.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : err.message);
        return;
      }
      window.location.href = '/app';
    } catch {
      setError('Erro ao entrar. Tente de novo.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const { data, error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/app` },
      });
      if (err) {
        setError(err.message);
        return;
      }
      if (data?.url) window.location.href = data.url;
    } catch {
      setError('Erro ao conectar com Google. Tente de novo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      className="min-h-screen flex items-center justify-center p-6 animate-fade-in"
      style={{ background: 'var(--background)' }}
    >
      <div className="w-full max-w-[28rem]" style={{ maxWidth: '448px' }}>
        <a
          href="/"
          className="ds-btn-text inline-flex items-center gap-2 mb-8 ds-font-ui"
          style={{ color: 'var(--muted-foreground)' }}
        >
          <ArrowLeft size={20} />
          Voltar
        </a>

        <h1 className="ds-h1 mb-2" style={{ color: 'var(--foreground)' }}>
          Entrar
        </h1>
        <p className="ds-font-serif text-base mb-8" style={{ color: 'var(--muted-foreground)' }}>
          Acesse sua conta para salvar conversas e ver insights.
        </p>

        <div className="ds-card">
          {error && (
            <div
              className="mb-6 py-3 px-4 rounded-lg text-sm flex items-center justify-between"
              style={{
                background: 'rgba(206, 57, 57, 0.15)',
                border: '1px solid var(--destructive)',
                color: 'var(--destructive-foreground)',
              }}
            >
              <span>{error}</span>
              <button type="button" onClick={() => setError(null)} className="ds-btn-text text-sm underline">
                Fechar
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="ds-btn-secondary w-full flex items-center justify-center gap-2 mb-5"
          >
            Continuar com Google
          </button>

          <div className="flex items-center gap-3 mb-5" style={{ color: 'var(--muted-foreground)' }}>
            <span className="flex-1" style={{ borderTop: '1px solid var(--border)' }} />
            <span className="ds-label text-xs">ou</span>
            <span className="flex-1" style={{ borderTop: '1px solid var(--border)' }} />
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-5">
              <label htmlFor="email" className="ds-label block mb-2">
                E-mail
              </label>
              <div className="relative">
                <Mail
                  size={20}
                  className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: 'var(--muted-foreground)' }}
                />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="ds-input pl-12"
                  style={{
                    background: 'var(--secondary)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
              </div>
            </div>

            <div className="mb-6">
              <label htmlFor="password" className="ds-label block mb-2">
                Senha
              </label>
              <div className="relative">
                <Lock
                  size={20}
                  className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: 'var(--muted-foreground)' }}
                />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="ds-input pl-12 pr-12"
                  style={{
                    background: 'var(--secondary)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 ds-btn-text p-1"
                  style={{ color: 'var(--muted-foreground)' }}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="ds-btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="animate-pulse-text">Entrando...</span>
              ) : (
                'Entrar com e-mail'
              )}
            </button>
          </form>

          <p className="ds-font-serif text-sm mt-6 text-center" style={{ color: 'var(--muted-foreground)' }}>
            Ainda não tem conta?{' '}
            <a href="/signup" className="underline hover:no-underline" style={{ color: 'var(--foreground)' }}>
              Criar conta
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
