"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { getCurrentProfile, requireAdmin, type CurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { origemApp } from "@/lib/acesso";
import { registrarAuditoria } from "@/lib/auditoria";
import { ANEXO_MAX_BYTES, nomeSeguro } from "@/lib/anexos";
import { lerConfig } from "@/lib/config-schemas";
import { localParaIso } from "@/lib/datas";
import {
  decodificarAssinaturaPng,
  encerrarOs,
  gerarESalvarPdf,
  hashAtualOs,
  registrarAssinatura,
} from "@/lib/os-encerramento";
import { LIMITES, MSG_MUITAS_TENTATIVAS, dentroDoLimite, ipDoCliente } from "@/lib/rate-limit";
import { criarTokenAssinatura, registrarTentativaToken, validarTokenAssinatura } from "@/lib/os-tokens";
import {
  ajusteVisitaSchema,
  assinaturaClienteSchema,
  assinaturaTecnicoSchema,
  avaliacaoSchema,
  motivoSchema,
  osAvulsaSchema,
  osSnapshotSchema,
} from "@/lib/validators";
import { dbErrorMessage, fail, nullIfEmpty, ok, zodFail, type ActionResult } from "@/lib/actions";

const idSchema = z.uuid();
const FOTO_TIPOS = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];

function revalidarOs(osId?: string, chamadoId?: string | null) {
  for (const p of [
    "/admin",
    "/admin/os",
    "/admin/chamados",
    "/tecnico",
    "/tecnico/historico",
    "/portal",
    "/portal/os",
  ]) {
    revalidatePath(p);
  }
  if (osId) {
    revalidatePath(`/admin/os/${osId}`);
    revalidatePath(`/tecnico/os/${osId}`);
    revalidatePath(`/tecnico/os/${osId}/assinatura`);
    revalidatePath(`/portal/os/${osId}`);
  }
  if (chamadoId) {
    revalidatePath(`/admin/chamados/${chamadoId}`);
    revalidatePath(`/tecnico/chamados/${chamadoId}`);
    revalidatePath(`/portal/chamados/${chamadoId}`);
  }
}

async function infoRequisicao() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  return { ip, userAgent: h.get("user-agent") };
}

async function perfilEquipe(): Promise<CurrentProfile | null> {
  const p = await getCurrentProfile();
  return p && (p.role === "tecnico" || p.role === "admin") ? p : null;
}

/** OS visível para o usuário (a RLS decide). */
async function osDoUsuario(osId: string) {
  if (!idSchema.safeParse(osId).success) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("ordens_servico")
    .select("id, status, finalizada_em, tecnico_id, chamado_id, cliente_id, data_inicio")
    .eq("id", osId)
    .maybeSingle();
  return data;
}

// =====================================================================
// Técnico: atendimento
// =====================================================================

/** "Iniciar atendimento" no chamado: cria/retoma a OS e abre uma visita (chegada). */
export async function iniciarAtendimento(chamadoId: string): Promise<ActionResult<{ osId: string }>> {
  const perfil = await perfilEquipe();
  if (!perfil) return fail("Sem permissão.");
  if (!idSchema.safeParse(chamadoId).success) return fail("Chamado inválido.");
  const supabase = await createClient();

  const { data: chamado } = await supabase
    .from("chamados")
    .select("id, status, cliente_id, tecnico_id")
    .eq("id", chamadoId)
    .maybeSingle();
  if (!chamado) return fail("Chamado não encontrado.");
  if (chamado.status === "resolvido" || chamado.status === "cancelado")
    return fail("Este chamado já foi encerrado.");
  if (perfil.role === "tecnico" && chamado.tecnico_id !== perfil.id)
    return fail("Este chamado não está atribuído a você.");

  const { data: existente } = await supabase
    .from("ordens_servico")
    .select("id, status")
    .eq("chamado_id", chamadoId)
    .is("finalizada_em", null)
    .neq("status", "cancelada")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existente?.status === "aguardando_assinatura")
    return ok({ osId: existente.id }, "OS aguardando assinatura.");

  let osId = existente?.id;
  if (!osId) {
    const { data: nova, error } = await supabase
      .from("ordens_servico")
      .insert({
        chamado_id: chamadoId,
        cliente_id: chamado.cliente_id,
        tecnico_id: chamado.tecnico_id,
        status: "em_execucao",
        data_inicio: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) return fail(dbErrorMessage(error, "Não foi possível abrir a OS."));
    osId = nova.id;
  }

  const r = await abrirVisita(osId);
  if (!r.ok) return r;
  if (chamado.status !== "em_atendimento") {
    await supabase.from("chamados").update({ status: "em_atendimento" }).eq("id", chamadoId);
  }
  revalidarOs(osId, chamadoId);
  return ok({ osId }, "Atendimento iniciado. Chegada registrada.");
}

/** Garante a OS em execução e uma visita aberta (registra a chegada). */
async function abrirVisita(osId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const os = await osDoUsuario(osId);
  if (!os) return fail("OS não encontrada.");
  if (os.finalizada_em || os.status === "cancelada") return fail("Esta OS já foi encerrada.");
  if (os.status === "aguardando_assinatura") return fail("A OS está aguardando assinatura.");

  if (os.status === "rascunho" || !os.data_inicio) {
    const { error } = await supabase
      .from("ordens_servico")
      .update({ status: "em_execucao", data_inicio: os.data_inicio ?? new Date().toISOString() })
      .eq("id", osId);
    if (error) return fail(dbErrorMessage(error));
  }
  const { data: aberta } = await supabase
    .from("os_visitas")
    .select("id")
    .eq("os_id", osId)
    .is("data_hora_saida", null)
    .limit(1)
    .maybeSingle();
  if (!aberta) {
    const { error } = await supabase
      .from("os_visitas")
      .insert({ os_id: osId, data_hora_chegada: new Date().toISOString() });
    if (error) return fail(dbErrorMessage(error, "Não foi possível registrar a chegada."));
  }
  return ok(undefined);
}

/** Nova visita (retorno) ou início de uma OS avulsa. */
export async function iniciarVisita(osId: string): Promise<ActionResult> {
  if (!(await perfilEquipe())) return fail("Sem permissão.");
  const r = await abrirVisita(osId);
  if (!r.ok) return r;
  const os = await osDoUsuario(osId);
  if (os?.chamado_id) {
    const supabase = await createClient();
    await supabase
      .from("chamados")
      .update({ status: "em_atendimento" })
      .eq("id", os.chamado_id)
      .not("status", "in", "(em_atendimento,resolvido,cancelado)");
  }
  revalidarOs(osId, os?.chamado_id);
  return ok(undefined, "Chegada registrada.");
}

export async function registrarSaida(visitaId: string): Promise<ActionResult> {
  if (!(await perfilEquipe())) return fail("Sem permissão.");
  if (!idSchema.safeParse(visitaId).success) return fail("Visita inválida.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("os_visitas")
    .update({ data_hora_saida: new Date().toISOString() })
    .eq("id", visitaId)
    .is("data_hora_saida", null)
    .select("os_id");
  if (error) return fail(dbErrorMessage(error));
  if (!data?.length) return fail("Visita não encontrada ou já encerrada.");
  revalidarOs(data[0].os_id);
  return ok(undefined, "Saída registrada.");
}

export async function ajustarVisita(visitaId: string, input: unknown): Promise<ActionResult> {
  if (!(await perfilEquipe())) return fail("Sem permissão.");
  if (!idSchema.safeParse(visitaId).success) return fail("Visita inválida.");
  const parsed = ajusteVisitaSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const chegada = localParaIso(parsed.data.chegada);
  const saida = localParaIso(parsed.data.saida);
  if (!chegada) return fail("Chegada inválida.");
  const limite = Date.now() + 10 * 60_000;
  if (Date.parse(chegada) > limite || (saida && Date.parse(saida) > limite)) {
    return fail("Os horários não podem estar no futuro.");
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("os_visitas")
    .update({ data_hora_chegada: chegada, data_hora_saida: saida })
    .eq("id", visitaId)
    .select("os_id");
  if (error) return fail(dbErrorMessage(error));
  if (!data?.length) return fail("Visita não encontrada.");
  revalidarOs(data[0].os_id);
  return ok(undefined, "Horários ajustados.");
}

/** Salva campos e itens da OS (usado pelo salvamento automático e pelo modo offline). */
export async function salvarOs(osId: string, input: unknown): Promise<ActionResult<{ salvoEm: string }>> {
  if (!(await perfilEquipe())) return fail("Sem permissão.");
  const os = await osDoUsuario(osId);
  if (!os) return fail("OS não encontrada.");
  const parsed = osSnapshotSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const d = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("ordens_servico")
    .update({
      tipo_atendimento: d.tipo_atendimento,
      problema_relatado: nullIfEmpty(d.problema_relatado),
      diagnostico: nullIfEmpty(d.diagnostico),
      servico_executado: nullIfEmpty(d.servico_executado),
      observacoes_tecnicas: nullIfEmpty(d.observacoes_tecnicas),
      recomendacoes: nullIfEmpty(d.recomendacoes),
      pendencias: d.pendencias,
      pendencias_texto: nullIfEmpty(d.pendencias_texto),
    })
    .eq("id", osId);
  if (error) return fail(dbErrorMessage(error));

  // Sincroniza itens: remove os que saíram e grava (upsert) os atuais.
  const { data: atuais } = await supabase.from("os_itens").select("id").eq("os_id", osId);
  const manter = new Set(d.itens.map((i) => i.id));
  const remover = (atuais ?? []).map((i) => i.id).filter((id) => !manter.has(id));
  if (remover.length) {
    const { error: delErro } = await supabase.from("os_itens").delete().in("id", remover);
    if (delErro) return fail(dbErrorMessage(delErro));
  }
  if (d.itens.length) {
    const { error: upErro } = await supabase.from("os_itens").upsert(
      d.itens.map((i) => ({ ...i, os_id: osId })),
      { onConflict: "id" },
    );
    if (upErro) return fail(dbErrorMessage(upErro, "Não foi possível salvar os itens."));
  }
  return ok({ salvoEm: new Date().toISOString() });
}

// ---------------------------------------------------------------- fotos da OS
const fotoSchema = z.object({
  nome: z.string().trim().min(1).max(200),
  tipo: z.string().refine((t) => FOTO_TIPOS.includes(t), "Use foto (JPG/PNG/WEBP/HEIC) ou PDF."),
  tamanho: z.number().int().positive().max(ANEXO_MAX_BYTES, "Arquivo maior que 20 MB."),
  categoria: z.enum(["foto_antes", "foto_depois", "documento", "outro"]),
});

export async function prepararUploadFotoOs(
  osId: string,
  input: unknown,
): Promise<ActionResult<{ path: string; token: string }>> {
  if (!(await perfilEquipe())) return fail("Sem permissão.");
  const os = await osDoUsuario(osId);
  if (!os) return fail("OS não encontrada.");
  if (os.finalizada_em || os.status === "aguardando_assinatura" || os.status === "cancelada") {
    return fail("A OS não aceita novas fotos neste momento.");
  }
  const parsed = fotoSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const path = `${os.cliente_id}/${os.id}/${crypto.randomUUID()}-${nomeSeguro(parsed.data.nome)}`;
  const { data, error } = await createAdminClient().storage.from("os-anexos").createSignedUploadUrl(path);
  if (error || !data) return fail("Não foi possível preparar o envio da foto.");
  return ok({ path: data.path, token: data.token });
}

export async function registrarFotoOs(osId: string, input: unknown): Promise<ActionResult> {
  const perfil = await perfilEquipe();
  if (!perfil) return fail("Sem permissão.");
  const os = await osDoUsuario(osId);
  if (!os) return fail("OS não encontrada.");
  const parsed = fotoSchema
    .extend({ path: z.string().min(10).max(400), legenda: z.string().trim().max(200) })
    .safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const d = parsed.data;
  if (!d.path.startsWith(`${os.cliente_id}/${os.id}/`) || d.path.includes(".."))
    return fail("Caminho inválido.");
  const { data: existe } = await createAdminClient().storage.from("os-anexos").exists(d.path);
  if (!existe) return fail("A foto não chegou ao servidor. Tente de novo.");

  const supabase = await createClient();
  const { error } = await supabase.from("os_anexos").insert({
    os_id: osId,
    tipo: d.categoria,
    storage_path: d.path,
    legenda: nullIfEmpty(d.legenda),
    mime_type: d.tipo,
    tamanho_bytes: d.tamanho,
    enviado_por: perfil.id,
  });
  if (error) return fail(dbErrorMessage(error, "Não foi possível registrar a foto."));
  revalidarOs(osId);
  return ok(undefined, "Foto enviada.");
}

export async function removerFotoOs(anexoId: string): Promise<ActionResult> {
  if (!(await perfilEquipe())) return fail("Sem permissão.");
  if (!idSchema.safeParse(anexoId).success) return fail("Foto inválida.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("os_anexos")
    .delete()
    .eq("id", anexoId)
    .select("os_id, storage_path");
  if (error) return fail(dbErrorMessage(error));
  if (!data?.length) return fail("Foto não encontrada.");
  await createAdminClient().storage.from("os-anexos").remove([data[0].storage_path]);
  revalidarOs(data[0].os_id);
  return ok(undefined, "Foto removida.");
}

// ---------------------------------------------------------------- conclusão
/** Fecha a visita aberta e deixa a OS pronta para assinatura (conteúdo congelado). */
export async function concluirOs(osId: string): Promise<ActionResult> {
  if (!(await perfilEquipe())) return fail("Sem permissão.");
  const os = await osDoUsuario(osId);
  if (!os) return fail("OS não encontrada.");
  if (os.status === "aguardando_assinatura") return ok(undefined);
  if (os.finalizada_em || os.status === "cancelada") return fail("Esta OS já foi encerrada.");

  const supabase = await createClient();
  const { data: dados } = await supabase
    .from("ordens_servico")
    .select("servico_executado, pendencias, pendencias_texto")
    .eq("id", osId)
    .single();
  const erros: Record<string, string> = {};
  if ((dados?.servico_executado ?? "").trim().length < 5)
    erros.servico_executado = "Descreva o serviço executado.";
  if (dados?.pendencias && (dados.pendencias_texto ?? "").trim().length < 3)
    erros.pendencias_texto = "Descreva as pendências.";
  const { count: visitas } = await supabase
    .from("os_visitas")
    .select("id", { count: "exact", head: true })
    .eq("os_id", osId);
  if (!visitas) erros.visitas = "Registre a chegada no local antes de concluir.";
  if (Object.keys(erros).length) return fail(Object.values(erros)[0], erros);

  const agora = new Date().toISOString();
  const { error: saidaErro } = await supabase
    .from("os_visitas")
    .update({ data_hora_saida: agora })
    .eq("os_id", osId)
    .is("data_hora_saida", null);
  if (saidaErro) return fail(dbErrorMessage(saidaErro, "Não foi possível registrar a saída da visita."));
  const { error } = await supabase
    .from("ordens_servico")
    .update({ status: "aguardando_assinatura", data_fim: agora })
    .eq("id", osId);
  if (error) return fail(dbErrorMessage(error));
  revalidarOs(osId, os.chamado_id);
  return ok(undefined, "OS concluída. Agora colete as assinaturas.");
}

/** Volta a OS para edição: descarta assinaturas e links já emitidos (o conteúdo vai mudar). */
export async function voltarParaEdicao(osId: string): Promise<ActionResult> {
  const perfil = await perfilEquipe();
  if (!perfil) return fail("Sem permissão.");
  const os = await osDoUsuario(osId);
  if (!os) return fail("OS não encontrada.");
  if (os.status !== "aguardando_assinatura" || os.finalizada_em)
    return fail("A OS não está aguardando assinatura.");
  if (perfil.role === "tecnico" && os.tecnico_id !== perfil.id) return fail("Esta OS não é sua.");

  const sa = createAdminClient();
  const agora = new Date().toISOString();
  await sa
    .from("os_assinaturas")
    .update({ invalidada_em: agora, invalidada_motivo: "OS voltou para edição" })
    .eq("os_id", osId)
    .is("invalidada_em", null);
  await sa.from("os_assinatura_tokens").update({ usado_em: agora }).eq("os_id", osId).is("usado_em", null);
  const { error } = await sa
    .from("ordens_servico")
    .update({ status: "em_execucao", data_fim: null })
    .eq("id", osId)
    .is("finalizada_em", null);
  if (error) return fail(dbErrorMessage(error));
  revalidarOs(osId, os.chamado_id);
  return ok(undefined, "OS liberada para edição. As assinaturas coletadas foram descartadas.");
}

// =====================================================================
// Assinaturas
// =====================================================================

/** Garante a assinatura (válida) do técnico para o conteúdo atual. */
async function garantirAssinaturaTecnico(
  osId: string,
  perfil: CurrentProfile,
  input: z.infer<typeof assinaturaTecnicoSchema> | null,
  hash: string,
  req: { ip: string | null; userAgent: string | null },
): Promise<string | null> {
  const sa = createAdminClient();
  const { data: existente } = await sa
    .from("os_assinaturas")
    .select("id, hash_documento")
    .eq("os_id", osId)
    .eq("tipo", "tecnico")
    .is("invalidada_em", null)
    .maybeSingle();
  if (existente?.hash_documento === hash) return null;
  if (!input) return "Falta a assinatura do técnico.";

  const { data: prof } = await sa
    .from("profiles")
    .select("assinatura_path, nome")
    .eq("id", perfil.id)
    .single();
  let imagem: Buffer | { copiarDe: string };
  if (input.usarSalva) {
    if (!prof?.assinatura_path) return "Você ainda não tem assinatura salva. Desenhe a assinatura.";
    imagem = { copiarDe: prof.assinatura_path };
  } else {
    const png = decodificarAssinaturaPng(input.imagem);
    if (!png) return "Faça a assinatura do técnico no quadro.";
    imagem = png;
    if (input.salvarComoPadrao) {
      const caminho = `perfis/${perfil.id}.png`;
      const { error } = await sa.storage
        .from("assinaturas")
        .upload(caminho, png, { contentType: "image/png", upsert: true });
      if (!error) await sa.from("profiles").update({ assinatura_path: caminho }).eq("id", perfil.id);
    }
  }
  if (existente) {
    await sa
      .from("os_assinaturas")
      .update({ invalidada_em: new Date().toISOString(), invalidada_motivo: "Substituída" })
      .eq("id", existente.id);
  }
  await registrarAssinatura({
    osId,
    tipo: "tecnico",
    nome: prof?.nome || perfil.nome,
    imagem,
    remota: false,
    ip: req.ip,
    userAgent: req.userAgent,
    hash,
  });
  return null;
}

async function prepararAssinatura(osId: string) {
  const perfil = await perfilEquipe();
  if (!perfil) return { erro: "Sem permissão." } as const;
  const os = await osDoUsuario(osId);
  if (!os) return { erro: "OS não encontrada." } as const;
  if (os.finalizada_em) return { erro: "Esta OS já foi encerrada." } as const;
  if (os.status !== "aguardando_assinatura")
    return { erro: "Conclua a OS antes de coletar assinaturas." } as const;
  if (perfil.role === "tecnico" && os.tecnico_id !== perfil.id)
    return { erro: "Esta OS não é sua." } as const;
  const hash = await hashAtualOs(osId);
  if (!hash) return { erro: "OS não encontrada." } as const;
  return { perfil, os, hash, req: await infoRequisicao() } as const;
}

const assinarNoLocalSchema = z.object({
  tecnico: assinaturaTecnicoSchema,
  cliente: assinaturaClienteSchema.nullable(),
  recusa: z.string().trim().max(500).nullable(),
});

/** Assinatura presencial: técnico + cliente na tela do celular (ou recusa do cliente). */
export async function assinarNoLocal(
  osId: string,
  input: unknown,
): Promise<ActionResult<{ pdf: boolean; email: boolean }>> {
  const ctx = await prepararAssinatura(osId);
  if ("erro" in ctx) return fail(ctx.erro!);
  const parsed = assinarNoLocalSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { tecnico, cliente, recusa } = parsed.data;
  if (!cliente && (!recusa || recusa.length < 5)) {
    return fail("Colete a assinatura do cliente ou informe o motivo da recusa.");
  }

  try {
    const erroTec = await garantirAssinaturaTecnico(osId, ctx.perfil, tecnico, ctx.hash, ctx.req);
    if (erroTec) return fail(erroTec);
    if (cliente) {
      const png = decodificarAssinaturaPng(cliente.imagem);
      if (!png) return fail("Faça a assinatura do cliente no quadro.");
      await registrarAssinatura({
        osId,
        tipo: "cliente",
        nome: cliente.nome,
        documento: nullIfEmpty(cliente.documento),
        cargo: nullIfEmpty(cliente.cargo),
        imagem: png,
        remota: false,
        ip: ctx.req.ip,
        userAgent: ctx.req.userAgent,
        geo: cliente.geo,
        hash: ctx.hash,
      });
    }
  } catch (e) {
    console.error("[os] assinatura", e);
    return fail("Não foi possível gravar a assinatura. Tente novamente.");
  }

  const r = await encerrarOs(osId, { recusaMotivo: cliente ? null : recusa, autorId: ctx.perfil.id });
  if (!r.ok) return fail(r.erro);
  revalidarOs(osId, ctx.os.chamado_id);
  return ok(
    { pdf: r.pdf, email: r.email },
    cliente ? "OS assinada e encerrada." : "OS encerrada com a recusa de assinatura registrada.",
  );
}

/** Link seguro para o cliente assinar depois (WhatsApp/e-mail). */
export async function gerarLinkAssinatura(
  osId: string,
  input: unknown,
): Promise<
  ActionResult<{
    link: string;
    expiraEm: string;
    nome: string;
    telefone: string | null;
    email: string | null;
  }>
> {
  const ctx = await prepararAssinatura(osId);
  if ("erro" in ctx) return fail(ctx.erro!);
  const tecnico = input == null ? null : assinaturaTecnicoSchema.safeParse(input);
  if (tecnico && !tecnico.success) return zodFail(tecnico.error);

  try {
    const erroTec = await garantirAssinaturaTecnico(
      osId,
      ctx.perfil,
      tecnico?.data ?? null,
      ctx.hash,
      ctx.req,
    );
    if (erroTec) return fail(erroTec);
  } catch (e) {
    console.error("[os] assinatura técnico", e);
    return fail("Não foi possível gravar a assinatura do técnico.");
  }

  const sa = createAdminClient();
  const [{ data: cfg }, { data: os }] = await Promise.all([
    sa.from("configuracoes").select("valor").eq("chave", "assinatura").maybeSingle(),
    sa
      .from("ordens_servico")
      .select(
        "numero, clientes(nome_fantasia, razao_social, telefone, email), unidades(telefone_local), chamados(telefone_contato)",
      )
      .eq("id", osId)
      .single(),
  ]);
  const { token, expiraEm } = await criarTokenAssinatura(
    osId,
    lerConfig("assinatura", cfg?.valor).validade_link_horas,
    ctx.perfil.id,
  );
  await registrarAuditoria({
    tabela: "ordens_servico",
    registroId: osId,
    acao: "link_assinatura_gerado",
    autorId: ctx.perfil.id,
  });
  revalidarOs(osId, ctx.os.chamado_id);
  return ok({
    link: `${await origemApp()}/assinar/${token}`,
    expiraEm,
    nome: os?.clientes?.nome_fantasia || os?.clientes?.razao_social || "cliente",
    telefone:
      os?.chamados?.telefone_contato || os?.unidades?.telefone_local || os?.clientes?.telefone || null,
    email: os?.clientes?.email ?? null,
  });
}

/** Assinatura pelo link público (sem login). Devolve um link temporário (30 min) do PDF assinado. */
export async function assinarPorLink(
  token: string,
  input: unknown,
): Promise<ActionResult<{ pdf: boolean; pdfUrl: string | null }>> {
  if (!(await dentroDoLimite("assinar-enviar", await ipDoCliente(), LIMITES.linkAssinaturaEnviar))) {
    return fail(MSG_MUITAS_TENTATIVAS);
  }
  const v = await validarTokenAssinatura(token);
  if (!v.ok) return fail(v.erro);
  await registrarTentativaToken(v.token.id, v.token.tentativas);

  const parsed = assinaturaClienteSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const png = decodificarAssinaturaPng(parsed.data.imagem);
  if (!png) return fail("Faça a assinatura no quadro.");

  const hash = await hashAtualOs(v.token.osId);
  if (!hash) return fail("Ordem de serviço não encontrada.");
  const req = await infoRequisicao();
  try {
    await registrarAssinatura({
      osId: v.token.osId,
      tipo: "cliente",
      nome: parsed.data.nome,
      documento: nullIfEmpty(parsed.data.documento),
      cargo: nullIfEmpty(parsed.data.cargo),
      imagem: png,
      remota: true,
      ip: req.ip,
      userAgent: req.userAgent,
      geo: parsed.data.geo,
      hash,
    });
  } catch (e) {
    console.error("[os] assinatura remota", e);
    return fail("Não foi possível gravar a assinatura. Tente novamente.");
  }
  const r = await encerrarOs(v.token.osId, { autorId: null });
  if (!r.ok) return fail(r.erro);
  // Sem revalidatePath aqui: revalidar re-renderiza a página pública, que (com o link já
  // usado) trocaria a tela de sucesso e o botão "Baixar PDF" por "já foi assinada".

  let pdfUrl: string | null = null;
  if (r.pdf) {
    const sa = createAdminClient();
    const { data: os } = await sa
      .from("ordens_servico")
      .select("numero, pdf_path")
      .eq("id", v.token.osId)
      .single();
    if (os?.pdf_path) {
      const { data } = await sa.storage
        .from("os-pdfs")
        .createSignedUrl(os.pdf_path, 1800, { download: `${os.numero}.pdf` });
      pdfUrl = data?.signedUrl ?? null;
    }
  }
  return ok({ pdf: r.pdf, pdfUrl }, "Assinatura registrada. Obrigado!");
}

/** Assinatura pelo portal do cliente (logado). */
export async function assinarPeloPortal(
  osId: string,
  input: unknown,
): Promise<ActionResult<{ pdf: boolean; pdfUrl: string | null }>> {
  const perfil = await getCurrentProfile();
  if (!perfil || perfil.role !== "cliente") return fail("Sem permissão.");
  const os = await osDoUsuario(osId); // RLS: só OS do próprio cliente
  if (!os) return fail("Ordem de serviço não encontrada.");
  if (os.finalizada_em) return fail("Esta ordem de serviço já foi assinada.");
  if (os.status !== "aguardando_assinatura")
    return fail("Esta ordem de serviço não está aguardando assinatura.");

  const parsed = assinaturaClienteSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const png = decodificarAssinaturaPng(parsed.data.imagem);
  if (!png) return fail("Faça a assinatura no quadro.");
  const hash = await hashAtualOs(osId);
  if (!hash) return fail("Ordem de serviço não encontrada.");
  const req = await infoRequisicao();
  try {
    await registrarAssinatura({
      osId,
      tipo: "cliente",
      nome: parsed.data.nome,
      documento: nullIfEmpty(parsed.data.documento),
      cargo: nullIfEmpty(parsed.data.cargo),
      imagem: png,
      remota: true,
      ip: req.ip,
      userAgent: req.userAgent,
      geo: parsed.data.geo,
      hash,
    });
  } catch (e) {
    console.error("[os] assinatura portal", e);
    return fail("Não foi possível gravar a assinatura. Tente novamente.");
  }
  const r = await encerrarOs(osId, { autorId: perfil.id });
  if (!r.ok) return fail(r.erro);
  revalidarOs(osId, os.chamado_id);
  return ok({ pdf: r.pdf, pdfUrl: r.pdf ? `/api/os/${osId}/pdf` : null }, "Assinatura registrada. Obrigado!");
}

/** Assinatura padrão do técnico (perfil). */
export async function salvarMinhaAssinatura(dataUrl: string): Promise<ActionResult> {
  const perfil = await perfilEquipe();
  if (!perfil) return fail("Sem permissão.");
  const png = decodificarAssinaturaPng(dataUrl);
  if (!png) return fail("Faça a assinatura no quadro.");
  const sa = createAdminClient();
  const caminho = `perfis/${perfil.id}.png`;
  const { error } = await sa.storage
    .from("assinaturas")
    .upload(caminho, png, { contentType: "image/png", upsert: true });
  if (error) return fail("Não foi possível salvar a assinatura.");
  const { error: perfilErro } = await sa
    .from("profiles")
    .update({ assinatura_path: caminho })
    .eq("id", perfil.id);
  if (perfilErro) return fail(dbErrorMessage(perfilErro));
  revalidatePath("/tecnico/assinatura");
  return ok(undefined, "Assinatura salva.");
}

// =====================================================================
// Portal: avaliação do atendimento
// =====================================================================
export async function avaliarChamado(chamadoId: string, input: unknown): Promise<ActionResult> {
  const perfil = await getCurrentProfile();
  if (!perfil || perfil.role !== "cliente") return fail("Sem permissão.");
  if (!idSchema.safeParse(chamadoId).success) return fail("Chamado inválido.");
  const parsed = avaliacaoSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chamados")
    .update({ avaliacao_nota: parsed.data.nota, avaliacao_comentario: nullIfEmpty(parsed.data.comentario) })
    .eq("id", chamadoId)
    .select("id");
  if (error) return fail(dbErrorMessage(error));
  if (!data?.length) return fail("Chamado não encontrado.");
  revalidatePath(`/portal/chamados/${chamadoId}`);
  revalidatePath(`/admin/chamados/${chamadoId}`);
  return ok(undefined, "Obrigado pela avaliação!");
}

// =====================================================================
// Admin
// =====================================================================

/** "Abrir ordem de serviço" a partir do chamado (fica com o técnico do chamado). */
export async function abrirOsDoChamado(chamadoId: string): Promise<ActionResult<{ osId: string }>> {
  await requireAdmin();
  if (!idSchema.safeParse(chamadoId).success) return fail("Chamado inválido.");
  const supabase = await createClient();
  const { data: chamado } = await supabase
    .from("chamados")
    .select("id, cliente_id, tecnico_id, status")
    .eq("id", chamadoId)
    .maybeSingle();
  if (!chamado) return fail("Chamado não encontrado.");
  if (chamado.status === "cancelado") return fail("Chamado cancelado.");
  const { data: existente } = await supabase
    .from("ordens_servico")
    .select("id")
    .eq("chamado_id", chamadoId)
    .is("finalizada_em", null)
    .neq("status", "cancelada")
    .limit(1)
    .maybeSingle();
  if (existente) return ok({ osId: existente.id }, "Este chamado já tem uma OS em aberto.");
  if (!chamado.tecnico_id) return fail("Atribua um técnico ao chamado antes de abrir a OS.");
  const { data, error } = await supabase
    .from("ordens_servico")
    .insert({
      chamado_id: chamadoId,
      cliente_id: chamado.cliente_id,
      tecnico_id: chamado.tecnico_id,
      status: "rascunho",
    })
    .select("id")
    .single();
  if (error) return fail(dbErrorMessage(error, "Não foi possível abrir a OS."));
  revalidarOs(data.id, chamadoId);
  return ok({ osId: data.id }, "OS aberta.");
}

/** OS sem chamado (ex.: preventiva, instalação), atribuída a um técnico. */
export async function criarOsAvulsa(input: unknown): Promise<ActionResult<{ osId: string }>> {
  await requireAdmin();
  const parsed = osAvulsaSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ordens_servico")
    .insert({
      cliente_id: d.cliente_id,
      unidade_id: nullIfEmpty(d.unidade_id),
      tecnico_id: d.tecnico_id,
      tipo_atendimento: d.tipo_atendimento,
      problema_relatado: nullIfEmpty(d.problema_relatado),
      status: "rascunho",
    })
    .select("id")
    .single();
  if (error) return fail(dbErrorMessage(error, "Não foi possível criar a OS."));
  revalidarOs(data.id);
  return ok({ osId: data.id }, "OS criada e atribuída ao técnico.");
}

export async function reabrirOs(osId: string, motivo: string): Promise<ActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(osId).success) return fail("OS inválida.");
  const m = motivoSchema.safeParse(motivo);
  if (!m.success) return zodFail(m.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("reabrir_os", { p_os_id: osId, p_motivo: m.data });
  if (error) return fail(dbErrorMessage(error, "Não foi possível reabrir a OS."));
  const os = await osDoUsuario(osId);
  revalidarOs(osId, os?.chamado_id);
  return ok(undefined, "OS reaberta. Uma nova assinatura será necessária.");
}

export async function cancelarOs(osId: string, motivo: string): Promise<ActionResult> {
  const atual = await requireAdmin();
  const os = await osDoUsuario(osId);
  if (!os) return fail("OS não encontrada.");
  if (os.finalizada_em) return fail("OS encerrada: reabra antes de cancelar.");
  const m = motivoSchema.safeParse(motivo);
  if (!m.success) return zodFail(m.error);
  const sa = createAdminClient();
  const agora = new Date().toISOString();
  await sa.from("os_assinatura_tokens").update({ usado_em: agora }).eq("os_id", osId).is("usado_em", null);
  await sa
    .from("os_visitas")
    .update({ data_hora_saida: agora })
    .eq("os_id", osId)
    .is("data_hora_saida", null);
  const { error } = await sa.from("ordens_servico").update({ status: "cancelada" }).eq("id", osId);
  if (error) return fail(dbErrorMessage(error));
  await registrarAuditoria({
    tabela: "ordens_servico",
    registroId: osId,
    acao: "os_cancelada",
    autorId: atual.id,
    motivo: m.data,
  });
  revalidarOs(osId, os.chamado_id);
  return ok(undefined, "OS cancelada.");
}

export async function regerarPdf(osId: string): Promise<ActionResult> {
  await requireAdmin();
  const os = await osDoUsuario(osId);
  if (!os?.finalizada_em) return fail("O PDF final só existe para OS encerrada.");
  try {
    await gerarESalvarPdf(osId);
  } catch (e) {
    console.error("[os] regerar PDF", e);
    return fail("Não foi possível gerar o PDF.");
  }
  revalidarOs(osId);
  return ok(undefined, "PDF gerado novamente.");
}
