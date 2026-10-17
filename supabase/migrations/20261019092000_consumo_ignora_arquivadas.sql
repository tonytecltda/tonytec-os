-- =====================================================================
-- Tonytec OS — 017: OS arquivada não consome a franquia do contrato
-- =====================================================================

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
  if not (
    coalesce(private.is_admin(), false)
    or coalesce(v_cliente = private.user_cliente_id(), false)
    or coalesce(auth.role(), '') = 'service_role'
  ) then
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
  left join (
    select ov.*
    from public.os_visitas ov
    join public.ordens_servico o on o.id = ov.os_id and o.ativo
  ) v
    on v.contrato_id = ct.id
   and v.data_hora_chegada >= v_ini
   and v.data_hora_chegada <  v_fim
  where ct.id = p_contrato_id
  group by ct.visitas_inclusas_mes, ct.horas_inclusas_mes;
end;
$$;

revoke all on function public.consumo_contrato_mes(uuid, date) from public, anon;
grant execute on function public.consumo_contrato_mes(uuid, date) to authenticated, service_role;
