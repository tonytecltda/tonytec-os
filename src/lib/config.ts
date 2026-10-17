import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { lerConfig, type ConfigChave, type ConfigValor } from "@/lib/config-schemas";

/** Lê uma configuração como o usuário logado (RLS: qualquer usuário autenticado lê). */
export async function getConfig<K extends ConfigChave>(chave: K): Promise<ConfigValor<K>> {
  const supabase = await createClient();
  const { data } = await supabase.from("configuracoes").select("valor").eq("chave", chave).maybeSingle();
  return lerConfig(chave, data?.valor);
}

export type EmpresaPublica = { nome: string; razaoSocial: string; logoUrl: string | null };

/**
 * Nome e logo da empresa para telas públicas (login) e o cabeçalho.
 * Usa a service_role só para ler esta chave, que não é sigilosa.
 */
export const getEmpresaPublica = cache(async (): Promise<EmpresaPublica> => {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("configuracoes").select("valor").eq("chave", "empresa").maybeSingle();
    const empresa = lerConfig("empresa", data?.valor);
    const logoUrl = empresa.logo_path
      ? admin.storage.from("empresa").getPublicUrl(empresa.logo_path).data.publicUrl
      : null;
    return {
      nome: empresa.nome_fantasia || empresa.razao_social,
      razaoSocial: empresa.razao_social,
      logoUrl,
    };
  } catch (e) {
    // Sem chave/banco (ex.: build no CI): usa a marca padrão em vez de quebrar a página.
    console.error("[config] getEmpresaPublica", e);
    const padrao = lerConfig("empresa", null);
    return { nome: padrao.nome_fantasia, razaoSocial: padrao.razao_social, logoUrl: null };
  }
});
