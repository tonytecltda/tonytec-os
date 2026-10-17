"use server";

import { revalidatePath } from "next/cache";
import type { Json } from "@/types/database";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrarAuditoria } from "@/lib/auditoria";
import { CONFIG_SCHEMAS, lerConfig, type ConfigChave } from "@/lib/config-schemas";
import { dbErrorMessage, fail, ok, zodFail, type ActionResult } from "@/lib/actions";

/** Chaves que mexem em dinheiro/prazos: toda alteração vai para a auditoria. */
const SENSIVEIS: ConfigChave[] = ["cobranca", "sla_padrao", "sla_horario_comercial"];

export async function salvarConfiguracao(chave: ConfigChave, valor: unknown): Promise<ActionResult> {
  const atual = await requireAdmin();
  if (!Object.hasOwn(CONFIG_SCHEMAS, chave)) return fail("Configuração inválida.");
  const parsed = CONFIG_SCHEMAS[chave].safeParse(valor);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createClient();
  const { data: antes } = await supabase
    .from("configuracoes")
    .select("valor")
    .eq("chave", chave)
    .maybeSingle();

  let novo: Record<string, unknown> = parsed.data as Record<string, unknown>;
  if (chave === "empresa") {
    // A logo só muda pelo upload, nunca pelo formulário.
    novo = { ...novo, logo_path: lerConfig("empresa", antes?.valor).logo_path };
  }

  const { error } = await supabase.from("configuracoes").upsert({ chave, valor: novo as Json });
  if (error) return fail(dbErrorMessage(error));

  if (SENSIVEIS.includes(chave)) {
    await registrarAuditoria({
      tabela: "configuracoes",
      registroId: null,
      acao: `config_${chave}`,
      autorId: atual.id,
      antes: antes?.valor ?? null,
      depois: novo,
    });
  }
  revalidatePath("/", "layout");
  return ok(undefined, "Configurações salvas.");
}

const TIPOS_LOGO: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const MAX_LOGO = 2 * 1024 * 1024;

async function gravarLogoPath(logoPath: string | null) {
  const supabase = await createClient();
  const { data } = await supabase.from("configuracoes").select("valor").eq("chave", "empresa").maybeSingle();
  const empresa = lerConfig("empresa", data?.valor);
  const anterior = empresa.logo_path;
  const { error } = await supabase
    .from("configuracoes")
    .upsert({ chave: "empresa", valor: { ...empresa, logo_path: logoPath } as Json });
  return { error, anterior };
}

export async function enviarLogo(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const arquivo = formData.get("logo");
  if (!(arquivo instanceof File) || arquivo.size === 0) return fail("Selecione uma imagem.");
  const ext = TIPOS_LOGO[arquivo.type];
  if (!ext) return fail("Use uma imagem PNG, JPG ou WEBP.");
  if (arquivo.size > MAX_LOGO) return fail("A imagem deve ter no máximo 2 MB.");

  const sa = createAdminClient();
  // Nome com timestamp: a URL muda a cada envio (sem cache antigo da logo).
  const caminho = `logo-${Date.now()}.${ext}`;
  const { error: upErro } = await sa.storage
    .from("empresa")
    .upload(caminho, arquivo, { contentType: arquivo.type, upsert: false, cacheControl: "31536000" });
  if (upErro) {
    console.error("[config] upload logo", upErro);
    return fail("Não foi possível enviar a imagem.");
  }

  const { error, anterior } = await gravarLogoPath(caminho);
  if (error) {
    await sa.storage.from("empresa").remove([caminho]);
    return fail(dbErrorMessage(error));
  }
  if (anterior) await sa.storage.from("empresa").remove([anterior]);
  revalidatePath("/", "layout");
  return ok(undefined, "Logo atualizada.");
}

export async function removerLogo(): Promise<ActionResult> {
  await requireAdmin();
  const { error, anterior } = await gravarLogoPath(null);
  if (error) return fail(dbErrorMessage(error));
  if (anterior) await createAdminClient().storage.from("empresa").remove([anterior]);
  revalidatePath("/", "layout");
  return ok(undefined, "Logo removida.");
}
