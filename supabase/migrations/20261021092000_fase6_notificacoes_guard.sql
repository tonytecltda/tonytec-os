-- Usuário só pode marcar a própria notificação como lida; título, mensagem e link não mudam.
create or replace function private.notificacoes_guard()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if private.is_privileged() then
    return new;
  end if;
  if new.profile_id is distinct from old.profile_id
     or new.titulo is distinct from old.titulo
     or new.mensagem is distinct from old.mensagem
     or new.link is distinct from old.link
     or new.created_at is distinct from old.created_at then
    raise exception 'Notificações só podem ser marcadas como lidas.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists notificacoes_10_guard on public.notificacoes;
create trigger notificacoes_10_guard before update on public.notificacoes
  for each row execute function private.notificacoes_guard();
