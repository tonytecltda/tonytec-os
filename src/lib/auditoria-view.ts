/** Apresentação da trilha de auditoria (puro, sem acesso ao banco). */

export const TABELAS_AUDITORIA: Record<string, string> = {
  profiles: "Usuários",
  clientes: "Clientes",
  unidades: "Unidades",
  contratos: "Contratos",
  configuracoes: "Configurações",
  itens_catalogo: "Catálogo de itens",
  categorias_servico: "Categorias de serviço",
  tipos_problema: "Tipos de problema",
  chamados: "Chamados",
  ordens_servico: "Ordens de serviço",
  os_visitas: "Visitas da OS",
};

export const ACOES_AUDITORIA: Record<string, string> = {
  insert: "Criação",
  update: "Alteração",
  delete: "Exclusão",
  status: "Mudança de situação da OS",
  reabertura_os: "Reabertura de OS",
  os_cancelada: "OS cancelada",
  chamado_cancelado: "Chamado cancelado",
  alteracao_cobranca_pos_assinatura: "Cobrança ajustada após assinatura",
  cobranca_recalculada: "Cobrança recalculada",
  contrato_criado: "Contrato criado",
  contrato_alterado: "Contrato alterado",
  catalogo_desativado: "Item de catálogo desativado",
  usuario_criado: "Usuário criado",
  link_acesso_gerado: "Link de acesso gerado",
  link_assinatura_gerado: "Link de assinatura gerado",
};

export const rotuloTabela = (t: string) => TABELAS_AUDITORIA[t] ?? t;
export const rotuloAcao = (a: string) => ACOES_AUDITORIA[a] ?? a.replace(/_/g, " ");

type Obj = Record<string, unknown>;
const comoObjeto = (v: unknown): Obj | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null;

/** Campo que melhor identifica o registro em cada tabela. */
export const CAMPOS_IDENTIFICACAO: Record<string, string[]> = {
  profiles: ["nome", "email"],
  clientes: ["nome_fantasia", "razao_social"],
  unidades: ["nome"],
  contratos: ["numero"],
  configuracoes: ["chave"],
  itens_catalogo: ["nome", "descricao"],
  categorias_servico: ["nome"],
  tipos_problema: ["nome"],
  chamados: ["protocolo"],
  ordens_servico: ["numero"],
};

export function rotuloRegistro(
  tabela: string,
  antes: unknown,
  depois: unknown,
  registroId: string | null,
): string {
  for (const origem of [comoObjeto(depois), comoObjeto(antes)]) {
    for (const campo of CAMPOS_IDENTIFICACAO[tabela] ?? []) {
      const v = origem?.[campo];
      if (typeof v === "string" && v.trim()) return v;
    }
  }
  return registroId ? registroId.slice(0, 8) : "—";
}

const CAMPOS_RUIDO = new Set(["id", "created_at", "updated_at"]);

export type LinhaDiff = { campo: string; antes: string | null; depois: string | null };

function texto(v: unknown): string {
  if (v === null || v === undefined) return "—";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 120 ? `${s.slice(0, 117)}…` : s;
}

/** Alteração campo a campo (antes → depois). Em criação/exclusão mostra só um dos lados. */
export function diffAuditoria(antes: unknown, depois: unknown): LinhaDiff[] {
  const a = comoObjeto(antes);
  const d = comoObjeto(depois);
  const campos = [...new Set([...Object.keys(a ?? {}), ...Object.keys(d ?? {})])]
    .filter((c) => !CAMPOS_RUIDO.has(c))
    .sort();
  return campos.map((campo) => ({
    campo,
    antes: a ? texto(a[campo]) : null,
    depois: d ? texto(d[campo]) : null,
  }));
}
