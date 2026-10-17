-- =====================================================================
-- Tonytec OS — 009: ajustes para a Fase 1 (cadastros)
-- =====================================================================

-- Novas funções no schema private não ficam executáveis por PUBLIC.
alter default privileges in schema private revoke execute on functions from public;

-- ---------------------------------------------------------------------
-- Documento do cliente: CPF (11 dígitos) ou CNPJ (14 posições).
-- Desde jul/2026 o CNPJ pode ser alfanumérico: 12 caracteres [0-9A-Z] + 2 DV numéricos.
-- Guardado sem pontuação e em maiúsculas.
-- ---------------------------------------------------------------------
comment on column public.clientes.cnpj_cpf is
  'CPF (11 dígitos) ou CNPJ (12 alfanuméricos + 2 DV), sem pontuação, maiúsculo';

update public.clientes
   set cnpj_cpf = nullif(upper(regexp_replace(cnpj_cpf, '[^0-9A-Za-z]', '', 'g')), '')
 where cnpj_cpf is not null;

alter table public.clientes
  add constraint clientes_documento_formato
  check (cnpj_cpf is null or cnpj_cpf ~ '^([0-9]{11}|[0-9A-Z]{12}[0-9]{2})$');

alter table public.unidades
  add constraint unidades_uf_formato check (uf is null or uf ~ '^[A-Z]{2}$');

-- ---------------------------------------------------------------------
-- Contratos: número automático CT-AAAA-000001 quando não informado.
-- ---------------------------------------------------------------------
alter table public.contratos alter column numero set default '';

create or replace function private.contratos_numero()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  if coalesce(trim(new.numero), '') = '' then
    new.numero := private.proximo_numero('CT');
  else
    new.numero := upper(trim(new.numero));
  end if;
  return new;
end;
$$;

create trigger contratos_10_numero
  before insert or update of numero on public.contratos
  for each row execute function private.contratos_numero();

grant execute on function private.contratos_numero() to authenticated, service_role;

-- Índices para as listagens/filtros dos cadastros
create index if not exists contratos_data_fim_idx on public.contratos (data_fim) where status = 'ativo';
create index if not exists itens_catalogo_descricao_idx on public.itens_catalogo (descricao);
