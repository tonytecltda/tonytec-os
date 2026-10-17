import { z } from "zod";
import { isDocumentoValido } from "@/lib/documentos";
import { UFS } from "@/lib/labels";

/**
 * Esquemas dos cadastros. Os mesmos esquemas validam o formulário (cliente)
 * e a Server Action (servidor). Campos de texto opcionais usam "" no formulário
 * e viram null ao gravar (nullIfEmpty).
 */
const texto = (max: number) => z.string().trim().max(max, `Máximo de ${max} caracteres.`);
const obrigatorio = (mensagem: string, max: number) =>
  z.string().trim().min(1, mensagem).max(max, `Máximo de ${max} caracteres.`);
const emailOpcional = z
  .string()
  .trim()
  .refine((v) => v === "" || z.email().safeParse(v).success, "E-mail inválido.");
const telefone = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{10,11}$/.test(v.replace(/\D/g, "")), "Telefone inválido.");
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");
const dataOpcional = z.string().refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data inválida.");
const uuid = (mensagem: string) => z.uuid(mensagem);

// ---------------------------------------------------------------- clientes
export const clienteSchema = z.object({
  razao_social: obrigatorio("Informe a razão social ou o nome.", 200),
  nome_fantasia: texto(200),
  cnpj_cpf: z
    .string()
    .trim()
    .refine((v) => v === "" || isDocumentoValido(v), "CPF/CNPJ inválido."),
  inscricao_estadual: texto(30),
  email: emailOpcional,
  telefone,
  observacoes: texto(2000),
});
export type ClienteInput = z.infer<typeof clienteSchema>;

// ---------------------------------------------------------------- unidades
export const unidadeSchema = z.object({
  nome: obrigatorio("Informe o nome da unidade.", 120),
  cep: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{5}-?\d{3}$/.test(v), "CEP inválido."),
  logradouro: texto(200),
  numero: texto(20),
  complemento: texto(100),
  bairro: texto(100),
  cidade: texto(100),
  uf: z
    .string()
    .trim()
    .refine((v) => v === "" || (UFS as readonly string[]).includes(v.toUpperCase()), "UF inválida."),
  contato_local: texto(120),
  telefone_local: telefone,
  referencia: texto(300),
});
export type UnidadeInput = z.infer<typeof unidadeSchema>;

// ---------------------------------------------------------------- contratos
const valor = (mensagem = "Valor inválido.") => z.number({ error: mensagem }).min(0, mensagem);

export const contratoSchema = z
  .object({
    cliente_id: uuid("Selecione o cliente."),
    numero: texto(40),
    descricao: texto(500),
    tipo: z.enum(["avulso", "manutencao_mensal", "sla_visitas"]),
    data_inicio: data,
    data_fim: dataOpcional,
    valor_mensal: valor("Informe o valor mensal (0 se não houver)."),
    visitas_inclusas_mes: z
      .number({ error: "Informe a quantidade." })
      .int("Use um número inteiro.")
      .min(0, "Valor inválido."),
    horas_inclusas_mes: valor("Informe as horas (0 se não houver)."),
    politica_visita_excedente: z.enum(["valor_unico", "valor_hora", "isento"]),
    valor_visita_excedente: valor().nullable(),
    valor_hora_excedente: valor().nullable(),
    sla_resposta_horas: z.number().positive("Deve ser maior que zero.").nullable(),
    sla_solucao_horas: z.number().positive("Deve ser maior que zero.").nullable(),
    status: z.enum(["ativo", "suspenso", "encerrado"]),
    observacoes: texto(2000),
  })
  .refine((d) => d.data_fim === "" || d.data_fim >= d.data_inicio, {
    path: ["data_fim"],
    message: "O fim deve ser igual ou posterior ao início.",
  })
  .refine(
    (d) =>
      d.sla_resposta_horas == null ||
      d.sla_solucao_horas == null ||
      d.sla_solucao_horas >= d.sla_resposta_horas,
    { path: ["sla_solucao_horas"], message: "A solução não pode ser menor que a resposta." },
  );
export type ContratoInput = z.infer<typeof contratoSchema>;

// ---------------------------------------------------------------- usuários
export const usuarioSchema = z.object({
  nome: obrigatorio("Informe o nome.", 120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .refine((v) => z.email().safeParse(v).success, "E-mail inválido."),
  telefone,
});
export type UsuarioInput = z.infer<typeof usuarioSchema>;

export const novoUsuarioSchema = usuarioSchema.extend({
  role: z.enum(["admin", "tecnico", "cliente"]),
  cliente_id: z.uuid().nullable(),
});
export type NovoUsuarioInput = z.infer<typeof novoUsuarioSchema>;

// ---------------------------------------------------------------- catálogos
export const categoriaSchema = z.object({
  nome: obrigatorio("Informe o nome.", 60),
  ordem: z.number({ error: "Informe a ordem." }).int().min(0).max(999),
});
export type CategoriaInput = z.infer<typeof categoriaSchema>;

export const tipoProblemaSchema = z.object({
  categoria_id: uuid("Selecione a categoria."),
  nome: obrigatorio("Informe o nome.", 120),
});
export type TipoProblemaInput = z.infer<typeof tipoProblemaSchema>;

export const itemCatalogoSchema = z.object({
  descricao: obrigatorio("Informe a descrição.", 200),
  tipo: z.enum(["material", "equipamento", "mao_de_obra", "servico"]),
  unidade: obrigatorio("Informe a unidade.", 10),
  valor_unitario: valor("Informe o valor."),
  categoria_id: z.string().refine((v) => v === "" || z.uuid().safeParse(v).success),
});
export type ItemCatalogoInput = z.infer<typeof itemCatalogoSchema>;

// ---------------------------------------------------------------- chamados
const prioridade = z.enum(["baixa", "media", "alta", "urgente"]);
const statusChamado = z.enum([
  "aberto",
  "triagem",
  "agendado",
  "em_atendimento",
  "aguardando_cliente",
  "aguardando_peca",
  "resolvido",
  "cancelado",
]);
const dataHoraOpcional = z
  .string()
  .refine((v) => v === "" || !Number.isNaN(Date.parse(v)), "Data/hora inválida.");

/** Abertura pelo portal do cliente (cliente_id, origem e status são definidos pelo servidor). */
export const chamadoPortalSchema = z.object({
  unidade_id: uuid("Selecione a unidade."),
  categoria_id: uuid("Selecione a categoria."),
  tipo_problema_id: z.string().refine((v) => v === "" || z.uuid().safeParse(v).success),
  titulo: obrigatorio("Resuma o problema em poucas palavras.", 120),
  descricao: z.string().trim().min(10, "Descreva o problema (mínimo 10 caracteres).").max(4000),
  prioridade,
  telefone_contato: telefone,
});
export type ChamadoPortalInput = z.infer<typeof chamadoPortalSchema>;

/** Abertura pela Tonytec (telefone, WhatsApp ou interna). */
export const chamadoAdminSchema = chamadoPortalSchema.extend({
  cliente_id: uuid("Selecione o cliente."),
  unidade_id: z.string().refine((v) => v === "" || z.uuid().safeParse(v).success),
  descricao: texto(4000),
  origem: z.enum(["admin", "telefone", "whatsapp"]),
  tecnico_id: z.string().refine((v) => v === "" || z.uuid().safeParse(v).success),
  data_agendada: dataHoraOpcional,
});
export type ChamadoAdminInput = z.infer<typeof chamadoAdminSchema>;

/** Gestão do chamado pelo admin (status, prioridade, técnico, agenda). */
export const gestaoChamadoSchema = z.object({
  status: statusChamado,
  prioridade,
  tecnico_id: z.string().refine((v) => v === "" || z.uuid().safeParse(v).success),
  data_agendada: dataHoraOpcional,
  motivo: z.string().trim().max(500),
});
export type GestaoChamadoInput = z.infer<typeof gestaoChamadoSchema>;

export const comentarioSchema = z.object({
  mensagem: z.string().trim().min(1, "Escreva a mensagem.").max(4000, "Máximo de 4000 caracteres."),
  interno: z.boolean(),
});
export type ComentarioInput = z.infer<typeof comentarioSchema>;

export const STATUS_CHAMADO = statusChamado.options;

/** Motivo obrigatório para desativações (vai para a auditoria). */
export const motivoSchema = z.string().trim().min(5, "Descreva o motivo (mínimo 5 caracteres).").max(500);
