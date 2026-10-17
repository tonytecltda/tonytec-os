-- =====================================================================
-- Tonytec OS — 010: ajustes para a Fase 2 (chamados)
-- =====================================================================

-- Filtros de SLA (chamados em aberto com prazo vencido/vencendo)
create index if not exists chamados_sla_solucao_idx
  on public.chamados (sla_solucao_ate)
  where status not in ('resolvido', 'cancelado');

create index if not exists chamados_sla_resposta_idx
  on public.chamados (sla_resposta_ate)
  where primeira_resposta_em is null and status not in ('resolvido', 'cancelado');

-- Quadro Kanban / listas por status e data
create index if not exists chamados_status_created_idx on public.chamados (status, created_at desc);

-- Anexos: no máximo 20 por chamado (evita abuso de armazenamento)
create or replace function private.chamado_anexos_limite()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select count(*) from public.chamado_anexos a where a.chamado_id = new.chamado_id) >= 20 then
    raise exception 'Limite de 20 anexos por chamado atingido.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger chamado_anexos_10_limite
  before insert on public.chamado_anexos
  for each row execute function private.chamado_anexos_limite();

grant execute on function private.chamado_anexos_limite() to authenticated, service_role;
