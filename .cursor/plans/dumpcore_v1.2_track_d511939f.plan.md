---
name: DumpCore v1.2 Track
overview: "Create a clean v1.2 path: minimal UI at /app calling a new JSON-only dump-core edge function (OpenAI tool calling), while isolating legacy AMIE without deletion."
todos:
  - id: isolate-legacy
    content: Ensure /app does not import AMIE flow modules
    status: completed
  - id: dump-core-function
    content: Create dump-core edge function with JSON-only tool call
    status: completed
  - id: minimal-ui
    content: Create minimal /app UI + hook/types/components
    status: completed
  - id: routing
    content: Wire / and /app routes and validate flow
    status: completed
  - id: verify-guide
    content: Provide run/test guide for v1.2 flow
    status: completed
isProject: false
---

# Dump.do v1.2 Track

## Scope and constraints

- Keep legacy AMIE files but stop importing them in the new flow.
- New flow: `/app` UI → `dump-core` edge function → JSON-only response.
- No streaming; no chain-of-thought/insights in UI; no browser-side AI.

## Implementation plan

### 1) Isolate legacy AMIE flow

- Ensure the new `/app` route does not import legacy modules:
  - `dump-do/src/components/Dump.tsx`
  - `dump-do/src/services/amieCore.ts`
  - `dump-do/src/services/geminiService.ts`
  - `dump-do/src/components/InsightPanel.tsx`
  - `dump-do/src/components/EmergencyModal.tsx`
- No deletions; just make sure `/app` uses new components.

### 2) Edge function `dump-core` (já implementada)

- Implementação: `[dump_do_backend/supabase/functions/dump-core/index.ts](dump_do_backend/supabase/functions/dump-core/index.ts)` (Supabase Edge, Deno).
- Runtime: **não existe servidor Express** neste caminho v1.2 (dev/prod). Em produção e dev, o Core roda via **Supabase Edge Function**.
- Resposta: **sempre JSON** com CORS. `OPTIONS` retorna `{"ok": true}` com `Content-Type: application/json`.
- Entrada (POST): espera `{ message, history }`.
  - Validação: `message` obrigatório (trim) e rejeita payload inválido / muito grande.
  - Rate limit: janela de 60s com limite (30 req) por chave derivada de `x-forwarded-for` ou `authorization` (fallback `anon`).
  - History trimming (antes do modelo): mantém no máximo 8 mensagens e no máximo 8000 chars; para mensagens `assistant`, usa `ai_response.response` quando presente (fallback `content`).
- Segurança (camada separada do Core): reutiliza MIND-SAFE do backend via `[dump_do_backend/supabase/functions/chat/mind-safe.ts](dump_do_backend/supabase/functions/chat/mind-safe.ts)`.
  - Essa camada roda **antes** do LLM e pode interceptar casos críticos com um payload JSON de emergência (ex.: `{ ok: false, emergency: true, message, risk_level }`), sem alterar o **contrato do Core em sucesso** (`ok: true`).
  - No frontend, componentes como `EmergencyModal` podem existir **antes/depois** do `dump-core`, mas **não mudam** o JSON do Core.
- LLM (tool calling obrigatório): chamada OpenAI com tool calling forçado para `respond_to_dump` (schema abaixo). O prompt do sistema (v1.3) vive no backend e **não deve aparecer no output** nem ser “explicado” ao usuário.
- Pós-modelo (sanitização já aplicada no backend): truncation/limites, no máximo 1 `?`, emoções filtradas para enum fixa (max 2), `micro_action` opcional com limite.
- OpenAI tool calling required: `respond_to_dump` function with schema (não mudar o contrato):
  - `response` (string, max 240)
  - `detected_emotions` (enum list, max 2)
  - `micro_action` (string|null, max 120)
  - `should_end` (boolean)
- Arquiteturas internas (não expor): AMIE/Wayfinding/PHA são **mecanismos internos de raciocínio** e **não aparecem** no JSON de saída.
- Proibições explícitas (contrato): **não** adicionar `inner_monologue`, SOAP, sumários/explicações longas, ou novos campos no JSON; o frontend **não** chama OpenAI/Gemini diretamente.

### 3) Build new minimal UI at `/app`

- Create:
  - `[dump-do/src/pages/DumpApp.tsx](dump-do/src/pages/DumpApp.tsx)`
  - `[dump-do/src/components/dump/DumpInput.tsx](dump-do/src/components/dump/DumpInput.tsx)`
  - `[dump-do/src/components/dump/MessageList.tsx](dump-do/src/components/dump/MessageList.tsx)`
  - `[dump-do/src/components/dump/ResponseCard.tsx](dump-do/src/components/dump/ResponseCard.tsx)`
  - `[dump-do/src/hooks/useDumpCore.ts](dump-do/src/hooks/useDumpCore.ts)`
  - `[dump-do/src/types/dump.ts](dump-do/src/types/dump.ts)`
- Behavior:
  - Local in-memory state only.
  - Send `{ message, history }` to `dump-core` via fetch using `VITE_SUPABASE_URL` and anon key headers.
  - UI rules: user on right muted; assistant on left; no insights/emotions displayed.
  - If `should_end` true, add extra spacing after response.
  - Textarea auto-grow, Enter sends, Shift+Enter newline.

### 4) Routing

- Update `[dump-do/src/App.tsx](dump-do/src/App.tsx)` to render:
  - `/` → simple landing (minimal copy)
  - `/app` → `DumpApp`
- Use the simplest routing approach available in the project (e.g., `react-router` if already present; otherwise minimal conditional routing).

### 5) Verification and handoff

- Confirm new files exist and legacy AMIE remains unused in `/app` path.
- Provide a mini-guide to run locally and test the `dump-core` function.

## Notes to implement

- Keep the backend response strictly JSON in all branches, including preflight:
  - `OPTIONS` returns `{"ok": true}` with `Content-Type: application/json`.
- Avoid logging user content in `dump-core`.
- Frontend must never call OpenAI/Gemini directly.

