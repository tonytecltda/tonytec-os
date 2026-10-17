import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { lerConfig } from "@/lib/config-schemas";
import { formatarDocumento } from "@/lib/documentos";
import { formatBRL, formatDataHora, formatNumero } from "@/lib/format";
import { COBRANCA_TIPO } from "@/lib/labels";
import { mesPorExtenso, type Celula, type Coluna } from "@/lib/export";
import type { Fechamento } from "@/lib/cobranca-consulta";
import { FechamentoDocumento, type PdfFechamentoDados } from "@/lib/pdf/fechamento-documento";
import type { ImagemPdf } from "@/lib/pdf/os-documento";

const TIPO = (t: keyof typeof COBRANCA_TIPO | null) => (t ? COBRANCA_TIPO[t] : "Sem cálculo");

// ---------------------------------------------------------------- lista de visitas
type VisitaListada = {
  data_hora_chegada: string;
  horas_trabalhadas: number | null;
  cobranca_tipo: keyof typeof COBRANCA_TIPO | null;
  valor_unitario: number | null;
  quantidade_horas: number | null;
  valor_total: number | null;
  justificativa_isencao: string | null;
  faturado: boolean;
  faturado_em: string | null;
  contratos: { numero: string } | null;
  ordens_servico: {
    numero: string;
    chamados: { protocolo: string } | null;
    clientes: { razao_social: string; nome_fantasia: string | null } | null;
  } | null;
};

export const COLUNAS_VISITAS: Coluna[] = [
  { titulo: "Cliente", largura: 32 },
  { titulo: "OS", largura: 16 },
  { titulo: "Chamado", largura: 16 },
  { titulo: "Contrato", largura: 14 },
  { titulo: "Data da visita", largura: 18, formato: "datahora" },
  { titulo: "Horas trabalhadas", largura: 12, formato: "numero" },
  { titulo: "Tipo de cobrança", largura: 18 },
  { titulo: "Horas cobradas", largura: 12, formato: "numero" },
  { titulo: "Valor unitário", largura: 14, formato: "moeda" },
  { titulo: "Valor total", largura: 14, formato: "moeda" },
  { titulo: "Justificativa", largura: 30 },
  { titulo: "Faturado", largura: 10 },
  { titulo: "Faturado em", largura: 18, formato: "datahora" },
];

export function linhasVisitas(visitas: VisitaListada[]): Celula[][] {
  return visitas.map((v) => [
    v.ordens_servico?.clientes?.nome_fantasia || v.ordens_servico?.clientes?.razao_social || "",
    v.ordens_servico?.numero ?? "",
    v.ordens_servico?.chamados?.protocolo ?? "",
    v.contratos?.numero ?? "",
    new Date(v.data_hora_chegada),
    v.horas_trabalhadas == null ? null : Number(v.horas_trabalhadas),
    TIPO(v.cobranca_tipo),
    v.quantidade_horas == null ? null : Number(v.quantidade_horas),
    v.valor_unitario == null ? null : Number(v.valor_unitario),
    Number(v.valor_total ?? 0),
    v.justificativa_isencao ?? "",
    v.faturado,
    v.faturado_em ? new Date(v.faturado_em) : null,
  ]);
}

// ---------------------------------------------------------------- fechamento (planilha)
export const COLUNAS_FECHAMENTO: Coluna[] = [
  { titulo: "Tipo", largura: 14 },
  { titulo: "OS", largura: 16 },
  { titulo: "Data / descrição", largura: 38 },
  { titulo: "Cobrança", largura: 22 },
  { titulo: "Horas", largura: 10, formato: "numero" },
  { titulo: "Valor unitário", largura: 14, formato: "moeda" },
  { titulo: "Valor", largura: 14, formato: "moeda" },
  { titulo: "Faturado", largura: 10 },
];

export function linhasFechamento(f: Fechamento): Celula[][] {
  const linhas: Celula[][] = [];
  for (const c of f.contratos) {
    linhas.push(["Mensalidade", "", `Contrato ${c.numero}`, "", null, null, c.valorMensal, null]);
  }
  for (const v of f.visitas) {
    linhas.push([
      "Visita",
      v.osNumero,
      formatDataHora(v.chegada),
      TIPO(v.tipo),
      v.horas,
      v.valorUnitario,
      v.valor,
      v.faturado,
    ]);
  }
  for (const i of f.itens) {
    linhas.push([
      "Item",
      i.osNumero,
      `${i.descricao} (${formatNumero(i.quantidade)}×)`,
      "",
      null,
      i.valorUnitario,
      i.valor,
      i.faturado,
    ]);
  }
  return linhas;
}

// ---------------------------------------------------------------- fechamento (PDF)
async function logoEmpresa(caminho: string | null): Promise<ImagemPdf | null> {
  if (!caminho) return null;
  try {
    const { data } = await createAdminClient().storage.from("empresa").download(caminho);
    if (!data) return null;
    const buf = Buffer.from(await data.arrayBuffer());
    const sharp = (await import("sharp")).default;
    return {
      data: await sharp(buf, { failOn: "none" })
        .resize({ width: 320, height: 140, fit: "inside" })
        .png()
        .toBuffer(),
      format: "png",
    };
  } catch {
    return null;
  }
}

export async function gerarPdfFechamento(f: Fechamento): Promise<Buffer> {
  const { renderToBuffer } = await import("@react-pdf/renderer");
  const { createElement } = await import("react");
  const { data: cfg } = await createAdminClient()
    .from("configuracoes")
    .select("valor")
    .eq("chave", "empresa")
    .maybeSingle();
  const empresa = lerConfig("empresa", cfg?.valor);

  const dados: PdfFechamentoDados = {
    empresa: {
      razao: empresa.razao_social,
      fantasia: empresa.nome_fantasia,
      cnpj: empresa.cnpj ? formatarDocumento(empresa.cnpj) : "",
      contato: [empresa.telefone, empresa.email].filter(Boolean).join(" - "),
      logo: await logoEmpresa(empresa.logo_path),
    },
    cliente: { nome: f.cliente.nome, razao: f.cliente.razaoSocial, documento: f.cliente.documento },
    mes: mesPorExtenso(f.mes),
    contratos: f.contratos.map((c) => ({
      numero: c.numero,
      mensal: formatBRL(c.valorMensal),
      franquia: `${c.visitasInclusas} visita(s) · ${formatNumero(c.horasInclusas)} h`,
      consumo: `${c.visitasUsadas} visita(s) · ${formatNumero(c.horasUsadas)} h · ${c.visitasExcedentes} excedente(s)`,
    })),
    visitas: f.visitas.map((v) => ({
      data: formatDataHora(v.chegada),
      os: v.osNumero,
      protocolo: v.protocolo ?? "",
      horas: v.horas == null ? "-" : formatNumero(v.horas),
      tipo: TIPO(v.tipo),
      cobranca:
        v.tipo === "valor_por_hora"
          ? `${formatNumero(v.quantidadeHoras)} h × ${formatBRL(v.valorUnitario)}`
          : (v.justificativa ?? ""),
      valor: formatBRL(v.valor),
      faturado: v.faturado ? "Sim" : "Não",
    })),
    itens: f.itens.map((i) => ({
      os: i.osNumero,
      descricao: i.descricao,
      qtd: formatNumero(i.quantidade),
      unit: formatBRL(i.valorUnitario),
      valor: formatBRL(i.valor),
    })),
    tipos: (Object.keys(COBRANCA_TIPO) as (keyof typeof COBRANCA_TIPO)[]).map((t) => ({
      rotulo: COBRANCA_TIPO[t],
      qtd: String(f.resumo.porTipo[t].quantidade),
      valor: formatBRL(f.resumo.porTipo[t].valor),
    })),
    resumo: [
      { rotulo: "Mensalidades do contrato", valor: formatBRL(f.resumo.mensalidades) },
      { rotulo: "Visitas cobradas", valor: formatBRL(f.resumo.totalVisitas) },
      { rotulo: "Materiais e serviços", valor: formatBRL(f.resumo.totalItens) },
      { rotulo: "TOTAL DO MÊS", valor: formatBRL(f.resumo.total), destaque: true },
    ],
    geradoEm: formatDataHora(new Date()),
  };
  return renderToBuffer(createElement(FechamentoDocumento, { d: dados }) as never);
}
