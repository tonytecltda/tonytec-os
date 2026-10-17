-- =====================================================================
-- Tonytec OS — 004: Row Level Security
--   admin   -> tudo (exceto DELETE físico em chamados/OS, bloqueado por trigger)
--   tecnico -> chamados/OS atribuídos + dados do cliente necessários
--   cliente -> somente dados do próprio cliente_id; nunca notas internas
-- Restrições de COLUNA (o que cada perfil pode alterar) ficam nos triggers *_guard.
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'clientes', 'unidades', 'profiles', 'contratos', 'categorias_servico', 'tipos_problema',
    'itens_catalogo', 'chamados', 'chamado_anexos', 'chamado_comentarios', 'chamado_historico',
    'ordens_servico', 'os_visitas', 'os_itens', 'os_anexos', 'os_assinaturas',
    'os_assinatura_tokens', 'configuracoes', 'notificacoes', 'auditoria'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

alter table private.contadores enable row level security;

-- Anônimo não acessa nenhuma tabela diretamente (assinatura remota passa pelo servidor).
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------
-- Admin: acesso total (CRUD) nas tabelas de cadastro/catálogo
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'clientes', 'unidades', 'profiles', 'contratos', 'categorias_servico', 'tipos_problema',
    'itens_catalogo', 'chamados', 'chamado_anexos', 'chamado_comentarios',
    'ordens_servico', 'os_visitas', 'os_itens', 'os_anexos', 'os_assinaturas',
    'os_assinatura_tokens', 'configuracoes', 'notificacoes'
  ] loop
    execute format(
      'create policy admin_all on public.%I for all to authenticated
         using ((select private.is_admin())) with check ((select private.is_admin()))', t
    );
  end loop;
end $$;

create policy admin_select on public.chamado_historico for select to authenticated
  using ((select private.is_admin()));
create policy admin_select on public.auditoria for select to authenticated
  using ((select private.is_admin()));

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
create policy proprio_select on public.profiles for select to authenticated
  using (id = (select auth.uid()));

-- Equipe vê todos os perfis; cliente vê a equipe (nomes de técnicos) e colegas do mesmo cliente.
create policy equipe_select on public.profiles for select to authenticated
  using ((select private.is_staff()));
create policy cliente_select on public.profiles for select to authenticated
  using (
    (select private.user_role()) = 'cliente'
    and (role in ('admin', 'tecnico') or cliente_id = (select private.user_cliente_id()))
  );

create policy proprio_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- clientes / unidades / contratos
-- ---------------------------------------------------------------------
create policy cliente_select on public.clientes for select to authenticated
  using (id = (select private.user_cliente_id()));
create policy tecnico_select on public.clientes for select to authenticated
  using (private.tecnico_atende_cliente(id));

create policy cliente_select on public.unidades for select to authenticated
  using (cliente_id = (select private.user_cliente_id()));
create policy tecnico_select on public.unidades for select to authenticated
  using (private.tecnico_atende_cliente(cliente_id));

create policy cliente_select on public.contratos for select to authenticated
  using (cliente_id = (select private.user_cliente_id()));

-- ---------------------------------------------------------------------
-- Catálogos e configurações: leitura para qualquer usuário logado
-- ---------------------------------------------------------------------
create policy leitura on public.categorias_servico for select to authenticated using (true);
create policy leitura on public.tipos_problema for select to authenticated using (true);
create policy leitura_equipe on public.itens_catalogo for select to authenticated
  using ((select private.is_staff()));
create policy leitura on public.configuracoes for select to authenticated using (true);

-- ---------------------------------------------------------------------
-- chamados
-- ---------------------------------------------------------------------
create policy tecnico_select on public.chamados for select to authenticated
  using ((select private.user_role()) = 'tecnico' and tecnico_id = (select auth.uid()));
create policy tecnico_update on public.chamados for update to authenticated
  using ((select private.user_role()) = 'tecnico' and tecnico_id = (select auth.uid()))
  with check ((select private.user_role()) = 'tecnico' and tecnico_id = (select auth.uid()));

create policy cliente_select on public.chamados for select to authenticated
  using (cliente_id = (select private.user_cliente_id()));
create policy cliente_insert on public.chamados for insert to authenticated
  with check ((select private.user_role()) = 'cliente');   -- cliente_id é forçado pelo trigger
create policy cliente_update on public.chamados for update to authenticated
  using (cliente_id = (select private.user_cliente_id()))
  with check (cliente_id = (select private.user_cliente_id()));

-- anexos do chamado
create policy participante_select on public.chamado_anexos for select to authenticated
  using (private.pode_ver_chamado(chamado_id));
create policy participante_insert on public.chamado_anexos for insert to authenticated
  with check (private.pode_ver_chamado(chamado_id) and enviado_por = (select auth.uid()));

-- comentários: cliente nunca vê notas internas
create policy participante_select on public.chamado_comentarios for select to authenticated
  using (private.pode_ver_chamado(chamado_id) and (not interno or (select private.is_staff())));
create policy participante_insert on public.chamado_comentarios for insert to authenticated
  with check (
    private.pode_ver_chamado(chamado_id)
    and autor_id = (select auth.uid())
    and (not interno or (select private.is_staff()))
  );

-- histórico: leitura para quem vê o chamado (gravação só via trigger)
create policy participante_select on public.chamado_historico for select to authenticated
  using (private.pode_ver_chamado(chamado_id));

-- ---------------------------------------------------------------------
-- ordens_servico
-- ---------------------------------------------------------------------
create policy tecnico_select on public.ordens_servico for select to authenticated
  using ((select private.user_role()) = 'tecnico' and tecnico_id = (select auth.uid()));
create policy tecnico_insert on public.ordens_servico for insert to authenticated
  with check ((select private.user_role()) = 'tecnico');   -- tecnico_id é forçado pelo trigger
create policy tecnico_update on public.ordens_servico for update to authenticated
  using ((select private.user_role()) = 'tecnico' and tecnico_id = (select auth.uid())
         and status not in ('assinada', 'cancelada'))
  with check ((select private.user_role()) = 'tecnico' and tecnico_id = (select auth.uid()));

create policy cliente_select on public.ordens_servico for select to authenticated
  using (cliente_id = (select private.user_cliente_id())
         and status in ('concluida', 'aguardando_assinatura', 'assinada'));

-- visitas: cliente NÃO acessa diretamente (dados financeiros internos)
create policy tecnico_select on public.os_visitas for select to authenticated
  using (private.pode_ver_os_staff(os_id));
create policy tecnico_insert on public.os_visitas for insert to authenticated
  with check (private.pode_editar_os(os_id));
create policy tecnico_update on public.os_visitas for update to authenticated
  using (private.pode_editar_os(os_id)) with check (private.pode_editar_os(os_id));

-- itens e anexos
create policy participante_select on public.os_itens for select to authenticated
  using (private.pode_ver_os(os_id));
create policy tecnico_insert on public.os_itens for insert to authenticated
  with check (private.pode_editar_os(os_id));
create policy tecnico_update on public.os_itens for update to authenticated
  using (private.pode_editar_os(os_id)) with check (private.pode_editar_os(os_id));
create policy tecnico_delete on public.os_itens for delete to authenticated
  using (private.pode_editar_os(os_id));

create policy participante_select on public.os_anexos for select to authenticated
  using (private.pode_ver_os(os_id));
create policy tecnico_insert on public.os_anexos for insert to authenticated
  with check (private.pode_editar_os(os_id) and enviado_por = (select auth.uid()));
create policy tecnico_delete on public.os_anexos for delete to authenticated
  using (private.pode_editar_os(os_id));

-- assinaturas: técnico coleta no local; cliente lê as da própria OS
create policy participante_select on public.os_assinaturas for select to authenticated
  using (private.pode_ver_os(os_id));
create policy tecnico_insert on public.os_assinaturas for insert to authenticated
  with check (private.pode_editar_os(os_id));

-- ---------------------------------------------------------------------
-- notificações: cada um vê/marca as suas
-- ---------------------------------------------------------------------
create policy proprio_select on public.notificacoes for select to authenticated
  using (profile_id = (select auth.uid()));
create policy proprio_update on public.notificacoes for update to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
