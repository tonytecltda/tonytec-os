-- =====================================================================
-- Tonytec OS — 007: correção na criação de usuários
-- Atualizar auth.users DENTRO do INSERT feito pelo serviço de Auth quebra a
-- criação ("Database error creating new user"). Na criação o app_metadata já
-- traz role/cliente_id, então o espelhamento só precisa rodar em UPDATEs.
-- =====================================================================

drop table if exists private.debug_log;

create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, nome, telefone, role, cliente_id)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data ->> 'telefone',
    coalesce((new.raw_app_meta_data ->> 'role')::public.user_role, 'cliente'),
    nullif(new.raw_app_meta_data ->> 'cliente_id', '')::uuid
  );
  return new;
end;
$$;

drop trigger if exists profiles_sync_claims on public.profiles;
create trigger profiles_sync_claims
  after update of role, cliente_id, ativo on public.profiles
  for each row
  when (old.role is distinct from new.role
        or old.cliente_id is distinct from new.cliente_id
        or old.ativo is distinct from new.ativo)
  execute function private.sync_profile_claims();
