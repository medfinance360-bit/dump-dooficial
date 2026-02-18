# Dump.do v1.2 - dump-core - Guia de teste local

## Pré-requisitos

1. **OpenAI API Key** - Configure no Supabase:
   ```bash
   supabase secrets set OPENAI_API_KEY=sk-...
   ```

2. **Variáveis de ambiente (frontend)** - `.env` ou `.env.local` em `dump-do/`:
   - Produção: `VITE_SUPABASE_URL=https://seu-projeto.supabase.co` e `VITE_SUPABASE_ANON_KEY=eyJ...`
   - Local (com `supabase start`): use `VITE_SUPABASE_URL=http://127.0.0.1:54321` e a anon key de `supabase status` (campo "anon key")

## Rodar localmente

### 1. Backend (Supabase)

```bash
cd dump_do_backend
supabase start
supabase functions serve dump-core --env-file .env.local
```

Se não tiver `.env.local`, crie com:
```
OPENAI_API_KEY=sk-...
```

### 2. Frontend

```bash
cd dump-do
npm run dev
```

### 3. Acessar

- `http://localhost:5173` → Landing page
- `http://localhost:5173/app` → DumpApp (v1.2)

## Testar dump-core direto

```bash
curl -X POST "http://localhost:54321/functions/v1/dump-core" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SUA_ANON_KEY" \
  -H "apikey: SUA_ANON_KEY" \
  -d '{"message":"To muito estressado com o trabalho","history":[]}'
```

Resposta esperada (JSON):
```json
{
  "ok": true,
  "response": "Pesado. O que tá rolando?",
  "detected_emotions": ["ansiedade", "frustração"],
  "micro_action": null,
  "should_end": false
}
```

## Fluxo v1.2

1. Usuário acessa `/app`
2. Digita mensagem, Enter envia
3. Frontend faz POST em `dump-core` com `{ message, history }`
4. Backend: MIND-SAFE → OpenAI tool call → sanitize → JSON
5. Frontend mostra resposta (sem insights/emotions na UI)

## Verificação v1.2

- **Rota `/app`** usa apenas: `DumpApp`, `MessageList`, `DumpInput`, `ResponseCard`, `useDumpCore`, `types/dump`. Nenhum import de `Dump.tsx`, `amieCore.ts`, `geminiService.ts`, `InsightPanel.tsx` ou `EmergencyModal.tsx`.
- **Backend**: resposta sempre JSON (incluindo `OPTIONS` → `{"ok": true}`); sem log de conteúdo do usuário; MIND-SAFE no backend.

## Rollback

O fluxo antigo (Dump.tsx + chat Edge Function) permanece no código. Para reativar, ajuste `App.tsx` para renderizar `<Dump />` em alguma rota (ex: `/chat`).
