/**
 * Dados de demonstração para testes (2 clientes, unidades, contrato, técnicos,
 * usuários de portal e chamados). Só roda com SEED_DEMO=true.
 * Senha de todos os usuários demo: SEED_DEMO_PASSWORD (.env.local).
 * Idempotente: pode rodar mais de uma vez.
 */
import { adminClient, requireEnv, upsertUser } from "./_lib";
import { DEMO } from "./demo-data";

async function main() {
  if (process.env.SEED_DEMO !== "true") {
    console.log("SEED_DEMO não é 'true' — nada a fazer.");
    return;
  }
  const password = requireEnv("SEED_DEMO_PASSWORD");
  const admin = adminClient();

  // Clientes
  const upsertCliente = async (
    c: { razao_social: string; cnpj_cpf: string },
    extra: Record<string, string>,
  ) => {
    const { data: found } = await admin
      .from("clientes")
      .select("id")
      .eq("cnpj_cpf", c.cnpj_cpf)
      .maybeSingle();
    if (found) return found.id;
    const { data, error } = await admin
      .from("clientes")
      .insert({ ...c, ...extra })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  };
  const clienteA = await upsertCliente(DEMO.clienteA, {
    nome_fantasia: "Residencial Alfa",
    telefone: "(11) 3000-0001",
  });
  const clienteB = await upsertCliente(DEMO.clienteB, {
    nome_fantasia: "Clínica Beta",
    telefone: "(11) 3000-0002",
  });

  // Unidades
  const upsertUnidade = async (cliente_id: string, nome: string, extra: Record<string, string>) => {
    const { data: found } = await admin
      .from("unidades")
      .select("id")
      .eq("cliente_id", cliente_id)
      .eq("nome", nome)
      .maybeSingle();
    if (found) return found.id;
    const { data, error } = await admin
      .from("unidades")
      .insert({ cliente_id, nome, ...extra })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  };
  const unidadeA = await upsertUnidade(clienteA, "Torre 1 — Portaria", {
    logradouro: "Rua das Flores",
    numero: "100",
    bairro: "Centro",
    cidade: "São Paulo",
    uf: "SP",
    cep: "01000-000",
    contato_local: "Zelador João",
    telefone_local: "(11) 98888-0001",
  });
  const unidadeB = await upsertUnidade(clienteB, "Matriz", {
    logradouro: "Av. Paulista",
    numero: "1000",
    bairro: "Bela Vista",
    cidade: "São Paulo",
    uf: "SP",
    cep: "01310-100",
  });

  // Contrato do cliente A
  const { data: contrato } = await admin
    .from("contratos")
    .select("id")
    .eq("numero", "CT-DEMO-001")
    .maybeSingle();
  if (!contrato) {
    const { error } = await admin.from("contratos").insert({
      cliente_id: clienteA,
      numero: "CT-DEMO-001",
      descricao: "Manutenção mensal CFTV + portões",
      tipo: "manutencao_mensal",
      data_inicio: "2026-01-01",
      valor_mensal: 890,
      visitas_inclusas_mes: 2,
      horas_inclusas_mes: 4,
      politica_visita_excedente: "valor_hora",
      valor_hora_excedente: 150,
      sla_resposta_horas: 4,
      sla_solucao_horas: 16,
    });
    if (error) throw error;
  }

  // Usuários
  const u = DEMO.users;
  const tecnico = await upsertUser(admin, { ...u.tecnico, password, role: "tecnico" });
  await upsertUser(admin, { ...u.tecnico2, password, role: "tecnico" });
  await upsertUser(admin, { ...u.clienteA, password, role: "cliente", cliente_id: clienteA });
  await upsertUser(admin, { ...u.clienteB, password, role: "cliente", cliente_id: clienteB });

  // Categorias/tipos para os chamados
  const { data: cat } = await admin
    .from("categorias_servico")
    .select("id")
    .eq("nome", "Câmeras/CFTV")
    .single();
  const { data: tipo } = await admin
    .from("tipos_problema")
    .select("id")
    .eq("nome", "Câmera sem imagem")
    .single();
  const { data: catPortao } = await admin
    .from("categorias_servico")
    .select("id")
    .eq("nome", "Portão Eletrônico")
    .single();

  const criarChamado = async (titulo: string, dados: Record<string, unknown>) => {
    const { data: found } = await admin.from("chamados").select("id").eq("titulo", titulo).maybeSingle();
    if (found) return found.id;
    const { data, error } = await admin
      .from("chamados")
      .insert({ titulo, ...dados } as never)
      .select("id, protocolo")
      .single();
    if (error) throw error;
    console.log(`  chamado ${data.protocolo}: ${titulo}`);
    return data.id;
  };

  const chA = await criarChamado("[DEMO] Câmera da garagem sem imagem", {
    cliente_id: clienteA,
    unidade_id: unidadeA,
    categoria_id: cat!.id,
    tipo_problema_id: tipo!.id,
    descricao: "A câmera 04 da garagem está sem imagem desde ontem.",
    prioridade: "alta",
    origem: "telefone",
    tecnico_id: tecnico,
    status: "agendado",
    data_agendada: new Date(Date.now() + 2 * 3600_000).toISOString(),
  });
  await criarChamado("[DEMO] Portão da recepção travando", {
    cliente_id: clienteB,
    unidade_id: unidadeB,
    categoria_id: catPortao!.id,
    descricao: "Portão trava no meio do curso.",
    prioridade: "media",
    origem: "whatsapp",
  });

  // Comentários (1 público + 1 interno) no chamado do cliente A
  const { count } = await admin
    .from("chamado_comentarios")
    .select("id", { count: "exact", head: true })
    .eq("chamado_id", chA);
  if (!count) {
    const { data: adminUser } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();
    const autor = adminUser?.id ?? tecnico;
    const { error } = await admin.from("chamado_comentarios").insert([
      {
        chamado_id: chA,
        autor_id: autor,
        mensagem: "Visita agendada para hoje. O técnico levará câmera reserva.",
        interno: false,
      },
      {
        chamado_id: chA,
        autor_id: autor,
        mensagem: "NOTA INTERNA: cliente com 2 visitas no mês, avaliar cobrança.",
        interno: true,
      },
    ]);
    if (error) throw error;
  }

  console.log("✓ Dados de demonstração prontos.");
  console.log("  Usuários (senha = SEED_DEMO_PASSWORD):");
  Object.values(u).forEach((x) => console.log(`   - ${x.email}`));
}

main().catch((e) => {
  console.error("FALHOU:", e instanceof Error ? e.message : e);
  process.exit(1);
});
