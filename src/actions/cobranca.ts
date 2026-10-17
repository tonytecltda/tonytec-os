"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrarAuditoria } from "@/lib/auditoria";
import { calcularCobrancaVisita, calcularCobrancasPendentes, configCobranca } from "@/lib/cobranca-server";
import { mesValido } from "@/lib/export";
import { cobrancaVisitaSchema } from "@/lib/validators";
import { dbErrorMessage, fail, nullIfEmpty, ok, zodFail, type ActionResult } from "@/lib/actions";

const idSchema = z.uuid();

function revalidarCobranca() {
  revalidatePath("/admin/cobranca");
  revalidatePath("/admin/cobranca/fechamento");
  revalidatePath("/admin");
}

/**
 * Ajuste manual da cobrança de uma visita (só admin). Depois da OS assinada,
 * o banco registra cada alteração na auditoria (antes e depois).
 */
export async function salvarCobrancaVisita(visitaId: string, input: unknown): Promise<ActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(visitaId).success) return fail("Visita inválida.");
  const parsed = cobrancaVisitaSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const d = parsed.data;

  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("os_visitas")
    .select("faturado")
    .eq("id", visitaId)
    .maybeSingle();
  if (!atual) return fail("Visita não encontrada.");
  if (atual.faturado) return fail("Esta visita já foi faturada. Desfaça o faturamento antes de alterar.");

  const semValor =
    d.cobranca_tipo === "isento_contrato" || d.cobranca_tipo === "garantia" || d.cobranca_tipo === "cortesia";
  const { error } = await supabase
    .from("os_visitas")
    .update({
      cobranca_tipo: d.cobranca_tipo,
      valor_unitario: semValor ? 0 : d.valor_unitario,
      quantidade_horas: d.cobranca_tipo === "valor_unico" ? null : d.quantidade_horas,
      justificativa_isencao: nullIfEmpty(d.justificativa_isencao),
      observacoes_financeiras: nullIfEmpty(d.observacoes_financeiras),
      cobranca_manual: true,
    })
    .eq("id", visitaId);
  if (error) return fail(dbErrorMessage(error));
  revalidarCobranca();
  return ok(undefined, "Cobrança da visita atualizada.");
}

/** Volta para a sugestão automática do contrato (descarta o ajuste manual). */
export async function recalcularCobrancaVisita(visitaId: string): Promise<ActionResult> {
  const atual = await requireAdmin();
  if (!idSchema.safeParse(visitaId).success) return fail("Visita inválida.");
  const sa = createAdminClient();
  const { data: v } = await sa
    .from("os_visitas")
    .select(
      "id, os_id, data_hora_chegada, horas_trabalhadas, faturado, cobranca_manual, ordens_servico(cliente_id, finalizada_em)",
    )
    .eq("id", visitaId)
    .maybeSingle();
  if (!v?.ordens_servico) return fail("Visita não encontrada.");
  if (v.faturado) return fail("Esta visita já foi faturada. Desfaça o faturamento antes de recalcular.");
  const r = await calcularCobrancaVisita(
    { ...v, horas_trabalhadas: v.horas_trabalhadas == null ? null : Number(v.horas_trabalhadas) },
    v.ordens_servico.cliente_id,
    await configCobranca(),
    { forcar: true },
  );
  await registrarAuditoria({
    tabela: "os_visitas",
    registroId: visitaId,
    acao: "cobranca_recalculada",
    autorId: atual.id,
    depois: r.sugestao,
  });
  revalidarCobranca();
  return ok(undefined, r.sugestao ? `Sugestão aplicada: ${r.sugestao.motivo}` : "Nada a recalcular.");
}

/** Calcula as visitas de OS encerradas que ainda estão sem cobrança. */
export async function calcularPendentes(): Promise<ActionResult<{ quantidade: number }>> {
  await requireAdmin();
  const quantidade = await calcularCobrancasPendentes();
  revalidarCobranca();
  return ok(
    { quantidade },
    quantidade ? `${quantidade} visita(s) calculada(s).` : "Nenhuma visita pendente de cálculo.",
  );
}

/** Marca visitas como faturadas (ou desfaz), em lote. Visitas sem cobrança calculada ficam de fora. */
export async function definirFaturamento(
  ids: string[],
  faturado: boolean,
): Promise<ActionResult<{ alteradas: number }>> {
  const atual = await requireAdmin();
  const lista = [...new Set(ids)].filter((i) => idSchema.safeParse(i).success);
  if (!lista.length) return fail("Selecione ao menos uma visita.");
  if (lista.length > 500) return fail("Selecione no máximo 500 visitas por vez.");

  const supabase = await createClient();
  let q = supabase.from("os_visitas").update({ faturado }).in("id", lista).eq("faturado", !faturado);
  if (faturado) q = q.not("cobranca_tipo", "is", null);
  const { data, error } = await q.select("id");
  if (error) return fail(dbErrorMessage(error));
  const alteradas = data?.length ?? 0;
  if (!alteradas) {
    return fail(
      faturado
        ? "Nenhuma visita elegível (precisam ter a cobrança calculada)."
        : "Nenhuma visita faturada na seleção.",
    );
  }
  await registrarAuditoria({
    tabela: "os_visitas",
    registroId: null,
    acao: faturado ? "faturamento_lote" : "faturamento_desfeito_lote",
    autorId: atual.id,
    depois: { quantidade: alteradas, ids: data!.map((d) => d.id) },
  });
  revalidarCobranca();
  const ignoradas = lista.length - alteradas;
  return ok(
    { alteradas },
    `${alteradas} visita(s) ${faturado ? "marcada(s) como faturada(s)" : "voltaram para “a faturar”"}${ignoradas ? ` (${ignoradas} ignorada(s))` : ""}.`,
  );
}

/** Fecha o mês de um cliente: marca como faturadas as visitas do mês e os itens cobrados das OS do mês. */
export async function faturarFechamento(
  clienteId: string,
  mes: string,
  faturado: boolean,
): Promise<ActionResult> {
  const atual = await requireAdmin();
  if (!idSchema.safeParse(clienteId).success || !mesValido(mes)) return fail("Dados inválidos.");
  const supabase = await createClient();
  const [a, m] = mes.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const prox = m === 12 ? { a: a + 1, m: 1 } : { a, m: m + 1 };
  const inicio = `${a}-${pad(m)}-01T00:00:00-03:00`;
  const fim = `${prox.a}-${pad(prox.m)}-01T00:00:00-03:00`;

  // Só visitas de OS encerradas do cliente, com cobrança calculada.
  const { data: visitas } = await supabase
    .from("os_visitas")
    .select("id, cobranca_tipo, ordens_servico!inner(cliente_id, finalizada_em)")
    .eq("ordens_servico.cliente_id", clienteId)
    .not("ordens_servico.finalizada_em", "is", null)
    .gte("data_hora_chegada", inicio)
    .lt("data_hora_chegada", fim)
    .eq("faturado", !faturado);
  const ids = (visitas ?? []).filter((v) => !faturado || v.cobranca_tipo).map((v) => v.id);
  if (faturado && (visitas ?? []).some((v) => !v.cobranca_tipo)) {
    return fail("Há visitas sem cobrança calculada neste mês. Calcule-as antes de faturar.");
  }

  let visitasAlteradas = 0;
  if (ids.length) {
    const { data, error } = await supabase.from("os_visitas").update({ faturado }).in("id", ids).select("id");
    if (error) return fail(dbErrorMessage(error));
    visitasAlteradas = data?.length ?? 0;
  }
  const { data: ordens, error: osErro } = await supabase
    .from("ordens_servico")
    .update({ itens_faturado_em: faturado ? new Date().toISOString() : null })
    .eq("cliente_id", clienteId)
    .not("finalizada_em", "is", null)
    .gte("finalizada_em", inicio)
    .lt("finalizada_em", fim)
    .select("id");
  if (osErro) return fail(dbErrorMessage(osErro));

  await registrarAuditoria({
    tabela: "clientes",
    registroId: clienteId,
    acao: faturado ? "fechamento_faturado" : "fechamento_desfeito",
    autorId: atual.id,
    depois: { mes, visitas: visitasAlteradas, os_com_itens: ordens?.length ?? 0 },
  });
  revalidarCobranca();
  return ok(undefined, faturado ? "Mês marcado como faturado." : "Faturamento do mês desfeito.");
}
