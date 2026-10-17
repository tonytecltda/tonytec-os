/** Identificadores fixos dos dados de demonstração (usados pelo seed e pelo teste de RLS). */
export const DEMO = {
  clienteA: { razao_social: "Condomínio Residencial Alfa (DEMO)", cnpj_cpf: "00000000000191" },
  clienteB: { razao_social: "Clínica Beta Saúde (DEMO)", cnpj_cpf: "00000000000272" },
  users: {
    tecnico: { email: "tecnico.demo@example.com", nome: "Técnico Demonstração" },
    tecnico2: { email: "tecnico2.demo@example.com", nome: "Segundo Técnico Demo" },
    clienteA: { email: "cliente.alfa.demo@example.com", nome: "Síndico Alfa (DEMO)" },
    clienteB: { email: "cliente.beta.demo@example.com", nome: "Gerente Beta (DEMO)" },
  },
} as const;
