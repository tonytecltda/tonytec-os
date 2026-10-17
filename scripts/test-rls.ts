/**
 * Teste automatizado de RLS e das regras de bloqueio por perfil.
 * Pré-requisito: `npm run seed:demo` (SEED_DEMO=true) já executado.
 * Uso: npm run test:rls
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

async function login(email: string) {
  const c = anonClient();
  const { error } = await c.auth.signInWithPassword({ email, password: requireEnv("SEED_DEMO_PASSWORD") });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

async function main() {
  const admin = adminClient();
  const { data: a } = await admin
    .from("clientes")
    .select("id")
    .eq("cnpj_cpf", DEMO.clienteA.cnpj_cpf)
    .single();
  const { data: b } = await admin
    .from("clientes")
    .select("id")
    .eq("cnpj_cpf", DEMO.clienteB.cnpj_cpf)
    .single();
  if (!a || !b) throw new Error("Rode `npm run seed:demo` antes.");
  const { data: chB } = await admin.from("chamados").select("id").eq("cliente_id", b.id).limit(1).single();
  const { data: chA } = await admin.from("chamados").select("id").eq("cliente_id", a.id).limit(1).single();

  // ---------------------------------------------------------------- anônimo
  console.log("\nAnônimo (sem login)");
  const anon = anonClient();
  for (const t of ["clientes", "chamados", "profiles", "configuracoes", "ordens_servico"] as const) {
    const { data } = await anon.from(t).select("*").limit(1);
    check(`não lê ${t}`, !data || data.length === 0, data);
  }

  // -------------------------------------------------------------- cliente A
  console.log("\nCliente A");
  const ca = await login(DEMO.users.clienteA.email);
  {
    const { data } = await ca.from("clientes").select("id");
    check("vê somente o próprio cliente", data?.length === 1 && data[0].id === a.id, data);
    const { data: chs } = await ca.from("chamados").select("id, cliente_id");
    check(
      "vê somente chamados do próprio cliente",
      !!chs?.length && chs.every((c) => c.cliente_id === a.id),
      chs,
    );
    const { data: outro } = await ca.from("chamados").select("id").eq("id", chB!.id);
    check("NÃO vê chamado do cliente B", outro?.length === 0, outro);
    const { data: unB } = await ca.from("unidades").select("id").eq("cliente_id", b.id);
    check("NÃO vê unidades do cliente B", unB?.length === 0, unB);
    const { data: com } = await ca.from("chamado_comentarios").select("interno").eq("chamado_id", chA!.id);
    check("vê comentário público", !!com?.some((c) => !c.interno), com);
    check("NÃO vê nota interna", !!com && com.every((c) => !c.interno), com);
    const { data: vis } = await ca.from("os_visitas").select("id").limit(1);
    check("NÃO lê visitas (dados financeiros)", vis?.length === 0, vis);
    const { data: aud } = await ca.from("auditoria").select("id").limit(1);
    check("NÃO lê auditoria", aud?.length === 0, aud);
    const { data: tk } = await ca.from("os_assinatura_tokens").select("id").limit(1);
    check("NÃO lê tokens de assinatura", tk?.length === 0, tk);

    const { error: e1 } = await ca.from("chamados").update({ prioridade: "urgente" }).eq("id", chA!.id);
    check("NÃO altera prioridade do chamado", !!e1, e1?.message);
    const { data: me } = await ca.auth.getUser();
    const { error: e2 } = await ca.from("profiles").update({ role: "admin" }).eq("id", me.user!.id);
    check("NÃO se promove a admin", !!e2, e2?.message);
    const { error: e3 } = await ca.from("profiles").update({ cliente_id: b.id }).eq("id", me.user!.id);
    check("NÃO troca o próprio cliente_id", !!e3, e3?.message);
    const { error: e4 } = await ca.from("chamado_comentarios").insert({ chamado_id: chB!.id, mensagem: "x" });
    check("NÃO comenta em chamado do cliente B", !!e4, e4?.message);
    const { error: e5 } = await ca.from("clientes").update({ razao_social: "hack" }).eq("id", a.id).select();
    const { data: nomeA } = await admin.from("clientes").select("razao_social").eq("id", a.id).single();
    check("NÃO edita cadastro do cliente", nomeA?.razao_social === DEMO.clienteA.razao_social, e5?.message);
    const { error: e6 } = await ca.from("chamados").update({ status: "cancelado" }).eq("id", chA!.id);
    check("NÃO muda o status do chamado", !!e6, e6?.message);
    const { data: anexB } = await ca.from("chamado_anexos").select("id").eq("chamado_id", chB!.id);
    check("NÃO vê anexos do cliente B", anexB?.length === 0, anexB);
    // Storage: sem URL assinada emitida pelo servidor, o cliente não lê nem envia arquivos.
    const { data: lista } = await ca.storage.from("chamado-anexos").list(a.id);
    check("NÃO lista arquivos do Storage diretamente", !lista?.length, lista);
    const { error: e7 } = await ca.storage
      .from("chamado-anexos")
      .upload(`${a.id}/${chA!.id}/invasao.txt`, new Blob(["x"], { type: "text/plain" }));
    check("NÃO envia arquivo direto ao Storage", !!e7, e7?.message);
    const { error: e8 } = await ca.storage.from("chamado-anexos").createSignedUploadUrl(`${b.id}/x/y.png`);
    check("NÃO gera URL de upload sozinho", !!e8, e8?.message);
  }

  // -------------------------------------------------------------- cliente B
  console.log("\nCliente B");
  const cb = await login(DEMO.users.clienteB.email);
  {
    const { data } = await cb.from("chamados").select("id, cliente_id");
    check(
      "vê somente chamados do cliente B",
      !!data?.length && data.every((c) => c.cliente_id === b.id),
      data,
    );
    const { data: outro } = await cb.from("chamados").select("id").eq("id", chA!.id);
    check("NÃO vê chamado do cliente A", outro?.length === 0, outro);
    const { data: ct } = await cb.from("contratos").select("id");
    check("NÃO vê contrato do cliente A", ct?.length === 0, ct);
  }

  // ---------------------------------------------------------------- técnico
  console.log("\nTécnico (atribuído ao chamado do cliente A)");
  const tc = await login(DEMO.users.tecnico.email);
  {
    const { data } = await tc.from("chamados").select("id");
    check("vê o chamado atribuído", !!data?.some((c) => c.id === chA!.id), data);
    check("NÃO vê chamado não atribuído (cliente B)", !data?.some((c) => c.id === chB!.id), data);
    const { data: cli } = await tc.from("clientes").select("id");
    check("vê só o cliente que atende", cli?.length === 1 && cli[0].id === a.id, cli);
    const { data: com } = await tc.from("chamado_comentarios").select("interno").eq("chamado_id", chA!.id);
    check("vê nota interna", !!com?.some((c) => c.interno), com);
    const { error: e1 } = await tc.from("chamados").update({ prioridade: "baixa" }).eq("id", chA!.id);
    check("NÃO altera prioridade (só status)", !!e1, e1?.message);
    const { error: e2 } = await tc.from("chamados").update({ status: "resolvido" }).eq("id", chA!.id);
    check("NÃO resolve chamado sem OS assinada", !!e2, e2?.message);
    const { error: e3 } = await tc.from("clientes").insert({ razao_social: "x" });
    check("NÃO cria cliente", !!e3, e3?.message);
    const { error: e4 } = await tc.from("chamados").update({ tecnico_id: null }).eq("id", chA!.id);
    check("NÃO troca o técnico responsável", !!e4, e4?.message);
    const { error: e5 } = await tc.from("chamados").update({ status: "cancelado" }).eq("id", chA!.id);
    check("NÃO cancela chamado", !!e5, e5?.message);
  }

  // ------------------------------------------------------- ordem de serviço
  console.log("\nOrdem de serviço (ciclo de vida)");
  {
    const { data: tec } = await admin
      .from("profiles")
      .select("id")
      .eq("email", DEMO.users.tecnico.email)
      .single();
    const { data: os, error: osErro } = await admin
      .from("ordens_servico")
      .insert({
        cliente_id: a.id,
        tecnico_id: tec!.id,
        status: "em_execucao",
        problema_relatado: "[RLS] teste",
      })
      .select("id")
      .single();
    if (osErro || !os) throw new Error(`OS de teste: ${osErro?.message}`);
    const ca2 = await login(DEMO.users.clienteA.email);
    const t1 = await login(DEMO.users.tecnico.email);
    const t2b = await login(DEMO.users.tecnico2.email);
    const cb2 = await login(DEMO.users.clienteB.email);

    const veOs = async (c: typeof ca2) =>
      ((await c.from("ordens_servico").select("id").eq("id", os.id)).data?.length ?? 0) === 1;
    check("em execução: técnico responsável vê", await veOs(t1));
    check("em execução: outro técnico NÃO vê", !(await veOs(t2b)));
    check("em execução: cliente NÃO vê (rascunho do técnico)", !(await veOs(ca2)));

    const { error: u1 } = await t1.from("ordens_servico").update({ cliente_id: b.id }).eq("id", os.id);
    check("técnico NÃO troca o cliente da OS", !!u1, u1?.message);
    const { error: u2 } = await t1.from("ordens_servico").update({ status: "assinada" }).eq("id", os.id);
    check("técnico NÃO marca a OS como assinada", !!u2, u2?.message);
    const { error: u3 } = await t1.from("ordens_servico").update({ diagnostico: "ok" }).eq("id", os.id);
    check("técnico edita a OS em execução", !u3, u3?.message);

    // Visita: o técnico registra chegada/saída, mas não mexe em cobrança
    const { data: vis, error: v1 } = await t1
      .from("os_visitas")
      .insert({ os_id: os.id })
      .select("id")
      .single();
    check("técnico registra a chegada", !v1 && !!vis, v1?.message);
    const { error: v2 } = await t1
      .from("os_visitas")
      .update({ data_hora_saida: new Date().toISOString() })
      .eq("id", vis!.id);
    check("técnico registra a saída (horas calculadas)", !v2, v2?.message);
    const { data: visDb } = await admin
      .from("os_visitas")
      .select("horas_trabalhadas")
      .eq("id", vis!.id)
      .single();
    check("horas trabalhadas foram calculadas", visDb?.horas_trabalhadas != null, visDb);
    const { error: v3 } = await t1.from("os_visitas").update({ cobranca_tipo: "cortesia" }).eq("id", vis!.id);
    check("técnico NÃO altera a cobrança da visita", !!v3, v3?.message);
    const { data: visCli } = await ca2.from("os_visitas").select("id").eq("os_id", os.id);
    check("cliente NÃO lê visitas", visCli?.length === 0, visCli);
    const { error: v4 } = await t1.from("os_visitas").update({ faturado: true }).eq("id", vis!.id);
    check("técnico NÃO fatura visita", !!v4, v4?.message);
    const { error: v5 } = await t1.from("os_visitas").update({ valor_unitario: 1 }).eq("id", vis!.id);
    check("técnico NÃO altera o valor da visita", !!v5, v5?.message);

    // Saldo do contrato (função consumo_contrato_mes): só o admin e o próprio cliente
    const { data: ctA } = await admin
      .from("contratos")
      .select("id")
      .eq("cliente_id", a.id)
      .eq("status", "ativo")
      .limit(1)
      .single();
    const mesRef = new Date().toISOString().slice(0, 7) + "-01";
    const { data: saldoA, error: sA } = await ca2.rpc("consumo_contrato_mes", {
      p_contrato_id: ctA!.id,
      p_mes: mesRef,
    });
    check("cliente vê o saldo do próprio contrato", !sA && saldoA?.length === 1, sA?.message);
    const { error: sB } = await cb2.rpc("consumo_contrato_mes", { p_contrato_id: ctA!.id, p_mes: mesRef });
    check("cliente B NÃO vê o saldo do contrato do cliente A", !!sB, sB?.message);
    const { error: sT } = await t1.rpc("consumo_contrato_mes", { p_contrato_id: ctA!.id, p_mes: mesRef });
    check("técnico NÃO consulta saldo de contrato", !!sT, sT?.message);
    const { error: sAnon } = await anonClient().rpc("consumo_contrato_mes", {
      p_contrato_id: ctA!.id,
      p_mes: mesRef,
    });
    check("anônimo NÃO consulta saldo de contrato", !!sAnon, sAnon?.message);

    // Aguardando assinatura: cliente passa a ver; técnico fica congelado
    await admin.from("ordens_servico").update({ status: "aguardando_assinatura" }).eq("id", os.id);
    check("aguardando assinatura: cliente A vê", await veOs(ca2));
    check("aguardando assinatura: cliente B NÃO vê", !(await veOs(cb2)));
    const { error: u4 } = await t1.from("ordens_servico").update({ diagnostico: "mudei" }).eq("id", os.id);
    check("aguardando assinatura: técnico NÃO edita", !!u4, u4?.message);
    const { error: i1 } = await t1
      .from("os_itens")
      .insert({ os_id: os.id, descricao: "x", quantidade: 1, valor_unitario: 1 });
    check("aguardando assinatura: técnico NÃO inclui itens", !!i1, i1?.message);
    const { error: s1 } = await ca2.from("os_assinaturas").insert({
      os_id: os.id,
      tipo: "cliente",
      nome_signatario: "x",
      imagem_path: "x",
      hash_documento: "x",
    });
    check("cliente NÃO grava assinatura direto (só pelo servidor)", !!s1, s1?.message);

    // Encerrada: imutável para todos, menos o servidor/admin nos campos permitidos
    await admin
      .from("ordens_servico")
      .update({ status: "assinada", finalizada_em: new Date().toISOString() })
      .eq("id", os.id);
    // A RLS filtra a linha (0 linhas afetadas, sem erro): o que importa é o dado não mudar.
    await t1.from("ordens_servico").update({ diagnostico: "tarde demais" }).eq("id", os.id);
    const { data: intacta } = await admin
      .from("ordens_servico")
      .select("diagnostico")
      .eq("id", os.id)
      .single();
    check("OS encerrada: técnico NÃO edita", intacta?.diagnostico === "ok", intacta);
    const { error: ad } = await admin
      .from("ordens_servico")
      .update({ diagnostico: "admin tenta" })
      .eq("id", os.id);
    check("OS encerrada: nem o servidor altera o conteúdo", !!ad, ad?.message);
    const { error: ad2 } = await admin
      .from("os_itens")
      .insert({ os_id: os.id, descricao: "x", quantidade: 1, valor_unitario: 1 });
    check("OS encerrada: não aceita novos itens", !!ad2, ad2?.message);
    const { error: ad3 } = await admin.from("ordens_servico").delete().eq("id", os.id);
    check("OS não pode ser apagada", !!ad3, ad3?.message);

    // Reabertura (só admin, com motivo): usa a função com o login do admin
    const adm = anonClient();
    const { error: l } = await adm.auth.signInWithPassword({
      email: requireEnv("SEED_ADMIN_EMAIL"),
      password: requireEnv("SEED_ADMIN_PASSWORD"),
    });
    if (l) throw new Error(`login admin: ${l.message}`);
    const { error: r1 } = await t1.rpc("reabrir_os", { p_os_id: os.id, p_motivo: "tentativa do técnico" });
    check("técnico NÃO reabre OS", !!r1, r1?.message);
    const { error: r2 } = await adm.rpc("reabrir_os", { p_os_id: os.id, p_motivo: "ab" });
    check("reabrir exige motivo", !!r2, r2?.message);
    const { error: r3 } = await adm.rpc("reabrir_os", {
      p_os_id: os.id,
      p_motivo: "Correção solicitada (teste RLS)",
    });
    check("admin reabre a OS com motivo", !r3, r3?.message);
    const { data: reab } = await admin
      .from("ordens_servico")
      .select("status, finalizada_em")
      .eq("id", os.id)
      .single();
    check(
      "OS reaberta volta para execução",
      reab?.status === "em_execucao" && reab.finalizada_em === null,
      reab,
    );
    const { count: audit } = await admin
      .from("auditoria")
      .select("id", { count: "exact", head: true })
      .eq("registro_id", os.id)
      .eq("acao", "reabertura_os");
    check("reabertura ficou na auditoria", (audit ?? 0) >= 1);

    // Limpeza: OS não pode ser apagada, então é arquivada
    await admin.from("ordens_servico").update({ ativo: false, status: "cancelada" }).eq("id", os.id);
  }

  console.log("\nSegundo técnico (sem chamados)");
  const t2 = await login(DEMO.users.tecnico2.email);
  {
    const { data } = await t2.from("chamados").select("id");
    check("não vê nenhum chamado", data?.length === 0, data);
    const { data: cli } = await t2.from("clientes").select("id");
    check("não vê nenhum cliente", cli?.length === 0, cli);
  }

  console.log(
    falhas ? `\n✗ ${falhas} verificação(ões) falharam.` : "\n✓ Todas as verificações de RLS passaram.",
  );
  process.exit(falhas ? 1 : 0);
}

main().catch((e) => {
  console.error("FALHOU:", e instanceof Error ? e.message : e);
  process.exit(1);
});
