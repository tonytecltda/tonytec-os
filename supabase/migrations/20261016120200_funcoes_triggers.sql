-- =====================================================================
-- Tonytec OS — 003: funções auxiliares e triggers de regra de negócio
--
-- Regra de segurança importante:
--   * Funções "guard" e de automação disparadas pelo usuário são SECURITY INVOKER,
--     para que current_user/auth.uid() reflitam quem está agindo.
--   * Funções que precisam ler/escrever ignorando RLS são SECURITY DEFINER
--     com search_path vazio e nomes totalmente qualificados.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Identidade do usuário atual
-- ---------------------------------------------------------------------
create or replace function private.user_role()
returns public.user_role
language sql stable security definer set search_path = ''
as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.ativo
$$;

create or replace function private.user_cliente_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select p.cliente_id from public.profiles p
  where p.id = auth.uid() and p.ativo and p.role = 'cliente'
$$;

create or replace function private.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(private.user_role() = 'admin', false)
$$;

create or replace function private.is_staff()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(private.user_role() in ('admin', 'tecnico'), false)
$$;

-- "Privilegiado" = admin, service_role (servidor) ou código rodando como dono
-- (funções SECURITY DEFINER / migrações). SECURITY INVOKER de propósito.
create or replace function private.is_privileged()
returns boolean
language sql stable security invoker set search_path = ''
as $$
  select coalesce(auth.role(), '') = 'service_role'
      or current_user in ('postgres', 'supabase_admin', 'service_role')
      or private.is_admin()
$$;

-- O técnico atende este cliente? (tem chamado ou OS atribuídos)
create or replace function private.tecnico_atende_cliente(p_cliente_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.user_role() = 'tecnico' and (
    exists (select 1 from public.chamados c
            where c.cliente_id = p_cliente_id and c.tecnico_id = auth.uid())
    or exists (select 1 from public.ordens_servico o
               where o.cliente_id = p_cliente_id and o.tecnico_id = auth.uid())
  )
$$;

create or replace function private.pode_ver_chamado(p_chamado_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.chamados c
    where c.id = p_chamado_id
      and (
        private.is_admin()
        or (private.user_role() = 'tecnico' and c.tecnico_id = auth.uid())
        or (c.cliente_id = private.user_cliente_id())
      )
  )
$$;

-- Status de OS visíveis ao cliente
create or replace function private.pode_ver_os(p_os_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.ordens_servico o
    where o.id = p_os_id
      and (
        private.is_admin()
        or (private.user_role() = 'tecnico' and o.tecnico_id = auth.uid())
        or (o.cliente_id = private.user_cliente_id()
            and o.status in ('concluida', 'aguardando_assinatura', 'assinada'))
      )
  )
$$;

create or replace function private.pode_ver_os_staff(p_os_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.ordens_servico o
    where o.id = p_os_id
      and (
        private.is_admin()
        or (private.user_role() = 'tecnico' and o.tecnico_id = auth.uid())
      )
  )
$$;

-- Pode editar a OS e seus filhos (técnico responsável até assinar; admin sempre,
-- respeitando o bloqueio de OS assinada nos triggers).
create or replace function private.pode_editar_os(p_os_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.ordens_servico o
    where o.id = p_os_id
      and (
        private.is_admin()
        or (private.user_role() = 'tecnico'
            and o.tecnico_id = auth.uid()
            and o.status not in ('assinada', 'cancelada'))
      )
  )
$$;

-- Compara duas linhas ignorando as colunas permitidas.
create or replace function private.somente_campos(p_old jsonb, p_new jsonb, p_permitidos text[])
returns boolean
language sql immutable set search_path = ''
as $$
  select (p_old - p_permitidos) = (p_new - p_permitidos)
$$;

-- Registro de auditoria (DEFINER: auditoria não aceita insert direto)
create or replace function private.registrar_auditoria(
  p_tabela text, p_registro_id uuid, p_acao text, p_motivo text,
  p_antes jsonb, p_depois jsonb
)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.auditoria (tabela, registro_id, acao, motivo, dados_antes, dados_depois, autor_id)
  values (p_tabela, p_registro_id, p_acao, p_motivo, p_antes, p_depois, auth.uid())
$$;

-- ---------------------------------------------------------------------
-- Numeração sequencial por ano: CH-2026-000001 / OS-2026-000001
-- ---------------------------------------------------------------------
create or replace function private.proximo_numero(p_prefixo text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_chave text := p_prefixo || '-' || extract(year from (now() at time zone 'America/Sao_Paulo'))::int;
  v_valor bigint;
begin
  insert into private.contadores as c (chave, valor) values (v_chave, 1)
  on conflict (chave) do update set valor = c.valor + 1
  returning c.valor into v_valor;
  return v_chave || '-' || lpad(v_valor::text, 6, '0');
end;
$$;

-- ---------------------------------------------------------------------
-- Contrato vigente do cliente numa data
-- ---------------------------------------------------------------------
create or replace function private.contrato_vigente(p_cliente_id uuid, p_data date)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select ct.id from public.contratos ct
  where ct.cliente_id = p_cliente_id
    and ct.status = 'ativo'
    and ct.data_inicio <= p_data
    and (ct.data_fim is null or ct.data_fim >= p_data)
  order by ct.data_inicio desc, ct.created_at desc
  limit 1
$$;

-- ---------------------------------------------------------------------
-- SLA: soma horas dentro do horário comercial (config "sla_horario_comercial").
-- Feriados não são considerados (premissa da Fase 0).
-- ---------------------------------------------------------------------
create or replace function private.somar_horas_uteis(p_inicio timestamptz, p_horas numeric)
returns timestamptz
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_cfg        jsonb;
  v_dias       int[];
  v_hi         time;
  v_hf         time;
  v_restante   interval;
  v_cur        timestamp;   -- horário local (America/Sao_Paulo)
  v_fim_dia    timestamp;
  v_disponivel interval;
  i            int := 0;
begin
  if p_inicio is null or p_horas is null then
    return null;
  end if;

  select c.valor into v_cfg from public.configuracoes c where c.chave = 'sla_horario_comercial';
  v_restante := make_interval(secs => (p_horas * 3600)::double precision);

  if v_cfg is null or coalesce((v_cfg ->> 'ativo')::boolean, true) = false then
    return p_inicio + v_restante;   -- 24x7
  end if;

  v_dias := array(select jsonb_array_elements_text(v_cfg -> 'dias')::int);
  v_hi := coalesce((v_cfg ->> 'inicio')::time, '08:00');
  v_hf := coalesce((v_cfg ->> 'fim')::time, '18:00');
  v_cur := p_inicio at time zone 'America/Sao_Paulo';

  while i < 1000 loop
    i := i + 1;
    if extract(isodow from v_cur)::int = any (v_dias) then
      if v_cur::time < v_hi then
        v_cur := date_trunc('day', v_cur) + v_hi;
      end if;
      v_fim_dia := date_trunc('day', v_cur) + v_hf;
      if v_cur < v_fim_dia then
        v_disponivel := v_fim_dia - v_cur;
        if v_restante <= v_disponivel then
          return (v_cur + v_restante) at time zone 'America/Sao_Paulo';
        end if;
        v_restante := v_restante - v_disponivel;
      end if;
    end if;
    v_cur := date_trunc('day', v_cur) + interval '1 day' + v_hi;
  end loop;

  return p_inicio + make_interval(secs => (p_horas * 3600)::double precision);
end;
$$;

create or replace function private.calcular_sla(
  p_contrato_id uuid, p_prioridade public.chamado_prioridade, p_base timestamptz,
  out sla_resposta_ate timestamptz, out sla_solucao_ate timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_resp numeric;
  v_sol  numeric;
  v_cfg  jsonb;
begin
  if p_contrato_id is not null then
    select ct.sla_resposta_horas, ct.sla_solucao_horas into v_resp, v_sol
    from public.contratos ct where ct.id = p_contrato_id;
  end if;

  select c.valor -> p_prioridade::text into v_cfg
  from public.configuracoes c where c.chave = 'sla_padrao';

  v_resp := coalesce(v_resp, (v_cfg ->> 'resposta')::numeric);
  v_sol  := coalesce(v_sol,  (v_cfg ->> 'solucao')::numeric);

  sla_resposta_ate := private.somar_horas_uteis(p_base, v_resp);
  sla_solucao_ate  := private.somar_horas_uteis(p_base, v_sol);
end;
$$;

-- ---------------------------------------------------------------------
-- updated_at genérico
-- ---------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'clientes', 'unidades', 'profiles', 'contratos', 'categorias_servico',
    'tipos_problema', 'itens_catalogo', 'chamados', 'ordens_servico',
    'os_visitas', 'os_itens', 'configuracoes'
  ] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function private.set_updated_at()',
      t || '_updated_at', t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Novo usuário em auth.users -> profile
-- role e cliente_id vêm de app_metadata (só o servidor/admin consegue definir).
-- ---------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, nome, telefone, role, cliente_id)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data ->> 'telefone',
    coalesce((new.raw_app_meta_data ->> 'role')::public.user_role, 'cliente'),
    nullif(new.raw_app_meta_data ->> 'cliente_id', '')::uuid
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Mantém role/cliente_id espelhados no app_metadata (JWT) para o roteamento.
-- A fonte da verdade continua sendo public.profiles.
create or replace function private.sync_profile_claims()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update auth.users u
     set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb)
       || jsonb_build_object('role', new.role, 'cliente_id', new.cliente_id, 'ativo', new.ativo)
   where u.id = new.id;
  return new;
end;
$$;

create trigger profiles_sync_claims
  after insert or update of role, cliente_id, ativo on public.profiles
  for each row execute function private.sync_profile_claims();

-- Usuário comum só altera nome, telefone e assinatura salva.
create or replace function private.profiles_guard()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  if private.is_privileged() then
    return new;
  end if;
  if not private.somente_campos(to_jsonb(old), to_jsonb(new),
       array['nome', 'telefone', 'assinatura_path', 'updated_at']) then
    raise exception 'Você só pode alterar nome, telefone e assinatura do seu perfil.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_10_guard
  before update on public.profiles
  for each row execute function private.profiles_guard();

-- ---------------------------------------------------------------------
-- Chamados
-- ---------------------------------------------------------------------
-- Validações de integridade (unidade do cliente, tipo da categoria).
create or replace function private.chamados_validar()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  if new.unidade_id is not null and not exists (
    select 1 from public.unidades u where u.id = new.unidade_id and u.cliente_id = new.cliente_id
  ) then
    raise exception 'Unidade não pertence ao cliente do chamado.' using errcode = '23514';
  end if;

  if new.tipo_problema_id is not null and new.categoria_id is not null and not exists (
    select 1 from public.tipos_problema tp
    where tp.id = new.tipo_problema_id and tp.categoria_id = new.categoria_id
  ) then
    raise exception 'Tipo de problema não pertence à categoria escolhida.' using errcode = '23514';
  end if;

  if new.tecnico_id is not null and not exists (
    select 1 from public.profiles p where p.id = new.tecnico_id and p.role = 'tecnico' and p.ativo
  ) then
    raise exception 'O responsável precisa ser um técnico ativo.' using errcode = '23514';
  end if;

  return new;
end;
$$;

-- BEFORE INSERT: protocolo, campos forçados para o cliente, contrato e SLA.
create or replace function private.chamados_before_insert()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare
  v_sla record;
begin
  if not private.is_privileged() then
    if private.user_role() is distinct from 'cliente' then
      raise exception 'Sem permissão para abrir chamado.' using errcode = '42501';
    end if;
    -- Cliente: o servidor decide estes campos, nunca o navegador.
    new.cliente_id           := private.user_cliente_id();
    new.status               := 'aberto';
    new.origem               := 'portal';
    new.tecnico_id           := null;
    new.data_agendada        := null;
    new.contrato_id          := null;
    new.primeira_resposta_em := null;
    new.resolvido_em         := null;
    new.avaliacao_nota       := null;
    new.avaliacao_comentario := null;
    new.avaliado_em          := null;
    new.ativo                := true;
    new.aberto_por           := auth.uid();
  end if;

  new.protocolo  := private.proximo_numero('CH');
  new.aberto_por := coalesce(new.aberto_por, auth.uid());
  new.created_at := now();

  if new.contrato_id is null then
    new.contrato_id := private.contrato_vigente(new.cliente_id, (now() at time zone 'America/Sao_Paulo')::date);
  end if;

  select * into v_sla from private.calcular_sla(new.contrato_id, new.prioridade, new.created_at);
  new.sla_resposta_ate := v_sla.sla_resposta_ate;
  new.sla_solucao_ate  := v_sla.sla_solucao_ate;

  return new;
end;
$$;

-- BEFORE UPDATE (1º): o que cada perfil pode alterar.
create or replace function private.chamados_guard()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare
  v_role public.user_role;
begin
  if new.protocolo is distinct from old.protocolo or new.created_at is distinct from old.created_at then
    raise exception 'Protocolo e data de abertura não podem ser alterados.' using errcode = '42501';
  end if;

  if private.is_privileged() then
    return new;
  end if;

  v_role := private.user_role();

  if v_role = 'tecnico' then
    if not private.somente_campos(to_jsonb(old), to_jsonb(new), array['status', 'updated_at']) then
      raise exception 'Técnico só pode alterar o status do chamado.' using errcode = '42501';
    end if;
    if new.status = 'cancelado' then
      raise exception 'Somente o administrador pode cancelar chamados.' using errcode = '42501';
    end if;
  elsif v_role = 'cliente' then
    if not private.somente_campos(to_jsonb(old), to_jsonb(new),
         array['avaliacao_nota', 'avaliacao_comentario', 'updated_at']) then
      raise exception 'Cliente só pode avaliar o atendimento.' using errcode = '42501';
    end if;
    if old.status <> 'resolvido' then
      raise exception 'A avaliação só é permitida após o chamado ser resolvido.' using errcode = '42501';
    end if;
    new.avaliado_em := now();
  else
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;

  return new;
end;
$$;

-- BEFORE UPDATE (2º): automações de status e SLA.
create or replace function private.chamados_before_update()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare
  v_sla record;
begin
  if new.status is distinct from old.status then
    -- Regra 2: só resolve com OS assinada ou recusa de assinatura registrada.
    if new.status = 'resolvido' then
      if not exists (
        select 1 from public.ordens_servico o
        where o.chamado_id = new.id and o.ativo
          and (o.status = 'assinada' or (o.status = 'concluida' and o.assinatura_recusada))
      ) then
        raise exception 'Chamado só pode ser resolvido com OS assinada (ou recusa de assinatura registrada).'
          using errcode = '23514';
      end if;
      new.resolvido_em := now();
    elsif old.status = 'resolvido' then
      new.resolvido_em := null;
    end if;

    if old.status = 'aberto' and new.primeira_resposta_em is null then
      new.primeira_resposta_em := now();
    end if;
  end if;

  -- Mudou prioridade ou contrato: recalcula SLA a partir da abertura.
  if new.prioridade is distinct from old.prioridade or new.contrato_id is distinct from old.contrato_id then
    select * into v_sla from private.calcular_sla(new.contrato_id, new.prioridade, new.created_at);
    new.sla_resposta_ate := v_sla.sla_resposta_ate;
    new.sla_solucao_ate  := v_sla.sla_solucao_ate;
  end if;

  return new;
end;
$$;

-- AFTER INSERT/UPDATE: histórico automático.
create or replace function private.chamados_historico()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.chamado_historico (chamado_id, autor_id, campo, valor_anterior, valor_novo)
    values (new.id, auth.uid(), 'abertura', null, new.status::text);
    if new.tecnico_id is not null then
      insert into public.chamado_historico (chamado_id, autor_id, campo, valor_anterior, valor_novo)
      values (new.id, auth.uid(), 'tecnico', null,
              (select p.nome from public.profiles p where p.id = new.tecnico_id));
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.chamado_historico (chamado_id, autor_id, campo, valor_anterior, valor_novo)
    values (new.id, auth.uid(), 'status', old.status::text, new.status::text);
  end if;
  if new.tecnico_id is distinct from old.tecnico_id then
    insert into public.chamado_historico (chamado_id, autor_id, campo, valor_anterior, valor_novo)
    values (new.id, auth.uid(), 'tecnico',
            (select p.nome from public.profiles p where p.id = old.tecnico_id),
            (select p.nome from public.profiles p where p.id = new.tecnico_id));
  end if;
  if new.prioridade is distinct from old.prioridade then
    insert into public.chamado_historico (chamado_id, autor_id, campo, valor_anterior, valor_novo)
    values (new.id, auth.uid(), 'prioridade', old.prioridade::text, new.prioridade::text);
  end if;
  if new.data_agendada is distinct from old.data_agendada then
    insert into public.chamado_historico (chamado_id, autor_id, campo, valor_anterior, valor_novo)
    values (new.id, auth.uid(), 'data_agendada', old.data_agendada::text, new.data_agendada::text);
  end if;
  return new;
end;
$$;

-- Triggers BEFORE rodam em ordem alfabética: 10 (força campos/guard) -> 15 (valida) -> 20.
create trigger chamados_15_validar
  before insert or update on public.chamados
  for each row execute function private.chamados_validar();
create trigger chamados_10_insert
  before insert on public.chamados
  for each row execute function private.chamados_before_insert();
create trigger chamados_10_guard
  before update on public.chamados
  for each row execute function private.chamados_guard();
create trigger chamados_20_update
  before update on public.chamados
  for each row execute function private.chamados_before_update();
create trigger chamados_30_historico
  after insert or update on public.chamados
  for each row execute function private.chamados_historico();

-- Comentário público da equipe conta como primeira resposta.
create or replace function private.comentarios_primeira_resposta()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not new.interno and exists (
    select 1 from public.profiles p where p.id = new.autor_id and p.role in ('admin', 'tecnico')
  ) then
    update public.chamados c set primeira_resposta_em = now()
    where c.id = new.chamado_id and c.primeira_resposta_em is null;
  end if;
  return new;
end;
$$;

-- Cliente nunca grava comentário interno nem em nome de outro.
create or replace function private.comentarios_guard()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  if not private.is_privileged() then
    new.autor_id := auth.uid();
    if private.user_role() = 'cliente' then
      new.interno := false;
    end if;
  end if;
  new.created_at := now();
  return new;
end;
$$;

create trigger chamado_comentarios_10_guard
  before insert on public.chamado_comentarios
  for each row execute function private.comentarios_guard();
create trigger chamado_comentarios_20_resposta
  after insert on public.chamado_comentarios
  for each row execute function private.comentarios_primeira_resposta();

-- ---------------------------------------------------------------------
-- Ordens de serviço
-- ---------------------------------------------------------------------
create or replace function private.os_before_insert()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare
  v_ch record;
begin
  if not private.is_privileged() then
    if private.user_role() is distinct from 'tecnico' then
      raise exception 'Sem permissão para criar OS.' using errcode = '42501';
    end if;
    new.tecnico_id := auth.uid();
    if new.status not in ('rascunho', 'em_execucao') then
      new.status := 'rascunho';
    end if;
    new.hash_conteudo := null;
    new.assinada_em := null;
    new.pdf_path := null;
    new.ativo := true;
  end if;

  if new.chamado_id is not null then
    select c.cliente_id, c.unidade_id, c.descricao, c.titulo, c.tecnico_id
      into v_ch
      from public.chamados c where c.id = new.chamado_id;
    if not found then
      raise exception 'Chamado não encontrado.' using errcode = '23503';
    end if;
    if not private.is_privileged() and v_ch.tecnico_id is distinct from auth.uid() then
      raise exception 'Este chamado não está atribuído a você.' using errcode = '42501';
    end if;
    new.cliente_id := v_ch.cliente_id;
    new.unidade_id := coalesce(new.unidade_id, v_ch.unidade_id);
    new.problema_relatado := coalesce(new.problema_relatado,
                                      concat_ws(E'\n', v_ch.titulo, v_ch.descricao));
  end if;

  if new.unidade_id is not null and not exists (
    select 1 from public.unidades u where u.id = new.unidade_id and u.cliente_id = new.cliente_id
  ) then
    raise exception 'Unidade não pertence ao cliente da OS.' using errcode = '23514';
  end if;

  new.numero := private.proximo_numero('OS');
  new.created_at := now();
  if new.tecnico_id is not null then
    new.tecnico_nome_snapshot := (select p.nome from public.profiles p where p.id = new.tecnico_id);
  end if;
  return new;
end;
$$;

-- Regra 4: OS assinada é imutável. Só a função reabrir_os() destrava.
create or replace function private.os_guard()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare
  v_reabrindo boolean := coalesce(current_setting('app.reabrir_os', true), '') = 'on';
begin
  if new.numero is distinct from old.numero or new.created_at is distinct from old.created_at then
    raise exception 'Número e data de criação da OS não podem ser alterados.' using errcode = '42501';
  end if;

  if old.status = 'assinada' then
    if v_reabrindo and private.is_privileged() then
      return new;
    end if;
    -- Após assinar, só o servidor grava o caminho do PDF final.
    if private.somente_campos(to_jsonb(old), to_jsonb(new), array['pdf_path', 'updated_at'])
       and private.is_privileged() then
      return new;
    end if;
    raise exception 'OS assinada não pode ser alterada. Reabra a OS (somente administrador) informando o motivo.'
      using errcode = '42501';
  end if;

  if private.is_privileged() then
    return new;
  end if;

  if private.user_role() = 'tecnico' then
    if not private.somente_campos(to_jsonb(old), to_jsonb(new), array[
      'status', 'tipo_atendimento', 'problema_relatado', 'diagnostico', 'servico_executado',
      'observacoes_tecnicas', 'recomendacoes', 'data_inicio', 'data_fim',
      'pendencias', 'pendencias_texto', 'assinatura_recusada', 'motivo_recusa', 'updated_at'
    ]) then
      raise exception 'Técnico não pode alterar cliente, responsável ou dados de assinatura da OS.'
        using errcode = '42501';
    end if;
    if new.status in ('assinada', 'cancelada') then
      raise exception 'Status "%" é definido pelo sistema/administrador.', new.status using errcode = '42501';
    end if;
    return new;
  end if;

  raise exception 'Sem permissão.' using errcode = '42501';
end;
$$;

create trigger ordens_servico_10_insert
  before insert on public.ordens_servico
  for each row execute function private.os_before_insert();
create trigger ordens_servico_10_guard
  before update on public.ordens_servico
  for each row execute function private.os_guard();

-- Filhos da OS (itens, anexos, visitas, assinaturas) seguem o bloqueio da OS.
-- Exceção: admin/servidor pode ajustar campos de cobrança da visita, com auditoria.
create or replace function private.os_filhos_guard()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare
  v_os_id     uuid := case when tg_op = 'DELETE' then old.os_id else new.os_id end;
  v_status    public.os_status;
  v_reabrindo boolean := coalesce(current_setting('app.reabrir_os', true), '') = 'on';
  v_campos_cobranca text[] := array[
    'cobranca_tipo', 'valor_unitario', 'quantidade_horas', 'horas_trabalhadas',
    'justificativa_isencao', 'faturado', 'faturado_em', 'observacoes_financeiras', 'updated_at'
  ];
begin
  if tg_op = 'UPDATE' and new.os_id is distinct from old.os_id then
    raise exception 'Não é permitido mover registros entre OS.' using errcode = '42501';
  end if;

  select o.status into v_status from public.ordens_servico o where o.id = v_os_id;

  if v_status = 'assinada' and not (v_reabrindo and private.is_privileged()) then
    if tg_table_name = 'os_visitas' and tg_op = 'UPDATE' and private.is_privileged()
       and private.somente_campos(to_jsonb(old), to_jsonb(new), v_campos_cobranca) then
      perform private.registrar_auditoria(
        'os_visitas', new.id, 'alteracao_cobranca_pos_assinatura', null, to_jsonb(old), to_jsonb(new)
      );
      return new;
    end if;
    raise exception 'OS assinada não pode ser alterada. Reabra a OS (somente administrador).'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['os_itens', 'os_anexos', 'os_visitas', 'os_assinaturas'] loop
    execute format(
      'create trigger %I before insert or update or delete on public.%I for each row execute function private.os_filhos_guard()',
      t || '_05_bloqueio_os', t
    );
  end loop;
end $$;

-- Visitas: técnico não mexe em cobrança/faturamento; horas calculadas.
create or replace function private.os_visitas_before()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  if not private.is_privileged() then
    if tg_op = 'INSERT' then
      new.cobranca_tipo := null;
      new.valor_unitario := null;
      new.quantidade_horas := null;
      new.justificativa_isencao := null;
      new.faturado := false;
      new.faturado_em := null;
      new.observacoes_financeiras := null;
    elsif not private.somente_campos(to_jsonb(old), to_jsonb(new), array[
      'data_hora_chegada', 'data_hora_saida', 'deslocamento_km', 'observacoes',
      'horas_trabalhadas', 'updated_at'
    ]) then
      raise exception 'Técnico não pode alterar dados de cobrança/faturamento da visita.'
        using errcode = '42501';
    end if;
  end if;

  -- Horas trabalhadas = saída - chegada, sempre que os horários mudarem.
  -- (Admin pode ajustar horas_trabalhadas sem alterar os horários.)
  if new.data_hora_saida is not null and (
       tg_op = 'INSERT'
       or new.data_hora_saida is distinct from old.data_hora_saida
       or new.data_hora_chegada is distinct from old.data_hora_chegada
       or not private.is_privileged()
     ) then
    new.horas_trabalhadas := round(
      (extract(epoch from (new.data_hora_saida - new.data_hora_chegada)) / 3600)::numeric, 2
    );
  elsif new.data_hora_saida is null and not private.is_privileged() then
    new.horas_trabalhadas := null;
  end if;

  if new.faturado and new.faturado_em is null then
    new.faturado_em := now();
  elsif not new.faturado then
    new.faturado_em := null;
  end if;

  return new;
end;
$$;

create trigger os_visitas_10_before
  before insert or update on public.os_visitas
  for each row execute function private.os_visitas_before();

-- Assinaturas não são alteradas/apagadas por usuários comuns.
create or replace function private.os_assinaturas_guard()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.assinado_em := now();
    new.invalidada_em := null;
    new.invalidada_motivo := null;
    return new;
  end if;
  if not private.is_privileged() then
    raise exception 'Assinaturas não podem ser alteradas.' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger os_assinaturas_10_guard
  before insert or update or delete on public.os_assinaturas
  for each row execute function private.os_assinaturas_guard();

-- Exclusões físicas proibidas em chamados e OS (regra 6: exclusão lógica).
create or replace function private.bloquear_delete()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  raise exception 'Exclusão física não permitida em %. Use a exclusão lógica (ativo = false).', tg_table_name
    using errcode = '42501';
end;
$$;

create trigger chamados_bloquear_delete before delete on public.chamados
  for each row execute function private.bloquear_delete();
create trigger ordens_servico_bloquear_delete before delete on public.ordens_servico
  for each row execute function private.bloquear_delete();
create trigger chamado_comentarios_bloquear_delete before delete on public.chamado_comentarios
  for each row execute function private.bloquear_delete();
create trigger chamado_historico_bloquear_delete before delete on public.chamado_historico
  for each row execute function private.bloquear_delete();
create trigger auditoria_bloquear_delete before delete on public.auditoria
  for each row execute function private.bloquear_delete();

-- ---------------------------------------------------------------------
-- Reabertura de OS assinada (somente admin, com motivo e auditoria)
-- ---------------------------------------------------------------------
create or replace function public.reabrir_os(p_os_id uuid, p_motivo text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_antes jsonb;
  v_chamado uuid;
begin
  if not private.is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Somente o administrador pode reabrir uma OS.' using errcode = '42501';
  end if;
  if coalesce(length(trim(p_motivo)), 0) < 5 then
    raise exception 'Informe o motivo da reabertura (mínimo 5 caracteres).' using errcode = '22023';
  end if;

  select to_jsonb(o), o.chamado_id into v_antes, v_chamado
  from public.ordens_servico o where o.id = p_os_id and o.status = 'assinada';
  if v_antes is null then
    raise exception 'OS não encontrada ou não está assinada.' using errcode = 'P0002';
  end if;

  perform set_config('app.reabrir_os', 'on', true);

  update public.os_assinaturas
     set invalidada_em = now(), invalidada_motivo = p_motivo
   where os_id = p_os_id and invalidada_em is null;

  update public.ordens_servico
     set status = 'em_execucao', assinada_em = null, hash_conteudo = null
   where id = p_os_id;

  if v_chamado is not null then
    update public.chamados set status = 'em_atendimento'
     where id = v_chamado and status = 'resolvido';
  end if;

  perform set_config('app.reabrir_os', 'off', true);

  perform private.registrar_auditoria('ordens_servico', p_os_id, 'reabertura_os', p_motivo, v_antes,
    (select to_jsonb(o) from public.ordens_servico o where o.id = p_os_id));
end;
$$;

-- ---------------------------------------------------------------------
-- Permissões de execução
-- ---------------------------------------------------------------------
revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;

-- O serviço de Auth dispara handle_new_user ao criar usuários.
grant usage on schema private to supabase_auth_admin;
grant execute on function private.handle_new_user() to supabase_auth_admin;
grant execute on function private.sync_profile_claims() to supabase_auth_admin;

revoke all on function public.reabrir_os(uuid, text) from public, anon;
grant execute on function public.reabrir_os(uuid, text) to authenticated, service_role;
