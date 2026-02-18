# Dump.do Backend v0.1

> Backend para o Dump.do - Parceiro de clareza cognitiva para profissionais de alta pressão.

## 🏗️ Arquitetura

```
dump_do_backend/
├── supabase/
│   ├── migrations/          # SQL migrations
│   │   ├── 001_enable_extensions.sql
│   │   ├── 002_create_users_table.sql
│   │   ├── 003_create_sessions_table.sql
│   │   ├── 004_create_messages_table.sql
│   │   ├── 005_create_risk_events_table.sql
│   │   └── 006_prepare_vector_store.sql
│   ├── functions/
│   │   └── chat/               # Edge Function principal
│   │       ├── index.ts        # Handler principal
│   │       ├── mind-safe.ts    # Sistema de detecção de crises
│   │       ├── prompts.ts      # System prompts dinâmicos
│   │       └── llm-provider.ts # Abstração de LLMs
│   └── config.toml
├── scripts/
│   ├── setup.sh
│   └── deploy.sh
├── docs/
│   └── API.md
├── .env.example
└── README.md
```

## 🚀 Quick Start

### Pré-requisitos

- [Supabase CLI](https://supabase.com/docs/guides/cli)
- Conta no [Supabase](https://supabase.com)
- API Key do [Google AI Studio](https://aistudio.google.com/app/apikey) (Gemini)

### Setup

```bash
# 1. Clone e entre no diretório
cd dump_do_backend

# 2. Copie e configure as variáveis de ambiente
cp .env.example .env
# Edite .env com suas credenciais

# 3. Execute o setup
chmod +x scripts/setup.sh
./scripts/setup.sh

# 4. Aplique as migrations
supabase db push

# 5. Deploy das Edge Functions
supabase functions deploy chat
```

### Desenvolvimento Local

```bash
# Inicie o Supabase local
supabase start

# Sirva as funções localmente
supabase functions serve chat --env-file .env
```

## 📊 Banco de Dados

### Tabelas

| Tabela | Descrição |
|--------|----------|
| `users` | Perfis de usuário (integrado com Supabase Auth) |
| `sessions` | Sessões de chat com tracking de risco |
| `messages` | Mensagens com avaliação MIND-SAFE |
| `risk_events` | Log de eventos de risco (análise) |
| `memory_summaries` | (v0.2) Memórias de longo prazo |

### Extensões

- `uuid-ossp`: Geração de UUIDs
- `pgvector`: Busca vetorial (preparado para v0.2)
- `pg_trgm`: Similaridade de texto

## 🛡️ Sistema MIND-SAFE

O MIND-SAFE intercepta mensagens **antes** do LLM para detectar crises:

### Níveis de Risco

| Nível | Ação |
|-------|------|
| `none` | Processamento normal |
| `low` | Monitora, processamento normal |
| `medium` | Loga evento, processamento normal |
| `high` | Loga evento, resposta de emergência |
| `critical` | Loga evento, resposta de emergência imediata |

### Indicadores Detectados

- 🚨 **Ideação suicida**: Expressões diretas, métodos
- 🩸 **Automutilação**: Cortes, queimaduras, auto-lesão
- ⚠️ **Violência**: Ameaças, intenções
- 💊 **Crises de vício**: Overdose, abstinência grave
- 💨 **Ataques de pânico**: Sintomas agudos

### Resposta de Emergência

Quando detectado risco alto/crítico:
1. Encaminha para CVV (188)
2. Oferece técnicas de grounding
3. Registra evento para análise
4. Não envia para o LLM (resposta pré-definida)

## 🤖 Modos de Chat

### Modo DUMP (Espelho)
- Permite desabafo sem interrupções
- Empatia cognitiva, sem julgamento
- Perguntas curtas: Fatos/Pensamentos/Sensações
- **PROIBIDO** dar conselhos

### Modo PROCESSAR (Estabilização)
Respostas estruturadas em 3 blocos:
- **0-5min**: Autocuidado físico imediato
- **5-20min**: Micro-ação concreta
- **+20min**: Estratégia (opcional)

## 🔄 Troca de LLM

O sistema suporta múltiplos providers:

```typescript
// .env
LLM_PROVIDER=openai  // ou: gemini, anthropic

// Modelos disponíveis:
// - gpt-4o (default)
// - gemini-2.5-flash-preview-05-20
// - claude-3-5-sonnet-20241022
```

## 📝 LGPD Compliance

- Dados sensíveis de saúde protegidos (Art. 11)
- Retenção configurável por usuário
- Consentimento versionado
- Risk events anonimizados
- RLS (Row Level Security) em todas as tabelas

## 🛠️ Variáveis de Ambiente

| Variável | Obrigatório | Descrição |
|----------|------------|----------|
| `SUPABASE_URL` | ✅ | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Chave de serviço |
| `OPENAI_API_KEY` | ✅ | API Key do OpenAI |
| `GEMINI_API_KEY` | ❌ | API Key do Gemini |
| `ANTHROPIC_API_KEY` | ❌ | API Key do Anthropic |
| `LLM_PROVIDER` | ❌ | Provider padrão (openai) |
| `ENVIRONMENT` | ❌ | development/production |

## 📚 Roadmap

### v0.1 (Atual)
- [x] Migrations SQL
- [x] Sistema MIND-SAFE
- [x] Edge Function de chat
- [x] Modos Dump/Processar
- [x] Integração OpenAI

### v0.2 (Planejado)
- [ ] Vector Store para memória de longo prazo
- [ ] Embeddings automáticos
- [ ] Busca semântica de contexto
- [ ] Sumários de sessão com IA

## 🆘 Suporte

Problemas ou dúvidas? Abra uma issue no repositório.

---

⚠️ **Aviso**: Este sistema não substitui acompanhamento profissional de saúde mental. Em caso de emergência, ligue para o CVV: **188**.
