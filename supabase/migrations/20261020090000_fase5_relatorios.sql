-- =====================================================================
-- Tonytec OS — 018: Fase 5 (dashboard e relatórios)
-- Todas as funções são SECURITY DEFINER, exigem admin e agregam no banco.
-- Períodos: [p_de, p_ate) em timestamptz (a aplicação converte datas de Brasília).
-- =====================================================================

create or replace function private.exigir_admin()
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not (coalesce(private.is_admin(), false) or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
end;
$$;

-- Dia/hora de Brasília
create or replace function private.sp(ts timestamptz)
returns timestamp
language sql immutable set search_path = ''
as $$ select ts at time zone 'America/Sao_Paulo' $$;

-- Linhas de faturamento: visitas de OS encerradas e ativas + materiais cobrados.
create or replace view private.linhas_faturamento as
  select
    o.cliente_id,
    coalesce(c.nome_fantasia, c.razao_social) as cliente,
    case v.cobranca_tipo
      when 'isento_contrato' then 'Isento (contrato)'
      when 'valor_unico' then 'Valor único'
      when 'valor_por_hora' then 'Por hora'
      when 'garantia' then 'Garantia'
      when 'cortesia' then 'Cortesia'
      else 'Sem cálculo'
    end as tipo,
    v.data_hora_chegada as data_ref,
    coalesce(v.valor_total, 0) as valor,
    v.faturado,
    'visita'::text as origem
  from public.os_visitas v
  join public.ordens_servico o on o.id = v.os_id and o.ativo and o.finalizada_em is not null
  join public.clientes c on c.id = o.cliente_id
  union all
  select
    o.cliente_id,
    coalesce(c.nome_fantasia, c.razao_social),
    'Materiais e serviços',
    o.finalizada_em,
    coalesce(i.valor_total, 0),
    o.itens_faturado_em is not null,
    'item'
  from public.os_itens i
  join public.ordens_servico o on o.id = i.os_id and o.ativo and o.finalizada_em is not null
  join public.clientes c on c.id = o.cliente_id
  where i.cobrado;

revoke all on private.linhas_faturamento from public, anon, authenticated;
grant select on private.linhas_faturamento to service_role;

-- ---------------------------------------------------------------------
-- Dashboard (um único jsonb: KPIs + séries)
-- ---------------------------------------------------------------------
create or replace function public.rel_dashboard(p_de timestamptz, p_ate timestamptz)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  r jsonb;
begin
  perform private.exigir_admin();

  with ch as (
    select c.*, cat.nome as categoria, tec.nome as tecnico_nome,
           coalesce(cl.nome_fantasia, cl.razao_social) as cliente_nome,
           tp.nome as tipo_nome
    from public.chamados c
    join public.clientes cl on cl.id = c.cliente_id
    left join public.categorias_servico cat on cat.id = c.categoria_id
    left join public.profiles tec on tec.id = c.tecnico_id
    left join public.tipos_problema tp on tp.id = c.tipo_problema_id
    where c.ativo
  ),
  per as (select * from ch where created_at >= p_de and created_at < p_ate),
  resp as (
    select * from per
    where status <> 'cancelado' and sla_resposta_ate is not null
      and (primeira_resposta_em is not null or sla_resposta_ate < now())
  ),
  sol as (
    select * from per
    where status <> 'cancelado' and sla_solucao_ate is not null
      and (resolvido_em is not null or sla_solucao_ate < now())
  ),
  risco as (
    select id, protocolo, titulo, cliente_nome, prioridade, status, tecnico_nome,
           least(
             case when primeira_resposta_em is null then sla_resposta_ate end,
             sla_solucao_ate
           ) as prazo,
           case when (primeira_resposta_em is null and sla_resposta_ate < now()) or sla_solucao_ate < now()
                then 'estourado' else 'vencendo' end as situacao
    from ch
    where status not in ('resolvido', 'cancelado')
      and (
        (primeira_resposta_em is null and sla_resposta_ate < now() + interval '4 hours')
        or sla_solucao_ate < now() + interval '4 hours'
      )
    order by 8, 7
    limit 10
  ),
  fat as (
    select * from private.linhas_faturamento where data_ref >= p_de and data_ref < p_ate
  ),
  meses as (
    select date_trunc('month', private.sp(now()))::date - (n || ' months')::interval as mes
    from generate_series(0, 11) n
  )
  select jsonb_build_object(
    'chamados', jsonb_build_object(
      'total', (select count(*) from per),
      'abertos', (select count(*) from per where status in ('aberto', 'triagem', 'agendado')),
      'em_atendimento', (select count(*) from per where status = 'em_atendimento'),
      'aguardando', (select count(*) from per where status in ('aguardando_cliente', 'aguardando_peca')),
      'resolvidos', (select count(*) from ch where resolvido_em >= p_de and resolvido_em < p_ate),
      'cancelados', (select count(*) from per where status = 'cancelado')
    ),
    'tempos', jsonb_build_object(
      'resposta_h', (select round(avg(extract(epoch from (primeira_resposta_em - created_at)) / 3600)::numeric, 1)
                       from per where primeira_resposta_em is not null),
      'resolucao_h', (select round(avg(extract(epoch from (resolvido_em - created_at)) / 3600)::numeric, 1)
                        from ch where resolvido_em >= p_de and resolvido_em < p_ate)
    ),
    'sla', jsonb_build_object(
      'resposta_total', (select count(*) from resp),
      'resposta_ok', (select count(*) from resp where primeira_resposta_em <= sla_resposta_ate),
      'solucao_total', (select count(*) from sol),
      'solucao_ok', (select count(*) from sol where resolvido_em <= sla_solucao_ate)
    ),
    'sla_risco', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from risco x),
    'os', jsonb_build_object(
      'concluidas', (select count(*) from public.ordens_servico
                      where ativo and finalizada_em >= p_de and finalizada_em < p_ate),
      'aguardando_assinatura', (select count(*) from public.ordens_servico
                                 where ativo and status = 'aguardando_assinatura' and finalizada_em is null)
    ),
    'faturamento', jsonb_build_object(
      'a_faturar', (select coalesce(sum(valor), 0) from fat where not faturado),
      'faturado', (select coalesce(sum(valor), 0) from fat where faturado)
    ),
    'satisfacao', jsonb_build_object(
      'media', (select round(avg(avaliacao_nota)::numeric, 2) from ch
                 where avaliado_em >= p_de and avaliado_em < p_ate),
      'avaliacoes', (select count(*) from ch where avaliado_em >= p_de and avaliado_em < p_ate)
    ),
    'por_dia', (
      select coalesce(jsonb_agg(jsonb_build_object('dia', d, 'abertos', a, 'resolvidos', s) order by d), '[]'::jsonb)
      from (
        select dia::date as d,
               (select count(*) from per where private.sp(per.created_at)::date = dia::date) as a,
               (select count(*) from ch where ch.resolvido_em is not null
                  and private.sp(ch.resolvido_em)::date = dia::date) as s
        from generate_series(private.sp(p_de)::date, private.sp(p_ate - interval '1 second')::date, interval '1 day') dia
      ) t
    ),
    'por_categoria', (select coalesce(jsonb_agg(jsonb_build_object('nome', n, 'qtd', q) order by q desc), '[]'::jsonb)
                       from (select coalesce(categoria, 'Sem categoria') n, count(*) q from per group by 1) t),
    'por_prioridade', (select coalesce(jsonb_agg(jsonb_build_object('nome', n, 'qtd', q)), '[]'::jsonb)
                        from (select prioridade::text n, count(*) q from per group by 1) t),
    'por_tecnico', (select coalesce(jsonb_agg(jsonb_build_object('nome', n, 'qtd', q) order by q desc), '[]'::jsonb)
                     from (select coalesce(tecnico_nome, 'Sem técnico') n, count(*) q from per group by 1) t),
    'receita_mensal', (
      select coalesce(jsonb_agg(jsonb_build_object('mes', to_char(m.mes, 'YYYY-MM'),
               'valor', coalesce((select sum(l.valor) from private.linhas_faturamento l
                                   where date_trunc('month', private.sp(l.data_ref))::date = m.mes::date), 0))
               order by m.mes), '[]'::jsonb)
      from meses m
    ),
    'top_clientes', (select coalesce(jsonb_agg(jsonb_build_object('nome', n, 'qtd', q) order by q desc), '[]'::jsonb)
                      from (select cliente_nome n, count(*) q from per group by 1 order by 2 desc limit 8) t),
    'top_problemas', (select coalesce(jsonb_agg(jsonb_build_object('nome', n, 'qtd', q) order by q desc), '[]'::jsonb)
                       from (select tipo_nome n, count(*) q from per where tipo_nome is not null
                             group by 1 order by 2 desc limit 8) t)
  ) into r;
  return r;
end;
$$;

-- ---------------------------------------------------------------------
-- 1. Clientes mais atendidos
-- ---------------------------------------------------------------------
create or replace function public.rel_clientes(p_de timestamptz, p_ate timestamptz)
returns table (cliente text, chamados bigint, os_encerradas bigint, horas numeric, valor_total numeric, valor_faturado numeric)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.exigir_admin();
  return query
  with ch as (
    select c.cliente_id, count(*) q from public.chamados c
    where c.ativo and c.created_at >= p_de and c.created_at < p_ate group by 1
  ),
  os as (
    select o.cliente_id, count(*) q from public.ordens_servico o
    where o.ativo and o.finalizada_em >= p_de and o.finalizada_em < p_ate group by 1
  ),
  hs as (
    select o.cliente_id, sum(v.horas_trabalhadas) h
    from public.os_visitas v join public.ordens_servico o on o.id = v.os_id and o.ativo and o.finalizada_em is not null
    where v.data_hora_chegada >= p_de and v.data_hora_chegada < p_ate group by 1
  ),
  fin as (
    select l.cliente_id, sum(l.valor) total, sum(l.valor) filter (where l.faturado) fat
    from private.linhas_faturamento l where l.data_ref >= p_de and l.data_ref < p_ate group by 1
  )
  select coalesce(cl.nome_fantasia, cl.razao_social),
         coalesce(ch.q, 0), coalesce(os.q, 0), round(coalesce(hs.h, 0), 2),
         coalesce(fin.total, 0), coalesce(fin.fat, 0)
  from public.clientes cl
  left join ch on ch.cliente_id = cl.id
  left join os on os.cliente_id = cl.id
  left join hs on hs.cliente_id = cl.id
  left join fin on fin.cliente_id = cl.id
  where coalesce(ch.q, 0) + coalesce(os.q, 0) > 0 or coalesce(fin.total, 0) > 0
  order by coalesce(ch.q, 0) desc, 5 desc;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Problemas (por tipo e categoria) e reincidência
-- ---------------------------------------------------------------------
create or replace function public.rel_problemas(p_de timestamptz, p_ate timestamptz)
returns table (categoria text, tipo text, chamados bigint, resolvidos bigint, tempo_medio_resolucao_h numeric)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.exigir_admin();
  return query
  select coalesce(cat.nome, 'Sem categoria'), coalesce(tp.nome, 'Não informado'),
         count(*), count(*) filter (where c.status = 'resolvido'),
         round(avg(extract(epoch from (c.resolvido_em - c.created_at)) / 3600)
               filter (where c.resolvido_em is not null)::numeric, 1)
  from public.chamados c
  left join public.categorias_servico cat on cat.id = c.categoria_id
  left join public.tipos_problema tp on tp.id = c.tipo_problema_id
  where c.ativo and c.status <> 'cancelado' and c.created_at >= p_de and c.created_at < p_ate
  group by 1, 2
  order by 3 desc, 1, 2;
end;
$$;

-- Reincidência: mesmo cliente + unidade + tipo de problema reaberto em até 30 dias.
create or replace function public.rel_reincidencia(p_de timestamptz, p_ate timestamptz)
returns table (cliente text, unidade text, tipo text, ocorrencias bigint, reincidencias bigint, taxa_pct numeric)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.exigir_admin();
  return query
  with base as (
    select c.cliente_id, c.unidade_id, c.tipo_problema_id, c.created_at,
           c.created_at - lag(c.created_at) over (
             partition by c.cliente_id, c.unidade_id, c.tipo_problema_id order by c.created_at
           ) as desde_anterior
    from public.chamados c
    where c.ativo and c.status <> 'cancelado' and c.tipo_problema_id is not null
  )
  select coalesce(cl.nome_fantasia, cl.razao_social), coalesce(u.nome, '—'), tp.nome,
         count(*), count(*) filter (where b.desde_anterior <= interval '30 days'),
         round(100.0 * count(*) filter (where b.desde_anterior <= interval '30 days') / nullif(count(*), 0), 1)
  from base b
  join public.clientes cl on cl.id = b.cliente_id
  left join public.unidades u on u.id = b.unidade_id
  join public.tipos_problema tp on tp.id = b.tipo_problema_id
  where b.created_at >= p_de and b.created_at < p_ate
  group by 1, 2, 3
  having count(*) filter (where b.desde_anterior <= interval '30 days') > 0
  order by 5 desc, 4 desc;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Produtividade por técnico
-- ---------------------------------------------------------------------
create or replace function public.rel_tecnicos(p_de timestamptz, p_ate timestamptz)
returns table (tecnico text, os_encerradas bigint, horas numeric, tempo_medio_por_os_h numeric, chamados_resolvidos bigint, nota_media numeric, avaliacoes bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.exigir_admin();
  return query
  with os as (
    select o.tecnico_id, count(*) q from public.ordens_servico o
    where o.ativo and o.finalizada_em >= p_de and o.finalizada_em < p_ate group by 1
  ),
  hs as (
    select o.tecnico_id, sum(v.horas_trabalhadas) h
    from public.os_visitas v join public.ordens_servico o on o.id = v.os_id and o.ativo and o.finalizada_em is not null
    where v.data_hora_chegada >= p_de and v.data_hora_chegada < p_ate group by 1
  ),
  rs as (
    select c.tecnico_id, count(*) q from public.chamados c
    where c.ativo and c.resolvido_em >= p_de and c.resolvido_em < p_ate group by 1
  ),
  nt as (
    select c.tecnico_id, avg(c.avaliacao_nota) n, count(*) q from public.chamados c
    where c.ativo and c.avaliado_em >= p_de and c.avaliado_em < p_ate group by 1
  )
  select p.nome, coalesce(os.q, 0), round(coalesce(hs.h, 0), 2),
         round(coalesce(hs.h, 0) / nullif(os.q, 0), 2),
         coalesce(rs.q, 0), round(nt.n::numeric, 2), coalesce(nt.q, 0)
  from public.profiles p
  left join os on os.tecnico_id = p.id
  left join hs on hs.tecnico_id = p.id
  left join rs on rs.tecnico_id = p.id
  left join nt on nt.tecnico_id = p.id
  where p.role = 'tecnico' and (p.ativo or coalesce(os.q, 0) + coalesce(rs.q, 0) > 0)
  order by 2 desc, 1;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. SLA (por prioridade, cliente ou técnico) e violações
-- ---------------------------------------------------------------------
create or replace function public.rel_sla(p_de timestamptz, p_ate timestamptz, p_dim text)
returns table (grupo text, chamados bigint, resposta_ok bigint, resposta_total bigint, resposta_pct numeric, solucao_ok bigint, solucao_total bigint, solucao_pct numeric)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.exigir_admin();
  if p_dim not in ('prioridade', 'cliente', 'tecnico') then
    raise exception 'Dimensão inválida.' using errcode = '22023';
  end if;
  return query
  with base as (
    select c.*,
      case p_dim when 'prioridade' then c.prioridade::text
                 when 'cliente' then coalesce(cl.nome_fantasia, cl.razao_social)
                 else coalesce(t.nome, 'Sem técnico') end as g
    from public.chamados c
    join public.clientes cl on cl.id = c.cliente_id
    left join public.profiles t on t.id = c.tecnico_id
    where c.ativo and c.status <> 'cancelado' and c.created_at >= p_de and c.created_at < p_ate
  )
  select b.g, count(*),
    count(*) filter (where b.sla_resposta_ate is not null and b.primeira_resposta_em <= b.sla_resposta_ate),
    count(*) filter (where b.sla_resposta_ate is not null and (b.primeira_resposta_em is not null or b.sla_resposta_ate < now())),
    round(100.0 * count(*) filter (where b.sla_resposta_ate is not null and b.primeira_resposta_em <= b.sla_resposta_ate)
          / nullif(count(*) filter (where b.sla_resposta_ate is not null and (b.primeira_resposta_em is not null or b.sla_resposta_ate < now())), 0), 1),
    count(*) filter (where b.sla_solucao_ate is not null and b.resolvido_em <= b.sla_solucao_ate),
    count(*) filter (where b.sla_solucao_ate is not null and (b.resolvido_em is not null or b.sla_solucao_ate < now())),
    round(100.0 * count(*) filter (where b.sla_solucao_ate is not null and b.resolvido_em <= b.sla_solucao_ate)
          / nullif(count(*) filter (where b.sla_solucao_ate is not null and (b.resolvido_em is not null or b.sla_solucao_ate < now())), 0), 1)
  from base b
  group by b.g
  order by 2 desc, 1;
end;
$$;

create or replace function public.rel_sla_violacoes(p_de timestamptz, p_ate timestamptz)
returns table (protocolo text, cliente text, tecnico text, prioridade text, prazo text, limite timestamptz, concluido_em timestamptz, atraso_h numeric)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.exigir_admin();
  return query
  select * from (
    select c.protocolo, coalesce(cl.nome_fantasia, cl.razao_social)::text, coalesce(t.nome, '—')::text, c.prioridade::text,
           'Resposta'::text, c.sla_resposta_ate, c.primeira_resposta_em,
           round(extract(epoch from (coalesce(c.primeira_resposta_em, now()) - c.sla_resposta_ate)) / 3600, 1)
    from public.chamados c join public.clientes cl on cl.id = c.cliente_id left join public.profiles t on t.id = c.tecnico_id
    where c.ativo and c.status <> 'cancelado' and c.created_at >= p_de and c.created_at < p_ate
      and c.sla_resposta_ate is not null
      and coalesce(c.primeira_resposta_em, now()) > c.sla_resposta_ate
    union all
    select c.protocolo, coalesce(cl.nome_fantasia, cl.razao_social)::text, coalesce(t.nome, '—')::text, c.prioridade::text,
           'Solução', c.sla_solucao_ate, c.resolvido_em,
           round(extract(epoch from (coalesce(c.resolvido_em, now()) - c.sla_solucao_ate)) / 3600, 1)
    from public.chamados c join public.clientes cl on cl.id = c.cliente_id left join public.profiles t on t.id = c.tecnico_id
    where c.ativo and c.status <> 'cancelado' and c.created_at >= p_de and c.created_at < p_ate
      and c.sla_solucao_ate is not null
      and coalesce(c.resolvido_em, now()) > c.sla_solucao_ate
  ) x
  order by 8 desc;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Faturamento de visitas (por cliente, tipo ou mês)
-- ---------------------------------------------------------------------
create or replace function public.rel_faturamento(p_de timestamptz, p_ate timestamptz, p_dim text)
returns table (grupo text, itens bigint, a_faturar numeric, faturado numeric, total numeric)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.exigir_admin();
  if p_dim not in ('cliente', 'tipo', 'mes') then
    raise exception 'Dimensão inválida.' using errcode = '22023';
  end if;
  return query
  select case p_dim when 'cliente' then l.cliente when 'tipo' then l.tipo
                    else to_char(private.sp(l.data_ref), 'YYYY-MM') end as g,
         count(*),
         coalesce(sum(l.valor) filter (where not l.faturado), 0),
         coalesce(sum(l.valor) filter (where l.faturado), 0),
         coalesce(sum(l.valor), 0)
  from private.linhas_faturamento l
  where l.data_ref >= p_de and l.data_ref < p_ate
  group by 1
  order by case when p_dim = 'mes' then 1 end, 5 desc, 1;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Consumo de contratos no período (e contratos a vencer)
-- ---------------------------------------------------------------------
create or replace function public.rel_contratos(p_de timestamptz, p_ate timestamptz)
returns table (contrato text, cliente text, vigencia_fim date, dias_para_vencer integer, mensal numeric,
               visitas_inclusas integer, horas_inclusas numeric, visitas_usadas bigint, horas_usadas numeric,
               visitas_excedentes bigint, valor_excedente numeric)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.exigir_admin();
  return query
  select ct.numero, coalesce(cl.nome_fantasia, cl.razao_social), ct.data_fim,
         (ct.data_fim - private.sp(now())::date)::integer,
         ct.valor_mensal, ct.visitas_inclusas_mes, ct.horas_inclusas_mes,
         count(v.id) filter (where v.cobranca_tipo = 'isento_contrato'),
         coalesce(sum(v.horas_franquia), 0),
         count(v.id) filter (where v.cobranca_tipo in ('valor_unico', 'valor_por_hora')),
         coalesce(sum(v.valor_total) filter (where v.cobranca_tipo in ('valor_unico', 'valor_por_hora')), 0)
  from public.contratos ct
  join public.clientes cl on cl.id = ct.cliente_id
  left join (
    select ov.* from public.os_visitas ov join public.ordens_servico o on o.id = ov.os_id and o.ativo
  ) v on v.contrato_id = ct.id and v.data_hora_chegada >= p_de and v.data_hora_chegada < p_ate
  where ct.status = 'ativo'
  group by ct.id, cl.id
  order by ct.data_fim nulls last, 1;
end;
$$;

-- ---------------------------------------------------------------------
-- 7. Evolução mensal
-- ---------------------------------------------------------------------
create or replace function public.rel_evolucao(p_de timestamptz, p_ate timestamptz)
returns table (mes text, abertos bigint, resolvidos bigint, backlog_final bigint, tempo_medio_resolucao_h numeric)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.exigir_admin();
  return query
  with m as (
    select d::date as ini, (d + interval '1 month')::date as fim
    from generate_series(date_trunc('month', private.sp(p_de)), date_trunc('month', private.sp(p_ate - interval '1 second')), interval '1 month') d
  ), ch as (select * from public.chamados where ativo)
  select to_char(m.ini, 'YYYY-MM'),
    (select count(*) from ch where private.sp(ch.created_at)::date >= m.ini and private.sp(ch.created_at)::date < m.fim),
    (select count(*) from ch where ch.resolvido_em is not null and private.sp(ch.resolvido_em)::date >= m.ini and private.sp(ch.resolvido_em)::date < m.fim),
    (select count(*) from ch where ch.status <> 'cancelado' and private.sp(ch.created_at)::date < m.fim
        and (ch.resolvido_em is null or private.sp(ch.resolvido_em)::date >= m.fim)),
    (select round(avg(extract(epoch from (ch.resolvido_em - ch.created_at)) / 3600)::numeric, 1)
       from ch where ch.resolvido_em is not null and private.sp(ch.resolvido_em)::date >= m.ini and private.sp(ch.resolvido_em)::date < m.fim)
  from m order by m.ini;
end;
$$;

-- ---------------------------------------------------------------------
-- 8. Satisfação
-- ---------------------------------------------------------------------
create or replace function public.rel_satisfacao(p_de timestamptz, p_ate timestamptz)
returns table (avaliado_em timestamptz, protocolo text, cliente text, tecnico text, nota smallint, comentario text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.exigir_admin();
  return query
  select c.avaliado_em, c.protocolo, coalesce(cl.nome_fantasia, cl.razao_social)::text, coalesce(t.nome, '—')::text,
         c.avaliacao_nota, coalesce(c.avaliacao_comentario, '')
  from public.chamados c join public.clientes cl on cl.id = c.cliente_id left join public.profiles t on t.id = c.tecnico_id
  where c.ativo and c.avaliado_em >= p_de and c.avaliado_em < p_ate
  order by c.avaliado_em desc;
end;
$$;

-- ---------------------------------------------------------------------
-- 9. Materiais e equipamentos mais utilizados
-- ---------------------------------------------------------------------
create or replace function public.rel_materiais(p_de timestamptz, p_ate timestamptz)
returns table (item text, tipo text, quantidade numeric, os bigint, valor_total numeric)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.exigir_admin();
  return query
  select min(i.descricao), i.tipo::text, sum(i.quantidade), count(distinct i.os_id), coalesce(sum(i.valor_total), 0)
  from public.os_itens i
  join public.ordens_servico o on o.id = i.os_id and o.ativo and o.finalizada_em >= p_de and o.finalizada_em < p_ate
  group by lower(trim(i.descricao)), i.tipo
  order by 3 desc, 1;
end;
$$;

-- ---------------------------------------------------------------------
-- 10. Mapa de calor (dia da semana x horário) e categoria x dia da semana
-- ---------------------------------------------------------------------
create or replace function public.rel_calor(p_de timestamptz, p_ate timestamptz)
returns table (dia_semana integer, hora integer, chamados bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.exigir_admin();
  return query
  select extract(dow from private.sp(c.created_at))::integer, extract(hour from private.sp(c.created_at))::integer, count(*)
  from public.chamados c
  where c.ativo and c.created_at >= p_de and c.created_at < p_ate
  group by 1, 2 order by 1, 2;
end;
$$;

create or replace function public.rel_categoria_dia(p_de timestamptz, p_ate timestamptz)
returns table (categoria text, dom bigint, seg bigint, ter bigint, qua bigint, qui bigint, sex bigint, sab bigint, total bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.exigir_admin();
  return query
  select coalesce(cat.nome, 'Sem categoria'),
    count(*) filter (where extract(dow from private.sp(c.created_at)) = 0),
    count(*) filter (where extract(dow from private.sp(c.created_at)) = 1),
    count(*) filter (where extract(dow from private.sp(c.created_at)) = 2),
    count(*) filter (where extract(dow from private.sp(c.created_at)) = 3),
    count(*) filter (where extract(dow from private.sp(c.created_at)) = 4),
    count(*) filter (where extract(dow from private.sp(c.created_at)) = 5),
    count(*) filter (where extract(dow from private.sp(c.created_at)) = 6),
    count(*)
  from public.chamados c left join public.categorias_servico cat on cat.id = c.categoria_id
  where c.ativo and c.created_at >= p_de and c.created_at < p_ate
  group by 1 order by 9 desc;
end;
$$;

-- ---------------------------------------------------------------------
-- 11. OS pendentes de assinatura e OS com pendências
-- ---------------------------------------------------------------------
create or replace function public.rel_os_aguardando(p_de timestamptz, p_ate timestamptz)
returns table (os text, cliente text, tecnico text, concluida_em timestamptz, dias_aguardando integer)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.exigir_admin();
  return query
  select o.numero, coalesce(cl.nome_fantasia, cl.razao_social)::text, coalesce(o.tecnico_nome_snapshot, '—')::text,
         o.data_fim, (private.sp(now())::date - private.sp(coalesce(o.data_fim, o.updated_at))::date)::integer
  from public.ordens_servico o join public.clientes cl on cl.id = o.cliente_id
  where o.ativo and o.status = 'aguardando_assinatura' and o.finalizada_em is null
  order by o.data_fim;
end;
$$;

create or replace function public.rel_os_pendencias(p_de timestamptz, p_ate timestamptz)
returns table (os text, cliente text, tecnico text, encerrada_em timestamptz, pendencia text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.exigir_admin();
  return query
  select o.numero, coalesce(cl.nome_fantasia, cl.razao_social)::text, coalesce(o.tecnico_nome_snapshot, '—')::text,
         o.finalizada_em, coalesce(o.pendencias_texto, '')
  from public.ordens_servico o join public.clientes cl on cl.id = o.cliente_id
  where o.ativo and o.pendencias and coalesce(o.finalizada_em, o.updated_at) >= p_de and coalesce(o.finalizada_em, o.updated_at) < p_ate
  order by o.finalizada_em desc nulls first;
end;
$$;

-- Permissões: só usuários autenticados (a função confere o admin); nunca anônimo.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'rel\_%' escape '\'
  loop
    execute format('revoke all on function %s from public, anon', f.assinatura);
    execute format('grant execute on function %s to authenticated, service_role', f.assinatura);
  end loop;
end $$;
