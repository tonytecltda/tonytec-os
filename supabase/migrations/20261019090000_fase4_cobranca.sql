-- =====================================================================
-- Tonytec OS — 015: Fase 4 (cobrança de visitas)
-- =====================================================================

-- Visita: contrato aplicado, horas cobertas pela franquia e controle de ajuste manual
alter table public.os_visitas
  add column if not exists contrato_id uuid references public.contratos (id),
  add column if not exists horas_franquia numeric(8, 2) not null default 0 check (horas_franquia >= 0),
  add column if not exists cobranca_manual boolean not null default false,
  add column if not exists cobranca_calculada_em timestamptz;

create index if not exists os_visitas_contrato_idx on public.os_visitas (contrato_id, data_hora_chegada);
create index if not exists os_visitas_a_faturar_idx on public.os_visitas (data_hora_chegada)
  where faturado = false;

-- Itens cobrados da OS são faturados junto com o fechamento do mês
alter table public.ordens_servico add column if not exists itens_faturado_em timestamptz;

-- ---------------------------------------------------------------------
-- Guard dos filhos: campos de cobrança que admin/servidor ajusta após encerrar
-- ---------------------------------------------------------------------
create or replace function private.os_filhos_guard()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare
  v_os_id      uuid := case when tg_op = 'DELETE' then old.os_id else new.os_id end;
  v_status     public.os_status;
  v_finalizada timestamptz;
  v_reabrindo  boolean := coalesce(current_setting('app.reabrir_os', true), '') = 'on';
  v_campos_cobranca text[] := array[
    'cobranca_tipo', 'valor_unitario', 'quantidade_horas', 'horas_trabalhadas', 'valor_total',
    'justificativa_isencao', 'faturado', 'faturado_em', 'observacoes_financeiras',
    'contrato_id', 'horas_franquia', 'cobranca_manual', 'cobranca_calculada_em', 'updated_at'
  ];
begin
  if tg_op = 'UPDATE' and new.os_id is distinct from old.os_id then
    raise exception 'Não é permitido mover registros entre OS.' using errcode = '42501';
  end if;

  select o.status, o.finalizada_em into v_status, v_finalizada
  from public.ordens_servico o where o.id = v_os_id;

  if v_finalizada is not null and not (v_reabrindo and private.is_privileged()) then
    -- Exceção: admin/servidor ajusta a cobrança da visita, sempre com auditoria.
    if tg_table_name = 'os_visitas' and tg_op = 'UPDATE' and private.is_privileged()
       and private.somente_campos(to_jsonb(old), to_jsonb(new), v_campos_cobranca) then
      perform private.registrar_auditoria(
        'os_visitas', new.id, 'alteracao_cobranca_pos_assinatura', null, to_jsonb(old), to_jsonb(new)
      );
      return new;
    end if;
    raise exception 'OS encerrada não pode ser alterada. Reabra a OS (somente administrador).'
      using errcode = '42501';
  end if;

  if v_status = 'aguardando_assinatura' and not private.is_privileged() then
    raise exception 'A OS está aguardando assinatura. Use “Voltar para edição” para alterar.'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- A OS encerrada aceita ainda: PDF, arquivamento e a marca de itens faturados.
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

  if old.finalizada_em is not null then
    if v_reabrindo and private.is_privileged() then
      return new;
    end if;
    if private.somente_campos(to_jsonb(old), to_jsonb(new),
         array['pdf_path', 'ativo', 'itens_faturado_em', 'updated_at'])
       and private.is_privileged() then
      return new;
    end if;
    raise exception 'OS encerrada não pode ser alterada. Reabra a OS (somente administrador) informando o motivo.'
      using errcode = '42501';
  end if;

  if private.is_privileged() then
    return new;
  end if;

  if private.user_role() = 'tecnico' then
    if old.status = 'aguardando_assinatura' then
      raise exception 'A OS está aguardando assinatura. Use “Voltar para edição” para alterar (as assinaturas coletadas serão descartadas).'
        using errcode = '42501';
    end if;
    if not private.somente_campos(to_jsonb(old), to_jsonb(new), array[
      'status', 'tipo_atendimento', 'problema_relatado', 'diagnostico', 'servico_executado',
      'observacoes_tecnicas', 'recomendacoes', 'data_inicio', 'data_fim',
      'pendencias', 'pendencias_texto', 'updated_at'
    ]) then
      raise exception 'Técnico não pode alterar cliente, responsável ou dados de assinatura da OS.'
        using errcode = '42501';
    end if;
    if new.status not in ('rascunho', 'em_execucao', 'aguardando_assinatura') then
      raise exception 'Status "%" é definido pelo sistema/administrador.', new.status using errcode = '42501';
    end if;
    return new;
  end if;

  raise exception 'Sem permissão.' using errcode = '42501';
end;
$$;

-- Técnico não mexe nos campos novos de cobrança ao criar/editar a visita.
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
      new.contrato_id := null;
      new.horas_franquia := 0;
      new.cobranca_manual := false;
      new.cobranca_calculada_em := null;
    elsif not private.somente_campos(to_jsonb(old), to_jsonb(new), array[
      'data_hora_chegada', 'data_hora_saida', 'deslocamento_km', 'observacoes',
      'horas_trabalhadas', 'valor_total', 'updated_at'
    ]) then
      raise exception 'Técnico não pode alterar dados de cobrança/faturamento da visita.'
        using errcode = '42501';
    end if;
  end if;

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

-- ---------------------------------------------------------------------
-- Consumo do contrato no mês (visitas/horas da franquia e excedentes)
-- ---------------------------------------------------------------------
create or replace function public.consumo_contrato_mes(p_contrato_id uuid, p_mes date)
returns table (
  visitas_inclusas integer,
  horas_inclusas numeric,
  visitas_usadas bigint,
  horas_usadas numeric,
  visitas_excedentes bigint,
  valor_excedente numeric
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_ini timestamptz := (date_trunc('month', p_mes)::timestamp) at time zone 'America/Sao_Paulo';
  v_fim timestamptz := ((date_trunc('month', p_mes) + interval '1 month')::timestamp) at time zone 'America/Sao_Paulo';
  v_cliente uuid;
begin
  select ct.cliente_id into v_cliente from public.contratos ct where ct.id = p_contrato_id;
  if v_cliente is null then
    return;
  end if;
  if not (private.is_admin() or v_cliente = private.user_cliente_id()
          or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;

  return query
  select
    ct.visitas_inclusas_mes,
    ct.horas_inclusas_mes,
    count(*) filter (where v.cobranca_tipo = 'isento_contrato'),
    coalesce(sum(v.horas_franquia), 0),
    count(*) filter (where v.cobranca_tipo in ('valor_unico', 'valor_por_hora')),
    coalesce(sum(v.valor_total) filter (where v.cobranca_tipo in ('valor_unico', 'valor_por_hora')), 0)
  from public.contratos ct
  left join public.os_visitas v
    on v.contrato_id = ct.id
   and v.data_hora_chegada >= v_ini
   and v.data_hora_chegada <  v_fim
  where ct.id = p_contrato_id
  group by ct.visitas_inclusas_mes, ct.horas_inclusas_mes;
end;
$$;

revoke all on function public.consumo_contrato_mes(uuid, date) from public, anon;
grant execute on function public.consumo_contrato_mes(uuid, date) to authenticated, service_role;
