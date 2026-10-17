"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { registrarAuditoria } from "@/lib/auditoria";
import { categoriaSchema, itemCatalogoSchema, tipoProblemaSchema } from "@/lib/validators";
import { dbErrorMessage, fail, nullIfEmpty, ok, zodFail, type ActionResult } from "@/lib/actions";

const idSchema = z.uuid();
export type TabelaCatalogo = "categorias_servico" | "tipos_problema" | "itens_catalogo";

type Resultado = { data: { id: string } | null; error: { code?: string; message?: string } | null };

function finalizar(r: Resultado, criado: boolean, msgs: [string, string]): ActionResult<{ id: string }> {
  if (r.error || !r.data) return fail(dbErrorMessage(r.error));
  revalidatePath("/admin/catalogos");
  return ok({ id: r.data.id }, criado ? msgs[0] : msgs[1]);
}

export async function salvarCategoria(
  id: string | null,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  if (id && !idSchema.safeParse(id).success) return fail("Registro inválido.");
  const parsed = categoriaSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const supabase = await createClient();
  const r = id
    ? await supabase.from("categorias_servico").update(parsed.data).eq("id", id).select("id").single()
    : await supabase.from("categorias_servico").insert(parsed.data).select("id").single();
  return finalizar(r, !id, ["Categoria criada.", "Categoria atualizada."]);
}

export async function salvarTipoProblema(
  id: string | null,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  if (id && !idSchema.safeParse(id).success) return fail("Registro inválido.");
  const parsed = tipoProblemaSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const supabase = await createClient();
  const r = id
    ? await supabase.from("tipos_problema").update(parsed.data).eq("id", id).select("id").single()
    : await supabase.from("tipos_problema").insert(parsed.data).select("id").single();
  return finalizar(r, !id, ["Tipo de problema criado.", "Tipo de problema atualizado."]);
}

export async function salvarItemCatalogo(
  id: string | null,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  if (id && !idSchema.safeParse(id).success) return fail("Registro inválido.");
  const parsed = itemCatalogoSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const d = parsed.data;
  const registro = { ...d, unidade: d.unidade.toLowerCase(), categoria_id: nullIfEmpty(d.categoria_id) };
  const supabase = await createClient();
  const r = id
    ? await supabase.from("itens_catalogo").update(registro).eq("id", id).select("id").single()
    : await supabase.from("itens_catalogo").insert(registro).select("id").single();
  return finalizar(r, !id, ["Item criado.", "Item atualizado."]);
}

export async function definirAtivoCatalogo(
  tabela: TabelaCatalogo,
  id: string,
  ativo: boolean,
): Promise<ActionResult> {
  const atual = await requireAdmin();
  if (!idSchema.safeParse(id).success) return fail("Registro inválido.");
  const supabase = await createClient();
  const { error } =
    tabela === "categorias_servico"
      ? await supabase.from("categorias_servico").update({ ativo }).eq("id", id)
      : tabela === "tipos_problema"
        ? await supabase.from("tipos_problema").update({ ativo }).eq("id", id)
        : tabela === "itens_catalogo"
          ? await supabase.from("itens_catalogo").update({ ativo }).eq("id", id)
          : { error: { message: "Tabela inválida." } };
  if (error) return fail(dbErrorMessage(error));
  if (!ativo) {
    await registrarAuditoria({ tabela, registroId: id, acao: "catalogo_desativado", autorId: atual.id });
  }
  revalidatePath("/admin/catalogos");
  return ok(undefined, ativo ? "Reativado." : "Desativado.");
}
