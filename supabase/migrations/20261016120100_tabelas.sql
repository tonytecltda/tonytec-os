-- =====================================================================
-- Tonytec OS — 002: tabelas
-- Convenções: uuid como PK, created_at/updated_at, exclusão lógica (ativo).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Clientes e unidades
-- ---------------------------------------------------------------------
create table public.clientes (
  id                 uuid primary key default gen_random_uuid(),
  razao_social       text not null,
  nome_fantasia      text,
  cnpj_cpf           text,            -- somente dígitos
  inscricao_estadual text,
  email              text,
  telefone           text,
  observacoes        text,
  ativo              boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create unique index clientes_cnpj_cpf_uniq on public.clientes (cnpj_cpf)
  where cnpj_cpf is not null and ativo;
create index clientes_razao_social_idx on public.clientes (razao_social);

create table public.unidades (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      uuid not null references public.clientes (id),
  nome            text not null,
  logradouro      text,
  numero          text,
  complemento     text,
  bairro          text,
  cidade          text,
  uf              char(2),
  cep             text,
  contato_local   text,
  telefone_local  text,
  referencia      text,
  ativo           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index unidades_cliente_idx on public.unidades (cliente_id);

-- ---------------------------------------------------------------------
-- Perfis (1:1 com auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  nome             text not null default '',
  email            text not null,
  telefone         text,
  role             public.user_role not null default 'cliente',
  cliente_id       uuid references public.clientes (id),
  assinatura_path  text,   -- assinatura salva do técnico (bucket "assinaturas")
  ativo            boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint profiles_cliente_requer_cliente_id
    check (role <> 'cliente' or cliente_id is not null)
);
create index profiles_role_idx on public.profiles (role);
create index profiles_cliente_idx on public.profiles (cliente_id);

-- ---------------------------------------------------------------------
-- Contratos
-- ---------------------------------------------------------------------
create table public.contratos (
  id                         uuid primary key default gen_random_uuid(),
  cliente_id                 uuid not null references public.clientes (id),
  numero                     text not null unique,
  descricao                  text,
  tipo                       public.contrato_tipo not null default 'avulso',
  data_inicio                date not null,
  data_fim                   date,
  valor_mensal               numeric(12, 2) not null default 0,
  visitas_inclusas_mes       integer not null default 0 check (visitas_inclusas_mes >= 0),
  horas_inclusas_mes         numeric(8, 2) not null default 0 check (horas_inclusas_mes >= 0),
  politica_visita_excedente  public.politica_excedente not null default 'valor_unico',
  valor_visita_excedente     numeric(12, 2),
  valor_hora_excedente       numeric(12, 2),
  sla_resposta_horas         numeric(6, 2),
  sla_solucao_horas          numeric(6, 2),
  status                     public.contrato_status not null default 'ativo',
  observacoes                text,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  constraint contratos_periodo_valido check (data_fim is null or data_fim >= data_inicio)
);
create index contratos_cliente_idx on public.contratos (cliente_id);
create index contratos_status_fim_idx on public.contratos (status, data_fim);

-- ---------------------------------------------------------------------
-- Catálogos
-- ---------------------------------------------------------------------
create table public.categorias_servico (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null unique,
  ordem       integer not null default 0,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.tipos_problema (
  id            uuid primary key default gen_random_uuid(),
  categoria_id  uuid not null references public.categorias_servico (id),
  nome          text not null,
  ativo         boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (categoria_id, nome)
);
create index tipos_problema_categoria_idx on public.tipos_problema (categoria_id);

-- Itens/serviços padrão com preço (usados para preencher os_itens)
create table public.itens_catalogo (
  id              uuid primary key default gen_random_uuid(),
  descricao       text not null,
  tipo            public.os_item_tipo not null default 'material',
  unidade         text not null default 'un',
  valor_unitario  numeric(12, 2) not null default 0,
  categoria_id    uuid references public.categorias_servico (id),
  ativo           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Chamados
-- ---------------------------------------------------------------------
create table public.chamados (
  id                     uuid primary key default gen_random_uuid(),
  protocolo              text not null default '' unique,   -- preenchido por trigger: CH-AAAA-000001
  cliente_id             uuid not null references public.clientes (id),
  unidade_id             uuid references public.unidades (id),
  aberto_por             uuid references public.profiles (id),
  categoria_id           uuid references public.categorias_servico (id),
  tipo_problema_id       uuid references public.tipos_problema (id),
  titulo                 text not null,
  descricao              text,
  telefone_contato       text,
  prioridade             public.chamado_prioridade not null default 'media',
  status                 public.chamado_status not null default 'aberto',
  tecnico_id             uuid references public.profiles (id),
  data_agendada          timestamptz,
  contrato_id            uuid references public.contratos (id),
  origem                 public.chamado_origem not null default 'admin',
  sla_resposta_ate       timestamptz,
  sla_solucao_ate        timestamptz,
  primeira_resposta_em   timestamptz,
  resolvido_em           timestamptz,
  avaliacao_nota         smallint check (avaliacao_nota between 1 and 5),
  avaliacao_comentario   text,
  avaliado_em            timestamptz,
  ativo                  boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index chamados_cliente_idx on public.chamados (cliente_id);
create index chamados_tecnico_idx on public.chamados (tecnico_id);
create index chamados_status_idx on public.chamados (status);
create index chamados_created_idx on public.chamados (created_at desc);
create index chamados_categoria_idx on public.chamados (categoria_id);
create index chamados_agenda_idx on public.chamados (data_agendada);

create table public.chamado_anexos (
  id             uuid primary key default gen_random_uuid(),
  chamado_id     uuid not null references public.chamados (id),
  storage_path   text not null,
  nome_arquivo   text not null,
  mime_type      text,
  tamanho_bytes  bigint,
  enviado_por    uuid references public.profiles (id) default auth.uid(),
  created_at     timestamptz not null default now()
);
create index chamado_anexos_chamado_idx on public.chamado_anexos (chamado_id);

create table public.chamado_comentarios (
  id          uuid primary key default gen_random_uuid(),
  chamado_id  uuid not null references public.chamados (id),
  autor_id    uuid not null references public.profiles (id) default auth.uid(),
  mensagem    text not null check (length(trim(mensagem)) > 0),
  interno     boolean not null default false,   -- notas internas: invisíveis ao cliente
  created_at  timestamptz not null default now()
);
create index chamado_comentarios_chamado_idx on public.chamado_comentarios (chamado_id, created_at);

create table public.chamado_historico (
  id              bigint generated always as identity primary key,
  chamado_id      uuid not null references public.chamados (id),
  autor_id        uuid references public.profiles (id),
  campo           text not null,
  valor_anterior  text,
  valor_novo      text,
  created_at      timestamptz not null default now()
);
create index chamado_historico_chamado_idx on public.chamado_historico (chamado_id, created_at);

-- ---------------------------------------------------------------------
-- Ordens de serviço
-- ---------------------------------------------------------------------
create table public.ordens_servico (
  id                     uuid primary key default gen_random_uuid(),
  numero                 text not null default '' unique,   -- preenchido por trigger: OS-AAAA-000001
  chamado_id             uuid references public.chamados (id),
  cliente_id             uuid not null references public.clientes (id),
  unidade_id             uuid references public.unidades (id),
  tecnico_id             uuid references public.profiles (id),
  tipo_atendimento       public.os_tipo_atendimento not null default 'corretivo',
  status                 public.os_status not null default 'rascunho',
  problema_relatado      text,
  diagnostico            text,
  servico_executado      text,
  observacoes_tecnicas   text,
  recomendacoes          text,
  data_inicio            timestamptz,
  data_fim               timestamptz,
  tecnico_nome_snapshot  text,
  pendencias             boolean not null default false,
  pendencias_texto       text,
  assinatura_recusada    boolean not null default false,
  motivo_recusa          text,
  hash_conteudo          text,         -- SHA-256 do conteúdo no momento da assinatura
  assinada_em            timestamptz,
  pdf_path               text,         -- PDF final (bucket "os-pdfs")
  ativo                  boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint os_recusa_exige_motivo
    check (not assinatura_recusada or coalesce(trim(motivo_recusa), '') <> ''),
  constraint os_pendencia_exige_texto
    check (not pendencias or coalesce(trim(pendencias_texto), '') <> '')
);
create index os_cliente_idx on public.ordens_servico (cliente_id);
create index os_tecnico_idx on public.ordens_servico (tecnico_id);
create index os_status_idx on public.ordens_servico (status);
create index os_chamado_idx on public.ordens_servico (chamado_id);
create index os_created_idx on public.ordens_servico (created_at desc);

create table public.os_visitas (
  id                       uuid primary key default gen_random_uuid(),
  os_id                    uuid not null references public.ordens_servico (id),
  data_hora_chegada        timestamptz not null default now(),
  data_hora_saida          timestamptz,
  horas_trabalhadas        numeric(8, 2),   -- calculado de chegada/saída; admin pode ajustar
  deslocamento_km          numeric(8, 1),
  cobranca_tipo            public.cobranca_tipo,   -- sugerido pelo contrato (fase 4)
  valor_unitario           numeric(12, 2),
  quantidade_horas         numeric(8, 2),          -- horas cobráveis (mínimo/fração aplicados)
  valor_total              numeric(12, 2) generated always as (
    case cobranca_tipo
      when 'valor_unico' then coalesce(valor_unitario, 0)
      when 'valor_por_hora' then round(coalesce(quantidade_horas, 0) * coalesce(valor_unitario, 0), 2)
      else 0
    end
  ) stored,
  justificativa_isencao    text,
  faturado                 boolean not null default false,
  faturado_em              timestamptz,
  observacoes              text,
  observacoes_financeiras  text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint visita_periodo_valido
    check (data_hora_saida is null or data_hora_saida >= data_hora_chegada),
  constraint visita_garantia_cortesia_justificada
    check (cobranca_tipo is null
           or cobranca_tipo not in ('garantia', 'cortesia')
           or coalesce(trim(justificativa_isencao), '') <> '')
);
create index os_visitas_os_idx on public.os_visitas (os_id);
create index os_visitas_chegada_idx on public.os_visitas (data_hora_chegada);
create index os_visitas_faturado_idx on public.os_visitas (faturado);

create table public.os_itens (
  id              uuid primary key default gen_random_uuid(),
  os_id           uuid not null references public.ordens_servico (id),
  catalogo_id     uuid references public.itens_catalogo (id),
  descricao       text not null,
  tipo            public.os_item_tipo not null default 'material',
  quantidade      numeric(10, 2) not null default 1 check (quantidade > 0),
  valor_unitario  numeric(12, 2) not null default 0 check (valor_unitario >= 0),
  valor_total     numeric(12, 2) generated always as (round(quantidade * valor_unitario, 2)) stored,
  cobrado         boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index os_itens_os_idx on public.os_itens (os_id);

create table public.os_anexos (
  id             uuid primary key default gen_random_uuid(),
  os_id          uuid not null references public.ordens_servico (id),
  tipo           public.os_anexo_tipo not null default 'outro',
  storage_path   text not null,
  legenda        text,
  mime_type      text,
  tamanho_bytes  bigint,
  enviado_por    uuid references public.profiles (id) default auth.uid(),
  created_at     timestamptz not null default now()
);
create index os_anexos_os_idx on public.os_anexos (os_id);

create table public.os_assinaturas (
  id                    uuid primary key default gen_random_uuid(),
  os_id                 uuid not null references public.ordens_servico (id),
  tipo                  public.assinatura_tipo not null,
  nome_signatario       text not null,
  documento_signatario  text,
  cargo                 text,
  imagem_path           text not null,   -- PNG no bucket "assinaturas"
  assinado_em           timestamptz not null default now(),
  ip                    text,
  user_agent            text,
  latitude              numeric(9, 6),
  longitude             numeric(9, 6),
  geo_consentimento     boolean not null default false,
  hash_documento        text not null,   -- SHA-256 do conteúdo da OS
  remota                boolean not null default false,
  invalidada_em         timestamptz,     -- preenchido quando a OS é reaberta
  invalidada_motivo     text,
  created_at            timestamptz not null default now()
);
create index os_assinaturas_os_idx on public.os_assinaturas (os_id);

-- Links seguros para assinatura remota (só o hash do token é guardado)
create table public.os_assinatura_tokens (
  id             uuid primary key default gen_random_uuid(),
  os_id          uuid not null references public.ordens_servico (id),
  token_hash     text not null unique,
  expira_em      timestamptz not null,
  usado_em       timestamptz,
  enviado_para   text,
  criado_por     uuid references public.profiles (id) default auth.uid(),
  created_at     timestamptz not null default now()
);
create index os_assinatura_tokens_os_idx on public.os_assinatura_tokens (os_id);

-- ---------------------------------------------------------------------
-- Configurações, notificações, auditoria
-- ---------------------------------------------------------------------
create table public.configuracoes (
  chave       text primary key,
  valor       jsonb not null,
  descricao   text,
  updated_at  timestamptz not null default now()
);

create table public.notificacoes (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  titulo      text not null,
  mensagem    text,
  link        text,
  lida        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index notificacoes_profile_idx on public.notificacoes (profile_id, lida, created_at desc);

create table public.auditoria (
  id            bigint generated always as identity primary key,
  tabela        text not null,
  registro_id   uuid,
  acao          text not null,
  motivo        text,
  dados_antes   jsonb,
  dados_depois  jsonb,
  autor_id      uuid default auth.uid(),
  created_at    timestamptz not null default now()
);
create index auditoria_registro_idx on public.auditoria (tabela, registro_id);
create index auditoria_created_idx on public.auditoria (created_at desc);

-- Contadores sequenciais por ano (protocolo de chamado / número de OS)
create table private.contadores (
  chave  text primary key,   -- ex.: 'CH-2026'
  valor  bigint not null
);
