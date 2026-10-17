/**
 * Valida as funções de relatório do banco: executam sem erro (service_role e admin),
 * retornam a estrutura esperada e são negadas a técnico, cliente e anônimo.
 * Uso: npm run test:relatorios   (requer seed:demo)
 */
import { adminClient, anonClient, requireEnv } from "./_lib";
import { DEMO } from "./demo-data";
import { RELATORIOS } from "../src/lib/relatorios";

let falhas = 0;
function check(nome: string, ok: boolean, detalhe?: unknown) {
  console.log(
    `${ok ? "  ✓" : "  ✗"} ${nome}${!ok && detalhe !== undefined ? ` → ${JSON.stringify(detalhe)}` : ""}`,
  );
  if (!ok) falhas++;
}

const de = new Date(Date.now() - 400 * 86_400_000).toISOString();
const ate = new Date(Date.now() + 86_400_000).toISOString();

const FUNCOES: { fn: string; args: Record<string, unknown> }[] = [
  { fn: "rel_clientes", args: { p_de: de, p_ate: ate } },
  { fn: "rel_problemas", args: { p_de: de, p_ate: ate } },
  { fn: "rel_reincidencia", args: { p_de: de, p_ate: ate } },
  { fn: "rel_tecnicos", args: { p_de: de, p_ate: ate } },
  { fn: "rel_sla", args: { p_de: de, p_ate: ate, p_dim: "prioridade" } },
  { fn: "rel_sla", args: { p_de: de, p_ate: ate, p_dim: "cliente" } },
  { fn: "rel_sla", args: { p_de: de, p_ate: ate, p_dim: "tecnico" } },
  { fn: "rel_sla_violacoes", args: { p_de: de, p_ate: ate } },
  { fn: "rel_faturamento", args: { p_de: de, p_ate: ate, p_dim: "cliente" } },
  { fn: "rel_faturamento", args: { p_de: de, p_ate: ate, p_dim: "tipo" } },
  { fn: "rel_faturamento", args: { p_de: de, p_ate: ate, p_dim: "mes" } },
  { fn: "rel_contratos", args: { p_de: de, p_ate: ate } },
  { fn: "rel_evolucao", args: { p_de: de, p_ate: ate } },
  { fn: "rel_satisfacao", args: { p_de: de, p_ate: ate } },
  { fn: "rel_materiais", args: { p_de: de, p_ate: ate } },
  { fn: "rel_calor", args: { p_de: de, p_ate: ate } },
  { fn: "rel_categoria_dia", args: { p_de: de, p_ate: ate } },
  { fn: "rel_os_aguardando", args: { p_de: de, p_ate: ate } },
  { fn: "rel_os_pendencias", args: { p_de: de, p_ate: ate } },
];

async function main() {
  const sa = adminClient();
  console.log("\nFunções (service_role)");
  for (const { fn, args } of FUNCOES) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sa as any).rpc(fn, args);
    const rotulo = args.p_dim ? `${fn}(${args.p_dim})` : fn;
    check(`${rotulo} executa`, !error && Array.isArray(data), error?.message);
  }

  const { data: dash, error: dashErro } = await sa.rpc("rel_dashboard", { p_de: de, p_ate: ate });
  const d = dash as Record<string, unknown> | null;
  check("rel_dashboard executa", !dashErro && !!d, dashErro?.message);
  for (const chave of [
    "chamados",
    "tempos",
    "sla",
    "sla_risco",
    "os",
    "faturamento",
    "satisfacao",
    "por_dia",
    "por_categoria",
    "por_prioridade",
    "por_tecnico",
    "receita_mensal",
    "top_clientes",
    "top_problemas",
  ]) {
    check(`dashboard traz "${chave}"`, !!d && chave in d);
  }
  check(
    "receita mensal tem 12 meses",
    Array.isArray(d?.receita_mensal) && (d!.receita_mensal as unknown[]).length === 12,
  );

  // Consistência: chamados por categoria somam o total do período
  const total = (d?.chamados as { total: number }).total;
  const somaCat = (d?.por_categoria as { qtd: number }[]).reduce((a, x) => a + Number(x.qtd), 0);
  const somaPri = (d?.por_prioridade as { qtd: number }[]).reduce((a, x) => a + Number(x.qtd), 0);
  const somaTec = (d?.por_tecnico as { qtd: number }[]).reduce((a, x) => a + Number(x.qtd), 0);
  check("categorias somam o total de chamados", somaCat === Number(total), { somaCat, total });
  check("prioridades somam o total de chamados", somaPri === Number(total), { somaPri, total });
  check("técnicos somam o total de chamados", somaTec === Number(total), { somaTec, total });

  const { error: dim } = await sa.rpc("rel_sla", { p_de: de, p_ate: ate, p_dim: "inexistente" });
  check("dimensão inválida é recusada", !!dim, dim?.message);

  // As colunas do catálogo precisam existir nas funções (conferido no catálogo do Postgres, mesmo sem dados).
  console.log("\nCatálogo x funções");
  const resp = await fetch(
    `https://api.supabase.com/v1/projects/${requireEnv("SUPABASE_PROJECT_REF")}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${requireEnv("SUPABASE_ACCESS_TOKEN")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `select p.proname as fn, pg_get_function_result(p.oid) as retorno
              from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and left(p.proname, 4) = 'rel_'`,
      }),
    },
  );
  const funcoes = (await resp.json()) as { fn: string; retorno: string }[];
  const colunasDe = (retorno: string) =>
    [
      ...retorno
        .replace(/^TABLE\(/, "")
        .replace(/\)$/, "")
        .matchAll(/(?:^|, )([a-z_0-9]+) [a-z]/g),
    ].map((m) => m[1]);
  for (const rel of RELATORIOS) {
    for (const secao of rel.secoes) {
      const f = funcoes.find((x) => x.fn === secao.fn);
      const reais = f ? colunasDe(f.retorno) : [];
      const faltando = secao.colunas.map((c) => c.chave).filter((c) => !reais.includes(c));
      check(`${rel.id}/${secao.id}: colunas existem em ${secao.fn}`, !!f && faltando.length === 0, {
        faltando,
        reais,
      });
    }
  }
  check("são 11 relatórios", RELATORIOS.length === 11, RELATORIOS.length);

  // Acesso: só admin
  console.log("\nAcesso");
  const senha = requireEnv("SEED_DEMO_PASSWORD");
  const perfis = [
    ["técnico", DEMO.users.tecnico.email],
    ["cliente", DEMO.users.clienteA.email],
  ] as const;
  for (const [rotulo, email] of perfis) {
    const c = anonClient();
    await c.auth.signInWithPassword({ email, password: senha });
    const { error: e1 } = await c.rpc("rel_dashboard", { p_de: de, p_ate: ate });
    check(`${rotulo} NÃO acessa o dashboard`, !!e1, e1?.message);
    const { error: e2 } = await c.rpc("rel_clientes", { p_de: de, p_ate: ate });
    check(`${rotulo} NÃO acessa relatórios`, !!e2, e2?.message);
  }
  const anon = anonClient();
  const { error: e3 } = await anon.rpc("rel_clientes", { p_de: de, p_ate: ate });
  check("anônimo NÃO acessa relatórios", !!e3, e3?.message);

  const adm = anonClient();
  await adm.auth.signInWithPassword({
    email: requireEnv("SEED_ADMIN_EMAIL"),
    password: requireEnv("SEED_ADMIN_PASSWORD"),
  });
  const { error: e4 } = await adm.rpc("rel_dashboard", { p_de: de, p_ate: ate });
  check("admin acessa o dashboard", !e4, e4?.message);

  console.log(
    falhas
      ? `\n✗ ${falhas} verificação(ões) falharam.`
      : "\n✓ Todas as verificações dos relatórios passaram.",
  );
  process.exit(falhas ? 1 : 0);
}

main().catch((e) => {
  console.error("FALHOU:", e instanceof Error ? e.message : e);
  process.exit(1);
});
