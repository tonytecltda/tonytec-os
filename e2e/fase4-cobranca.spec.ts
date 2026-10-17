import ExcelJS from "exceljs";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { DEMO } from "../scripts/demo-data";

/**
 * Checkpoint da Fase 4: fechamento mensal de um cliente de teste com valores
 * conferidos à mão.
 *
 * Contrato: 2 visitas + 4 h por mês, excedente por hora a R$ 120, mensalidade R$ 500.
 * Config padrão: mínimo 1 h, fração de 15 min.
 *   v1  1 h        -> isento (franquia: 1 visita, 1 h)
 *   v2  1 h 30     -> isento (franquia: 2 visitas, 2,5 h)
 *   v3  2 h        -> franquia de visitas esgotada: 2 h x R$ 120 = R$ 240
 *   v4  20 min     -> mínimo de 1 h x R$ 120 = R$ 120
 *   item da v3: 2 x R$ 45 = R$ 90
 * Total esperado: 500 + 360 + 90 = R$ 950,00
 */

const SENHA = process.env.SEED_DEMO_PASSWORD!;
const sufixo = Date.now().toString(36).toUpperCase();

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

async function entrar(page: Page, email: string, senha: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/(admin|tecnico|portal)/);
}

const mesAtual = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" })
  .format(new Date())
  .slice(0, 7);
const reais = (n: number) =>
  new RegExp(`R\\$\\s${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 }).replace(".", "\\.")}`);

type Visita = { id: string; os: string; osId: string };

test.describe("Fase 4 — cobrança de visitas", () => {
  test.skip(({ isMobile }) => isMobile, "fluxo completo roda só no desktop");
  test.skip(!process.env.SEED_ADMIN_PASSWORD || !SENHA, "senhas de seed não definidas");

  let clienteId = "";
  let contratoId = "";
  const visitas: Visita[] = [];

  test.beforeAll(async () => {
    const sa = admin();
    const { data: cfg } = await sa
      .from("configuracoes")
      .select("valor")
      .eq("chave", "cobranca")
      .maybeSingle();
    const c = (cfg?.valor ?? {}) as Record<string, number>;
    test.skip(
      c.minimo_horas_cobraveis !== 1 || c.fracao_minutos !== 15,
      "valores esperados dependem da configuração padrão (mínimo 1 h, fração 15 min)",
    );

    const alnum = Array.from(
      { length: 9 },
      () => "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 36)],
    ).join("");
    const { data: cliente, error } = await sa
      .from("clientes")
      .insert({
        razao_social: `[E2E] Cliente Cobrança ${sufixo}`,
        nome_fantasia: `E2E Cobrança ${sufixo}`,
        cnpj_cpf: `E2E${alnum}00`,
      })
      .select("id")
      .single();
    if (error) throw error;
    clienteId = cliente.id;

    const primeiroDiaMesAnterior = new Date();
    primeiroDiaMesAnterior.setUTCMonth(primeiroDiaMesAnterior.getUTCMonth() - 1, 1);
    const { data: contrato, error: ctErro } = await sa
      .from("contratos")
      .insert({
        cliente_id: clienteId,
        numero: `E2E-CT-${sufixo}`,
        tipo: "manutencao_mensal",
        data_inicio: primeiroDiaMesAnterior.toISOString().slice(0, 10),
        valor_mensal: 500,
        visitas_inclusas_mes: 2,
        horas_inclusas_mes: 4,
        politica_visita_excedente: "valor_hora",
        valor_hora_excedente: 120,
        status: "ativo",
      })
      .select("id")
      .single();
    if (ctErro) throw ctErro;
    contratoId = contrato.id;

    const { data: tecnico } = await sa
      .from("profiles")
      .select("id")
      .eq("email", DEMO.users.tecnico.email)
      .single();
    const plano = [
      { dia: "02", minutos: 60 },
      { dia: "03", minutos: 90 },
      { dia: "04", minutos: 120 },
      { dia: "05", minutos: 20 },
    ];
    for (const [i, p] of plano.entries()) {
      const { data: os, error: osErro } = await sa
        .from("ordens_servico")
        .insert({
          cliente_id: clienteId,
          tecnico_id: tecnico!.id,
          status: "em_execucao",
          servico_executado: `[E2E] visita ${i + 1}`,
        })
        .select("id, numero")
        .single();
      if (osErro) throw osErro;
      const chegada = new Date(`${mesAtual}-${p.dia}T09:00:00-03:00`);
      const saida = new Date(chegada.getTime() + p.minutos * 60_000);
      const { data: v, error: vErro } = await sa
        .from("os_visitas")
        .insert({
          os_id: os.id,
          data_hora_chegada: chegada.toISOString(),
          data_hora_saida: saida.toISOString(),
        })
        .select("id")
        .single();
      if (vErro) throw vErro;
      if (i === 2) {
        await sa
          .from("os_itens")
          .insert({
            os_id: os.id,
            descricao: "Fonte E2E 12V",
            quantidade: 2,
            valor_unitario: 45,
            cobrado: true,
          });
      }
      const agora = new Date().toISOString();
      const { error: encErro } = await sa
        .from("ordens_servico")
        .update({
          status: "assinada",
          finalizada_em: agora,
          assinada_em: agora,
          hash_conteudo: "e2e",
          data_inicio: chegada.toISOString(),
          data_fim: saida.toISOString(),
        })
        .eq("id", os.id);
      if (encErro) throw encErro;
      visitas.push({ id: v.id, os: os.numero, osId: os.id });
    }
  });

  test.afterAll(async () => {
    if (!clienteId) return;
    const sa = admin();
    for (const v of visitas) await sa.from("ordens_servico").update({ ativo: false }).eq("id", v.osId);
    await sa.from("contratos").update({ status: "encerrado" }).eq("id", contratoId);
    await sa.from("clientes").update({ ativo: false }).eq("id", clienteId);
  });

  test("calcula, ajusta, fecha o mês, exporta e fatura", async ({ page, browser }) => {
    test.setTimeout(240_000);
    await entrar(page, process.env.SEED_ADMIN_EMAIL!, process.env.SEED_ADMIN_PASSWORD!);
    const linha = (v: Visita) => page.getByRole("row", { name: new RegExp(v.os) });
    const lista = `/admin/cobranca?cliente=${clienteId}&faturamento=todos`;

    // 1) Visitas sem cálculo -> "Calcular pendentes"
    await page.goto(lista);
    for (const v of visitas) await expect(linha(v)).toContainText("Sem cálculo");
    await page.getByRole("button", { name: /Calcular pendentes/ }).click();
    await expect(linha(visitas[3])).toContainText("Por hora", { timeout: 30_000 });

    await expect(linha(visitas[0])).toContainText("Isento (contrato)");
    await expect(linha(visitas[1])).toContainText("Isento (contrato)");
    await expect(linha(visitas[2])).toContainText("Por hora");
    await expect(linha(visitas[2])).toContainText(reais(240));
    await expect(linha(visitas[3])).toContainText(reais(120));

    // Banco: valores conferidos
    const sa = admin();
    const { data: calc } = await sa
      .from("os_visitas")
      .select("id, cobranca_tipo, valor_total, quantidade_horas, horas_franquia, contrato_id")
      .in(
        "id",
        visitas.map((v) => v.id),
      );
    const por = (v: Visita) => calc!.find((c) => c.id === v.id)!;
    expect(por(visitas[0]).cobranca_tipo).toBe("isento_contrato");
    expect(Number(por(visitas[1]).horas_franquia)).toBe(1.5);
    expect(Number(por(visitas[2]).quantidade_horas)).toBe(2);
    expect(Number(por(visitas[2]).valor_total)).toBe(240);
    expect(Number(por(visitas[3]).quantidade_horas)).toBe(1);
    expect(Number(por(visitas[3]).valor_total)).toBe(120);
    expect(calc!.every((c) => c.contrato_id === contratoId)).toBe(true);

    // 2) Ajuste manual: cortesia exige justificativa; depois, recalcular volta à sugestão
    await page.getByRole("button", { name: `Ajustar cobrança da ${visitas[3].os}` }).click();
    const dialogo = page.getByRole("dialog");
    await dialogo.getByLabel("Tipo de cobrança").click();
    await page.getByRole("option", { name: "Cortesia" }).click();
    await dialogo.getByRole("button", { name: "Salvar" }).click();
    await expect(dialogo.getByText(/exigem justificativa/)).toBeVisible();
    await dialogo.getByLabel(/Justificativa/).fill("Cortesia comercial — teste E2E");
    await dialogo.getByRole("button", { name: "Salvar" }).click();
    await expect(dialogo).toBeHidden();
    await expect(linha(visitas[3])).toContainText("Cortesia");
    await expect(linha(visitas[3])).toContainText("ajuste manual");
    await expect(linha(visitas[3])).toContainText(reais(0));
    const { count: auditoria } = await sa
      .from("auditoria")
      .select("id", { count: "exact", head: true })
      .eq("registro_id", visitas[3].id)
      .eq("acao", "alteracao_cobranca_pos_assinatura");
    expect(auditoria).toBeGreaterThanOrEqual(1); // alteração após a assinatura fica na auditoria

    await page.getByRole("button", { name: `Ajustar cobrança da ${visitas[3].os}` }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Recalcular sugestão" }).click();
    await expect(linha(visitas[3])).toContainText("Por hora", { timeout: 20_000 });
    await expect(linha(visitas[3])).toContainText(reais(120));

    // 3) Fechamento mensal: totais conferidos à mão
    await page.goto(`/admin/cobranca/fechamento?cliente=${clienteId}&mes=${mesAtual}`);
    await expect(page.getByTestId("resumo-Mensalidades")).toHaveText(reais(500));
    await expect(page.getByTestId("resumo-Visitas cobradas")).toHaveText(reais(360));
    await expect(page.getByTestId("resumo-Materiais e serviços")).toHaveText(reais(90));
    await expect(page.getByTestId("resumo-Total do mês")).toHaveText(reais(950));
    await expect(page.getByText("Fonte E2E 12V")).toBeVisible();

    // 4) Exportações (CSV, XLSX e PDF)
    const base = `/api/cobranca/fechamento?cliente=${clienteId}&mes=${mesAtual}`;
    const csv = await page.request.get(`${base}&formato=csv`);
    expect(csv.headers()["content-type"]).toContain("text/csv");
    const textoCsv = (await csv.body()).toString("utf8");
    expect(textoCsv).toContain("TOTAL DO MÊS");
    expect(textoCsv).toContain("950,00");
    expect(textoCsv).toContain("240,00");

    const xlsx = await page.request.get(`${base}&formato=xlsx`);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await xlsx.body()) as never);
    const ws = wb.worksheets[0];
    const valores: number[] = [];
    ws.eachRow((row) => {
      const v = row.getCell(7).value;
      if (typeof v === "number") valores.push(v);
    });
    expect(valores.at(-1)).toBe(950); // linha de total
    expect(valores).toContain(240);

    const pdf = await page.request.get(`${base}&formato=pdf`);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

    const lista2 = await page.request.get(
      `/api/cobranca/export?cliente=${clienteId}&faturamento=todos&formato=csv`,
    );
    expect((await lista2.body()).toString("utf8")).toContain("E2E Cobrança");

    // 5) Faturar em lote na tela de cobrança
    await page.goto(`/admin/cobranca?cliente=${clienteId}`);
    await page.getByRole("checkbox", { name: "Selecionar todas" }).click();
    await expect(page.getByText(/4 selecionada\(s\)/)).toBeVisible();
    await page.getByRole("button", { name: "Marcar como faturado" }).click();
    await expect(page.getByText(/4 visita\(s\) marcada\(s\) como faturada\(s\)/)).toBeVisible();
    await page.goto(`/admin/cobranca?cliente=${clienteId}&faturamento=faturado`);
    await expect(linha(visitas[0])).toContainText("Faturado");

    // Visita faturada não pode ser alterada
    await page.getByRole("button", { name: `Ajustar cobrança da ${visitas[0].os}` }).click();
    await expect(page.getByRole("dialog").getByText(/já foi faturada/)).toBeVisible();
    await expect(page.getByRole("dialog").getByRole("button", { name: "Salvar" })).toBeDisabled();
    await page.keyboard.press("Escape");

    // Fechamento: marcar o mês (inclui os materiais) e depois desfazer
    await page.goto(`/admin/cobranca/fechamento?cliente=${clienteId}&mes=${mesAtual}`);
    await page.getByRole("button", { name: "Marcar mês como faturado" }).click();
    await page.getByRole("button", { name: "Marcar como faturado", exact: true }).click();
    await expect(page.getByRole("button", { name: "Desfazer faturamento do mês" })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: "Desfazer faturamento do mês" }).click();
    await expect(page.getByRole("button", { name: "Marcar mês como faturado" })).toBeVisible({
      timeout: 20_000,
    });
    const { count: aFaturar } = await sa
      .from("os_visitas")
      .select("id", { count: "exact", head: true })
      .in(
        "id",
        visitas.map((v) => v.id),
      )
      .eq("faturado", false);
    expect(aFaturar).toBe(4);

    // 6) Técnico não acessa a cobrança (tela e downloads)
    const ctx = await browser.newContext();
    const tec = await ctx.newPage();
    await entrar(tec, DEMO.users.tecnico.email, SENHA);
    await tec.goto("/admin/cobranca");
    await expect(tec).toHaveURL(/\/tecnico$/);
    expect((await tec.request.get(`/api/cobranca/export?formato=csv`)).status()).toBe(403);
    expect((await tec.request.get(`${base}&formato=pdf`)).status()).toBe(403);
    await ctx.close();
  });
});
