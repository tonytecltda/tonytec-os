import type { Database } from "@/types/database";

type Enums = Database["public"]["Enums"];

/** Rótulos em português para os enums do banco. */
export const CONTRATO_TIPO: Record<Enums["contrato_tipo"], string> = {
  avulso: "Avulso",
  manutencao_mensal: "Manutenção mensal",
  sla_visitas: "SLA / pacote de visitas",
};

export const POLITICA_EXCEDENTE: Record<Enums["politica_excedente"], string> = {
  valor_unico: "Valor fixo por visita",
  valor_hora: "Valor por hora",
  isento: "Isento (sem cobrança)",
};

export const CONTRATO_STATUS: Record<Enums["contrato_status"], string> = {
  ativo: "Ativo",
  suspenso: "Suspenso",
  encerrado: "Encerrado",
};

export const ITEM_TIPO: Record<Enums["os_item_tipo"], string> = {
  material: "Material",
  equipamento: "Equipamento",
  mao_de_obra: "Mão de obra",
  servico: "Serviço",
};

export const PRIORIDADE: Record<Enums["chamado_prioridade"], string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

export const CHAMADO_STATUS: Record<Enums["chamado_status"], string> = {
  aberto: "Aberto",
  triagem: "Em triagem",
  agendado: "Agendado",
  em_atendimento: "Em atendimento",
  aguardando_cliente: "Aguardando cliente",
  aguardando_peca: "Aguardando peça",
  resolvido: "Resolvido",
  cancelado: "Cancelado",
};

export const OS_STATUS: Record<Enums["os_status"], string> = {
  rascunho: "Rascunho",
  em_execucao: "Em execução",
  concluida: "Concluída",
  aguardando_assinatura: "Aguardando assinatura",
  assinada: "Assinada",
  cancelada: "Cancelada",
};

export const UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

export const DIAS_SEMANA = [
  { valor: 1, curto: "Seg", nome: "Segunda" },
  { valor: 2, curto: "Ter", nome: "Terça" },
  { valor: 3, curto: "Qua", nome: "Quarta" },
  { valor: 4, curto: "Qui", nome: "Quinta" },
  { valor: 5, curto: "Sex", nome: "Sexta" },
  { valor: 6, curto: "Sáb", nome: "Sábado" },
  { valor: 7, curto: "Dom", nome: "Domingo" },
] as const;

/** Converte um Record de rótulos em opções para <Select>. */
export const opcoes = <K extends string>(mapa: Record<K, string>) =>
  (Object.entries(mapa) as [K, string][]).map(([value, label]) => ({ value, label }));
