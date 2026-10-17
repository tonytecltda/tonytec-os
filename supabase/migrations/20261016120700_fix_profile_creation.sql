-- =====================================================================
-- Tonytec OS — 008: criação do profile quando a role estiver disponível
-- O serviço de Auth insere o usuário SEM o app_metadata customizado e só depois
-- faz um UPDATE com role/cliente_id. Então o profile é criado no primeiro
-- momento em que a role existir (INSERT ou UPDATE de raw_app_meta_data).
-- Usuário sem role não recebe profile e, portanto, não acessa nada.
-- =====================================================================

create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_role text := new.raw_app_meta_data ->> 'role';
begin
  if v_role is null or v_role not in ('admin', 'tecnico', 'cliente') then
    return new;
  end if;

  insert into public.profiles (id, email, nome, telefone, role, cliente_id)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'nome', ''), split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data ->> 'telefone',
    v_role::public.user_role,
    nullif(new.raw_app_meta_data ->> 'cliente_id', '')::uuid
  )
  on conflict (id) do nothing;   -- profile já existe: a fonte da verdade é public.profiles
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of raw_app_meta_data on auth.users
  for each row
  when (new.raw_app_meta_data ->> 'role' is not null)
  execute function private.handle_new_user();
