-- rel_dashboard: séries diárias e mensais agregadas uma única vez (antes: uma varredura por dia/mês).
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
      select coalesce(jsonb_agg(jsonb_build_object('dia', g.d, 'abertos', coalesce(a.q, 0), 'resolvidos', coalesce(s.q, 0))
                                order by g.d), '[]'::jsonb)
      from (
        select dia::date as d
        from generate_series(private.sp(p_de)::date, private.sp(p_ate - interval '1 second')::date, interval '1 day') dia
      ) g
      left join (select private.sp(created_at)::date as d, count(*) as q from per group by 1) a on a.d = g.d
      left join (select private.sp(resolvido_em)::date as d, count(*) as q
                 from ch where resolvido_em is not null group by 1) s on s.d = g.d
    ),
    'por_categoria', (select coalesce(jsonb_agg(jsonb_build_object('nome', n, 'qtd', q) order by q desc), '[]'::jsonb)
                       from (select coalesce(categoria, 'Sem categoria') n, count(*) q from per group by 1) t),
    'por_prioridade', (select coalesce(jsonb_agg(jsonb_build_object('nome', n, 'qtd', q)), '[]'::jsonb)
                        from (select prioridade::text n, count(*) q from per group by 1) t),
    'por_tecnico', (select coalesce(jsonb_agg(jsonb_build_object('nome', n, 'qtd', q) order by q desc), '[]'::jsonb)
                     from (select coalesce(tecnico_nome, 'Sem técnico') n, count(*) q from per group by 1) t),
    'receita_mensal', (
      select coalesce(jsonb_agg(jsonb_build_object('mes', to_char(m.mes, 'YYYY-MM'), 'valor', coalesce(f.v, 0))
                                order by m.mes), '[]'::jsonb)
      from meses m
      left join (select date_trunc('month', private.sp(data_ref))::date as mes, sum(valor) as v
                 from private.linhas_faturamento group by 1) f on f.mes = m.mes::date
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
