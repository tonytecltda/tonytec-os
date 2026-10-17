/**
 * Catálogo dos 11 relatórios. Cada seção chama uma função SQL (rel_*) e define como
 * exibir/exportar as colunas. Sem dependências de servidor: testável.
 */
export type FormatoRel =
  "texto" | "inteiro" | "numero" | "moeda" | "percentual" | "data" | "datahora" | "dia_semana";

export type ColunaRel = { chave: string; titulo: string; formato?: FormatoRel; largura?: number };

export type GraficoRel = "evolucao" | "faturamento_mes" | "calor";

export type SecaoRel = {
  id: string;
  titulo: string;
  /** Função SQL (schema public). */
  fn: string;
  /** Parâmetro extra (dimensão) quando a função aceita. */
  dim?: string;
  colunas: ColunaRel[];
  grafico?: GraficoRel;
  /** Mostra só o gráfico na tela (a tabela vai apenas nas exportações). */
  somenteGrafico?: boolean;
};

export type RelatorioDef = {
  id: string;
  titulo: string;
  descricao: string;
  /** Relatórios sem filtro de período (retrato de agora). */
  semPeriodo?: boolean;
  secoes: SecaoRel[];
};

const SLA_COLUNAS = (grupo: string): ColunaRel[] => [
  { chave: "grupo", titulo: grupo, largura: 30 },
  { chave: "chamados", titulo: "Chamados", formato: "inteiro" },
  { chave: "resposta_ok", titulo: "Resposta no prazo", formato: "inteiro" },
  { chave: "resposta_total", titulo: "Resposta (avaliados)", formato: "inteiro" },
  { chave: "resposta_pct", titulo: "Resposta (%)", formato: "percentual" },
  { chave: "solucao_ok", titulo: "Solução no prazo", formato: "inteiro" },
  { chave: "solucao_total", titulo: "Solução (avaliados)", formato: "inteiro" },
  { chave: "solucao_pct", titulo: "Solução (%)", formato: "percentual" },
];

const FAT_COLUNAS = (grupo: string): ColunaRel[] => [
  { chave: "grupo", titulo: grupo, largura: 30 },
  { chave: "itens", titulo: "Lançamentos", formato: "inteiro" },
  { chave: "a_faturar", titulo: "A faturar", formato: "moeda" },
  { chave: "faturado", titulo: "Faturado", formato: "moeda" },
  { chave: "total", titulo: "Total", formato: "moeda" },
];

export const RELATORIOS: RelatorioDef[] = [
  {
    id: "clientes",
    titulo: "Clientes mais atendidos",
    descricao: "Chamados, OS encerradas, horas e valores por cliente.",
    secoes: [
      {
        id: "clientes",
        titulo: "Clientes",
        fn: "rel_clientes",
        colunas: [
          { chave: "cliente", titulo: "Cliente", largura: 34 },
          { chave: "chamados", titulo: "Chamados", formato: "inteiro" },
          { chave: "os_encerradas", titulo: "OS encerradas", formato: "inteiro" },
          { chave: "horas", titulo: "Horas", formato: "numero" },
          { chave: "valor_total", titulo: "Valor total", formato: "moeda" },
          { chave: "valor_faturado", titulo: "Valor faturado", formato: "moeda" },
        ],
      },
    ],
  },
  {
    id: "problemas",
    titulo: "Problemas e reincidência",
    descricao:
      "Problemas mais resolvidos e recorrentes por categoria e tipo; reincidência por cliente e unidade (mesmo problema em até 30 dias).",
    secoes: [
      {
        id: "problemas",
        titulo: "Por categoria e tipo de problema",
        fn: "rel_problemas",
        colunas: [
          { chave: "categoria", titulo: "Categoria", largura: 24 },
          { chave: "tipo", titulo: "Tipo de problema", largura: 34 },
          { chave: "chamados", titulo: "Chamados", formato: "inteiro" },
          { chave: "resolvidos", titulo: "Resolvidos", formato: "inteiro" },
          { chave: "tempo_medio_resolucao_h", titulo: "Tempo médio de resolução (h)", formato: "numero" },
        ],
      },
      {
        id: "reincidencia",
        titulo: "Reincidência por cliente e unidade",
        fn: "rel_reincidencia",
        colunas: [
          { chave: "cliente", titulo: "Cliente", largura: 30 },
          { chave: "unidade", titulo: "Unidade", largura: 24 },
          { chave: "tipo", titulo: "Problema", largura: 30 },
          { chave: "ocorrencias", titulo: "Ocorrências", formato: "inteiro" },
          { chave: "reincidencias", titulo: "Reincidências", formato: "inteiro" },
          { chave: "taxa_pct", titulo: "Taxa de reincidência (%)", formato: "percentual" },
        ],
      },
    ],
  },
  {
    id: "tecnicos",
    titulo: "Produtividade por técnico",
    descricao: "OS encerradas, horas, tempo médio por OS, chamados resolvidos e nota média.",
    secoes: [
      {
        id: "tecnicos",
        titulo: "Técnicos",
        fn: "rel_tecnicos",
        colunas: [
          { chave: "tecnico", titulo: "Técnico", largura: 28 },
          { chave: "os_encerradas", titulo: "OS encerradas", formato: "inteiro" },
          { chave: "horas", titulo: "Horas", formato: "numero" },
          { chave: "tempo_medio_por_os_h", titulo: "Tempo médio por OS (h)", formato: "numero" },
          { chave: "chamados_resolvidos", titulo: "Chamados resolvidos", formato: "inteiro" },
          { chave: "nota_media", titulo: "Nota média", formato: "numero" },
          { chave: "avaliacoes", titulo: "Avaliações", formato: "inteiro" },
        ],
      },
    ],
  },
  {
    id: "sla",
    titulo: "SLA",
    descricao: "Cumprimento de prazos por prioridade, cliente e técnico, e lista de violações.",
    secoes: [
      {
        id: "sla-prioridade",
        titulo: "Por prioridade",
        fn: "rel_sla",
        dim: "prioridade",
        colunas: SLA_COLUNAS("Prioridade"),
      },
      {
        id: "sla-cliente",
        titulo: "Por cliente",
        fn: "rel_sla",
        dim: "cliente",
        colunas: SLA_COLUNAS("Cliente"),
      },
      {
        id: "sla-tecnico",
        titulo: "Por técnico",
        fn: "rel_sla",
        dim: "tecnico",
        colunas: SLA_COLUNAS("Técnico"),
      },
      {
        id: "sla-violacoes",
        titulo: "Violações",
        fn: "rel_sla_violacoes",
        colunas: [
          { chave: "protocolo", titulo: "Protocolo", largura: 16 },
          { chave: "cliente", titulo: "Cliente", largura: 28 },
          { chave: "tecnico", titulo: "Técnico", largura: 22 },
          { chave: "prioridade", titulo: "Prioridade", largura: 12 },
          { chave: "prazo", titulo: "Prazo", largura: 12 },
          { chave: "limite", titulo: "Limite", formato: "datahora", largura: 18 },
          { chave: "concluido_em", titulo: "Concluído em", formato: "datahora", largura: 18 },
          { chave: "atraso_h", titulo: "Atraso (h)", formato: "numero" },
        ],
      },
    ],
  },
  {
    id: "faturamento",
    titulo: "Faturamento de visitas",
    descricao: "Visitas e materiais por cliente, por tipo de cobrança e por mês; a faturar x faturado.",
    secoes: [
      {
        id: "fat-mes",
        titulo: "Por mês",
        fn: "rel_faturamento",
        dim: "mes",
        colunas: FAT_COLUNAS("Mês"),
        grafico: "faturamento_mes",
      },
      {
        id: "fat-cliente",
        titulo: "Por cliente",
        fn: "rel_faturamento",
        dim: "cliente",
        colunas: FAT_COLUNAS("Cliente"),
      },
      {
        id: "fat-tipo",
        titulo: "Por tipo de cobrança",
        fn: "rel_faturamento",
        dim: "tipo",
        colunas: FAT_COLUNAS("Tipo"),
      },
    ],
  },
  {
    id: "contratos",
    titulo: "Consumo de contratos",
    descricao: "Visitas e horas usadas x inclusas no período, excedentes cobrados e contratos a vencer.",
    secoes: [
      {
        id: "contratos",
        titulo: "Contratos ativos",
        fn: "rel_contratos",
        colunas: [
          { chave: "contrato", titulo: "Contrato", largura: 18 },
          { chave: "cliente", titulo: "Cliente", largura: 28 },
          { chave: "vigencia_fim", titulo: "Fim", formato: "data" },
          { chave: "dias_para_vencer", titulo: "Dias p/ vencer", formato: "inteiro" },
          { chave: "mensal", titulo: "Mensalidade", formato: "moeda" },
          { chave: "visitas_inclusas", titulo: "Visitas inclusas/mês", formato: "inteiro" },
          { chave: "horas_inclusas", titulo: "Horas inclusas/mês", formato: "numero" },
          { chave: "visitas_usadas", titulo: "Visitas usadas", formato: "inteiro" },
          { chave: "horas_usadas", titulo: "Horas usadas", formato: "numero" },
          { chave: "visitas_excedentes", titulo: "Excedentes", formato: "inteiro" },
          { chave: "valor_excedente", titulo: "Valor excedente", formato: "moeda" },
        ],
      },
    ],
  },
  {
    id: "evolucao",
    titulo: "Evolução mensal",
    descricao: "Chamados abertos x resolvidos, backlog e tempo médio de resolução por mês.",
    secoes: [
      {
        id: "evolucao",
        titulo: "Por mês",
        fn: "rel_evolucao",
        grafico: "evolucao",
        colunas: [
          { chave: "mes", titulo: "Mês" },
          { chave: "abertos", titulo: "Abertos", formato: "inteiro" },
          { chave: "resolvidos", titulo: "Resolvidos", formato: "inteiro" },
          { chave: "backlog_final", titulo: "Backlog no fim do mês", formato: "inteiro" },
          { chave: "tempo_medio_resolucao_h", titulo: "Tempo médio de resolução (h)", formato: "numero" },
        ],
      },
    ],
  },
  {
    id: "satisfacao",
    titulo: "Satisfação",
    descricao: "Notas e comentários dos clientes sobre os atendimentos.",
    secoes: [
      {
        id: "satisfacao",
        titulo: "Avaliações",
        fn: "rel_satisfacao",
        colunas: [
          { chave: "avaliado_em", titulo: "Data", formato: "datahora", largura: 18 },
          { chave: "protocolo", titulo: "Protocolo", largura: 16 },
          { chave: "cliente", titulo: "Cliente", largura: 28 },
          { chave: "tecnico", titulo: "Técnico", largura: 22 },
          { chave: "nota", titulo: "Nota", formato: "inteiro" },
          { chave: "comentario", titulo: "Comentário", largura: 50 },
        ],
      },
    ],
  },
  {
    id: "materiais",
    titulo: "Materiais e equipamentos",
    descricao: "Itens mais utilizados nas OS encerradas.",
    secoes: [
      {
        id: "materiais",
        titulo: "Itens",
        fn: "rel_materiais",
        colunas: [
          { chave: "item", titulo: "Item", largura: 36 },
          { chave: "tipo", titulo: "Tipo", largura: 16 },
          { chave: "quantidade", titulo: "Quantidade", formato: "numero" },
          { chave: "os", titulo: "OS", formato: "inteiro" },
          { chave: "valor_total", titulo: "Valor total", formato: "moeda" },
        ],
      },
    ],
  },
  {
    id: "calor",
    titulo: "Chamados por horário e dia da semana",
    descricao: "Mapa de calor da abertura de chamados e distribuição por categoria e dia da semana.",
    secoes: [
      {
        id: "calor",
        titulo: "Mapa de calor (dia × hora)",
        fn: "rel_calor",
        grafico: "calor",
        somenteGrafico: true,
        colunas: [
          { chave: "dia_semana", titulo: "Dia da semana", formato: "dia_semana" },
          { chave: "hora", titulo: "Hora", formato: "inteiro" },
          { chave: "chamados", titulo: "Chamados", formato: "inteiro" },
        ],
      },
      {
        id: "categoria-dia",
        titulo: "Categoria × dia da semana",
        fn: "rel_categoria_dia",
        colunas: [
          { chave: "categoria", titulo: "Categoria", largura: 26 },
          { chave: "dom", titulo: "Dom", formato: "inteiro" },
          { chave: "seg", titulo: "Seg", formato: "inteiro" },
          { chave: "ter", titulo: "Ter", formato: "inteiro" },
          { chave: "qua", titulo: "Qua", formato: "inteiro" },
          { chave: "qui", titulo: "Qui", formato: "inteiro" },
          { chave: "sex", titulo: "Sex", formato: "inteiro" },
          { chave: "sab", titulo: "Sáb", formato: "inteiro" },
          { chave: "total", titulo: "Total", formato: "inteiro" },
        ],
      },
    ],
  },
  {
    id: "os-pendentes",
    titulo: "OS pendentes",
    descricao: "OS aguardando assinatura (agora) e OS com pendências registradas.",
    secoes: [
      {
        id: "os-aguardando",
        titulo: "Aguardando assinatura",
        fn: "rel_os_aguardando",
        colunas: [
          { chave: "os", titulo: "OS", largura: 16 },
          { chave: "cliente", titulo: "Cliente", largura: 30 },
          { chave: "tecnico", titulo: "Técnico", largura: 22 },
          { chave: "concluida_em", titulo: "Concluída em", formato: "datahora", largura: 18 },
          { chave: "dias_aguardando", titulo: "Dias aguardando", formato: "inteiro" },
        ],
      },
      {
        id: "os-pendencias",
        titulo: "Com pendências",
        fn: "rel_os_pendencias",
        colunas: [
          { chave: "os", titulo: "OS", largura: 16 },
          { chave: "cliente", titulo: "Cliente", largura: 30 },
          { chave: "tecnico", titulo: "Técnico", largura: 22 },
          { chave: "encerrada_em", titulo: "Encerrada em", formato: "datahora", largura: 18 },
          { chave: "pendencia", titulo: "Pendência", largura: 50 },
        ],
      },
    ],
  },
];

export const RELATORIO_POR_ID = new Map(RELATORIOS.map((r) => [r.id, r]));

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/** Valor bruto do banco -> texto para a tela. */
export function exibirValor(valor: unknown, formato: FormatoRel = "texto"): string {
  if (valor == null || valor === "") return "—";
  switch (formato) {
    case "moeda":
      return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    case "numero":
      return Number(valor).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
    case "inteiro":
      return Number(valor).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
    case "percentual":
      return `${Number(valor).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
    case "dia_semana":
      return DIAS[Number(valor)] ?? String(valor);
    case "data": {
      const [a, m, d] = String(valor).slice(0, 10).split("-");
      return `${d}/${m}/${a}`;
    }
    case "datahora":
      return new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(String(valor)));
    default:
      return String(valor);
  }
}

/** Valor bruto -> célula de planilha (números continuam números; datas viram Date). */
export function valorExportacao(
  valor: unknown,
  formato: FormatoRel = "texto",
): string | number | Date | null {
  if (valor == null || valor === "") return null;
  switch (formato) {
    case "moeda":
    case "numero":
    case "inteiro":
    case "percentual":
      return Number(valor);
    case "dia_semana":
      return DIAS[Number(valor)] ?? String(valor);
    case "data":
      return new Date(`${String(valor).slice(0, 10)}T12:00:00-03:00`);
    case "datahora":
      return new Date(String(valor));
    default:
      return String(valor);
  }
}
