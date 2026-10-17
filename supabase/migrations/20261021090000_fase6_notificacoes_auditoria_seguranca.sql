-- =====================================================================
-- Tonytec OS — Fase 6: notificações, auditoria ampliada e limite de tentativas
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Notificações
--    Cada usuário só enxerga as próprias (nem o admin lê as dos outros).
--    A criação é feita só pelos gatilhos abaixo (SECURITY DEFINER).
-- ---------------------------------------------------------------------
drop policy if exists admin_all on public.notificacoes;

create or replace function private.ids_admins()
returns uuid[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(id), '{}') from public.profiles where role = 'admin' and ativo
$$;

create or replace function private.ids_usuarios_cliente(p_cliente_id uuid)
returns uuid[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(id), '{}') from public.profiles
  where role = 'cliente' and ativo and cliente_id = p_cliente_id
$$;

/**
 * Cria uma notificação para cada destinatário ativo (menos quem causou o evento),
 * com o link adequado ao perfil de cada um.
 */
create or replace function private.notificar(
  p_ids uuid[], p_titulo text, p_mensagem text,
  p_link_admin text, p_link_tecnico text, p_link_cliente text
)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.notificacoes (profile_id, titulo, mensagem, link)
  select p.id, p_titulo, left(p_mensagem, 280),
         case p.role when 'admin' then p_link_admin when 'tecnico' then p_link_tecnico else p_link_cliente end
  from public.profiles p
  where p.id = any (p_ids) and p.ativo and p.id is distinct from auth.uid()
$$;

revoke all on function private.notificar(uuid[], text, text, text, text, text) from public, anon, authenticated;
revoke all on function private.ids_admins() from public, anon, authenticated;
revoke all on function private.ids_usuarios_cliente(uuid) from public, anon, authenticated;

-- Chamados: novo, atribuição, agendamento, resolução e avaliação
create or replace function private.notificar_chamado()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_quando text;
begin
  if tg_op = 'INSERT' then
    perform private.notificar(
      private.ids_admins(), 'Novo chamado ' || new.protocolo, new.titulo,
      '/admin/chamados/' || new.id, null, null
    );
    if new.tecnico_id is not null then
      perform private.notificar(
        array[new.tecnico_id], 'Chamado atribuído a você: ' || new.protocolo, new.titulo,
        null, '/tecnico/chamados/' || new.id, null
      );
    end if;
    return new;
  end if;

  if new.tecnico_id is not null and new.tecnico_id is distinct from old.tecnico_id then
    perform private.notificar(
      array[new.tecnico_id], 'Chamado atribuído a você: ' || new.protocolo, new.titulo,
      null, '/tecnico/chamados/' || new.id, null
    );
  end if;

  if new.data_agendada is not null and new.status = 'agendado'
     and (new.data_agendada is distinct from old.data_agendada or old.status <> 'agendado') then
    v_quando := to_char(new.data_agendada at time zone 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI');
    perform private.notificar(
      private.ids_usuarios_cliente(new.cliente_id), 'Visita agendada: ' || new.protocolo,
      'Visita técnica em ' || v_quando || '.', null, null, '/portal/chamados/' || new.id
    );
    if new.tecnico_id is not null and old.status = 'agendado' then
      perform private.notificar(
        array[new.tecnico_id], 'Visita reagendada: ' || new.protocolo,
        new.titulo || ' — ' || v_quando || '.', null, '/tecnico/chamados/' || new.id, null
      );
    end if;
  end if;

  if new.status = 'resolvido' and old.status <> 'resolvido' then
    perform private.notificar(
      private.ids_usuarios_cliente(new.cliente_id), 'Chamado resolvido: ' || new.protocolo,
      new.titulo || ' — avalie o atendimento.', null, null, '/portal/chamados/' || new.id
    );
  end if;

  if new.avaliado_em is not null and old.avaliado_em is null then
    perform private.notificar(
      private.ids_admins(), 'Avaliação recebida: ' || new.avaliacao_nota || ' de 5 em ' || new.protocolo,
      coalesce(new.avaliacao_comentario, new.titulo), '/admin/chamados/' || new.id, null, null
    );
  end if;
  return new;
end;
$$;

drop trigger if exists chamados_80_notificar on public.chamados;
create trigger chamados_80_notificar after insert or update on public.chamados
  for each row execute function private.notificar_chamado();

-- Comentários: resposta do cliente -> equipe; resposta pública da equipe -> cliente; nota interna -> equipe
create or replace function private.notificar_comentario()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  c public.chamados;
  v_papel public.user_role;
  v_equipe uuid[];
begin
  select * into c from public.chamados where id = new.chamado_id;
  select role into v_papel from public.profiles where id = new.autor_id;
  v_equipe := private.ids_admins() || case when c.tecnico_id is null then '{}'::uuid[] else array[c.tecnico_id] end;

  if new.interno then
    perform private.notificar(
      v_equipe, 'Nota interna em ' || c.protocolo, new.mensagem,
      '/admin/chamados/' || c.id, '/tecnico/chamados/' || c.id, null
    );
  elsif v_papel = 'cliente' then
    perform private.notificar(
      v_equipe, 'Cliente respondeu em ' || c.protocolo, new.mensagem,
      '/admin/chamados/' || c.id, '/tecnico/chamados/' || c.id, null
    );
  else
    perform private.notificar(
      private.ids_usuarios_cliente(c.cliente_id), 'Nova resposta em ' || c.protocolo, new.mensagem,
      null, null, '/portal/chamados/' || c.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists chamado_comentarios_80_notificar on public.chamado_comentarios;
create trigger chamado_comentarios_80_notificar after insert on public.chamado_comentarios
  for each row execute function private.notificar_comentario();

-- OS: aguardando assinatura e assinada
create or replace function private.notificar_os()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = old.status then
    return new;
  end if;
  if new.status = 'aguardando_assinatura' then
    perform private.notificar(
      private.ids_admins(), 'OS aguardando assinatura: ' || new.numero,
      'O atendimento foi concluído e aguarda a assinatura do cliente.',
      '/admin/os/' || new.id, null, null
    );
  elsif new.status = 'assinada' then
    perform private.notificar(
      private.ids_admins(), 'OS assinada: ' || new.numero, 'A OS foi assinada e encerrada.',
      '/admin/os/' || new.id, null, null
    );
    perform private.notificar(
      private.ids_usuarios_cliente(new.cliente_id), 'Ordem de serviço ' || new.numero || ' disponível',
      'O atendimento foi encerrado. Veja e baixe o PDF da OS.', null, null, '/portal/os/' || new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists ordens_servico_80_notificar on public.ordens_servico;
create trigger ordens_servico_80_notificar after update on public.ordens_servico
  for each row execute function private.notificar_os();

-- ---------------------------------------------------------------------
-- 2. Auditoria ampliada: cadastros sensíveis e ciclo de vida da OS
-- ---------------------------------------------------------------------
create or replace function private.auditar_alteracao()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_ignorar text[] := array['updated_at'];
  v_antes jsonb;
  v_depois jsonb;
  v_id uuid;
begin
  if tg_op = 'UPDATE' then
    select coalesce(jsonb_object_agg(k, o.value), '{}'), coalesce(jsonb_object_agg(k, n.value), '{}')
      into v_antes, v_depois
    from jsonb_each(to_jsonb(old)) o(k, value)
    join jsonb_each(to_jsonb(new)) n(k, value) using (k)
    where o.value is distinct from n.value and k <> all (v_ignorar);
    if v_antes = '{}'::jsonb then
      return new;
    end if;
    v_id := (to_jsonb(new) ->> 'id')::uuid;
  elsif tg_op = 'INSERT' then
    v_depois := to_jsonb(new);
    v_id := (v_depois ->> 'id')::uuid;
  else
    v_antes := to_jsonb(old);
    v_id := (v_antes ->> 'id')::uuid;
  end if;

  -- Configurações usam "chave" como identificador (texto): guardamos no registro.
  if tg_table_name = 'configuracoes' then
    v_id := null;
    v_depois := coalesce(v_depois, '{}'::jsonb) || jsonb_build_object('chave', coalesce((to_jsonb(new) ->> 'chave'), (to_jsonb(old) ->> 'chave')));
  end if;

  insert into public.auditoria (tabela, registro_id, acao, dados_antes, dados_depois, autor_id)
  values (tg_table_name, v_id, lower(tg_op), v_antes, v_depois, auth.uid());
  return coalesce(new, old);
end;
$$;

revoke all on function private.auditar_alteracao() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'clientes', 'unidades', 'contratos', 'configuracoes', 'itens_catalogo',
                           'categorias_servico', 'tipos_problema']
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_90_auditoria', t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function private.auditar_alteracao()',
      t || '_90_auditoria', t
    );
  end loop;
end $$;

-- Ciclo de vida da OS (envio para assinatura, assinatura, cancelamento): quem e quando
create or replace function private.auditar_status_os()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    insert into public.auditoria (tabela, registro_id, acao, dados_antes, dados_depois, autor_id)
    values ('ordens_servico', new.id, 'status',
            jsonb_build_object('status', old.status, 'numero', old.numero),
            jsonb_build_object('status', new.status, 'numero', new.numero), auth.uid());
  end if;
  return new;
end;
$$;

revoke all on function private.auditar_status_os() from public, anon, authenticated;

drop trigger if exists ordens_servico_90_auditoria on public.ordens_servico;
create trigger ordens_servico_90_auditoria after update on public.ordens_servico
  for each row execute function private.auditar_status_os();

create index if not exists auditoria_autor_idx on public.auditoria (autor_id, created_at desc);
create index if not exists auditoria_tabela_created_idx on public.auditoria (tabela, created_at desc);

-- ---------------------------------------------------------------------
-- 3. Limite de tentativas (login, links de assinatura, recuperação de senha)
--    Chamado só pelo servidor (service_role). Janela fixa por chave.
-- ---------------------------------------------------------------------
create table if not exists private.rate_limit (
  chave      text not null,
  janela     bigint not null,
  tentativas integer not null default 0,
  expira_em  timestamptz not null,
  primary key (chave, janela)
);
alter table private.rate_limit enable row level security;

create or replace function public.checar_rate_limit(p_chave text, p_max integer, p_janela_seg integer)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_janela bigint;
  v_tentativas integer;
begin
  if p_chave is null or p_max < 1 or p_janela_seg < 1 then
    raise exception 'Parâmetros inválidos.';
  end if;
  v_janela := floor(extract(epoch from now()) / p_janela_seg);
  insert into private.rate_limit as r (chave, janela, tentativas, expira_em)
  values (left(p_chave, 200), v_janela, 1, now() + make_interval(secs => p_janela_seg * 2))
  on conflict (chave, janela) do update set tentativas = r.tentativas + 1
  returning r.tentativas into v_tentativas;

  if random() < 0.02 then
    delete from private.rate_limit where expira_em < now();
  end if;
  return v_tentativas <= p_max;
end;
$$;

revoke all on function public.checar_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.checar_rate_limit(text, integer, integer) to service_role;
