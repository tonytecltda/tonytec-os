/**
 * Fase 6 no banco: notificações geradas pelos gatilhos e isoladas por usuário,
 * auditoria dos cadastros e função de limite de tentativas.
 * Pré-requisito: `npm run seed:demo`. Uso: npm run test:fase6
 */
import { adminClient, anonClient, requireEnv } from "./_lib";
import { DEMO } from "./demo-data";

let falhas = 0;
function check(nome: string, ok: boolean, detalhe?: unknown) {
  console.log(
    `${ok ? "  ✓" : "  ✗"} ${nome}${!ok && detalhe !== undefined ? ` → ${JSON.stringify(detalhe)}` : ""}`,
  );
  if (!ok) falhas++;
}

async function login(email: string, senha = requireEnv("SEED_DEMO_PASSWORD")) {
  const c = anonClient();
  const { error } = await c.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

async function main() {
  const sa = adminClient();
  const marca = `[F6] ${Date.now().toString(36)}`;

  const { data: cli } = await sa
    .from("clientes")
    .select("id")
    .eq("cnpj_cpf", DEMO.clienteA.cnpj_cpf)
    .single();
  const { data: tecnico } = await sa
    .from("profiles")
    .select("id")
    .eq("email", DEMO.users.tecnico.email)
    .single();
  const { data: tecnico2 } = await sa
    .from("profiles")
    .select("id")
    .eq("email", DEMO.users.tecnico2.email)
    .single();
  const { data: usuarioCliente } = await sa
    .from("profiles")
    .select("id")
    .eq("email", DEMO.users.clienteA.email)
    .single();
  const { data: usuarioClienteB } = await sa
    .from("profiles")
    .select("id")
    .eq("email", DEMO.users.clienteB.email)
    .single();
  const { data: adminProfile } = await sa
    .from("profiles")
    .select("id")
    .eq("email", requireEnv("SEED_ADMIN_EMAIL"))
    .single();
  if (!cli || !tecnico || !tecnico2 || !usuarioCliente || !usuarioClienteB || !adminProfile)
    throw new Error("Rode `npm run seed:demo` antes.");

  const nots = async (profileId: string, filtro: string) => {
    const { data } = await sa
      .from("notificacoes")
      .select("id, titulo, mensagem, link, lida")
      .eq("profile_id", profileId)
      .ilike("titulo", `%${filtro}%`);
    return data ?? [];
  };

  // ------------------------------------------------------------ chamado novo
  console.log("\nNotificações de chamados");
  const { data: ch, error: chErro } = await sa
    .from("chamados")
    .insert({
      cliente_id: cli.id,
      titulo: `${marca} câmera sem imagem`,
      origem: "telefone",
      prioridade: "media",
    })
    .select("id, protocolo")
    .single();
  if (chErro || !ch) throw new Error(`criar chamado: ${chErro?.message}`);

  const novoAdmin = await nots(adminProfile.id, ch.protocolo);
  check(
    "admin é avisado do chamado novo",
    novoAdmin.some((n) => n.titulo.startsWith("Novo chamado")),
    novoAdmin,
  );
  check(
    "link do admin aponta para o chamado",
    novoAdmin[0]?.link === `/admin/chamados/${ch.id}`,
    novoAdmin[0],
  );
  check("técnico sem atribuição não é avisado", (await nots(tecnico.id, ch.protocolo)).length === 0);
  check(
    "cliente não é avisado do próprio chamado novo",
    (await nots(usuarioCliente.id, ch.protocolo)).length === 0,
  );

  // atribuição
  await sa.from("chamados").update({ tecnico_id: tecnico.id, status: "triagem" }).eq("id", ch.id);
  const atribuido = await nots(tecnico.id, ch.protocolo);
  check("técnico é avisado da atribuição", atribuido.length === 1, atribuido);
  check("link do técnico aponta para a tela do técnico", atribuido[0]?.link === `/tecnico/chamados/${ch.id}`);

  // agendamento (avisa o cliente)
  await sa
    .from("chamados")
    .update({ status: "agendado", data_agendada: new Date(Date.now() + 86_400_000).toISOString() })
    .eq("id", ch.id);
  const agendado = await nots(usuarioCliente.id, "Visita agendada");
  check(
    "usuários do cliente são avisados do agendamento",
    agendado.some((n) => n.mensagem?.includes("às")),
    agendado,
  );
  check("outro cliente NÃO é avisado", (await nots(usuarioClienteB.id, ch.protocolo)).length === 0);

  // ---------------------------------------------------------------- comentários
  console.log("\nNotificações de comentários");
  const clienteSessao = await login(DEMO.users.clienteA.email);
  const tecnicoSessao = await login(DEMO.users.tecnico.email);
  const { error: c1 } = await clienteSessao
    .from("chamado_comentarios")
    .insert({ chamado_id: ch.id, mensagem: "O problema voltou." });
  check("cliente comenta", !c1, c1?.message);
  check(
    "técnico é avisado da resposta do cliente",
    (await nots(tecnico.id, "Cliente respondeu")).some((n) => n.mensagem === "O problema voltou."),
  );
  check(
    "admin é avisado da resposta do cliente",
    (await nots(adminProfile.id, "Cliente respondeu")).some((n) => n.mensagem === "O problema voltou."),
  );
  check(
    "o autor não é avisado do próprio comentário",
    (await nots(usuarioCliente.id, "Cliente respondeu")).length === 0,
  );

  const { error: c2 } = await tecnicoSessao
    .from("chamado_comentarios")
    .insert({ chamado_id: ch.id, mensagem: "Estou a caminho.", interno: false });
  check("técnico responde ao cliente", !c2, c2?.message);
  const respostas = await nots(usuarioCliente.id, "Nova resposta");
  check(
    "cliente é avisado da resposta da equipe",
    respostas.some((n) => n.mensagem === "Estou a caminho."),
  );
  check(
    "link do cliente aponta para o portal",
    respostas[0]?.link === `/portal/chamados/${ch.id}`,
    respostas[0],
  );

  await tecnicoSessao
    .from("chamado_comentarios")
    .insert({ chamado_id: ch.id, mensagem: "Senha do DVR é do síndico.", interno: true });
  const vazamento = [
    ...(await nots(usuarioCliente.id, "Nota interna")),
    ...(await nots(usuarioCliente.id, "Nova resposta")).filter((n) => n.mensagem?.includes("DVR")),
  ];
  check("nota interna NÃO chega ao cliente", vazamento.length === 0, vazamento);
  check("nota interna chega ao admin", (await nots(adminProfile.id, "Nota interna")).length >= 1);

  // -------------------------------------------------------------- isolamento
  console.log("\nIsolamento das notificações");
  const adm = await login(requireEnv("SEED_ADMIN_EMAIL"), requireEnv("SEED_ADMIN_PASSWORD"));
  const { data: dasDoTecnico } = await adm.from("notificacoes").select("id").eq("profile_id", tecnico.id);
  check("nem o admin lê as notificações de outro usuário", !dasDoTecnico?.length, dasDoTecnico);
  const { data: minhasAdmin } = await adm.from("notificacoes").select("id, profile_id");
  check(
    "admin lê apenas as próprias",
    !!minhasAdmin?.length && minhasAdmin.every((n) => n.profile_id === adminProfile.id),
  );
  const { data: dasCliente } = await tecnicoSessao.from("notificacoes").select("profile_id");
  check(
    "técnico lê apenas as próprias",
    !!dasCliente?.length && dasCliente.every((n) => n.profile_id === tecnico.id),
  );
  const tec2 = await login(DEMO.users.tecnico2.email);
  const { data: t2 } = await tec2.from("notificacoes").select("id").ilike("titulo", `%${ch.protocolo}%`);
  check("segundo técnico não vê notificações do chamado", !t2?.length, t2);

  const { error: ins } = await tecnicoSessao
    .from("notificacoes")
    .insert({ profile_id: usuarioCliente.id, titulo: "Falsa", mensagem: "x" });
  check("usuário NÃO cria notificação", !!ins, ins?.message);
  const alvo = atribuido[0];
  const { error: edit } = await tecnicoSessao
    .from("notificacoes")
    .update({ titulo: "Adulterada" })
    .eq("id", alvo.id);
  check("usuário NÃO altera o texto da notificação", !!edit, edit?.message);
  const { error: lida } = await tecnicoSessao.from("notificacoes").update({ lida: true }).eq("id", alvo.id);
  check("usuário marca a própria como lida", !lida, lida?.message);
  const { data: depois } = await sa.from("notificacoes").select("lida, titulo").eq("id", alvo.id).single();
  check(
    "a marcação foi gravada sem mudar o título",
    depois?.lida === true && depois.titulo !== "Adulterada",
    depois,
  );
  const { data: alheia } = await tecnicoSessao
    .from("notificacoes")
    .update({ lida: true })
    .eq("profile_id", usuarioCliente.id)
    .select("id");
  check("usuário NÃO marca notificação de outro", !alheia?.length, alheia);

  // ---------------------------------------------------------------- OS
  console.log("\nNotificações e auditoria da OS");
  const { data: os, error: osErro } = await sa
    .from("ordens_servico")
    .insert({
      cliente_id: cli.id,
      chamado_id: ch.id,
      tecnico_id: tecnico.id,
      tipo_atendimento: "corretivo",
      status: "em_execucao",
    })
    .select("id, numero")
    .single();
  if (osErro || !os) throw new Error(`criar OS: ${osErro?.message}`);
  await sa.from("ordens_servico").update({ status: "concluida" }).eq("id", os.id);
  await sa.from("ordens_servico").update({ status: "aguardando_assinatura" }).eq("id", os.id);
  check("admin é avisado da OS aguardando assinatura", (await nots(adminProfile.id, os.numero)).length >= 1);
  const { data: statusAud } = await sa
    .from("auditoria")
    .select("acao, dados_depois")
    .eq("registro_id", os.id)
    .eq("acao", "status")
    .order("id");
  check("mudanças de situação da OS ficam na auditoria", (statusAud?.length ?? 0) >= 2, statusAud);

  // Resolução do chamado (exige OS assinada ou recusa de assinatura registrada)
  const { error: rec } = await sa
    .from("ordens_servico")
    .update({ status: "concluida", assinatura_recusada: true, motivo_recusa: "Teste Fase 6" })
    .eq("id", os.id);
  check("OS concluída com recusa de assinatura", !rec, rec?.message);
  await sa.from("chamados").update({ status: "em_atendimento" }).eq("id", ch.id);
  const { error: res } = await sa.from("chamados").update({ status: "resolvido" }).eq("id", ch.id);
  check("chamado é resolvido", !res, res?.message);
  check("cliente é avisado da resolução", (await nots(usuarioCliente.id, "Chamado resolvido")).length === 1);

  // ---------------------------------------------------------------- auditoria
  console.log("\nAuditoria de cadastros");
  const antes = Date.now();
  const { error: upCli } = await adm
    .from("clientes")
    .update({ observacoes: `${marca} obs` })
    .eq("id", cli.id);
  check("admin altera cliente", !upCli, upCli?.message);
  const { data: audCli } = await sa
    .from("auditoria")
    .select("acao, autor_id, dados_antes, dados_depois, created_at")
    .eq("tabela", "clientes")
    .eq("registro_id", cli.id)
    .eq("acao", "update")
    .order("id", { ascending: false })
    .limit(1)
    .single();
  check(
    "alteração do cliente registrada com autor e só os campos alterados",
    !!audCli &&
      audCli.autor_id === adminProfile.id &&
      Object.keys((audCli.dados_depois as object) ?? {}).join() === "observacoes" &&
      Date.parse(audCli.created_at) >= antes - 60_000,
    audCli,
  );
  const { count: semMudanca } = await sa
    .from("auditoria")
    .select("id", { count: "exact", head: true })
    .eq("registro_id", cli.id)
    .gte("created_at", new Date(antes).toISOString());
  await adm
    .from("clientes")
    .update({ observacoes: `${marca} obs` })
    .eq("id", cli.id);
  const { count: semMudanca2 } = await sa
    .from("auditoria")
    .select("id", { count: "exact", head: true })
    .eq("registro_id", cli.id)
    .gte("created_at", new Date(antes).toISOString());
  check("atualização sem mudança real não gera registro", semMudanca === semMudanca2, {
    semMudanca,
    semMudanca2,
  });
  await sa.from("clientes").update({ observacoes: null }).eq("id", cli.id);

  const { data: audTec } = await tecnicoSessao.from("auditoria").select("id").limit(1);
  check("técnico NÃO lê a auditoria", !audTec?.length, audTec);
  const { data: audCliente } = await clienteSessao.from("auditoria").select("id").limit(1);
  check("cliente NÃO lê a auditoria", !audCliente?.length, audCliente);
  const { data: audAdmin } = await adm.from("auditoria").select("id").limit(1);
  check("admin lê a auditoria", !!audAdmin?.length);
  const { error: audIns } = await tecnicoSessao
    .from("auditoria")
    .insert({ tabela: "x", acao: "falsa", registro_id: null });
  check("usuário NÃO grava na auditoria", !!audIns, audIns?.message);
  const { error: audDel } = await sa
    .from("auditoria")
    .delete()
    .eq("tabela", "clientes")
    .eq("registro_id", cli.id);
  check("auditoria não pode ser apagada (nem pelo servidor)", !!audDel, audDel?.message);

  // ------------------------------------------------------- limite de tentativas
  console.log("\nLimite de tentativas");
  const chave = `teste-f6:${Date.now()}`;
  const tentativas: boolean[] = [];
  for (let i = 0; i < 4; i++) {
    const { data, error } = await sa.rpc("checar_rate_limit", { p_chave: chave, p_max: 3, p_janela_seg: 60 });
    if (error) throw new Error(error.message);
    tentativas.push(data as boolean);
  }
  check(
    "3 primeiras tentativas passam e a 4ª é barrada",
    tentativas.join() === "true,true,true,false",
    tentativas,
  );
  const { data: bloq } = await sa.rpc("rate_limit_bloqueado", { p_chave: chave, p_max: 3, p_janela_seg: 60 });
  check("consulta sem contar informa o bloqueio", bloq === true);
  const { data: livre } = await sa.rpc("rate_limit_bloqueado", {
    p_chave: `${chave}-outra`,
    p_max: 3,
    p_janela_seg: 60,
  });
  check("chave diferente não é afetada", livre === false);
  for (const [rotulo, cliente] of [
    ["anônimo", anonClient()],
    ["técnico", tecnicoSessao],
    ["cliente", clienteSessao],
    ["admin logado", adm],
  ] as const) {
    const { error } = await cliente.rpc("checar_rate_limit", { p_chave: "x", p_max: 1, p_janela_seg: 60 });
    check(`${rotulo} NÃO chama checar_rate_limit`, !!error, error?.message);
    const { error: e2 } = await cliente.rpc("rate_limit_bloqueado", {
      p_chave: "x",
      p_max: 1,
      p_janela_seg: 60,
    });
    check(`${rotulo} NÃO chama rate_limit_bloqueado`, !!e2, e2?.message);
  }
  const { error: parametros } = await sa.rpc("checar_rate_limit", {
    p_chave: "x",
    p_max: 0,
    p_janela_seg: 60,
  });
  check("parâmetros inválidos são recusados", !!parametros, parametros?.message);
  const { data: tabela } = await anonClient()
    .from("rate_limit" as never)
    .select("*")
    .limit(1);
  check("tabela do limite não é exposta pela API", !tabela || (tabela as unknown[]).length === 0);

  // ------------------------------------------------------------------- limpeza
  await sa.from("ordens_servico").update({ ativo: false, status: "cancelada" }).eq("id", os.id);
  await sa.from("chamados").update({ ativo: false }).eq("id", ch.id);
  await sa
    .from("notificacoes")
    .delete()
    .in("profile_id", [adminProfile.id, tecnico.id, tecnico2.id, usuarioCliente.id, usuarioClienteB.id])
    .or(`titulo.ilike.%${ch.protocolo}%,titulo.ilike.%${os.numero}%,mensagem.ilike.%${ch.protocolo}%`);

  console.log(
    falhas ? `\n✗ ${falhas} verificação(ões) falharam.` : "\n✓ Todas as verificações da Fase 6 passaram.",
  );
  process.exit(falhas ? 1 : 0);
}

main().catch((e) => {
  console.error("FALHOU:", e instanceof Error ? e.message : e);
  process.exit(1);
});
