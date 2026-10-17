import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Periodo } from "@/lib/periodo";

type Serie = { nome: string; qtd: number }[];

export type DadosDashboard = {
  chamados: {
    total: number;
    abertos: number;
    em_atendimento: number;
    aguardando: number;
    resolvidos: number;
    cancelados: number;
  };
  tempos: { resposta_h: number | null; resolucao_h: number | null };
  sla: { resposta_total: number; resposta_ok: number; solucao_total: number; solucao_ok: number };
  sla_risco: {
    id: string;
    protocolo: string;
    titulo: string;
    cliente_nome: string;
    prioridade: string;
    status: string;
    tecnico_nome: string | null;
    prazo: string;
    situacao: "estourado" | "vencendo";
  }[];
  os: { concluidas: number; aguardando_assinatura: number };
  faturamento: { a_faturar: number; faturado: number };
  satisfacao: { media: number | null; avaliacoes: number };
  por_dia: { dia: string; abertos: number; resolvidos: number }[];
  por_categoria: Serie;
  por_prioridade: Serie;
  por_tecnico: Serie;
  receita_mensal: { mes: string; valor: number }[];
  top_clientes: Serie;
  top_problemas: Serie;
};

/** KPIs e séries do dashboard (uma chamada ao banco; só o admin consegue executar). */
export async function carregarDashboard(periodo: Periodo): Promise<DadosDashboard | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rel_dashboard", { p_de: periodo.de, p_ate: periodo.ate });
  if (error || !data) {
    console.error("[dashboard]", error);
    return null;
  }
  return data as unknown as DadosDashboard;
}

export { horasLegivel, pct } from "@/lib/dashboard-formatos";
