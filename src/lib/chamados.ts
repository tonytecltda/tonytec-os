import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CHAMADO_STATUS, PRIORIDADE } from "@/lib/labels";
import { formatDataHora } from "@/lib/format";

const BUCKET = "chamado-anexos";
/** Validade das URLs de anexos exibidas na página (expiração curta, LGPD). */
const URL_ANEXO_SEGUNDOS = 10 * 60;

/**
 * Chamado com cliente, unidade, categoria, técnico e contrato.
 * A RLS decide se o usuário pode vê-lo (retorna null se não puder).
 */
export async function carregarChamado(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("chamados")
    .select(
      `*,
       clientes(id, razao_social, nome_fantasia, telefone),
       unidades(*),
       categorias_servico(nome),
       tipos_problema(nome),
       contratos(id, numero),
       tecnico:profiles!chamados_tecnico_id_fkey(id, nome, telefone),
       abertoPor:profiles!chamados_aberto_por_fkey(id, nome, role)`,
    )
    .eq("id", id)
    .maybeSingle();
  return data;
}

export type ChamadoCompleto = NonNullable<Awaited<ReturnType<typeof carregarChamado>>>;

export type EventoTimeline =
  | {
      tipo: "comentario";
      id: string;
      data: string;
      autor: string;
      papel: string | null;
      mensagem: string;
      interno: boolean;
    }
  | { tipo: "historico"; id: string; data: string; autor: string | null; texto: string };

const PAPEL_LABEL: Record<string, string> = { admin: "Tonytec", tecnico: "Técnico", cliente: "Cliente" };

function textoHistorico(campo: string, anterior: string | null, novo: string | null): string {
  const st = (v: string | null) => (v ? (CHAMADO_STATUS[v as keyof typeof CHAMADO_STATUS] ?? v) : "—");
  switch (campo) {
    case "abertura":
      return "Chamado aberto";
    case "status":
      return `Status: ${st(anterior)} → ${st(novo)}`;
    case "tecnico":
      return novo ? `Técnico responsável: ${novo}` : `Técnico removido${anterior ? ` (${anterior})` : ""}`;
    case "prioridade": {
      const p = (v: string | null) => (v ? (PRIORIDADE[v as keyof typeof PRIORIDADE] ?? v) : "—");
      return `Prioridade: ${p(anterior)} → ${p(novo)}`;
    }
    case "data_agendada":
      return novo ? `Visita agendada para ${formatDataHora(novo)}` : "Agendamento removido";
    default:
      return `${campo}: ${anterior ?? "—"} → ${novo ?? "—"}`;
  }
}

/** Comentários (a RLS esconde as notas internas do cliente) + histórico, em ordem cronológica. */
export async function carregarTimeline(chamadoId: string): Promise<EventoTimeline[]> {
  const supabase = await createClient();
  const [{ data: comentarios }, { data: historico }] = await Promise.all([
    supabase
      .from("chamado_comentarios")
      .select("id, mensagem, interno, created_at, autor:profiles(nome, role)")
      .eq("chamado_id", chamadoId)
      .order("created_at"),
    supabase
      .from("chamado_historico")
      .select("id, campo, valor_anterior, valor_novo, created_at, autor:profiles(nome)")
      .eq("chamado_id", chamadoId)
      .order("created_at"),
  ]);

  const eventos: EventoTimeline[] = [
    ...(comentarios ?? []).map((c) => ({
      tipo: "comentario" as const,
      id: c.id,
      data: c.created_at,
      autor: c.autor?.nome ?? "Usuário",
      papel: c.autor?.role ? PAPEL_LABEL[c.autor.role] : null,
      mensagem: c.mensagem,
      interno: c.interno,
    })),
    ...(historico ?? []).map((h) => ({
      tipo: "historico" as const,
      id: `h${h.id}`,
      data: h.created_at,
      autor: h.autor?.nome ?? null,
      texto: textoHistorico(h.campo, h.valor_anterior, h.valor_novo),
    })),
  ];
  return eventos.sort((a, b) => a.data.localeCompare(b.data));
}

export type AnexoComUrl = {
  id: string;
  nome: string;
  mime: string | null;
  tamanho: number | null;
  data: string;
  autor: string | null;
  url: string | null;
};

/** Anexos visíveis ao usuário (RLS) com URL assinada de curta duração. */
export async function carregarAnexos(chamadoId: string): Promise<AnexoComUrl[]> {
  const supabase = await createClient();
  const { data: anexos } = await supabase
    .from("chamado_anexos")
    .select("id, storage_path, nome_arquivo, mime_type, tamanho_bytes, created_at, autor:profiles(nome)")
    .eq("chamado_id", chamadoId)
    .order("created_at");
  if (!anexos?.length) return [];

  // A RLS já confirmou o acesso às linhas; a assinatura usa a service_role (bucket sem policies).
  const { data: urls } = await createAdminClient()
    .storage.from(BUCKET)
    .createSignedUrls(
      anexos.map((a) => a.storage_path),
      URL_ANEXO_SEGUNDOS,
    );
  const porCaminho = new Map((urls ?? []).map((u) => [u.path, u.signedUrl]));

  return anexos.map((a) => ({
    id: a.id,
    nome: a.nome_arquivo,
    mime: a.mime_type,
    tamanho: a.tamanho_bytes,
    data: a.created_at,
    autor: a.autor?.nome ?? null,
    url: porCaminho.get(a.storage_path) ?? null,
  }));
}

/** Técnicos ativos (selects de atribuição). */
export async function opcoesTecnicos() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, nome")
    .eq("role", "tecnico")
    .eq("ativo", true)
    .order("nome");
  return (data ?? []).map((t) => ({ value: t.id, label: t.nome }));
}

/** Categorias e tipos de problema ativos (formulários de abertura). */
export async function opcoesCategorias() {
  const supabase = await createClient();
  const [{ data: categorias }, { data: tipos }] = await Promise.all([
    supabase.from("categorias_servico").select("id, nome").eq("ativo", true).order("ordem").order("nome"),
    supabase.from("tipos_problema").select("id, nome, categoria_id").eq("ativo", true).order("nome"),
  ]);
  return {
    categorias: (categorias ?? []).map((c) => ({ value: c.id, label: c.nome })),
    tipos: (tipos ?? []).map((t) => ({ value: t.id, label: t.nome, categoriaId: t.categoria_id })),
  };
}
