"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { gerarLinkDefinicaoSenha } from "@/lib/acesso";
import { registrarAuditoria } from "@/lib/auditoria";
import { motivoSchema, novoUsuarioSchema, usuarioSchema } from "@/lib/validators";
import { dbErrorMessage, fail, nullIfEmpty, ok, zodFail, type ActionResult } from "@/lib/actions";
import type { LinkAcesso } from "@/components/access-link-dialog";

/** Banimento "permanente" no Auth (~100 anos) = usuário desativado. */
const BAN_PERMANENTE = "876000h";
const idSchema = z.uuid("Usuário inválido.");

function revalidarUsuarios(clienteId?: string | null) {
  revalidatePath("/admin/tecnicos");
  revalidatePath("/admin/configuracoes");
  if (clienteId) revalidatePath(`/admin/clientes/${clienteId}`);
}

const emailDuplicado = (msg?: string, code?: string) =>
  code === "email_exists" || /already|registered|exists/i.test(msg ?? "");

export async function criarUsuario(input: unknown): Promise<ActionResult<LinkAcesso & { id: string }>> {
  const atual = await requireAdmin();
  const parsed = novoUsuarioSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const d = parsed.data;
  const clienteId = d.role === "cliente" ? d.cliente_id : null;
  if (d.role === "cliente" && !clienteId) return fail("Selecione o cliente do usuário.");

  const sa = createAdminClient();
  if (clienteId) {
    const { data: cliente } = await sa.from("clientes").select("ativo").eq("id", clienteId).maybeSingle();
    if (!cliente?.ativo) return fail("Cliente não encontrado ou inativo.");
  }

  const telefone = nullIfEmpty(d.telefone);
  const { data: criado, error } = await sa.auth.admin.createUser({
    email: d.email,
    email_confirm: true,
    app_metadata: { role: d.role, cliente_id: clienteId },
    user_metadata: { nome: d.nome, telefone },
  });
  if (error || !criado.user) {
    if (emailDuplicado(error?.message, error?.code)) {
      return fail("Já existe um usuário com este e-mail.", { email: "E-mail já cadastrado." });
    }
    console.error("[usuarios] createUser", error);
    return fail("Não foi possível criar o usuário.");
  }

  const id = criado.user.id;
  const { error: perfilErro } = await sa.from("profiles").upsert({
    id,
    email: d.email,
    nome: d.nome,
    telefone,
    role: d.role,
    cliente_id: clienteId,
    ativo: true,
  });
  if (perfilErro) {
    await sa.auth.admin.deleteUser(id);
    return fail(dbErrorMessage(perfilErro));
  }

  let link: string;
  try {
    link = await gerarLinkDefinicaoSenha(d.email);
  } catch {
    revalidarUsuarios(clienteId);
    return fail("Usuário criado, mas não foi possível gerar o link. Use “Gerar link de acesso”.");
  }

  await registrarAuditoria({
    tabela: "profiles",
    registroId: id,
    acao: "usuario_criado",
    autorId: atual.id,
    depois: { email: d.email, role: d.role, cliente_id: clienteId },
  });
  revalidarUsuarios(clienteId);
  return ok({ id, link, nome: d.nome, email: d.email, telefone }, "Usuário criado.");
}

export async function atualizarUsuario(id: string, input: unknown): Promise<ActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return fail("Usuário inválido.");
  const parsed = usuarioSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const d = parsed.data;

  const sa = createAdminClient();
  const { data: perfil } = await sa.from("profiles").select("email, cliente_id").eq("id", id).maybeSingle();
  if (!perfil) return fail("Usuário não encontrado.");

  if (perfil.email !== d.email) {
    const { error } = await sa.auth.admin.updateUserById(id, { email: d.email, email_confirm: true });
    if (error) {
      return emailDuplicado(error.message, error.code)
        ? fail("Já existe um usuário com este e-mail.", { email: "E-mail já cadastrado." })
        : fail("Não foi possível alterar o e-mail.");
    }
  }

  const { error } = await sa
    .from("profiles")
    .update({ nome: d.nome, email: d.email, telefone: nullIfEmpty(d.telefone) })
    .eq("id", id);
  if (error) return fail(dbErrorMessage(error));

  revalidarUsuarios(perfil.cliente_id);
  return ok(undefined, "Usuário atualizado.");
}

export async function definirAtivoUsuario(id: string, ativo: boolean, motivo: string): Promise<ActionResult> {
  const atual = await requireAdmin();
  if (!idSchema.safeParse(id).success) return fail("Usuário inválido.");
  if (!ativo) {
    if (id === atual.id) return fail("Você não pode desativar o seu próprio usuário.");
    const m = motivoSchema.safeParse(motivo);
    if (!m.success) return zodFail(m.error);
  }

  const sa = createAdminClient();
  const { data: alvo } = await sa
    .from("profiles")
    .select("role, cliente_id, email, ativo")
    .eq("id", id)
    .maybeSingle();
  if (!alvo) return fail("Usuário não encontrado.");

  if (!ativo && alvo.role === "admin") {
    const { count } = await sa
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("ativo", true);
    if ((count ?? 0) <= 1) return fail("É preciso manter ao menos um administrador ativo.");
  }

  if (ativo && alvo.cliente_id) {
    const { data: cliente } = await sa
      .from("clientes")
      .select("ativo")
      .eq("id", alvo.cliente_id)
      .maybeSingle();
    if (!cliente?.ativo) return fail("O cliente deste usuário está inativo. Reative o cliente primeiro.");
  }

  const { error: banErro } = await sa.auth.admin.updateUserById(id, {
    ban_duration: ativo ? "none" : BAN_PERMANENTE,
  });
  if (banErro) {
    console.error("[usuarios] ban", banErro);
    return fail("Não foi possível alterar o acesso do usuário.");
  }
  const { error } = await sa.from("profiles").update({ ativo }).eq("id", id);
  if (error) return fail(dbErrorMessage(error));

  await registrarAuditoria({
    tabela: "profiles",
    registroId: id,
    acao: ativo ? "usuario_reativado" : "usuario_desativado",
    autorId: atual.id,
    motivo: ativo ? null : motivo,
    antes: { ativo: alvo.ativo },
    depois: { ativo },
  });
  revalidarUsuarios(alvo.cliente_id);
  return ok(undefined, ativo ? "Usuário reativado." : "Usuário desativado.");
}

export async function gerarLinkAcesso(id: string): Promise<ActionResult<LinkAcesso>> {
  const atual = await requireAdmin();
  if (!idSchema.safeParse(id).success) return fail("Usuário inválido.");
  const sa = createAdminClient();
  const { data: alvo } = await sa
    .from("profiles")
    .select("email, nome, telefone, ativo")
    .eq("id", id)
    .maybeSingle();
  if (!alvo) return fail("Usuário não encontrado.");
  if (!alvo.ativo) return fail("Usuário inativo. Reative antes de gerar o link.");

  try {
    const link = await gerarLinkDefinicaoSenha(alvo.email);
    await registrarAuditoria({
      tabela: "profiles",
      registroId: id,
      acao: "link_acesso_gerado",
      autorId: atual.id,
    });
    return ok({ link, nome: alvo.nome, email: alvo.email, telefone: alvo.telefone });
  } catch {
    return fail("Não foi possível gerar o link de acesso.");
  }
}
