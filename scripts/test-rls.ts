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
