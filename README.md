# Tonytec OS

Sistema de gestão de chamados, visitas técnicas, cobrança e ordens de serviço da **Tonytec Ltda**
(CFTV, centrais telefônicas, portões eletrônicos e controle de acesso).

- **Stack:** Next.js 16 (App Router) + TypeScript · Tailwind CSS 4 + shadcn/ui · Supabase (Postgres, Auth, Storage, RLS) · Vercel
- **Perfis:** `admin` (`/admin`), `tecnico` (`/tecnico`, mobile-first), `cliente` (`/portal`)

> Status: **Fases 0 a 6 concluídas** (fundação, cadastros, chamados, OS e assinatura, cobrança de visitas,
> dashboard/relatórios/agenda, notificações, auditoria e preparação para o go-live). Decisões e premissas:
> [docs/PREMISSAS.md](docs/PREMISSAS.md). Para entrar em produção: [docs/CHECKLIST-PRODUCAO.md](docs/CHECKLIST-PRODUCAO.md).
> Guias de uma página por perfil: [administrador](docs/guias/administrador.md) ·
> [técnico](docs/guias/tecnico.md) · [cliente](docs/guias/cliente.md).

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

### Criando usuários (técnicos, administradores e usuários do portal)

- **Técnicos:** _Técnicos → Novo técnico_. **Administradores:** _Configurações → Administradores_.
  **Usuários do portal:** _Clientes → (cliente) → Usuários do portal → Novo usuário_.
- Ao salvar, o sistema mostra um **link de acesso** (válido por 24 h, uso único) com botões para enviar
  por **WhatsApp** ou e-mail. O usuário abre o link, clica em **Continuar** e cria a senha.
- Link expirou ou o usuário esqueceu a senha? No menu “⋯” do usuário: **Gerar link de acesso**.
- **Desativar** um usuário corta o acesso na hora (com motivo registrado na auditoria). Desativar um
  **cliente** também desativa os usuários do portal dele.
- O botão “Continuar” existe de propósito: pré-visualizações de link (WhatsApp, antivírus de e-mail)
  abrem o endereço sozinhas e, sem ele, gastariam o link antes do usuário.

### Fluxo de chamados

1. **Abertura:** o cliente abre pelo portal (_Abrir chamado_) ou a Tonytec registra em _Chamados → Novo
   chamado_ (telefone/WhatsApp). O banco gera o protocolo (`CH-AAAA-000001`) e os prazos de SLA (horas
   úteis; prazos do contrato vigente ou padrão por prioridade).
2. **Triagem:** no **Kanban** (_Chamados_) arraste o cartão entre colunas, ou abra o chamado e use
   _Gestão_ para status, prioridade, técnico e agendamento (agendar um chamado aberto muda o status para
   “Agendado”).
3. **Atendimento:** o técnico vê o chamado em _Meu dia_, abre a rota no Google Maps, liga para o local,
   tira fotos e registra mensagens/notas internas. **Notas internas** nunca aparecem para o cliente.
4. **Ordem de serviço:** o técnico toca em **Iniciar atendimento** (abre a OS e registra a chegada),
   preenche diagnóstico/serviço/itens/fotos (salvo automaticamente, mesmo sem sinal), **Registra a saída**
   e toca em **Concluir e assinar**. Técnico e cliente assinam na tela, o cliente assina depois por **link**
   (WhatsApp/e-mail) ou pelo portal, ou o técnico registra a **recusa** com motivo.
5. **Encerramento:** ao assinar, o sistema grava o hash, bloqueia a OS, marca o chamado como resolvido,
   gera o PDF e (se o Resend estiver configurado) envia ao cliente. Só o admin reabre, com motivo.

Anexos (fotos, vídeos curtos e PDF, até 20 MB cada, 20 por chamado) vão direto do navegador para o
Storage por URL assinada; fotos grandes são reduzidas no próprio celular antes do envio.

### Cobrança de visitas

1. Ao **encerrar a OS**, cada visita recebe uma **sugestão de cobrança** pelo contrato vigente: isento
   (dentro da franquia de visitas/horas do mês), valor único ou por hora (excedente, pela política do
   contrato), ou o valor padrão das Configurações se o cliente não tem contrato.
2. Em **Cobrança de visitas** o admin vê todas as visitas de OS encerradas, filtra por cliente, período,
   status de faturamento e tipo, **ajusta** o que for preciso (garantia e cortesia pedem justificativa) e
   pode **recalcular a sugestão**. Depois da assinatura, cada ajuste fica na auditoria.
3. Selecione visitas e use **Marcar como faturado** (em lote). Visita faturada fica travada até desfazer.
4. **Fechamento mensal** (por cliente e mês): mensalidade + visitas + materiais, com **PDF, XLSX e CSV**
   para o financeiro e o botão **Marcar mês como faturado**.
5. O **saldo do mês** (visitas e horas usadas da franquia) aparece no contrato (admin) e no portal.

### Dashboard, relatórios e agenda

- **Dashboard** (`/admin`): atalhos de "atenção agora" (chamados novos, sem técnico, SLA estourado, contratos a
  vencer), KPIs, chamados em risco de SLA e gráficos. O filtro de período (hoje, 7/30 dias, mês, personalizado)
  vale para toda a tela; o fuso é sempre o de Brasília.
- **Relatórios** (`/admin/relatorios`): 11 relatórios (clientes mais atendidos, problemas e reincidência,
  produtividade por técnico, SLA, faturamento, contratos, evolução mensal, satisfação, materiais, mapa de
  calor, OS aguardando/pendentes). Cada um exporta **CSV** (Excel brasileiro), **XLSX** e **PDF**. Os números
  são calculados no banco (funções `rel_*`, exclusivas de admin).
- **Agenda** (`/admin/agenda`): visão semanal e mensal, filtro por técnico; **arraste** um chamado para outro
  dia (mantém a hora) ou clique para escolher o horário. A lista "sem agendamento" mostra o que falta marcar.

### Notificações e auditoria

- O **sino** no cabeçalho avisa (atualiza a cada 45 s): chamado novo, atribuição/reagendamento, resposta do
  cliente ou da equipe, chamado resolvido, avaliação recebida, OS aguardando assinatura e OS assinada. Cada
  pessoa só vê as próprias notificações (nem o admin lê as dos outros).
- **Auditoria** (`/admin/auditoria`): quem fez o quê e quando — usuários, clientes, unidades, contratos,
  configurações, catálogos, cobrança ajustada depois da assinatura, reabertura de OS e mudanças de situação
  da OS. Filtros por área, ação, autor e período; os registros não podem ser alterados nem apagados.

## 4. Dados de demonstração e testes

```bash
# .env.local: SEED_DEMO=true e SEED_DEMO_PASSWORD=<senha>
npm run seed:demo    # 2 clientes, unidades, contrato, 2 técnicos, 2 usuários de portal, chamados
npm run test:unit        # regras puras (CPF/CNPJ, SLA, cobrança, período, agenda, auditoria...)
npm run test:rls         # isolamento entre clientes e permissões por perfil
npm run test:relatorios  # funções de relatório no banco (estrutura, somas, acesso só do admin)
npm run test:fase6       # notificações, auditoria e limite de tentativas no banco
npm run build && npm run test:e2e   # e2e (desktop + 375 px): login, cadastros, chamados, OS e assinatura,
                                    # cobrança, dashboard/relatórios/agenda, notificações/auditoria/segurança
```

> Os testes e2e rodam contra o banco configurado no `.env.local` e apagam os dados `[E2E]` que criam
> (ficam apenas os registros de auditoria). Antes do go-live, o ideal é um projeto Supabase de homologação.

Usuários demo (senha = `SEED_DEMO_PASSWORD`): `tecnico.demo@example.com`, `tecnico2.demo@example.com`,
`cliente.alfa.demo@example.com`, `cliente.beta.demo@example.com`.

## 5. Segurança (resumo)

- **RLS em todas as tabelas.** Cliente só vê o próprio `cliente_id` e nunca notas internas nem dados
  financeiros das visitas; técnico só vê chamados/OS atribuídos; admin vê tudo.
- **Restrição de colunas por perfil** em triggers `*_guard` (ex.: técnico só altera o status do chamado;
  cliente só avalia; ninguém troca a própria role; notificação só pode ser marcada como lida).
- **OS assinada é imutável**; só `reabrir_os(os_id, motivo)` (admin) destrava, com auditoria.
- **Exclusão física bloqueada** em chamados, OS, comentários, histórico e auditoria.
- **Storage privado**: os buckets não têm policies para usuários; o servidor valida a permissão e emite
  URLs assinadas de curta duração.
- **Link de assinatura**: token de 256 bits (só o hash fica no banco), uso único, validade, no máximo 10
  tentativas e `Referrer-Policy: no-referrer` / sem cache.
- **Limite de tentativas** (tabela `private.rate_limit`, função só do servidor): login (8 falhas por e-mail
  e 40 por IP a cada 10 min), recuperação de senha, ativação de acesso e as páginas públicas de assinatura.
- **Cabeçalhos HTTP** (`next.config.ts`): CSP restritiva (só a própria origem e o Supabase), HSTS,
  `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` e `noindex`.
- `service_role` só em código de servidor (`src/lib/supabase/admin.ts`, marcado `server-only`).
- `src/proxy.ts` (antigo middleware) só faz o roteamento; a autorização é refeita em cada
  layout/action (`requireRole`) e garantida pela RLS.
- As funções `rel_*`, `reabrir_os` e `consumo_contrato_mes` ficam chamáveis por usuários logados (o
  advisor do Supabase acusa "SECURITY DEFINER executável"), mas cada uma confere o perfil por dentro —
  coberto por `test:rls` e `test:relatorios`.

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

## Go-live

Veja o passo a passo em [docs/CHECKLIST-PRODUCAO.md](docs/CHECKLIST-PRODUCAO.md). Para limpar os dados de
demonstração/testes e zerar a numeração:

```bash
npm run golive:limpar                                   # simulação: mostra o que seria removido, sem alterar nada
npm run golive:limpar -- --executar --confirmo=LIMPAR   # remove demonstração/testes (clientes "(DEMO)"/"[E2E]", @example.com)
npm run golive:limpar -- --executar --confirmo=LIMPAR --tudo   # também apaga TODOS os chamados/OS (início do zero)
```

Nunca remove administradores, configurações nem catálogos. Faça um backup antes — a execução é irreversível.

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
