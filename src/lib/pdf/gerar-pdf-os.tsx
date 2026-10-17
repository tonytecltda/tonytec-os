import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatarDocumento } from "@/lib/documentos";
import { enderecoCompleto } from "@/lib/endereco";
import { formatBRL, formatDataHora, formatNumero } from "@/lib/format";
import { ANEXO_OS_TIPO, ITEM_TIPO, TIPO_ATENDIMENTO } from "@/lib/labels";
import type { DadosCompletosOs } from "@/lib/os";
import { OsDocumento, type ImagemPdf, type PdfOsDados } from "./os-documento";

const MAX_FOTOS_PDF = 9;

async function baixar(bucket: string, caminho: string): Promise<Buffer | null> {
  const { data, error } = await createAdminClient().storage.from(bucket).download(caminho);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

/** Reduz a foto para o PDF (JPEG leve). Sem sharp, usa o original se for JPG/PNG. */
async function fotoParaPdf(buf: Buffer, mime: string | null): Promise<ImagemPdf | null> {
  try {
    const sharp = (await import("sharp")).default;
    const data = await sharp(buf, { failOn: "none" })
      .rotate()
      .resize({ width: 900, height: 900, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 72 })
      .toBuffer();
    return { data, format: "jpg" };
  } catch {
    if (mime === "image/jpeg") return { data: buf, format: "jpg" };
    if (mime === "image/png") return { data: buf, format: "png" };
    return null; // WEBP/HEIC sem sharp: fica fora do PDF
  }
}

/** Logo em PNG (o PDF não aceita WEBP). */
async function logoParaPdf(buf: Buffer, caminho: string): Promise<ImagemPdf | null> {
  try {
    const sharp = (await import("sharp")).default;
    const data = await sharp(buf, { failOn: "none" })
      .resize({ width: 360, height: 160, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    return { data, format: "png" };
  } catch {
    if (/\.png$/i.test(caminho)) return { data: buf, format: "png" };
    if (/\.jpe?g$/i.test(caminho)) return { data: buf, format: "jpg" };
    return null;
  }
}

/** Gera o PDF da OS (A4) a partir dos dados completos. */
export async function gerarPdfOs(d: DadosCompletosOs): Promise<Buffer> {
  const { os } = d;

  const logo = d.empresa.logo_path
    ? await baixar("empresa", d.empresa.logo_path).then((b) =>
        b ? logoParaPdf(b, d.empresa.logo_path!) : null,
      )
    : null;

  const ordemFoto = { foto_antes: 0, foto_depois: 1, documento: 2, outro: 3 } as const;
  const imagens = d.anexos
    .filter((a) => a.mime_type?.startsWith("image/"))
    .sort((a, b) => ordemFoto[a.tipo] - ordemFoto[b.tipo]);
  const fotos = (
    await Promise.all(
      imagens.slice(0, MAX_FOTOS_PDF).map(async (a) => {
        const buf = await baixar("os-anexos", a.storage_path);
        const imagem = buf ? await fotoParaPdf(buf, a.mime_type) : null;
        return imagem
          ? { imagem, legenda: `${ANEXO_OS_TIPO[a.tipo]}${a.legenda ? ` - ${a.legenda}` : ""}` }
          : null;
      }),
    )
  ).filter((f): f is NonNullable<typeof f> => !!f);

  // Técnico primeiro, cliente depois.
  const assinaturasOrdenadas = [...d.assinaturas].sort((a, b) =>
    a.tipo === b.tipo ? 0 : a.tipo === "tecnico" ? -1 : 1,
  );
  const assinaturas = await Promise.all(
    assinaturasOrdenadas.map(async (a) => {
      const buf = await baixar("assinaturas", a.imagem_path);
      return {
        titulo:
          a.tipo === "tecnico" ? "Técnico responsável" : a.remota ? "Cliente (assinatura remota)" : "Cliente",
        nome: a.nome_signatario,
        detalhe: [a.documento_signatario ? `Doc. ${a.documento_signatario}` : null, a.cargo]
          .filter(Boolean)
          .join(" - "),
        data: `Assinado em ${formatDataHora(a.assinado_em)}`,
        imagem: buf ? ({ data: buf, format: "png" } as ImagemPdf) : null,
      };
    }),
  );

  const totalHoras = d.visitas.reduce((acc, v) => acc + Number(v.horas_trabalhadas ?? 0), 0);
  const totalItens = d.itens.filter((i) => i.cobrado).reduce((acc, i) => acc + Number(i.valor_total ?? 0), 0);
  const cliente = os.clientes;
  const unidade = os.unidades;

  const dados: PdfOsDados = {
    empresa: {
      razao: d.empresa.razao_social,
      fantasia: d.empresa.nome_fantasia,
      cnpj: d.empresa.cnpj ? formatarDocumento(d.empresa.cnpj) : "",
      endereco: d.empresa.endereco,
      contato: [d.empresa.telefone, d.empresa.email, d.empresa.site].filter(Boolean).join(" - "),
      logo,
    },
    os: {
      numero: os.numero,
      protocolo: os.chamados?.protocolo ?? null,
      tipo: `Atendimento ${TIPO_ATENDIMENTO[os.tipo_atendimento].toLowerCase()}`,
      situacao: os.assinada_em
        ? `Assinada em ${formatDataHora(os.assinada_em)}`
        : os.assinatura_recusada
          ? `Encerrada em ${formatDataHora(os.finalizada_em)} sem assinatura do cliente`
          : "Aguardando assinatura",
      inicio: formatDataHora(os.data_inicio),
      fim: formatDataHora(os.data_fim),
      tecnico: os.tecnico_nome_snapshot ?? os.tecnico?.nome ?? "-",
      problema: os.problema_relatado ?? "",
      diagnostico: os.diagnostico ?? "",
      servico: os.servico_executado ?? "",
      observacoes: os.observacoes_tecnicas ?? "",
      recomendacoes: os.recomendacoes ?? "",
      pendencias: os.pendencias && os.pendencias_texto ? os.pendencias_texto : null,
      recusa: os.assinatura_recusada ? `Motivo informado pelo técnico: ${os.motivo_recusa ?? "-"}` : null,
    },
    cliente: {
      nome: cliente?.nome_fantasia || cliente?.razao_social || "-",
      razao: cliente?.razao_social ?? "",
      documento: cliente?.cnpj_cpf ? formatarDocumento(cliente.cnpj_cpf) : "",
      contato: [cliente?.telefone, cliente?.email].filter(Boolean).join(" - "),
    },
    unidade: unidade
      ? {
          nome: unidade.nome,
          endereco: enderecoCompleto(unidade),
          contato: [unidade.contato_local, unidade.telefone_local].filter(Boolean).join(" - "),
        }
      : null,
    visitas: d.visitas.map((v) => ({
      chegada: formatDataHora(v.data_hora_chegada),
      saida: v.data_hora_saida ? formatDataHora(v.data_hora_saida) : "-",
      horas: v.horas_trabalhadas == null ? "-" : `${formatNumero(v.horas_trabalhadas)} h`,
    })),
    totalHoras: `${formatNumero(totalHoras)} h`,
    itens: d.itens.map((i) => ({
      descricao: i.descricao + (i.cobrado ? "" : " (sem cobrança)"),
      tipo: ITEM_TIPO[i.tipo],
      qtd: formatNumero(i.quantidade),
      unit: formatBRL(i.valor_unitario),
      total: i.cobrado ? formatBRL(i.valor_total) : "-",
    })),
    totalItens: totalItens > 0 ? formatBRL(totalItens) : null,
    exibirValores: d.pdf.exibir_valores,
    fotos,
    totalFotos: imagens.length,
    termo: d.assinatura.termo_aceite,
    assinaturas,
    hash: os.hash_conteudo ?? "-",
    geradoEm: formatDataHora(new Date()),
    rodape: d.pdf.rodape,
  };

  return renderToBuffer(<OsDocumento d={dados} />);
}
