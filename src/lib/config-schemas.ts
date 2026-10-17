import { z } from "zod";
import { isCnpjValido } from "@/lib/documentos";

/**
 * Esquemas das chaves de public.configuracoes (valor jsonb).
 * Usados no formulário (cliente) e na Server Action (servidor).
 */
const emailOuVazio = z
  .string()
  .trim()
  .refine((v) => v === "" || z.email().safeParse(v).success, "E-mail inválido.");

export const empresaSchema = z.object({
  razao_social: z.string().trim().min(1, "Informe a razão social.").max(200),
  nome_fantasia: z.string().trim().max(120),
  cnpj: z
    .string()
    .trim()
    .refine((v) => v === "" || isCnpjValido(v), "CNPJ inválido."),
  endereco: z.string().trim().max(300),
  telefone: z.string().trim().max(30),
  email: emailOuVazio,
  site: z.string().trim().max(200),
  logo_path: z.string().nullable(),
});

export const cobrancaSchema = z.object({
  valor_hora_padrao: z.number({ error: "Informe o valor." }).min(0, "Valor inválido."),
  valor_visita_padrao: z.number({ error: "Informe o valor." }).min(0, "Valor inválido."),
  minimo_horas_cobraveis: z
    .number({ error: "Informe o mínimo." })
    .min(0, "Valor inválido.")
    .max(24, "Máximo de 24 horas."),
  fracao_minutos: z
    .number({ error: "Informe a fração." })
    .int()
    .min(1, "Mínimo de 1 minuto.")
    .max(60, "Máximo de 60 minutos."),
});

const prazo = z.object({
  resposta: z.number({ error: "Informe as horas." }).positive("Deve ser maior que zero."),
  solucao: z.number({ error: "Informe as horas." }).positive("Deve ser maior que zero."),
});

export const slaPadraoSchema = z
  .object({ urgente: prazo, alta: prazo, media: prazo, baixa: prazo })
  .superRefine((v, ctx) => {
    for (const p of ["urgente", "alta", "media", "baixa"] as const) {
      if (v[p].solucao < v[p].resposta) {
        ctx.addIssue({
          code: "custom",
          path: [p, "solucao"],
          message: "A solução não pode ser menor que a resposta.",
        });
      }
    }
  });

const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida (HH:MM).");

export const horarioComercialSchema = z
  .object({
    ativo: z.boolean(),
    dias: z.array(z.number().int().min(1).max(7)).min(1, "Selecione ao menos um dia."),
    inicio: hora,
    fim: hora,
  })
  .refine((v) => v.fim > v.inicio, { path: ["fim"], message: "O fim deve ser depois do início." });

export const assinaturaSchema = z.object({
  termo_aceite: z
    .string()
    .trim()
    .min(20, "O termo precisa ter pelo menos 20 caracteres.")
    .max(4000, "Máximo de 4000 caracteres."),
  validade_link_horas: z
    .number({ error: "Informe a validade." })
    .int()
    .min(1, "Mínimo de 1 hora.")
    .max(720, "Máximo de 720 horas (30 dias)."),
});

export const pdfSchema = z.object({
  rodape: z.string().trim().max(300, "Máximo de 300 caracteres."),
  exibir_valores: z.boolean(),
});

export const CONFIG_SCHEMAS = {
  empresa: empresaSchema,
  cobranca: cobrancaSchema,
  sla_padrao: slaPadraoSchema,
  sla_horario_comercial: horarioComercialSchema,
  assinatura: assinaturaSchema,
  pdf: pdfSchema,
} as const;

export type ConfigChave = keyof typeof CONFIG_SCHEMAS;
export type ConfigValor<K extends ConfigChave> = z.infer<(typeof CONFIG_SCHEMAS)[K]>;

/** Valores usados quando a chave não existe no banco (mesmos do seed). */
export const CONFIG_PADRAO: { [K in ConfigChave]: ConfigValor<K> } = {
  empresa: {
    razao_social: "Tonytec Ltda",
    nome_fantasia: "Tonytec",
    cnpj: "",
    endereco: "",
    telefone: "",
    email: "",
    site: "",
    logo_path: null,
  },
  cobranca: {
    valor_hora_padrao: 150,
    valor_visita_padrao: 180,
    minimo_horas_cobraveis: 1,
    fracao_minutos: 15,
  },
  sla_padrao: {
    urgente: { resposta: 1, solucao: 4 },
    alta: { resposta: 4, solucao: 8 },
    media: { resposta: 8, solucao: 24 },
    baixa: { resposta: 24, solucao: 72 },
  },
  sla_horario_comercial: { ativo: true, dias: [1, 2, 3, 4, 5], inicio: "08:00", fim: "18:00" },
  assinatura: {
    termo_aceite: "Declaro que os serviços descritos nesta Ordem de Serviço foram executados e conferidos.",
    validade_link_horas: 72,
  },
  pdf: { rodape: "", exibir_valores: true },
};

/** Mescla o valor do banco com os padrões, tolerando chaves ausentes/antigas. */
export function lerConfig<K extends ConfigChave>(chave: K, valorDb: unknown): ConfigValor<K> {
  const base = CONFIG_PADRAO[chave];
  const mesclado =
    valorDb && typeof valorDb === "object" && !Array.isArray(valorDb)
      ? { ...base, ...(valorDb as Record<string, unknown>) }
      : base;
  const parsed = CONFIG_SCHEMAS[chave].safeParse(mesclado);
  return (parsed.success ? parsed.data : base) as ConfigValor<K>;
}
