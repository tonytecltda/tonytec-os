import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrarAuditoria } from "@/lib/auditoria";
import { emailConfigurado, enviarEmail, escaparHtml } from "@/lib/email";
import { formatDataHora } from "@/lib/format";
import { calcularCobrancaOs } from "@/lib/cobranca-server";
import { hashConteudoOs } from "@/lib/os-hash";
import { dadosCompletosOs, montarConteudoOs } from "@/lib/os";
import { gerarPdfOs } from "@/lib/pdf/gerar-pdf-os";

/** Valida e decodifica a imagem da assinatura (PNG em data URL, até 1 MB). */
export function decodificarAssinaturaPng(dataUrl: string | null | undefined): Buffer | null {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl ?? "");
  if (!m) return null;
  const buf = Buffer.from(m[1], "base64");
  if (buf.length < 100 || buf.length > 1_000_000) return null;
  if (buf.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") return null;
  return buf;
}

/** Hash do conteúdo atual da OS (o que está sendo assinado agora). */
export async function hashAtualOs(osId: string): Promise<string | null> {
  const d = await dadosCompletosOs(osId);
  return d ? hashConteudoOs(montarConteudoOs(d)) : null;
}

/**
 * Grava uma assinatura (imagem no bucket privado + registro com o hash do conteúdo).
 * `imagem` pode ser um PNG ou o caminho da assinatura salva do técnico (é copiada,
 * para que trocar a assinatura padrão depois não altere OS já assinadas).
 */
export async function registrarAssinatura(p: {
  osId: string;
  tipo: "cliente" | "tecnico";
  nome: string;
  documento?: string | null;
  cargo?: string | null;
  imagem: Buffer | { copiarDe: string };
  remota: boolean;
  ip: string | null;
  userAgent: string | null;
  geo?: { lat: number; lng: number } | null;
  hash: string;
}) {
  const sa = createAdminClient();
  const caminho = `os/${p.osId}/${p.tipo}-${randomUUID()}.png`;
  const envio =
    "copiarDe" in p.imagem
      ? await sa.storage.from("assinaturas").copy(p.imagem.copiarDe, caminho)
      : await sa.storage
          .from("assinaturas")
          .upload(caminho, p.imagem, { contentType: "image/png", upsert: false });
  if (envio.error) throw new Error(`Falha ao gravar a imagem da assinatura: ${envio.error.message}`);

  const { error } = await sa.from("os_assinaturas").insert({
    os_id: p.osId,
    tipo: p.tipo,
    nome_signatario: p.nome,
    documento_signatario: p.documento || null,
    cargo: p.cargo || null,
    imagem_path: caminho,
    remota: p.remota,
    ip: p.ip,
    user_agent: p.userAgent?.slice(0, 400) ?? null,
    latitude: p.geo?.lat ?? null,
    longitude: p.geo?.lng ?? null,
    geo_consentimento: !!p.geo,
    hash_documento: p.hash,
  });
  if (error) {
    await sa.storage.from("assinaturas").remove([caminho]);
    throw new Error(`Falha ao registrar a assinatura: ${error.message}`);
  }
}

/** Gera o PDF da OS encerrada, guarda no bucket "os-pdfs" e grava o caminho. */
export async function gerarESalvarPdf(
  osId: string,
): Promise<{ caminho: string; pdf: Buffer; numero: string }> {
  const d = await dadosCompletosOs(osId);
  if (!d) throw new Error("OS não encontrada.");
  const pdf = await gerarPdfOs(d);
  const sa = createAdminClient();
  const caminho = `${d.os.cliente_id}/${osId}/${d.os.numero}-${Date.now()}.pdf`;
  const { error: upErro } = await sa.storage
    .from("os-pdfs")
    .upload(caminho, pdf, { contentType: "application/pdf", upsert: false });
  if (upErro) throw new Error(`Falha ao guardar o PDF: ${upErro.message}`);
  const { error } = await sa.from("ordens_servico").update({ pdf_path: caminho }).eq("id", osId);
  if (error) throw new Error(`Falha ao registrar o PDF: ${error.message}`);
  return { caminho, pdf, numero: d.os.numero };
}

type ResultadoEncerramento = { ok: true; pdf: boolean; email: boolean } | { ok: false; erro: string };

/**
 * Encerra a OS: confere assinaturas e hash, bloqueia a OS, resolve o chamado,
 * gera o PDF final e envia por e-mail (se configurado).
 */
export async function encerrarOs(
  osId: string,
  opts: { recusaMotivo?: string | null; autorId?: string | null } = {},
): Promise<ResultadoEncerramento> {
  const sa = createAdminClient();
  const d = await dadosCompletosOs(osId);
  if (!d) return { ok: false, erro: "OS não encontrada." };
  if (d.os.finalizada_em) return { ok: false, erro: "Esta OS já foi encerrada." };
  if (d.os.status !== "aguardando_assinatura")
    return { ok: false, erro: "A OS ainda não foi concluída pelo técnico." };

  const hash = hashConteudoOs(montarConteudoOs(d));
  const tecnico = d.assinaturas.find((a) => a.tipo === "tecnico");
  const cliente = d.assinaturas.find((a) => a.tipo === "cliente");
  if (!tecnico) return { ok: false, erro: "Falta a assinatura do técnico." };
  if (!opts.recusaMotivo && !cliente) return { ok: false, erro: "Falta a assinatura do cliente." };
  if (d.assinaturas.some((a) => a.hash_documento !== hash)) {
    return {
      ok: false,
      erro: "O conteúdo da OS mudou depois da assinatura. Volte para edição e colete as assinaturas novamente.",
    };
  }

  // Cobrança das visitas: calculada ANTES de encerrar (depois da assinatura só o admin altera).
  // Uma falha aqui não impede o encerramento: o admin pode calcular pela tela de Cobrança.
  try {
    await calcularCobrancaOs(osId);
  } catch (e) {
    console.error("[os] cobrança das visitas", e);
  }

  const agora = new Date().toISOString();
  const recusa = !!opts.recusaMotivo;
  const { data: atualizada, error } = await sa
    .from("ordens_servico")
    .update({
      status: recusa ? "concluida" : "assinada",
      assinada_em: recusa ? null : (cliente?.assinado_em ?? agora),
      finalizada_em: agora,
      hash_conteudo: hash,
      assinatura_recusada: recusa,
      motivo_recusa: recusa ? opts.recusaMotivo! : null,
      data_fim: d.os.data_fim ?? agora,
    })
    .eq("id", osId)
    .is("finalizada_em", null)
    .select("id");
  if (error) return { ok: false, erro: `Não foi possível encerrar a OS: ${error.message}` };
  if (!atualizada?.length) return { ok: false, erro: "Esta OS já foi encerrada." };

  await sa.from("os_assinatura_tokens").update({ usado_em: agora }).eq("os_id", osId).is("usado_em", null);

  // Regra 2: o chamado só resolve com OS assinada ou recusa registrada (o banco confere).
  if (d.os.chamado_id) {
    const { error: chErro } = await sa
      .from("chamados")
      .update({ status: "resolvido" })
      .eq("id", d.os.chamado_id)
      .not("status", "in", "(resolvido,cancelado)");
    if (chErro) console.error("[os] resolver chamado", chErro);
  }

  await registrarAuditoria({
    tabela: "ordens_servico",
    registroId: osId,
    acao: recusa ? "os_encerrada_sem_assinatura" : "os_assinada",
    autorId: opts.autorId ?? null, // null = assinatura remota (cliente sem login)
    motivo: opts.recusaMotivo ?? null,
    depois: {
      hash,
      assinaturas: d.assinaturas.map((a) => ({ tipo: a.tipo, nome: a.nome_signatario, remota: a.remota })),
    },
  });

  let pdfOk = false;
  let emailOk = false;
  try {
    const { pdf, numero } = await gerarESalvarPdf(osId);
    pdfOk = true;
    if (emailConfigurado()) emailOk = await enviarPdfPorEmail(d, pdf, numero, recusa);
  } catch (e) {
    console.error("[os] PDF/e-mail", e);
  }
  return { ok: true, pdf: pdfOk, email: emailOk };
}

async function enviarPdfPorEmail(
  d: NonNullable<Awaited<ReturnType<typeof dadosCompletosOs>>>,
  pdf: Buffer,
  numero: string,
  recusa: boolean,
) {
  const sa = createAdminClient();
  const destinatarios: string[] = [];
  if (d.os.clientes?.email) destinatarios.push(d.os.clientes.email);
  if (d.os.chamados?.aberto_por) {
    const { data: quemAbriu } = await sa
      .from("profiles")
      .select("email, role")
      .eq("id", d.os.chamados.aberto_por)
      .maybeSingle();
    if (quemAbriu?.role === "cliente" && quemAbriu.email) destinatarios.push(quemAbriu.email);
  }
  const empresa = d.empresa.nome_fantasia || d.empresa.razao_social;
  const html = `
    <p>Olá,</p>
    <p>Segue em anexo a Ordem de Serviço <strong>${escaparHtml(numero)}</strong>${
      d.os.chamados?.protocolo
        ? ` referente ao chamado <strong>${escaparHtml(d.os.chamados.protocolo)}</strong>`
        : ""
    }, ${recusa ? "encerrada sem assinatura do cliente" : "assinada"} em ${escaparHtml(formatDataHora(new Date()))}.</p>
    ${d.os.servico_executado ? `<p><strong>Serviço executado:</strong><br>${escaparHtml(d.os.servico_executado).replace(/\n/g, "<br>")}</p>` : ""}
    <p>Atenciosamente,<br>${escaparHtml(empresa)}</p>`;
  return enviarEmail({
    para: destinatarios,
    assunto: `Ordem de Serviço ${numero} - ${empresa}`,
    html,
    anexos: [{ nome: `${numero}.pdf`, conteudo: pdf }],
  });
}
