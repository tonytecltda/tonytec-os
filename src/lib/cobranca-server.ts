import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { lerConfig } from "@/lib/config-schemas";
import { TZ } from "@/lib/format";
import {
  calcularCobranca,
  type ConfigCobranca,
  type ContratoCobranca,
  type SugestaoCobranca,
} from "@/lib/cobranca";

/** Data (aaaa-mm-dd) de um instante em America/Sao_Paulo. */
function dataSP(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));
}

/** Início do mês da visita e do mês seguinte, em instantes (fuso de Brasília, sem horário de verão). */
function janelaDoMes(chegadaIso: string) {
  const [ano, mes] = dataSP(chegadaIso).split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const prox = mes === 12 ? { a: ano + 1, m: 1 } : { a: ano, m: mes + 1 };
  return {
    inicio: `${ano}-${pad(mes)}-01T00:00:00-03:00`,
    fim: `${prox.a}-${pad(prox.m)}-01T00:00:00-03:00`,
  };
}

export async function configCobranca(): Promise<ConfigCobranca> {
  const { data } = await createAdminClient()
    .from("configuracoes")
    .select("valor")
    .eq("chave", "cobranca")
    .maybeSingle();
  return lerConfig("cobranca", data?.valor);
}

/** Contrato vigente do cliente na data (mesma regra do banco: ativo, cobre a data, início mais recente). */
async function contratoVigente(clienteId: string, data: string): Promise<ContratoCobranca | null> {
  const { data: c } = await createAdminClient()
    .from("contratos")
    .select(
      "id, visitas_inclusas_mes, horas_inclusas_mes, politica_visita_excedente, valor_visita_excedente, valor_hora_excedente",
    )
    .eq("cliente_id", clienteId)
    .eq("status", "ativo")
    .lte("data_inicio", data)
    .or(`data_fim.is.null,data_fim.gte.${data}`)
    .order("data_inicio", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!c) return null;
  return {
    id: c.id,
    visitas_inclusas_mes: c.visitas_inclusas_mes,
    horas_inclusas_mes: Number(c.horas_inclusas_mes),
    politica_visita_excedente: c.politica_visita_excedente,
    valor_visita_excedente: c.valor_visita_excedente == null ? null : Number(c.valor_visita_excedente),
    valor_hora_excedente: c.valor_hora_excedente == null ? null : Number(c.valor_hora_excedente),
  };
}

type VisitaBase = {
  id: string;
  os_id: string;
  data_hora_chegada: string;
  horas_trabalhadas: number | null;
  faturado: boolean;
  cobranca_manual: boolean;
};

/** Calcula a sugestão de UMA visita e a grava (a menos que seja ajuste manual ou já faturada). */
export async function calcularCobrancaVisita(
  visita: VisitaBase,
  clienteId: string,
  config: ConfigCobranca,
  opts: { forcar?: boolean } = {},
): Promise<{ aplicada: boolean; sugestao: SugestaoCobranca | null }> {
  if (visita.faturado) return { aplicada: false, sugestao: null };
  if (visita.cobranca_manual && !opts.forcar) return { aplicada: false, sugestao: null };
  const sa = createAdminClient();

  const contrato = await contratoVigente(clienteId, dataSP(visita.data_hora_chegada));
  let consumo = { visitas: 0, horas: 0 };
  if (contrato) {
    const { inicio, fim } = janelaDoMes(visita.data_hora_chegada);
    const { data: outras } = await sa
      .from("os_visitas")
      .select("cobranca_tipo, horas_franquia")
      .eq("contrato_id", contrato.id)
      .gte("data_hora_chegada", inicio)
      .lt("data_hora_chegada", fim)
      .neq("id", visita.id);
    consumo = {
      visitas: (outras ?? []).filter((o) => o.cobranca_tipo === "isento_contrato").length,
      horas: (outras ?? []).reduce((acc, o) => acc + Number(o.horas_franquia ?? 0), 0),
    };
  }

  const sugestao = calcularCobranca({
    horasTrabalhadas: visita.horas_trabalhadas == null ? null : Number(visita.horas_trabalhadas),
    contrato,
    consumo,
    config,
  });
  const { error } = await sa
    .from("os_visitas")
    .update({
      cobranca_tipo: sugestao.tipo,
      valor_unitario: sugestao.valor_unitario,
      quantidade_horas: sugestao.quantidade_horas,
      horas_franquia: sugestao.horas_franquia,
      contrato_id: contrato?.id ?? null,
      justificativa_isencao: null,
      cobranca_manual: false,
      cobranca_calculada_em: new Date().toISOString(),
      observacoes_financeiras: sugestao.motivo,
    })
    .eq("id", visita.id);
  if (error) throw new Error(`Falha ao gravar a cobrança da visita: ${error.message}`);
  return { aplicada: true, sugestao };
}

/**
 * Calcula a cobrança de todas as visitas de uma OS, em ordem cronológica
 * (a franquia do contrato é consumida visita a visita).
 */
export async function calcularCobrancaOs(osId: string) {
  const sa = createAdminClient();
  const [{ data: os }, config] = await Promise.all([
    sa.from("ordens_servico").select("cliente_id").eq("id", osId).single(),
    configCobranca(),
  ]);
  if (!os) return;
  const { data: visitas } = await sa
    .from("os_visitas")
    .select("id, os_id, data_hora_chegada, horas_trabalhadas, faturado, cobranca_manual")
    .eq("os_id", osId)
    .order("data_hora_chegada");
  for (const v of visitas ?? []) {
    await calcularCobrancaVisita(
      { ...v, horas_trabalhadas: v.horas_trabalhadas == null ? null : Number(v.horas_trabalhadas) },
      os.cliente_id,
      config,
    );
  }
}

/** Visitas de OS encerradas que ainda não têm cobrança calculada (ex.: OS anteriores à Fase 4). */
export async function calcularCobrancasPendentes(): Promise<number> {
  const sa = createAdminClient();
  const { data: pendentes } = await sa
    .from("os_visitas")
    .select("os_id, ordens_servico!inner(finalizada_em)")
    .is("cobranca_tipo", null)
    .not("ordens_servico.finalizada_em", "is", null)
    .order("data_hora_chegada"); // a franquia do contrato é consumida em ordem cronológica
  const osIds = [...new Set((pendentes ?? []).map((p) => p.os_id))];
  for (const id of osIds) await calcularCobrancaOs(id);
  return pendentes?.length ?? 0;
}
