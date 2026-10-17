import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enderecoCompleto } from "@/lib/endereco";
import { lerConfig } from "@/lib/config-schemas";
import type { ConteudoOs } from "@/lib/os-hash";
import type { ResumoOs } from "@/components/os/resumo-os";

const URL_SEGUNDOS = 10 * 60;

/**
 * OS com chamado, cliente, unidade e técnico, como o usuário logado (RLS).
 * Retorna null se o usuário não puder vê-la.
 */
export async function carregarOs(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ordens_servico")
    .select(
      `*,
       chamados(id, protocolo, titulo, status),
       clientes(id, razao_social, nome_fantasia, cnpj_cpf, email, telefone),
       unidades(*),
       tecnico:profiles!ordens_servico_tecnico_id_fkey(id, nome, telefone, assinatura_path)`,
    )
    .eq("id", id)
    .maybeSingle();
  return data;
}

export type OsCarregada = NonNullable<Awaited<ReturnType<typeof carregarOs>>>;

export type FotoOs = {
  id: string;
  tipo: "foto_antes" | "foto_depois" | "documento" | "outro";
  nome: string;
  legenda: string | null;
  mime: string | null;
  url: string | null;
  caminho: string;
};

export type AssinaturaOs = {
  id: string;
  tipo: "cliente" | "tecnico";
  nome: string;
  documento: string | null;
  cargo: string | null;
  assinadoEm: string;
  remota: boolean;
  url: string | null;
};

/**
 * Visitas, itens, fotos e assinaturas válidas da OS.
 * Chame SOMENTE depois de carregarOs() ter confirmado o acesso pela RLS:
 * as visitas são lidas com a service_role (o cliente não lê os_visitas, que tem
 * dados financeiros), mas aqui só saem horários.
 */
export async function carregarDetalhesOs(osId: string) {
  const supabase = await createClient();
  const sa = createAdminClient();
  const [{ data: visitas }, { data: itens }, { data: anexos }, { data: assinaturas }] = await Promise.all([
    sa
      .from("os_visitas")
      .select("id, data_hora_chegada, data_hora_saida, horas_trabalhadas, deslocamento_km, observacoes")
      .eq("os_id", osId)
      .order("data_hora_chegada"),
    supabase
      .from("os_itens")
      .select(
        "id, catalogo_id, descricao, tipo, quantidade, valor_unitario, valor_total, cobrado, created_at",
      )
      .eq("os_id", osId)
      .order("created_at"),
    supabase
      .from("os_anexos")
      .select("id, tipo, storage_path, legenda, mime_type, created_at")
      .eq("os_id", osId)
      .order("created_at"),
    supabase
      .from("os_assinaturas")
      .select("id, tipo, nome_signatario, documento_signatario, cargo, imagem_path, assinado_em, remota")
      .eq("os_id", osId)
      .is("invalidada_em", null)
      .order("assinado_em"),
  ]);

  const caminhosFotos = (anexos ?? []).map((a) => a.storage_path);
  const caminhosAss = (assinaturas ?? []).map((a) => a.imagem_path);
  const [urlsFotos, urlsAss] = await Promise.all([
    caminhosFotos.length
      ? sa.storage.from("os-anexos").createSignedUrls(caminhosFotos, URL_SEGUNDOS)
      : Promise.resolve({ data: [] as { path: string | null; signedUrl: string }[] }),
    caminhosAss.length
      ? sa.storage.from("assinaturas").createSignedUrls(caminhosAss, URL_SEGUNDOS)
      : Promise.resolve({ data: [] as { path: string | null; signedUrl: string }[] }),
  ]);
  const mapaFotos = new Map((urlsFotos.data ?? []).map((u) => [u.path, u.signedUrl]));
  const mapaAss = new Map((urlsAss.data ?? []).map((u) => [u.path, u.signedUrl]));

  return {
    visitas: visitas ?? [],
    itens: (itens ?? []).map((i) => ({
      ...i,
      quantidade: Number(i.quantidade),
      valor_unitario: Number(i.valor_unitario),
      valor_total: Number(i.valor_total ?? 0),
    })),
    fotos: (anexos ?? []).map((a): FotoOs => ({
      id: a.id,
      tipo: a.tipo,
      nome: a.storage_path.split("/").pop() ?? "foto",
      legenda: a.legenda,
      mime: a.mime_type,
      url: mapaFotos.get(a.storage_path) ?? null,
      caminho: a.storage_path,
    })),
    assinaturas: (assinaturas ?? []).map((a): AssinaturaOs => ({
      id: a.id,
      tipo: a.tipo,
      nome: a.nome_signatario,
      documento: a.documento_signatario,
      cargo: a.cargo,
      assinadoEm: a.assinado_em,
      remota: a.remota,
      url: mapaAss.get(a.imagem_path) ?? null,
    })),
  };
}

/** Itens do catálogo para o técnico escolher na OS. */
export async function opcoesCatalogo() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("itens_catalogo")
    .select("id, descricao, tipo, unidade, valor_unitario")
    .eq("ativo", true)
    .order("descricao")
    .limit(1000);
  return (data ?? []).map((i) => ({ ...i, valor_unitario: Number(i.valor_unitario) }));
}

/**
 * Dados completos da OS com a service_role (encerramento, hash e PDF).
 * Use apenas depois de autorizar a operação.
 */
export async function dadosCompletosOs(osId: string) {
  const sa = createAdminClient();
  const [
    { data: os },
    { data: visitas },
    { data: itens },
    { data: anexos },
    { data: assinaturas },
    { data: configs },
  ] = await Promise.all([
    sa
      .from("ordens_servico")
      .select(
        `*,
           chamados(id, protocolo, titulo, aberto_por, status),
           clientes(id, razao_social, nome_fantasia, cnpj_cpf, email, telefone),
           unidades(*),
           tecnico:profiles!ordens_servico_tecnico_id_fkey(id, nome, email, assinatura_path)`,
      )
      .eq("id", osId)
      .single(),
    sa.from("os_visitas").select("*").eq("os_id", osId).order("data_hora_chegada"),
    sa.from("os_itens").select("*").eq("os_id", osId).order("created_at").order("id"),
    sa.from("os_anexos").select("*").eq("os_id", osId).order("created_at").order("id"),
    sa.from("os_assinaturas").select("*").eq("os_id", osId).is("invalidada_em", null).order("assinado_em"),
    sa.from("configuracoes").select("chave, valor").in("chave", ["empresa", "assinatura", "pdf"]),
  ]);
  if (!os) return null;
  const cfg = (chave: string) => configs?.find((c) => c.chave === chave)?.valor;
  return {
    os,
    visitas: visitas ?? [],
    itens: itens ?? [],
    anexos: anexos ?? [],
    assinaturas: assinaturas ?? [],
    empresa: lerConfig("empresa", cfg("empresa")),
    assinatura: lerConfig("assinatura", cfg("assinatura")),
    pdf: lerConfig("pdf", cfg("pdf")),
  };
}

export type DadosCompletosOs = NonNullable<Awaited<ReturnType<typeof dadosCompletosOs>>>;

/** Monta o conteúdo assinado (base do hash) a partir dos dados completos. */
export function montarConteudoOs(d: DadosCompletosOs): ConteudoOs {
  const { os } = d;
  return {
    numero: os.numero,
    protocolo: os.chamados?.protocolo ?? null,
    cliente: { razao_social: os.clientes?.razao_social ?? "", cnpj_cpf: os.clientes?.cnpj_cpf ?? null },
    unidade: os.unidades ? { nome: os.unidades.nome, endereco: enderecoCompleto(os.unidades) } : null,
    tecnico: os.tecnico_nome_snapshot ?? os.tecnico?.nome ?? null,
    tipo_atendimento: os.tipo_atendimento,
    problema_relatado: os.problema_relatado,
    diagnostico: os.diagnostico,
    servico_executado: os.servico_executado,
    observacoes_tecnicas: os.observacoes_tecnicas,
    recomendacoes: os.recomendacoes,
    pendencias: os.pendencias,
    pendencias_texto: os.pendencias ? os.pendencias_texto : null,
    data_inicio: os.data_inicio,
    data_fim: os.data_fim,
    visitas: d.visitas.map((v) => ({
      chegada: v.data_hora_chegada,
      saida: v.data_hora_saida,
      horas: v.horas_trabalhadas == null ? null : Number(v.horas_trabalhadas),
    })),
    itens: d.itens.map((i) => ({
      descricao: i.descricao,
      tipo: i.tipo,
      quantidade: Number(i.quantidade),
      valor_unitario: Number(i.valor_unitario),
      cobrado: i.cobrado,
    })),
    anexos: d.anexos.map((a) => ({ tipo: a.tipo, caminho: a.storage_path })),
    termo: d.assinatura.termo_aceite,
  };
}

/** Resumo para exibição (assinatura, portal, admin) a partir da OS e dos detalhes. */
export function resumoParaExibicao(
  os: OsCarregada,
  detalhes: Awaited<ReturnType<typeof carregarDetalhesOs>>,
  exibirValores: boolean,
): ResumoOs {
  return {
    numero: os.numero,
    protocolo: os.chamados?.protocolo ?? null,
    cliente: os.clientes?.nome_fantasia || os.clientes?.razao_social || "—",
    unidade: os.unidades?.nome ?? null,
    endereco: os.unidades ? enderecoCompleto(os.unidades) : null,
    tecnico: os.tecnico_nome_snapshot ?? os.tecnico?.nome ?? null,
    tipo: os.tipo_atendimento,
    problema: os.problema_relatado,
    diagnostico: os.diagnostico,
    servico: os.servico_executado,
    observacoes: os.observacoes_tecnicas,
    recomendacoes: os.recomendacoes,
    pendencias: os.pendencias ? os.pendencias_texto : null,
    visitas: detalhes.visitas.map((v) => ({
      chegada: v.data_hora_chegada,
      saida: v.data_hora_saida,
      horas: v.horas_trabalhadas == null ? null : Number(v.horas_trabalhadas),
    })),
    itens: detalhes.itens,
    exibirValores,
    fotos: detalhes.fotos,
  };
}

/**
 * Resumo a partir dos dados completos (service_role) — usado na página pública
 * de assinatura, DEPOIS de validar o token do link.
 */
export async function resumoDeDadosCompletos(d: DadosCompletosOs): Promise<ResumoOs> {
  const sa = createAdminClient();
  const caminhos = d.anexos.map((a) => a.storage_path);
  const { data: urls } = caminhos.length
    ? await sa.storage.from("os-anexos").createSignedUrls(caminhos, URL_SEGUNDOS)
    : { data: [] as { path: string | null; signedUrl: string }[] };
  const mapa = new Map((urls ?? []).map((u) => [u.path, u.signedUrl]));
  const { os } = d;
  return {
    numero: os.numero,
    protocolo: os.chamados?.protocolo ?? null,
    cliente: os.clientes?.nome_fantasia || os.clientes?.razao_social || "—",
    unidade: os.unidades?.nome ?? null,
    endereco: os.unidades ? enderecoCompleto(os.unidades) : null,
    tecnico: os.tecnico_nome_snapshot ?? os.tecnico?.nome ?? null,
    tipo: os.tipo_atendimento,
    problema: os.problema_relatado,
    diagnostico: os.diagnostico,
    servico: os.servico_executado,
    observacoes: os.observacoes_tecnicas,
    recomendacoes: os.recomendacoes,
    pendencias: os.pendencias ? os.pendencias_texto : null,
    visitas: d.visitas.map((v) => ({
      chegada: v.data_hora_chegada,
      saida: v.data_hora_saida,
      horas: v.horas_trabalhadas == null ? null : Number(v.horas_trabalhadas),
    })),
    itens: d.itens.map((i) => ({
      descricao: i.descricao,
      tipo: i.tipo,
      quantidade: Number(i.quantidade),
      valor_unitario: Number(i.valor_unitario),
      cobrado: i.cobrado,
    })),
    exibirValores: d.pdf.exibir_valores,
    fotos: d.anexos.map((a) => ({
      id: a.id,
      tipo: a.tipo,
      nome: a.storage_path.split("/").pop() ?? "foto",
      legenda: a.legenda,
      mime: a.mime_type,
      url: mapa.get(a.storage_path) ?? null,
      caminho: a.storage_path,
    })),
  };
}
