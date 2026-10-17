import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { lerConfig } from "@/lib/config-schemas";
import { formatarDocumento } from "@/lib/documentos";
import { formatDataHora } from "@/lib/format";
import type { Coluna, SecaoExport } from "@/lib/export";
import type { Periodo } from "@/lib/periodo";
import { exibirValor, valorExportacao, type RelatorioDef, type SecaoRel } from "@/lib/relatorios";
import { RelatorioDocumento, type PdfRelatorioDados } from "@/lib/pdf/relatorio-documento";
import type { ImagemPdf } from "@/lib/pdf/os-documento";

export type LinhaBruta = Record<string, unknown>;
export type SecaoCarregada = { def: SecaoRel; linhas: LinhaBruta[]; erro: boolean };

/** Executa as funções SQL do relatório (como o usuário logado: só o admin tem acesso). */
export async function carregarRelatorio(def: RelatorioDef, periodo: Periodo): Promise<SecaoCarregada[]> {
  const supabase = await createClient();
  return Promise.all(
    def.secoes.map(async (secao) => {
      // O nome da função vem do catálogo fixo (relatorios.ts), nunca da URL.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc(secao.fn, {
        p_de: periodo.de,
        p_ate: periodo.ate,
        ...(secao.dim ? { p_dim: secao.dim } : {}),
      });
      if (error) console.error(`[relatorio] ${secao.fn}`, error.message);
      return { def: secao, linhas: (error ? [] : (data ?? [])) as LinhaBruta[], erro: !!error };
    }),
  );
}

const FORMATO_EXPORT: Record<string, Coluna["formato"]> = {
  texto: "texto",
  inteiro: "inteiro",
  numero: "numero",
  moeda: "moeda",
  percentual: "percentual",
  data: "data",
  datahora: "datahora",
  dia_semana: "texto",
};

/** Seções prontas para CSV/XLSX. */
export function secoesParaExportacao(secoes: SecaoCarregada[]): SecaoExport[] {
  return secoes.map((s) => ({
    titulo: s.def.titulo,
    colunas: s.def.colunas.map((c) => ({
      titulo: c.titulo,
      largura: c.largura,
      formato: FORMATO_EXPORT[c.formato ?? "texto"],
    })),
    linhas: s.linhas.map((l) => s.def.colunas.map((c) => valorExportacao(l[c.chave], c.formato))),
  }));
}

async function logoEmpresa(caminho: string | null): Promise<ImagemPdf | null> {
  if (!caminho) return null;
  try {
    const { data } = await createAdminClient().storage.from("empresa").download(caminho);
    if (!data) return null;
    const sharp = (await import("sharp")).default;
    const png = await sharp(Buffer.from(await data.arrayBuffer()), { failOn: "none" })
      .resize({ width: 320, height: 140, fit: "inside" })
      .png()
      .toBuffer();
    return { data: png, format: "png" };
  } catch {
    return null;
  }
}

export async function gerarPdfRelatorio(
  def: RelatorioDef,
  periodo: Periodo,
  secoes: SecaoCarregada[],
): Promise<Buffer> {
  const { renderToBuffer } = await import("@react-pdf/renderer");
  const { createElement } = await import("react");
  const { data: cfg } = await createAdminClient()
    .from("configuracoes")
    .select("valor")
    .eq("chave", "empresa")
    .maybeSingle();
  const empresa = lerConfig("empresa", cfg?.valor);
  const MAX_LINHAS = 600; // PDF para leitura; a planilha tem tudo

  const dados: PdfRelatorioDados = {
    empresa: {
      razao: empresa.razao_social,
      fantasia: empresa.nome_fantasia,
      cnpj: empresa.cnpj ? formatarDocumento(empresa.cnpj) : "",
      logo: await logoEmpresa(empresa.logo_path),
    },
    titulo: def.titulo,
    periodo: periodo.rotulo,
    geradoEm: formatDataHora(new Date()),
    secoes: secoes.map((s) => {
      const exp = secoesParaExportacao([s])[0];
      return {
        titulo: s.def.titulo,
        colunas: s.def.colunas.map((c) => ({
          titulo: c.titulo,
          peso: c.largura ?? 14,
          direita: !!c.formato && ["inteiro", "numero", "moeda", "percentual"].includes(c.formato),
        })),
        linhas: s.linhas
          .slice(0, MAX_LINHAS)
          .map((l) => s.def.colunas.map((c) => exibirValor(l[c.chave], c.formato))),
        truncado: s.linhas.length > MAX_LINHAS ? s.linhas.length : 0,
        vazio: exp.linhas.length === 0,
      };
    }),
  };
  return renderToBuffer(createElement(RelatorioDocumento, { d: dados }) as never);
}
