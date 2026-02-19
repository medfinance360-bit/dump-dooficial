# Status do projeto e próximos passos

Documento salvo para retomar depois de fechar o Cursor. Atualizado até a sessão atual.

---

## 1. O que já foi feito (até aqui)

### Git no projeto
- Repositório Git **inicializado** na pasta raiz `01_PLANTAO360` (onde estão `dump-do`, `dump_do_backend`, etc.).
- Branch padrão: **`main`**.
- **Remote `origin`** configurado: `https://github.com/medfinance360-bit/dump-dooficial.git`
- **Primeiro commit** feito com: dump-do, dump_do_backend, .cursor (planos/rules), .gitignore, package.json, etc.

### .gitignore (raiz)
- Ignora: `node_modules/`, `dist/`, `.env` e variantes, `_tmp_*`, `*.zip`, pastas Supabase `.branches` e `.temp`, arquivos de IDE/OS.
- Garante que chaves e arquivos temporários **não** entram no repositório.

### Segurança / .env.example
- O arquivo **`dump_do_backend/.env.example`** foi **corrigido**: todas as chaves reais (OpenAI, Supabase, Gemini) foram trocadas por **placeholders** (ex.: `your_openai_key_here`, `your_supabase_anon_key_here`).
- O arquivo no disco **já está limpo**; o problema é que o **commit** que você está tentando enviar ainda é o antigo (com a chave na linha 29). Por isso o próximo passo é fazer **amend** e **push** de novo.

### Documentação criada
- **`dump-do/vercel.json`**: config do Vercel (build Vite, output `dist`).
- **`dump-do/DEPLOY-VERCEL.md`**: passo a passo para subir no Vercel e abrir no celular.
- **`.cursor/plans/dumpcore_v1.2_track_d511939f.plan.md`**: plano v1.2 atualizado descrevendo o dump-core real (Edge, tool calling, MIND-SAFE, sem mudar contrato).

### Estrutura de pastas (sua máquina)
- **Raiz do repo:** `C:\Users\ricas\OneDrive\Desktop\01- PLANTAO 360\01_PLANTAO360`
- **Frontend (Vercel):** `...\01_PLANTAO360\dump-do`
- **Backend (Supabase):** `...\01_PLANTAO360\dump_do_backend`
- **Cursor:** `...\01_PLANTAO360\.cursor`
- **Git:** `.git` e `.gitignore` na raiz `01_PLANTAO360`.

### Repositório oficial
- **Oficial:** `medfinance360-bit/dump-dooficial` — é esse que deve receber o código.
- **Outro repo (tentativas antigas):** `dump.do-neuro` com várias branches `cursor/*` — não é o oficial.
- No momento o **dump-dooficial está vazio** porque o push foi barrado pelo GitHub (secret scanning no `.env.example`).

---

## 2. Fase atual

- **Push para o GitHub:** concluído. O repositório **dump-dooficial** tem a branch **main** com o projeto (dump-do, dump_do_backend, .cursor, etc.).
- **Próximo:** deploy no Vercel (Passo 2 abaixo) e, se quiser, subir as novidades (README raiz, STATUS-E-PROXIMOS-PASSOS.md, .env.example corrigido) com um novo commit.
---

## 3. Próximos passos (em ordem)

### Passo 1 — Concluir o push para o GitHub
1. **Fechar o Cursor** por completo.
2. Abrir **PowerShell** (como usuário normal, não Administrador).
3. Rodar (caminho com a letra **O** em PLANTA**O**360):

   ```powershell
   cd "c:\Users\ricas\OneDrive\Desktop\01- PLANTAO 360\01_PLANTAO360"
   git add dump_do_backend/.env.example
   git commit --amend --no-edit
   git push -u origin main --force
   ```

4. Se o GitHub pedir autenticação: usar **usuário** + **Personal Access Token** (não a senha da conta).
5. Se ainda aparecer aviso de secret: usar o **link de unblock** que o GitHub mostra na mensagem de erro e tentar `git push -u origin main --force` de novo.

**Alternativa (amend falha por lock/permissão no PC):**  
O GitHub está barrando o push porque o **commit** que você envia ainda tem a chave antiga no `.env.example`. O arquivo no disco já está limpo, mas o amend não está conseguindo rodar daqui (lock no `.git`). Você pode:
- **Opção A:** Fechar o Cursor, abrir PowerShell **fora** do Cursor, ir na pasta do projeto e rodar os 3 comandos do Passo 1 de novo.
- **Opção B:** Usar o link de **unblock** que o GitHub mostra no erro. Exemplo (o seu pode ter outro ID):  
  `https://github.com/medfinance360-bit/dump-dooficial/security/secret-scanning/unblock-secret/...`  
  Abra esse link no navegador, faça login, confirme o unblock. Depois rode no PowerShell:  
  `git push -u origin main`  
  O push vai passar e o repo deixa de estar vazio. Em seguida **troque a chave da OpenAI** no painel deles (a que estava no .env.example já foi exposta).

Quando o push passar, o repositório **dump-dooficial** deixará de estar vazio e terá a branch **main** com todo o projeto.

### Passo 2 — Deploy no Vercel (depois do push)
1. Acessar [vercel.com](https://vercel.com) e fazer login.
2. **Add New** → **Project** → importar o repositório **medfinance360-bit/dump-dooficial**.
3. Configurar:
   - **Root Directory:** `dump-do` (obrigatório, pois o repo é a raiz 01_PLANTAO360).
   - **Framework:** Vite.
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Em **Environment Variables** adicionar:
   - `VITE_SUPABASE_URL` = URL do projeto no Supabase
   - `VITE_SUPABASE_ANON_KEY` = anon key do Supabase  
   (valores em Supabase Dashboard → projeto → Settings → API.)
5. Clicar em **Deploy**. Ao terminar, o Vercel mostra a URL (ex.: `https://seu-projeto.vercel.app`).

Detalhes completos em: **`dump-do/DEPLOY-VERCEL.md`**.

### Passo 3 — Usar no celular
- Abrir no navegador do celular a URL do Vercel (ex.: `https://seu-projeto.vercel.app` ou `.../app` para ir direto ao chat).
- Opcional: “Adicionar à tela inicial” para ter ícone de app.

---

## 4. Segurança (lembrete)

- As chaves que **estavam** no `.env.example` já foram expostas (push tentado). O mais seguro é **trocar** essas chaves nos painéis (OpenAI, Supabase, Gemini) e usar as novas só no arquivo **`.env`** local (nunca commitar o `.env`).
- O `.env.example` serve só de **modelo** com placeholders; as chaves reais ficam apenas em `.env`, que está no `.gitignore`.

---

## 5. Referências rápidas

| Item | Onde |
|------|------|
| Repo oficial | https://github.com/medfinance360-bit/dump-dooficial |
| README (raiz) | [README.md](README.md) |
| Deploy Vercel | [dump-do/DEPLOY-VERCEL.md](dump-do/DEPLOY-VERCEL.md) |
| Config Vercel | [dump-do/vercel.json](dump-do/vercel.json) |
| Git ignore | [.gitignore](.gitignore) |
| Track v1.2 (dump-core) | [.cursor/plans/dumpcore_v1.2_track_d511939f.plan.md](.cursor/plans/dumpcore_v1.2_track_d511939f.plan.md) |

---

## 6. .env.example: o que mudar e se é indispensável

### O que é o .env.example?
- É um **arquivo de exemplo** (modelo). Ele lista **quais** variáveis o backend usa e mostra placeholders como `your_openai_key_here`.
- No repositório ele **não** deve ter chaves reais — só placeholders. O arquivo `dump_do_backend/.env.example` no seu disco **já está assim**.

### Você precisa “mudar” o .env.example?
- **Não.** Você **não** edita o `.env.example` para colocar suas chaves.
- O que você faz: **copiar** o `.env.example` para um arquivo chamado **`.env`** (no mesmo pasta `dump_do_backend/`) e **editar o `.env`** colocando suas chaves reais. O `.env` não vai pro Git (está no .gitignore).

### O que é indispensável?
- **Para o backend rodar** (Edge Functions como dump-core): é indispensável **ter** as variáveis preenchidas em algum lugar. Em produção no Supabase isso é nas **Secrets** do projeto (Dashboard → Edge Functions → Secrets). Em desenvolvimento local, é no arquivo **`.env`** que você criou a partir do `.env.example`.
- **O arquivo .env.example em si** não é indispensável para a aplicação funcionar — ele é documentação. O indispensável é **ter um `.env`** (ou as Secrets no Supabase) com as chaves reais.

### Resumo
| Arquivo      | Onde fica              | O que faz | Commitar? |
|-------------|------------------------|-----------|-----------|
| .env.example | dump_do_backend/       | Modelo com placeholders | Sim (já está correto) |
| .env        | dump_do_backend/ (cópia que você cria) | Suas chaves reais | **Não** (nunca) |

**Em uma frase:** não mude o `.env.example`; crie um `.env` a partir dele e coloque as chaves reais só no `.env`. Isso é indispensável para o backend funcionar; o `.env.example` em si é só o modelo.

---

*Última atualização: README raiz criado; explicação .env.example adicionada.*
