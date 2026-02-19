# Dump.do

Repositório oficial do projeto Dump.do: frontend (React/Vite) e backend (Supabase Edge Functions).

## Estrutura

| Pasta | Conteúdo |
|-------|----------|
| **dump-do** | Frontend: app em React + Vite. Landing, `/app` (chat), chamada à Edge Function dump-core. |
| **dump_do_backend** | Backend: Supabase (Edge Functions, dump-core, MIND-SAFE, migrations). |
| **.cursor** | Planos e regras do projeto (Cursor). |

## Como rodar

### Frontend (dump-do)
```bash
cd dump-do
npm install
npm run dev
```
Crie um `.env` em `dump-do/` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` se for usar o chat contra o Supabase.

### Backend (Supabase)
- Deploy das Edge Functions e do banco via Supabase CLI a partir de `dump_do_backend/`.
- As variáveis de ambiente do backend (OpenAI, Supabase service role, etc.) são configuradas no **Supabase Dashboard** (Settings → Edge Functions → Secrets) ou num arquivo **.env** local só para testes. Veja a seção [Variáveis de ambiente](#variáveis-de-ambiente) abaixo.

## Variáveis de ambiente

### O que é o `.env.example`?
- É um **modelo**: mostra **quais** variáveis existem e **não** deve conter chaves reais.
- No repositório o `.env.example` já vem com **placeholders** (ex.: `your_openai_key_here`). Você **não precisa mudar** o `.env.example` para colocar suas chaves.

### O que você precisa fazer (indispensável para rodar o backend)
1. **Copiar** o arquivo de exemplo para um arquivo real:
   - No backend: `dump_do_backend/.env.example` → `dump_do_backend/.env`
2. **Abrir** o `.env` (que não vai pro Git) e **substituir** os placeholders pelos seus valores reais:
   - Supabase: URL e chaves em [Supabase Dashboard](https://supabase.com/dashboard) → seu projeto → Settings → API.
   - OpenAI: chave em [OpenAI API Keys](https://platform.openai.com/api-keys) (necessária para a Edge Function dump-core).
   - Outras (Gemini, Anthropic) só se for usar.
3. **Nunca** commitar o arquivo `.env` (ele já está no `.gitignore`).

**Resumo:** não é indispensável **alterar** o `.env.example`. É indispensável **ter um `.env`** (cópia dele) com as chaves reais para o backend (e, no frontend, as variáveis `VITE_*` no `.env` do dump-do) para a aplicação funcionar.

## Deploy

- **Frontend:** Vercel. Importe este repositório e defina **Root Directory** = `dump-do`. Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` nas variáveis de ambiente do Vercel.
- **Backend:** Supabase (Edge Functions e banco). Chaves (ex.: OpenAI) nas Secrets do projeto no Supabase.

Detalhes: [dump-do/DEPLOY-VERCEL.md](dump-do/DEPLOY-VERCEL.md) e [dump_do_backend/README.md](dump_do_backend/README.md).

## Documentação extra

- [STATUS-E-PROXIMOS-PASSOS.md](STATUS-E-PROXIMOS-PASSOS.md) — status do repo, push para GitHub e próximos passos (Vercel, celular).
- [.cursor/plans/dumpcore_v1.2_track_d511939f.plan.md](.cursor/plans/dumpcore_v1.2_track_d511939f.plan.md) — arquitetura da Edge Function dump-core.
