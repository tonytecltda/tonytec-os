# Checklist de produção — Tonytec OS

Marque cada item antes de liberar o sistema para a equipe e para os clientes. Itens marcados com 🔒 são de
segurança e não devem ser pulados.

## 1. Acessos e segredos 🔒

- [ ] **Revogar o token pessoal do Supabase** (`sbp_…`) usado nas migrações: Supabase → Account → Access Tokens.
      Gere outro só quando precisar rodar migrações, e apague do `.env.local` depois.
- [ ] **Trocar a senha do banco**: Supabase → Project Settings → Database → _Reset database password_.
- [ ] **Girar a `service_role`** se ela já foi exibida/compartilhada: Project Settings → API (_Generate new JWT secret_
      exige reconfigurar as chaves na Vercel).
- [ ] Apagar `SEED_ADMIN_PASSWORD` e `SEED_DEMO_PASSWORD` do `.env.local`; confirmar que `.env.local` nunca foi
      commitado (`git log --all -- .env.local` deve voltar vazio).
- [ ] Trocar a senha do administrador inicial pela definitiva (e usar senha forte, única).
- [ ] Conferir quem tem acesso ao repositório do GitHub, ao projeto Vercel e ao projeto Supabase.

## 2. Supabase

- [ ] Rodar `npm run db:status`: nenhuma migração pendente.
- [ ] **Authentication → URL Configuration**: _Site URL_ = URL de produção; _Redirect URLs_ com `https://SEU-DOMINIO/**`.
- [ ] **Authentication → Providers → Email**: cadastro público **desativado** (_Allow new users to sign up_ = off),
      confirmação de e-mail conforme o fluxo (usuários são criados pelo admin).
- [ ] 🔒 Ativar **Leaked password protection** (Authentication → Policies; exige plano Pro) e definir tamanho mínimo de senha ≥ 8.
- [ ] Avaliar o tempo de validade do link de acesso (hoje 24 h; ver premissa 54).
- [ ] **Backups**: plano Pro com backup diário (e PITR se o prazo de recuperação importar). No plano gratuito, programe
      um `pg_dump` periódico e guarde fora do Supabase. Teste uma restauração.
- [ ] Região do projeto × região das funções da Vercel: ideal que fiquem próximas (hoje o projeto está em us-west-2;
      Vercel → Settings → Functions → _Function Region_ = `pdx1`). Se a operação for toda no Brasil, considere
      migrar o banco para São Paulo antes de ter dados reais.
- [ ] Rodar o **advisor** (Dashboard → Advisors): restam apenas avisos conhecidos (funções `SECURITY DEFINER` com
      checagem interna, políticas múltiplas permissivas).
- [ ] Opcional: um segundo projeto Supabase de **homologação** para testar migrações e e2e sem tocar nos dados reais.

## 3. Vercel

- [ ] Projeto importado de `tonytecltda/tonytec-os`, branch de produção `main`.
- [ ] Variáveis (_Production_): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
      (**sem** marcar como pública), `NEXT_PUBLIC_APP_URL` (URL final com `https://`). Opcional: `RESEND_API_KEY`, `EMAIL_FROM`.
- [ ] **Domínio**: Settings → Domains; criar o registro DNS indicado; atualizar `NEXT_PUBLIC_APP_URL` e a _Site URL_ do Supabase.
- [ ] Primeiro deploy verde (a CI do GitHub roda lint, typecheck, formatação e build).
- [ ] Plano da Vercel compatível com o uso comercial (o plano _Hobby_ é só para uso pessoal) e com `maxDuration` de
      60 s nas telas que geram PDF.
- [ ] Verificar os cabeçalhos em produção (`curl -I https://SEU-DOMINIO/login`): `content-security-policy`,
      `strict-transport-security`, `x-frame-options`.

## 4. E-mail (opcional)

- [ ] Criar conta no Resend, **verificar o domínio** (SPF/DKIM) e gerar a chave.
- [ ] Definir `RESEND_API_KEY` e `EMAIL_FROM` (ex.: `Tonytec <os@tonytec.com.br>`) na Vercel e redeploy.
- [ ] Concluir uma OS de teste e conferir se o PDF chega ao e-mail do cliente (e a pasta de spam).

## 5. Dados reais

- [ ] Em _Configurações_: dados da empresa (razão social, CNPJ, telefone, logo), horário comercial, feriados, SLA por
      prioridade, valores padrão de visita e hora, termo de aceite da assinatura.
- [ ] Revisar os **catálogos** (categorias, tipos de problema, itens de materiais/serviços).
- [ ] **Limpar os dados de demonstração/testes** — primeiro `npm run golive:limpar` (simulação) e, conferindo o
      resumo, `npm run golive:limpar -- --executar --confirmo=LIMPAR`. A numeração (CH-/OS-) volta ao 1 se não sobrar
      nenhum chamado/OS. **Faça um backup antes.**
- [ ] Cadastrar **administradores** e **técnicos** reais (_Técnicos → Novo técnico_) e enviar os links de acesso.
- [ ] Cadastrar **clientes**, unidades, contratos e os **usuários do portal**; enviar os links de acesso.
- [ ] Cada técnico entra uma vez, cadastra a **assinatura** (_Minha assinatura_) e instala o atalho na tela inicial do celular.
- [ ] Desativar/remover contas de teste (`@example.com`).

## 6. Teste de aceitação (com dados reais ou de homologação)

- [ ] Cliente abre um chamado pelo portal → o admin vê o aviso no sino.
- [ ] Admin atribui e agenda → o técnico recebe o aviso e vê o chamado em _Meu dia_.
- [ ] Técnico atende no celular (com e sem sinal), registra horas, itens e fotos, e conclui com assinatura do cliente.
- [ ] PDF da OS baixa corretamente (logo, dados, fotos, assinaturas, hash).
- [ ] Cobrança sugerida confere com o contrato; fechamento mensal exporta PDF/XLSX/CSV.
- [ ] Link de assinatura remota funciona uma vez e não funciona depois de usado.
- [ ] Cliente A não enxerga nada do cliente B; técnico não vê chamados de outro técnico; técnico/cliente não abrem `/admin`.
- [ ] Teste em celular real (Android e iPhone), em 4G.

## 7. Operação contínua

- [ ] Quem recebe os avisos do sistema e quem atende o suporte do sistema (nome e telefone).
- [ ] Rotina mensal: fechamento de cobrança; revisão da auditoria; remoção de usuários que saíram.
- [ ] Rotina trimestral: girar chaves, revisar acessos, testar restauração do backup.
- [ ] Atualizações: `npm outdated`, revisar o changelog do Next/Supabase; aplicar migrações primeiro em homologação.

## Limitações conhecidas (ver `docs/PREMISSAS.md`)

- Sem alerta automático de SLA (o risco aparece no dashboard); exigiria uma rotina agendada (pg_cron/Vercel Cron).
- Notificações só dentro do sistema (sem push nem e-mail), com atualização a cada 45 s.
- O limite de tentativas usa janela fixa; na virada da janela podem passar até o dobro das tentativas.
