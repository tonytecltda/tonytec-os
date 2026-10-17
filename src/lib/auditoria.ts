import "server-only";
import type { Json } from "@/types/database";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Registra uma ação sensível em public.auditoria (exclusões lógicas, alterações
 * de cobrança, reaberturas...). Falha de auditoria não interrompe a operação,
 * mas é logada no servidor.
 */
export async function registrarAuditoria(params: {
  tabela: string;
  registroId: string | null;
  acao: string;
  /** Quem agiu (null quando não há usuário logado, ex.: assinatura remota por link). */
  autorId: string | null;
  motivo?: string | null;
  antes?: unknown;
  depois?: unknown;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from("auditoria").insert({
    tabela: params.tabela,
    registro_id: params.registroId,
    acao: params.acao,
    autor_id: params.autorId,
    motivo: params.motivo ?? null,
    dados_antes: (params.antes ?? null) as Json,
    dados_depois: (params.depois ?? null) as Json,
  });
  if (error) console.error("[auditoria]", params.acao, error);
}
