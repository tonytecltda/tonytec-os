import "server-only";
import { createClient } from "@/lib/supabase/server";
import { formatarDocumento } from "@/lib/documentos";
import { mesValido } from "@/lib/export";
import type { TipoCobranca } from "@/lib/cobranca";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const TIPOS: TipoCobranca[] = ["isento_contrato", "valor_unico", "valor_por_hora", "garantia", "cortesia"];

export type FiltrosCobranca = {
  cliente: string;
  de: string;
  ate: string;
  faturamento: "a_faturar" | "faturado" | "todos";
  tipo: TipoCobranca | "sem_calculo" | "";
};

type Param = string | string[] | undefined;
const um = (v: Param) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

/** Lê e valida os filtros da URL (a mesma regra vale para a tela e para as exportações). */
export function lerFiltrosCobranca(sp: Record<string, Param>): FiltrosCobranca {
  const cliente = um(sp.cliente);
  const de = um(sp.de);
  const ate = um(sp.ate);
  const faturamento = um(sp.faturamento);
  const tipo = um(sp.tipo);
  return {
    cliente: UUID.test(cliente) ? cliente : "",
    de: DATA.test(de) ? de : "",
    ate: DATA.test(ate) ? ate : "",
    faturamento: faturamento === "faturado" || faturamento === "todos" ? faturamento : "a_faturar",
    tipo:
      tipo === "sem_calculo" || (TIPOS as string[]).includes(tipo) ? (tipo as FiltrosCobranca["tipo"]) : "",
  };
}

export const SELECT_VISITA_COBRANCA = `
  id, os_id, data_hora_chegada, data_hora_saida, horas_trabalhadas, cobranca_tipo, valor_unitario,
  quantidade_horas, valor_total, justificativa_isencao, observacoes_financeiras, faturado, faturado_em,
  cobranca_manual, horas_franquia, contrato_id,
  contratos(numero),
  ordens_servico!inner(numero, finalizada_em, ativo, cliente_id, chamados(protocolo), clientes(razao_social, nome_fantasia))
`;

/** Consulta de visitas de OS encerradas, com os filtros da tela de Cobrança. */
export async function consultarVisitasCobranca(
  f: FiltrosCobranca,
  paginacao?: { page: number; pageSize: number },
) {
  const supabase = await createClient();
  let q = supabase
    .from("os_visitas")
    .select(SELECT_VISITA_COBRANCA, { count: "exact" })
    .not("ordens_servico.finalizada_em", "is", null)
    .eq("ordens_servico.ativo", true);
  if (f.cliente) q = q.eq("ordens_servico.cliente_id", f.cliente);
  if (f.de) q = q.gte("data_hora_chegada", `${f.de}T00:00:00-03:00`);
  if (f.ate) q = q.lte("data_hora_chegada", `${f.ate}T23:59:59.999-03:00`);
  if (f.faturamento === "a_faturar") q = q.eq("faturado", false);
  else if (f.faturamento === "faturado") q = q.eq("faturado", true);
  if (f.tipo === "sem_calculo") q = q.is("cobranca_tipo", null);
  else if (f.tipo) q = q.eq("cobranca_tipo", f.tipo);

  q = q.order("data_hora_chegada", { ascending: false });
  q = paginacao
    ? q.range((paginacao.page - 1) * paginacao.pageSize, paginacao.page * paginacao.pageSize - 1)
    : q.limit(5000);
  return q;
}

/** Totais do conjunto filtrado (consulta leve, sem paginar). */
export async function totaisCobranca(f: FiltrosCobranca) {
  const supabase = await createClient();
  let q = supabase
    .from("os_visitas")
    .select("valor_total, faturado, cobranca_tipo, ordens_servico!inner(finalizada_em, ativo, cliente_id)")
    .not("ordens_servico.finalizada_em", "is", null)
    .eq("ordens_servico.ativo", true);
  if (f.cliente) q = q.eq("ordens_servico.cliente_id", f.cliente);
  if (f.de) q = q.gte("data_hora_chegada", `${f.de}T00:00:00-03:00`);
  if (f.ate) q = q.lte("data_hora_chegada", `${f.ate}T23:59:59.999-03:00`);
  if (f.faturamento === "a_faturar") q = q.eq("faturado", false);
  else if (f.faturamento === "faturado") q = q.eq("faturado", true);
  if (f.tipo === "sem_calculo") q = q.is("cobranca_tipo", null);
  else if (f.tipo) q = q.eq("cobranca_tipo", f.tipo);
  const { data } = await q.limit(20000);

  let aFaturar = 0;
  let faturado = 0;
  let semCalculo = 0;
  for (const v of data ?? []) {
    const valor = Number(v.valor_total ?? 0);
    if (v.faturado) faturado += valor;
    else aFaturar += valor;
    if (!v.cobranca_tipo) semCalculo++;
  }
  return { aFaturar, faturado, semCalculo, quantidade: data?.length ?? 0 };
}

// ---------------------------------------------------------------- fechamento mensal
export type LinhaVisitaFechamento = {
  id: string;
  osNumero: string;
  protocolo: string | null;
  chegada: string;
  horas: number | null;
  tipo: TipoCobranca | null;
  valorUnitario: number | null;
  quantidadeHoras: number | null;
  valor: number;
  justificativa: string | null;
  contrato: string | null;
  faturado: boolean;
};

export type LinhaItemFechamento = {
  osId: string;
  osNumero: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  valor: number;
  faturado: boolean;
};

export type ContratoFechamento = {
  id: string;
  numero: string;
  valorMensal: number;
  visitasInclusas: number;
  horasInclusas: number;
  visitasUsadas: number;
  horasUsadas: number;
  visitasExcedentes: number;
};

export type Fechamento = {
  cliente: { id: string; nome: string; razaoSocial: string; documento: string };
  mes: string;
  contratos: ContratoFechamento[];
  visitas: LinhaVisitaFechamento[];
  itens: LinhaItemFechamento[];
  resumo: {
    mensalidades: number;
    totalVisitas: number;
    totalItens: number;
    total: number;
    visitasAFaturar: number;
    visitasFaturadas: number;
    itensAFaturar: number;
    itensFaturados: number;
    semCalculo: number;
    porTipo: Record<TipoCobranca, { quantidade: number; valor: number }>;
  };
};

function limitesDoMes(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const prox = m === 12 ? { a: a + 1, m: 1 } : { a, m: m + 1 };
  return {
    inicio: `${a}-${pad(m)}-01T00:00:00-03:00`,
    fim: `${prox.a}-${pad(prox.m)}-01T00:00:00-03:00`,
    primeiroDia: `${a}-${pad(m)}-01`,
    ultimoDia: new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10),
  };
}

/**
 * Fechamento do mês de um cliente: mensalidades do contrato + visitas do mês
 * (por data de chegada) + itens cobrados das OS encerradas no mês.
 * Lê como o usuário logado (RLS): só o admin enxerga visitas e valores.
 */
export async function carregarFechamento(clienteId: string, mes: string): Promise<Fechamento | null> {
  if (!UUID.test(clienteId) || !mesValido(mes)) return null;
  const supabase = await createClient();
  const { inicio, fim, primeiroDia, ultimoDia } = limitesDoMes(mes);

  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, razao_social, nome_fantasia, cnpj_cpf")
    .eq("id", clienteId)
    .maybeSingle();
  if (!cliente) return null;

  const [{ data: visitas }, { data: ordens }, { data: contratos }] = await Promise.all([
    supabase
      .from("os_visitas")
      .select(SELECT_VISITA_COBRANCA)
      .eq("ordens_servico.cliente_id", clienteId)
      .not("ordens_servico.finalizada_em", "is", null)
      .eq("ordens_servico.ativo", true)
      .gte("data_hora_chegada", inicio)
      .lt("data_hora_chegada", fim)
      .order("data_hora_chegada"),
    supabase
      .from("ordens_servico")
      .select(
        "id, numero, itens_faturado_em, os_itens(descricao, quantidade, valor_unitario, valor_total, cobrado, created_at)",
      )
      .eq("cliente_id", clienteId)
      .eq("ativo", true)
      .not("finalizada_em", "is", null)
      .gte("finalizada_em", inicio)
      .lt("finalizada_em", fim)
      .order("finalizada_em"),
    supabase
      .from("contratos")
      .select("id, numero, valor_mensal, visitas_inclusas_mes, horas_inclusas_mes")
      .eq("cliente_id", clienteId)
      .eq("status", "ativo")
      .lte("data_inicio", ultimoDia)
      .or(`data_fim.is.null,data_fim.gte.${primeiroDia}`)
      .order("numero"),
  ]);

  const linhasVisitas: LinhaVisitaFechamento[] = (visitas ?? []).map((v) => ({
    id: v.id,
    osNumero: v.ordens_servico?.numero ?? "",
    protocolo: v.ordens_servico?.chamados?.protocolo ?? null,
    chegada: v.data_hora_chegada,
    horas: v.horas_trabalhadas == null ? null : Number(v.horas_trabalhadas),
    tipo: v.cobranca_tipo,
    valorUnitario: v.valor_unitario == null ? null : Number(v.valor_unitario),
    quantidadeHoras: v.quantidade_horas == null ? null : Number(v.quantidade_horas),
    valor: Number(v.valor_total ?? 0),
    justificativa: v.justificativa_isencao,
    contrato: v.contratos?.numero ?? null,
    faturado: v.faturado,
  }));

  const linhasItens: LinhaItemFechamento[] = (ordens ?? []).flatMap((o) =>
    (o.os_itens ?? [])
      .filter((i) => i.cobrado)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((i) => ({
        osId: o.id,
        osNumero: o.numero,
        descricao: i.descricao,
        quantidade: Number(i.quantidade),
        valorUnitario: Number(i.valor_unitario),
        valor: Number(i.valor_total ?? 0),
        faturado: !!o.itens_faturado_em,
      })),
  );

  // Consumo por contrato (mesma regra da função do banco, a partir das visitas carregadas)
  const consumoContratos: ContratoFechamento[] = (contratos ?? []).map((c) => {
    const doContrato = linhasVisitas.filter((v) => v.contrato === c.numero);
    return {
      id: c.id,
      numero: c.numero,
      valorMensal: Number(c.valor_mensal),
      visitasInclusas: c.visitas_inclusas_mes,
      horasInclusas: Number(c.horas_inclusas_mes),
      visitasUsadas: doContrato.filter((v) => v.tipo === "isento_contrato").length,
      horasUsadas: (visitas ?? [])
        .filter((v) => v.contratos?.numero === c.numero)
        .reduce((acc, v) => acc + Number(v.horas_franquia ?? 0), 0),
      visitasExcedentes: doContrato.filter((v) => v.tipo === "valor_unico" || v.tipo === "valor_por_hora")
        .length,
    };
  });

  const porTipo = Object.fromEntries(
    TIPOS.map((t) => [t, { quantidade: 0, valor: 0 }]),
  ) as Fechamento["resumo"]["porTipo"];
  for (const v of linhasVisitas) {
    if (v.tipo) {
      porTipo[v.tipo].quantidade++;
      porTipo[v.tipo].valor += v.valor;
    }
  }
  const soma = (xs: { valor: number }[]) => Math.round(xs.reduce((a, x) => a + x.valor, 0) * 100) / 100;
  const mensalidades = Math.round(consumoContratos.reduce((a, c) => a + c.valorMensal, 0) * 100) / 100;
  const totalVisitas = soma(linhasVisitas);
  const totalItens = soma(linhasItens);

  return {
    cliente: {
      id: cliente.id,
      nome: cliente.nome_fantasia || cliente.razao_social,
      razaoSocial: cliente.razao_social,
      documento: cliente.cnpj_cpf ? formatarDocumento(cliente.cnpj_cpf) : "",
    },
    mes,
    contratos: consumoContratos,
    visitas: linhasVisitas,
    itens: linhasItens,
    resumo: {
      mensalidades,
      totalVisitas,
      totalItens,
      total: Math.round((mensalidades + totalVisitas + totalItens) * 100) / 100,
      visitasAFaturar: soma(linhasVisitas.filter((v) => !v.faturado)),
      visitasFaturadas: soma(linhasVisitas.filter((v) => v.faturado)),
      itensAFaturar: soma(linhasItens.filter((i) => !i.faturado)),
      itensFaturados: soma(linhasItens.filter((i) => i.faturado)),
      semCalculo: linhasVisitas.filter((v) => !v.tipo).length,
      porTipo,
    },
  };
}
