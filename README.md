# Tonytec OS

Sistema de gestão de chamados, visitas técnicas, cobrança e ordens de serviço da **Tonytec Ltda**
(CFTV, centrais telefônicas, portões eletrônicos e controle de acesso).

- **Stack:** Next.js 16 (App Router) + TypeScript · Tailwind CSS 4 + shadcn/ui · Supabase (Postgres, Auth, Storage, RLS) · Vercel
- **Perfis:** `admin` (`/admin`), `tecnico` (`/tecnico`, mobile-first), `cliente` (`/portal`)

> Status: **Fase 0 — Fundação** concluída. Veja [docs/PREMISSAS.md](docs/PREMISSAS.md) para decisões e premissas.

---

## 1. Rodar localmente

Pré-requisitos: Node.js 20.9+ (recomendado 22/24 LTS) e acesso ao projeto Supabase.

```bash
npm install
cp .env.example .env.local   # preencha as variáveis (veja abaixo)
npm run dev                  # http://localhost:3000
```

### Variáveis de ambiente

| Variável                          | Onde usar                             | Descrição                                                                                  |
| --------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`        | local + Vercel                        | URL do projeto (Settings → API)                                                            |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | local + Vercel                        | chave pública (anon)                                                                       |
| `SUPABASE_SERVICE_ROLE_KEY`       | local + Vercel (**somente servidor**) | chave secreta; nunca expor no navegador                                                    |
| `NEXT_PUBLIC_APP_URL`             | local + Vercel                        | URL pública (links de convite/assinatura)                                                  |
| `SUPABASE_PROJECT_REF`            | só local                              | ref do projeto (ex.: `rhiclchgsomchuhthyvh`)                                               |
| `SUPABASE_ACCESS_TOKEN`           | só local                              | token pessoal para migrações ([gerar aqui](https://supabase.com/dashboard/account/tokens)) |
| `SEED_ADMIN_*`                    | só local                              | dados do 1º admin (apague a senha após usar)                                               |
| `SEED_DEMO`, `SEED_DEMO_PASSWORD` | só local                              | dados de demonstração                                                                      |
| `RESEND_API_KEY`, `EMAIL_FROM`    | opcional                              | e-mail transacional; sem a chave o sistema funciona sem e-mail                             |

**Nunca** commite o `.env.local` (já está no `.gitignore`).

## 2. Banco de dados (migrações)

As migrações versionadas ficam em `supabase/migrations/`. Elas são aplicadas pela Management API do
Supabase (não precisa da senha do banco):

```bash
npm run db:status    # lista aplicadas/pendentes
npm run db:migrate   # aplica as pendentes (cada uma em transação)
npm run db:types     # regenera src/types/database.ts após mudar o schema
npm run db:sql -- "select count(*) from public.chamados"   # SQL avulso
```

O histórico fica em `supabase_migrations.schema_migrations` (compatível com `supabase db push`).

Para criar uma migração nova: adicione `supabase/migrations/AAAAMMDDHHMMSS_descricao.sql`, rode
`npm run db:migrate` e depois `npm run db:types`.

## 3. Primeiro administrador

1. Preencha no `.env.local`: `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` (mín. 8) e `SEED_ADMIN_NAME`.
2. Rode `npm run seed:admin` (pode repetir para redefinir a senha).
3. Entre em `/login`. Depois, apague `SEED_ADMIN_PASSWORD` do `.env.local`.

O cadastro público está **desativado**: usuários técnicos e de cliente são criados pelo admin.

## 4. Dados de demonstração e testes

```bash
# .env.local: SEED_DEMO=true e SEED_DEMO_PASSWORD=<senha>
npm run seed:demo    # 2 clientes, unidades, contrato, 2 técnicos, 2 usuários de portal, chamados
npm run test:rls     # verifica isolamento entre clientes e permissões por perfil (31 verificações)
npm run build && npx playwright test   # e2e: login dos 3 perfis (desktop e mobile)
```

Usuários demo (senha = `SEED_DEMO_PASSWORD`): `tecnico.demo@example.com`, `tecnico2.demo@example.com`,
`cliente.alfa.demo@example.com`, `cliente.beta.demo@example.com`.

## 5. Segurança (resumo)

- **RLS em todas as tabelas.** Cliente só vê o próprio `cliente_id` e nunca notas internas nem dados
  financeiros das visitas; técnico só vê chamados/OS atribuídos; admin vê tudo.
- **Restrição de colunas por perfil** em triggers `*_guard` (ex.: técnico só altera o status do chamado;
  cliente só avalia; ninguém troca a própria role).
- **OS assinada é imutável**; só `reabrir_os(os_id, motivo)` (admin) destrava, com auditoria.
- **Exclusão física bloqueada** em chamados, OS, comentários, histórico e auditoria.
- **Storage privado**: os buckets não têm policies para usuários; o servidor valida a permissão e emite
  URLs assinadas de curta duração.
- `service_role` só em código de servidor (`src/lib/supabase/admin.ts`, marcado `server-only`).
- `src/proxy.ts` (antigo middleware) só faz o roteamento; a autorização é refeita em cada
  layout/action (`requireRole`) e garantida pela RLS.

## 6. Deploy na Vercel

1. Em [vercel.com/new](https://vercel.com/new), importe o repositório `tonytecltda/tonytec-os`.
2. Em **Settings → Environment Variables**, cadastre `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e `NEXT_PUBLIC_APP_URL` (a URL final,
   ex.: `https://tonytec-os.vercel.app`). Opcional: `RESEND_API_KEY`, `EMAIL_FROM`.
3. Deploy. Cada push na `main` faz deploy automático.
4. No Supabase (**Authentication → URL Configuration**): defina **Site URL** = URL de produção e inclua
   `https://SEU-DOMINIO/**` nas Redirect URLs.

### Domínio próprio

Vercel → Settings → Domains → adicione o domínio e crie o registro DNS indicado. Atualize
`NEXT_PUBLIC_APP_URL` e a Site URL do Supabase.

## 7. Backup

- O plano gratuito do Supabase não inclui backups automáticos restauráveis; no plano Pro há backup
  diário (e PITR opcional).
- Backup manual: `npx supabase db dump --linked -f backup.sql` (requer a senha do banco) ou pelo
  Dashboard → Database → Backups.

## 8. Estrutura

```
src/
  app/(auth)/        login, esqueci-senha, definir-senha, sem-acesso + server actions
  app/auth/confirm/  destino dos links de convite/recuperação
  app/admin|tecnico|portal/   áreas por perfil (layout checa a role no servidor)
  components/        layout (sidebar/menu), ui (shadcn)
  lib/supabase/      clientes browser/server/admin e o proxy de sessão
  lib/auth.ts        getCurrentProfile / requireRole
  proxy.ts           renovação de sessão + roteamento por role
supabase/migrations/ schema, triggers, RLS, storage, seeds base
scripts/             migrações, seeds e teste de RLS
e2e/                 testes Playwright
```
