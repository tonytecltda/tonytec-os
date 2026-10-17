-- =====================================================================
-- Tonytec OS — 011: Fase 3 (ordem de serviço e assinatura)
--
-- Bloqueio da OS passa a ser por `finalizada_em` (encerrada = assinada pelo
-- cliente OU com recusa de assinatura registrada). Enquanto aguarda assinatura,
-- o conteúdo fica congelado para o técnico (as assinaturas guardam o hash dele).
-- =====================================================================

alter table public.ordens_servico add column if not exists finalizada_em timestamptz;
comment on column public.ordens_servico.finalizada_em is
  'Encerramento da OS (assinada pelo cliente ou recusa registrada). Com valor, a OS fica bloqueada.';
comment on column public.ordens_servico.assinada_em is
  'Quando o cliente assinou (null se a assinatura foi recusada).';

alter table public.os_assinatura_tokens add column if not exists tentativas integer not null default 0;

create index if not exists os_finalizada_idx on public.ordens_servico (finalizada_em desc)
  where finalizada_em is not null;
create index if not exists os_assinatura_tokens_validos_idx on public.os_assinatura_tokens (os_id)
  where usado_em is null;

-- ---------------------------------------------------------------------
-- Quem pode editar a OS e seus filhos
-- ---------------------------------------------------------------------
create or replace function private.pode_editar_os(p_os_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.ordens_servico o
    where o.id = p_os_id
      and o.finalizada_em is null
      and (
        private.is_admin()
        or (private.user_role() = 'tecnico'
            and o.tecnico_id = auth.uid()
            and o.status not in ('cancelada', 'aguardando_assinatura'))
      )
  )
$$;

drop policy if exists tecnico_update on public.ordens_servico;
create policy tecnico_update on public.ordens_servico for update to authenticated
  using ((select private.user_role()) = 'tecnico' and tecnico_id = (select auth.uid())
         and finalizada_em is null and status <> 'cancelada')
  with check ((select private.user_role()) = 'tecnico' and tecnico_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- Guard da OS
-- ---------------------------------------------------------------------
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

  -- Regra 4: OS encerrada é imutável. Só reabrir_os() destrava.
  if old.finalizada_em is not null then
    if v_reabrindo and private.is_privileged() then
      return new;
    end if;
    -- Depois de encerrar, o servidor só grava o caminho do PDF final.
    if private.somente_campos(to_jsonb(old), to_jsonb(new), array['pdf_path', 'updated_at'])
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

-- ---------------------------------------------------------------------
-- Guard dos filhos (itens, anexos, visitas, assinaturas)
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
    'cobranca_tipo', 'valor_unitario', 'quantidade_horas', 'horas_trabalhadas',
    'justificativa_isencao', 'faturado', 'faturado_em', 'observacoes_financeiras', 'updated_at'
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

-- ---------------------------------------------------------------------
-- Reabertura (admin): destrava a OS encerrada, invalida assinaturas e links
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
  from public.ordens_servico o where o.id = p_os_id and o.finalizada_em is not null;
  if v_antes is null then
    raise exception 'OS não encontrada ou não está encerrada.' using errcode = 'P0002';
  end if;

  perform set_config('app.reabrir_os', 'on', true);

  update public.os_assinaturas
     set invalidada_em = now(), invalidada_motivo = p_motivo
   where os_id = p_os_id and invalidada_em is null;

  update public.os_assinatura_tokens set usado_em = now()
   where os_id = p_os_id and usado_em is null;

  update public.ordens_servico
     set status = 'em_execucao', finalizada_em = null, assinada_em = null, hash_conteudo = null,
         assinatura_recusada = false, motivo_recusa = null, pdf_path = null, data_fim = null
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

revoke all on function public.reabrir_os(uuid, text) from public, anon;
grant execute on function public.reabrir_os(uuid, text) to authenticated, service_role;
