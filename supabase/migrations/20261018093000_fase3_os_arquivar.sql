-- =====================================================================
-- Tonytec OS — 013: arquivar (exclusão lógica) OS encerrada
-- Arquivar não altera o conteúdo assinado: admin/servidor pode mudar `ativo`
-- de uma OS encerrada. O restante continua imutável (regra 4).
-- =====================================================================

create or replace function private.os_guard()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare
  v_reabrindo boolean := coalesce(current_setting('app.reabrir_os', true), '') = 'on';
begin
  if new.numero is distinct from old.numero or new.created_at is distinct from old.created_at then
    raise exception 'Número e data de criação da OS não podem ser alterados.' using errcode = '42501';
  end if;

  -- Regra 4: OS encerrada é imutável. Só reabrir_os() destrava.
  if old.finalizada_em is not null then
    if v_reabrindo and private.is_privileged() then
      return new;
    end if;
    -- Depois de encerrar, o servidor só grava o PDF final e o admin pode arquivar.
    if private.somente_campos(to_jsonb(old), to_jsonb(new), array['pdf_path', 'ativo', 'updated_at'])
       and private.is_privileged() then
      return new;
    end if;
    raise exception 'OS encerrada não pode ser alterada. Reabra a OS (somente administrador) informando o motivo.'
      using errcode = '42501';
  end if;

  if private.is_privileged() then
    return new;
  end if;

  if private.user_role() = 'tecnico' then
    if old.status = 'aguardando_assinatura' then
      raise exception 'A OS está aguardando assinatura. Use “Voltar para edição” para alterar (as assinaturas coletadas serão descartadas).'
        using errcode = '42501';
    end if;
    if not private.somente_campos(to_jsonb(old), to_jsonb(new), array[
      'status', 'tipo_atendimento', 'problema_relatado', 'diagnostico', 'servico_executado',
      'observacoes_tecnicas', 'recomendacoes', 'data_inicio', 'data_fim',
      'pendencias', 'pendencias_texto', 'updated_at'
    ]) then
      raise exception 'Técnico não pode alterar cliente, responsável ou dados de assinatura da OS.'
        using errcode = '42501';
    end if;
    if new.status not in ('rascunho', 'em_execucao', 'aguardando_assinatura') then
      raise exception 'Status "%" é definido pelo sistema/administrador.', new.status using errcode = '42501';
    end if;
    return new;
  end if;

  raise exception 'Sem permissão.' using errcode = '42501';
end;
$$;
