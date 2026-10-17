-- =====================================================================
-- Tonytec OS — 014: técnico não conseguia registrar a saída da visita
-- Em triggers BEFORE, a coluna gerada valor_total ainda não foi recalculada no NEW,
-- então o guard via "alteração de cobrança". valor_total é derivada: fica fora da checagem.
-- =====================================================================

create or replace function private.os_visitas_before()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  if not private.is_privileged() then
    if tg_op = 'INSERT' then
      new.cobranca_tipo := null;
      new.valor_unitario := null;
      new.quantidade_horas := null;
      new.justificativa_isencao := null;
      new.faturado := false;
      new.faturado_em := null;
      new.observacoes_financeiras := null;
    elsif not private.somente_campos(to_jsonb(old), to_jsonb(new), array[
      'data_hora_chegada', 'data_hora_saida', 'deslocamento_km', 'observacoes',
      'horas_trabalhadas', 'valor_total', 'updated_at'
    ]) then
      raise exception 'Técnico não pode alterar dados de cobrança/faturamento da visita.'
        using errcode = '42501';
    end if;
  end if;

  -- Horas trabalhadas = saída - chegada, sempre que os horários mudarem.
  -- (Admin pode ajustar horas_trabalhadas sem alterar os horários.)
  if new.data_hora_saida is not null and (
       tg_op = 'INSERT'
       or new.data_hora_saida is distinct from old.data_hora_saida
       or new.data_hora_chegada is distinct from old.data_hora_chegada
       or not private.is_privileged()
     ) then
    new.horas_trabalhadas := round(
      (extract(epoch from (new.data_hora_saida - new.data_hora_chegada)) / 3600)::numeric, 2
    );
  elsif new.data_hora_saida is null and not private.is_privileged() then
    new.horas_trabalhadas := null;
  end if;

  if new.faturado and new.faturado_em is null then
    new.faturado_em := now();
  elsif not new.faturado then
    new.faturado_em := null;
  end if;

  return new;
end;
$$;
