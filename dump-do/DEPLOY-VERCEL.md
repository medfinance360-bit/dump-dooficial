# Subir no Vercel e rodar no celular

## 1. Deixar o código no GitHub

- Se ainda não tiver: crie um repositório no GitHub e dê push do projeto.
- Se o repositório for a pasta **01_PLANTAO360** (raiz com `dump-do` e `dump_do_backend`), anote isso — no Vercel você vai apontar a **pasta** do front.

## 2. Conectar no Vercel

1. Acesse **[vercel.com](https://vercel.com)** e entre na sua conta (ou crie uma).
2. Clique em **Add New** → **Project**.
3. **Import** o repositório do GitHub (autorize o Vercel no GitHub se pedir).
4. **Root Directory**: clique em **Edit** e coloque **`dump-do`** (só se o repositório for a raiz 01_PLANTAO360; se o repo for só a pasta dump-do, deixe em branco).
5. **Framework Preset**: deve aparecer **Vite**; se não, escolha Vite.
6. **Build Command**: `npm run build` (já vem assim).
7. **Output Directory**: `dist` (já vem assim).

## 3. Variáveis de ambiente

No mesmo passo do projeto, em **Environment Variables**:

| Nome                     | Valor                          | Onde |
|--------------------------|--------------------------------|------|
| `VITE_SUPABASE_URL`      | URL do seu projeto Supabase   | Production (e Preview se quiser) |
| `VITE_SUPABASE_ANON_KEY` | anon key do Supabase          | Production (e Preview se quiser) |

- Pegue a URL e a anon key em: [Supabase](https://supabase.com/dashboard) → seu projeto → **Settings** → **API**.
- Depois de adicionar, clique em **Deploy**.

## 4. Deploy

- O Vercel vai rodar o build e, no fim, mostra um link tipo:  
  `https://seu-projeto.vercel.app`
- Esse é o link do app no ar.

## 5. Abrir no celular

- No celular, abra o navegador (Chrome, Safari, etc.).
- Digite ou cole o link: **`https://seu-projeto.vercel.app`**  
  (ou acesse `/app` se a landing for na raiz: `https://seu-projeto.vercel.app/app`).
- Pronto: o app roda no celular pelo navegador. Não precisa instalar nada.

**Dica:** no celular você pode usar “Adicionar à tela inicial” (ou “Add to Home Screen”) para o site virar um ícone como app.
