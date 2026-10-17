"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Database } from "@/types/database";
import { getCurrentProfile, requireAdmin, requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrarAuditoria } from "@/lib/auditoria";
import { ANEXO_MAX_BYTES, ANEXO_TIPOS, nomeSeguro } from "@/lib/anexos";
import { novoHorario } from "@/lib/agenda";
import { paraInputDataHora } from "@/lib/format";
import { CHAMADO_STATUS } from "@/lib/labels";
import {
  chamadoAdminSchema,
  chamadoPortalSchema,
  comentarioSchema,
  gestaoChamadoSchema,
} from "@/lib/validators";
import { dbErrorMessage, fail, nullIfEmpty, ok, zodFail, type ActionResult } from "@/lib/actions";

type StatusChamado = Database["public"]["Enums"]["chamado_status"];

const BUCKET = "chamado-anexos";
const idSchema = z.uuid();

/** Status que o técnico pode definir pelo app (o encerramento vem pela OS, na Fase 3). */
const STATUS_TECNICO: StatusChamado[] = ["em_atendimento", "aguardando_cliente", "aguardando_peca"];

/** "2026-10-20T14:30" (input datetime-local, horário de Brasília) -> ISO com fuso. */
function localParaIso(valor: string): string | null {
  if (!valor) return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor)) return `${valor}:00-03:00`;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function revalidarChamado(id?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/chamados");
  revalidatePath("/portal");
  revalidatePath("/portal/chamados");
  revalidatePath("/tecnico");
  if (id) {
    revalidatePath(`/admin/chamados/${id}`);
    revalidatePath(`/portal/chamados/${id}`);
    revalidatePath(`/tecnico/chamados/${id}`);
  }
}

// ---------------------------------------------------------------- abertura
export async function abrirChamadoPortal(
  input: unknown,
): Promise<ActionResult<{ id: string; protocolo: string }>> {
  const perfil = await requireRole("cliente");
  const parsed = chamadoPortalSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const d = parsed.data;

  const supabase = await createClient();
  const { data: unidade } = await supabase
    .from("unidades")
    .select("ativo")
    .eq("id", d.unidade_id)
    .maybeSingle();
  if (!unidade?.ativo) return fail("Selecione uma unidade válida.", { unidade_id: "Unidade inválida." });

  // cliente_id, status, origem e técnico são forçados pelo trigger do banco.
  const { data, error } = await supabase
    .from("chamados")
    .insert({
      cliente_id: perfil.cliente_id!,
      unidade_id: d.unidade_id,
      categoria_id: d.categoria_id,
      tipo_problema_id: nullIfEmpty(d.tipo_problema_id),
      titulo: d.titulo,
      descricao: d.descricao,
      prioridade: d.prioridade,
      telefone_contato: nullIfEmpty(d.telefone_contato),
      origem: "portal",
    })
    .select("id, protocolo")
    .single();
  if (error) return fail(dbErrorMessage(error, "Não foi possível abrir o chamado."));

  revalidarChamado(data.id);
  return ok(data, `Chamado ${data.protocolo} aberto.`);
}

export async function criarChamadoAdmin(
  input: unknown,
): Promise<ActionResult<{ id: string; protocolo: string }>> {
  await requireAdmin();
  const parsed = chamadoAdminSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const d = parsed.data;
  const dataAgendada = localParaIso(d.data_agendada);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chamados")
    .insert({
      cliente_id: d.cliente_id,
      unidade_id: nullIfEmpty(d.unidade_id),
      categoria_id: d.categoria_id,
      tipo_problema_id: nullIfEmpty(d.tipo_problema_id),
      titulo: d.titulo,
      descricao: nullIfEmpty(d.descricao),
      prioridade: d.prioridade,
      telefone_contato: nullIfEmpty(d.telefone_contato),
      origem: d.origem,
      tecnico_id: nullIfEmpty(d.tecnico_id),
      data_agendada: dataAgendada,
      status: dataAgendada ? "agendado" : "aberto",
    })
    .select("id, protocolo")
    .single();
  if (error) return fail(dbErrorMessage(error, "Não foi possível abrir o chamado."));

  revalidarChamado(data.id);
  return ok(data, `Chamado ${data.protocolo} aberto.`);
}

/** Unidades ativas de um cliente (formulário de chamado do admin). */
export async function listarUnidadesCliente(clienteId: string): Promise<{ id: string; nome: string }[]> {
  await requireAdmin();
  if (!idSchema.safeParse(clienteId).success) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("unidades")
    .select("id, nome")
    .eq("cliente_id", clienteId)
    .eq("ativo", true)
    .order("nome");
  return data ?? [];
}

// ---------------------------------------------------------------- gestão
export async function atualizarChamado(id: string, input: unknown): Promise<ActionResult> {
  const atual = await requireAdmin();
  if (!idSchema.safeParse(id).success) return fail("Chamado inválido.");
  const parsed = gestaoChamadoSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const d = parsed.data;

  const supabase = await createClient();
  const { data: antes } = await supabase
    .from("chamados")
    .select("status, prioridade, tecnico_id, data_agendada")
    .eq("id", id)
    .maybeSingle();
  if (!antes) return fail("Chamado não encontrado.");

  const cancelando = d.status === "cancelado" && antes.status !== "cancelado";
  if (cancelando && d.motivo.length < 5) {
    return fail("Informe o motivo do cancelamento.", { motivo: "Mínimo 5 caracteres." });
  }

  const dataAgendada = localParaIso(d.data_agendada);
  let status = d.status;
  // Agendou agora um chamado ainda não triado/agendado: passa para "Agendado".
  if (dataAgendada && !antes.data_agendada && (status === "aberto" || status === "triagem"))
    status = "agendado";

  const { error } = await supabase
    .from("chamados")
    .update({
      status,
      prioridade: d.prioridade,
      tecnico_id: nullIfEmpty(d.tecnico_id),
      data_agendada: dataAgendada,
    })
    .eq("id", id);
  if (error) return fail(dbErrorMessage(error));

  if (cancelando) {
    await supabase.from("chamado_comentarios").insert({
      chamado_id: id,
      autor_id: atual.id,
      mensagem: `Chamado cancelado. Motivo: ${d.motivo}`,
      interno: true,
    });
    await registrarAuditoria({
      tabela: "chamados",
      registroId: id,
      acao: "chamado_cancelado",
      autorId: atual.id,
      motivo: d.motivo,
      antes: { status: antes.status },
    });
  }

  revalidarChamado(id);
  return ok(
    undefined,
    status !== d.status ? `Salvo. Status alterado para “${CHAMADO_STATUS[status]}”.` : "Chamado atualizado.",
  );
}

/**
 * Reagenda a visita (agenda dos técnicos: arrastar para outro dia ou escolher o horário).
 * `dia` mantém a hora atual (ou 09:00); `horario` é um datetime-local de Brasília.
 */
export async function reagendarChamado(
  id: string,
  destino: { dia?: string; horario?: string },
): Promise<ActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return fail("Chamado inválido.");
  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("chamados")
    .select("status, data_agendada")
    .eq("id", id)
    .maybeSingle();
  if (!atual) return fail("Chamado não encontrado.");
  if (atual.status === "resolvido" || atual.status === "cancelado") {
    return fail("Chamado encerrado não pode ser reagendado.");
  }

  let horario = destino.horario ?? "";
  if (!horario && destino.dia) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(destino.dia)) return fail("Data inválida.");
    const local = atual.data_agendada ? paraInputDataHora(atual.data_agendada) : null;
    horario = novoHorario(destino.dia, local);
  }
  const iso = localParaIso(horario);
  if (!iso) return fail("Data e hora inválidas.");

  const { error } = await supabase
    .from("chamados")
    .update({
      data_agendada: iso,
      ...(atual.status === "aberto" || atual.status === "triagem" ? { status: "agendado" as const } : {}),
    })
    .eq("id", id);
  if (error) return fail(dbErrorMessage(error));
  revalidatePath("/admin/agenda");
  revalidarChamado(id);
  return ok(undefined, "Visita reagendada.");
}

/** Mudança rápida de status (Kanban do admin e botões do técnico). */
export async function moverStatusChamado(id: string, status: StatusChamado): Promise<ActionResult> {
  const perfil = await getCurrentProfile();
  if (!perfil || perfil.role === "cliente") return fail("Sem permissão.");
  if (!idSchema.safeParse(id).success || !(status in CHAMADO_STATUS)) return fail("Dados inválidos.");
  if (status === "cancelado") return fail("Para cancelar, abra o chamado e informe o motivo.");
  if (perfil.role === "tecnico" && !STATUS_TECNICO.includes(status)) {
    return fail("Este status é definido pela Tonytec ou pelo encerramento da OS.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("chamados").update({ status }).eq("id", id).select("id");
  if (error) return fail(dbErrorMessage(error));
  if (!data?.length) return fail("Chamado não encontrado.");

  revalidarChamado(id);
  return ok(undefined, `Status: ${CHAMADO_STATUS[status]}.`);
}

// ---------------------------------------------------------------- comentários
export async function comentarChamado(chamadoId: string, input: unknown): Promise<ActionResult> {
  const perfil = await getCurrentProfile();
  if (!perfil) return fail("Sessão expirada. Entre novamente.");
  if (!idSchema.safeParse(chamadoId).success) return fail("Chamado inválido.");
  const parsed = comentarioSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from("chamado_comentarios").insert({
    chamado_id: chamadoId,
    autor_id: perfil.id,
    mensagem: parsed.data.mensagem,
    // Cliente nunca grava nota interna (o banco também garante).
    interno: perfil.role === "cliente" ? false : parsed.data.interno,
  });
  if (error) return fail(dbErrorMessage(error, "Não foi possível enviar a mensagem."));

  revalidarChamado(chamadoId);
  return ok(
    undefined,
    parsed.data.interno && perfil.role !== "cliente" ? "Nota interna registrada." : "Mensagem enviada.",
  );
}

// ---------------------------------------------------------------- anexos
const arquivoSchema = z.object({
  nome: z.string().trim().min(1).max(200),
  tipo: z.string().refine((t) => !!ANEXO_TIPOS[t], "Tipo de arquivo não permitido."),
  tamanho: z.number().int().positive().max(ANEXO_MAX_BYTES, "Arquivo maior que 20 MB."),
});

/** Chamado visível para o usuário (a RLS decide) + checagens de estado. */
async function chamadoParaAnexo(chamadoId: string) {
  const perfil = await getCurrentProfile();
  if (!perfil) return { erro: "Sessão expirada. Entre novamente." } as const;
  if (!idSchema.safeParse(chamadoId).success) return { erro: "Chamado inválido." } as const;
  const supabase = await createClient();
  const { data: chamado } = await supabase
    .from("chamados")
    .select("id, cliente_id, status")
    .eq("id", chamadoId)
    .maybeSingle();
  if (!chamado) return { erro: "Chamado não encontrado." } as const;
  if (perfil.role === "cliente" && (chamado.status === "resolvido" || chamado.status === "cancelado")) {
    return { erro: "Este chamado já foi encerrado." } as const;
  }
  return { perfil, chamado, supabase } as const;
}

/**
 * Gera uma URL assinada de upload (o arquivo vai direto do navegador ao Storage,
 * sem passar pelo limite de 4,5 MB das funções da Vercel).
 */
export async function prepararUploadAnexo(
  chamadoId: string,
  arquivo: unknown,
): Promise<ActionResult<{ path: string; token: string }>> {
  const ctx = await chamadoParaAnexo(chamadoId);
  if ("erro" in ctx) return fail(ctx.erro!);
  const parsed = arquivoSchema.safeParse(arquivo);
  if (!parsed.success) return zodFail(parsed.error);

  const { count } = await ctx.supabase
    .from("chamado_anexos")
    .select("id", { count: "exact", head: true })
    .eq("chamado_id", chamadoId);
  if ((count ?? 0) >= 20) return fail("Limite de 20 anexos por chamado atingido.");

  const path = `${ctx.chamado.cliente_id}/${ctx.chamado.id}/${crypto.randomUUID()}-${nomeSeguro(parsed.data.nome)}`;
  const { data, error } = await createAdminClient().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("[anexos] signed upload", error);
    return fail("Não foi possível preparar o envio do arquivo.");
  }
  return ok({ path: data.path, token: data.token });
}

/** Registra o anexo depois que o upload terminou (confere caminho e existência do arquivo). */
export async function registrarAnexo(chamadoId: string, input: unknown): Promise<ActionResult> {
  const ctx = await chamadoParaAnexo(chamadoId);
  if ("erro" in ctx) return fail(ctx.erro!);
  const parsed = arquivoSchema.extend({ path: z.string().min(10).max(400) }).safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const d = parsed.data;

  if (!d.path.startsWith(`${ctx.chamado.cliente_id}/${ctx.chamado.id}/`) || d.path.includes("..")) {
    return fail("Caminho de arquivo inválido.");
  }
  const { data: existe } = await createAdminClient().storage.from(BUCKET).exists(d.path);
  if (!existe) return fail("O arquivo não chegou ao servidor. Tente enviar de novo.");

  const { error } = await ctx.supabase.from("chamado_anexos").insert({
    chamado_id: chamadoId,
    storage_path: d.path,
    nome_arquivo: d.nome,
    mime_type: d.tipo,
    tamanho_bytes: d.tamanho,
    enviado_por: ctx.perfil.id,
  });
  if (error) return fail(dbErrorMessage(error, "Não foi possível registrar o anexo."));

  revalidarChamado(chamadoId);
  return ok(undefined, "Anexo enviado.");
}
