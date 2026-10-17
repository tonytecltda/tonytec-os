"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrarAuditoria } from "@/lib/auditoria";
import { normalizarDocumento } from "@/lib/documentos";
import { mascaraCep } from "@/lib/masks";
import { clienteSchema, motivoSchema, unidadeSchema } from "@/lib/validators";
import { dbErrorMessage, fail, nullIfEmpty, ok, zodFail, type ActionResult } from "@/lib/actions";

const idSchema = z.uuid();

function revalidarCliente(id?: string) {
  revalidatePath("/admin/clientes");
  if (id) revalidatePath(`/admin/clientes/${id}`);
}

// ---------------------------------------------------------------- clientes
export async function salvarCliente(
  id: string | null,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  if (id && !idSchema.safeParse(id).success) return fail("Cliente inválido.");
  const parsed = clienteSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const d = parsed.data;

  const registro = {
    razao_social: d.razao_social,
    nome_fantasia: nullIfEmpty(d.nome_fantasia),
    cnpj_cpf: nullIfEmpty(normalizarDocumento(d.cnpj_cpf)),
    inscricao_estadual: nullIfEmpty(d.inscricao_estadual),
    email: nullIfEmpty(d.email)?.toLowerCase() ?? null,
    telefone: nullIfEmpty(d.telefone),
    observacoes: nullIfEmpty(d.observacoes),
  };

  const supabase = await createClient();
  const resultado = id
    ? await supabase.from("clientes").update(registro).eq("id", id).select("id").single()
    : await supabase.from("clientes").insert(registro).select("id").single();

  if (resultado.error) {
    const msg = dbErrorMessage(resultado.error);
    return fail(msg, msg.includes("CPF/CNPJ") ? { cnpj_cpf: msg } : undefined);
  }
  revalidarCliente(resultado.data.id);
  return ok({ id: resultado.data.id }, id ? "Cliente atualizado." : "Cliente cadastrado.");
}

/**
 * Desativa/reativa o cliente. Ao desativar, os usuários do portal desse cliente
 * também perdem o acesso (a reativação deles é individual).
 */
export async function definirAtivoCliente(id: string, ativo: boolean, motivo: string): Promise<ActionResult> {
  const atual = await requireAdmin();
  if (!idSchema.safeParse(id).success) return fail("Cliente inválido.");
  if (!ativo) {
    const m = motivoSchema.safeParse(motivo);
    if (!m.success) return zodFail(m.error);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("clientes").update({ ativo }).eq("id", id);
  if (error) return fail(dbErrorMessage(error));

  let usuariosDesativados = 0;
  if (!ativo) {
    const sa = createAdminClient();
    const { data: usuarios } = await sa.from("profiles").select("id").eq("cliente_id", id).eq("ativo", true);
    for (const u of usuarios ?? []) {
      await sa.auth.admin.updateUserById(u.id, { ban_duration: "876000h" });
      await sa.from("profiles").update({ ativo: false }).eq("id", u.id);
      usuariosDesativados++;
    }
  }

  await registrarAuditoria({
    tabela: "clientes",
    registroId: id,
    acao: ativo ? "cliente_reativado" : "cliente_desativado",
    autorId: atual.id,
    motivo: ativo ? null : motivo,
    depois: { ativo, usuarios_desativados: usuariosDesativados },
  });
  revalidarCliente(id);
  return ok(
    undefined,
    ativo
      ? "Cliente reativado. Reative os usuários do portal que devem voltar a acessar."
      : `Cliente desativado${usuariosDesativados ? ` (${usuariosDesativados} usuário(s) do portal sem acesso)` : ""}.`,
  );
}

// ---------------------------------------------------------------- unidades
export async function salvarUnidade(
  clienteId: string,
  unidadeId: string | null,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  if (!idSchema.safeParse(clienteId).success || (unidadeId && !idSchema.safeParse(unidadeId).success)) {
    return fail("Registro inválido.");
  }
  const parsed = unidadeSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const d = parsed.data;

  const registro = {
    nome: d.nome,
    cep: nullIfEmpty(mascaraCep(d.cep)),
    logradouro: nullIfEmpty(d.logradouro),
    numero: nullIfEmpty(d.numero),
    complemento: nullIfEmpty(d.complemento),
    bairro: nullIfEmpty(d.bairro),
    cidade: nullIfEmpty(d.cidade),
    uf: nullIfEmpty(d.uf.toUpperCase()),
    contato_local: nullIfEmpty(d.contato_local),
    telefone_local: nullIfEmpty(d.telefone_local),
    referencia: nullIfEmpty(d.referencia),
  };

  const supabase = await createClient();
  const resultado = unidadeId
    ? await supabase
        .from("unidades")
        .update(registro)
        .eq("id", unidadeId)
        .eq("cliente_id", clienteId)
        .select("id")
        .single()
    : await supabase
        .from("unidades")
        .insert({ ...registro, cliente_id: clienteId })
        .select("id")
        .single();

  if (resultado.error) return fail(dbErrorMessage(resultado.error));
  revalidarCliente(clienteId);
  return ok({ id: resultado.data.id }, unidadeId ? "Unidade atualizada." : "Unidade cadastrada.");
}

export async function definirAtivoUnidade(unidadeId: string, ativo: boolean): Promise<ActionResult> {
  const atual = await requireAdmin();
  if (!idSchema.safeParse(unidadeId).success) return fail("Unidade inválida.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("unidades")
    .update({ ativo })
    .eq("id", unidadeId)
    .select("cliente_id, nome")
    .single();
  if (error) return fail(dbErrorMessage(error));

  await registrarAuditoria({
    tabela: "unidades",
    registroId: unidadeId,
    acao: ativo ? "unidade_reativada" : "unidade_desativada",
    autorId: atual.id,
    depois: { ativo, nome: data.nome },
  });
  revalidarCliente(data.cliente_id);
  return ok(undefined, ativo ? "Unidade reativada." : "Unidade desativada.");
}
