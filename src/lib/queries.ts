import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { OpcaoCliente } from "@/components/forms/cliente-combobox";

/** Clientes ativos para selects/combobox (inclui um id extra, ex.: o cliente atual de um contrato). */
export async function opcoesClientes(incluirId?: string | null): Promise<OpcaoCliente[]> {
  const supabase = await createClient();
  let query = supabase
    .from("clientes")
    .select("id, razao_social, nome_fantasia, cnpj_cpf")
    .order("razao_social");
  query = incluirId ? query.or(`ativo.eq.true,id.eq.${incluirId}`) : query.eq("ativo", true);
  const { data } = await query.limit(2000);
  return (data ?? []).map((c) => ({
    id: c.id,
    nome: c.nome_fantasia ? `${c.nome_fantasia} (${c.razao_social})` : c.razao_social,
    documento: c.cnpj_cpf,
  }));
}
