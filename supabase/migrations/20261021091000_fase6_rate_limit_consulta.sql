-- Consulta sem contar (usada no login: só as falhas contam para o bloqueio)
create or replace function public.rate_limit_bloqueado(p_chave text, p_max integer, p_janela_seg integer)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select r.tentativas >= p_max from private.rate_limit r
     where r.chave = left(p_chave, 200) and r.janela = floor(extract(epoch from now()) / p_janela_seg)),
    false)
$$;

revoke all on function public.rate_limit_bloqueado(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_bloqueado(text, integer, integer) to service_role;
