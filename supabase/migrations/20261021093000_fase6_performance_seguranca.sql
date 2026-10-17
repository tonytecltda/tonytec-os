-- Revisão da Fase 6 (advisors do Supabase): índices nas chaves estrangeiras e função de plataforma fechada.

-- Função auxiliar do Supabase (gatilho de evento): não precisa ser chamável pela API.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;

create index if not exists chamado_anexos_enviado_por_idx on public.chamado_anexos (enviado_por);
create index if not exists chamado_comentarios_autor_idx on public.chamado_comentarios (autor_id);
create index if not exists chamado_historico_autor_idx on public.chamado_historico (autor_id);
create index if not exists chamados_aberto_por_idx on public.chamados (aberto_por);
create index if not exists chamados_contrato_idx on public.chamados (contrato_id);
create index if not exists chamados_tipo_problema_idx on public.chamados (tipo_problema_id);
create index if not exists chamados_unidade_idx on public.chamados (unidade_id);
create index if not exists itens_catalogo_categoria_idx on public.itens_catalogo (categoria_id);
create index if not exists ordens_servico_unidade_idx on public.ordens_servico (unidade_id);
create index if not exists os_anexos_enviado_por_idx on public.os_anexos (enviado_por);
create index if not exists os_assinatura_tokens_criado_por_idx on public.os_assinatura_tokens (criado_por);
create index if not exists os_itens_catalogo_idx on public.os_itens (catalogo_id);
