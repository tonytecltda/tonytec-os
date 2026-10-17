"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { registrarAuditoria } from "@/lib/auditoria";
import { contratoSchema } from "@/lib/validators";
import { dbErrorMessage, fail, nullIfEmpty, ok, zodFail, type ActionResult } from "@/lib/actions";

const idSchema = z.uuid();

export async function salvarContrato(
  id: string | null,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const atual = await requireAdmin();
  if (id && !idSchema.safeParse(id).success) return fail("Contrato inválido.");
  const parsed = contratoSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const d = parsed.data;

  // Valores de excedente só fazem sentido para a política escolhida.
  const registro = {
    cliente_id: d.cliente_id,
    numero: d.numero.trim().toUpperCase(),
    descricao: nullIfEmpty(d.descricao),
    tipo: d.tipo,
    data_inicio: d.data_inicio,
    data_fim: nullIfEmpty(d.data_fim),
    valor_mensal: d.valor_mensal,
    visitas_inclusas_mes: d.visitas_inclusas_mes,
    horas_inclusas_mes: d.horas_inclusas_mes,
    politica_visita_excedente: d.politica_visita_excedente,
    valor_visita_excedente: d.politica_visita_excedente === "valor_unico" ? d.valor_visita_excedente : null,
    valor_hora_excedente: d.politica_visita_excedente === "valor_hora" ? d.valor_hora_excedente : null,
    sla_resposta_horas: d.sla_resposta_horas,
    sla_solucao_horas: d.sla_solucao_horas,
    status: d.status,
    observacoes: nullIfEmpty(d.observacoes),
  };

  const supabase = await createClient();

  const { data: cliente } = await supabase
    .from("clientes")
    .select("ativo")
    .eq("id", d.cliente_id)
    .maybeSingle();
  if (!cliente) return fail("Cliente não encontrado.", { cliente_id: "Cliente não encontrado." });

  if (id) {
    const { data: antes } = await supabase.from("contratos").select("*").eq("id", id).maybeSingle();
    if (!antes) return fail("Contrato não encontrado.");
    if (!cliente.ativo && antes.cliente_id !== d.cliente_id) return fail("O cliente escolhido está inativo.");

    const { error } = await supabase.from("contratos").update(registro).eq("id", id);
    if (error) {
      const msg = dbErrorMessage(error);
      return fail(msg, msg.includes("número") ? { numero: msg } : undefined);
    }
    // Mudanças de status/valores do contrato afetam a cobrança: ficam na auditoria.
    const camposSensiveis = [
      "status",
      "valor_mensal",
      "visitas_inclusas_mes",
      "horas_inclusas_mes",
      "politica_visita_excedente",
      "valor_visita_excedente",
      "valor_hora_excedente",
      "data_inicio",
      "data_fim",
    ] as const;
    const mudou = camposSensiveis.filter((c) => String(antes[c] ?? "") !== String(registro[c] ?? ""));
    if (mudou.length) {
      await registrarAuditoria({
        tabela: "contratos",
        registroId: id,
        acao: "contrato_alterado",
        autorId: atual.id,
        antes: Object.fromEntries(mudou.map((c) => [c, antes[c]])),
        depois: Object.fromEntries(mudou.map((c) => [c, registro[c]])),
      });
    }
    revalidatePath("/admin/contratos");
    revalidatePath(`/admin/contratos/${id}`);
    revalidatePath(`/admin/clientes/${d.cliente_id}`);
    return ok({ id }, "Contrato atualizado.");
  }

  if (!cliente.ativo) return fail("O cliente escolhido está inativo.");
  const { data, error } = await supabase.from("contratos").insert(registro).select("id").single();
  if (error) {
    const msg = dbErrorMessage(error);
    return fail(msg, msg.includes("número") ? { numero: msg } : undefined);
  }
  await registrarAuditoria({
    tabela: "contratos",
    registroId: data.id,
    acao: "contrato_criado",
    autorId: atual.id,
    depois: registro,
  });
  revalidatePath("/admin/contratos");
  revalidatePath(`/admin/clientes/${d.cliente_id}`);
  return ok({ id: data.id }, "Contrato cadastrado.");
}
