import ExcelJS from "exceljs";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { DEMO } from "../scripts/demo-data";
import { RELATORIOS } from "../src/lib/relatorios";

/**
 * Checkpoint da Fase 5: os números do dashboard batem com os dados (conferidos por
 * consultas independentes ao banco), os 11 relatórios exportam e a agenda reagenda
 * arrastando o chamado para outro dia.
 */
const SENHA = process.env.SEED_DEMO_PASSWORD!;
const sufixo = Date.now().toString(36).toUpperCase();

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

async function entrarAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(process.env.SEED_ADMIN_EMAIL!);
  await page.getByLabel("Senha", { exact: true }).fill(process.env.SEED_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/admin/);
}

const hojeSP = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const somar = (d: string, n: number) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
/** Quarta-feira da semana corrente (semana começa na segunda): origem e destino ficam na mesma semana. */
const quartaDaSemana = () => {
  const h = hojeSP();
  const dow = new Date(`${h}T00:00:00Z`).getUTCDay();
  return somar(h, -((dow + 6) % 7) + 2);
};
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const rotuloDia = (d: string) =>
  `${DIAS[new Date(`${d}T00:00:00Z`).getUTCDay()]} ${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Valor numérico do cartão de KPI pelo título. */
async function kpi(page: Page, titulo: string) {
  const texto = await page
    .locator("p", { hasText: new RegExp(`^${titulo}$`) })
    .first()
    .locator("xpath=following-sibling::p[1]")
    .innerText();
  return texto.trim();
}

async function contagens(de: string, ate: string) {
  const sa = admin();
  const base = () =>
    sa
      .from("chamados")
      .select("id", { count: "exact", head: true })
      .eq("ativo", true)
      .gte("created_at", de)
      .lt("created_at", ate);
  const [abertos, atendimento, aguardando, total] = await Promise.all([
    base().in("status", ["aberto", "triagem", "agendado"]),
    base().eq("status", "em_atendimento"),
    base().in("status", ["aguardando_cliente", "aguardando_peca"]),
    base(),
  ]);
  return {
    abertos: abertos.count ?? 0,
    atendimento: atendimento.count ?? 0,
    aguardando: aguardando.count ?? 0,
    total: total.count ?? 0,
  };
}

async function arrastar(
  page: Page,
  origem: ReturnType<Page["locator"]>,
  destino: ReturnType<Page["locator"]>,
) {
  const a = (await origem.boundingBox())!;
  const b = (await destino.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + 14);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 12, a.y + 24, { steps: 4 });
  await page.mouse.move(b.x + b.width / 2, b.y + 50, { steps: 20 });
  await page.mouse.up();
}

test.describe("Fase 5 — dashboard, relatórios e agenda", () => {
  test.skip(({ isMobile }) => isMobile, "fluxo completo roda só no desktop");
  test.skip(!process.env.SEED_ADMIN_PASSWORD || !SENHA, "senhas de seed não definidas");

  const criados: string[] = [];
  let atrasado = { id: "", protocolo: "" };
  let agendado = { id: "", protocolo: "" };

  test.beforeAll(async () => {
    const sa = admin();
    const { data: cliente } = await sa
      .from("clientes")
      .select("id")
      .eq("cnpj_cpf", DEMO.clienteA.cnpj_cpf)
      .single();
    const { data: tecnico } = await sa
      .from("profiles")
      .select("id")
      .eq("email", DEMO.users.tecnico.email)
      .single();
    const novo = async (titulo: string, extra: Record<string, unknown>) => {
      const { data, error } = await sa
        .from("chamados")
        .insert({
          cliente_id: cliente!.id,
          tecnico_id: tecnico!.id,
          titulo,
          prioridade: "alta",
          origem: "telefone",
          ...extra,
        })
        .select("id, protocolo")
        .single();
      if (error) throw error;
      criados.push(data.id);
      return data;
    };
    // Chamado com a solução vencida há 2 horas (SLA estourado)
    atrasado = await novo(`[E2E] SLA estourado ${sufixo}`, { status: "em_atendimento" });
    await sa
      .from("chamados")
      .update({
        sla_solucao_ate: new Date(Date.now() - 2 * 3_600_000).toISOString(),
        sla_resposta_ate: new Date(Date.now() - 6 * 3_600_000).toISOString(),
      })
      .eq("id", atrasado.id);
    // Chamado agendado para amanhã às 10:00 (agenda)
    agendado = await novo(`[E2E] Visita agendada ${sufixo}`, {
      status: "agendado",
      data_agendada: `${quartaDaSemana()}T10:00:00-03:00`,
    });
  });

  test.afterAll(async () => {
    const sa = admin();
    for (const id of criados) await sa.from("chamados").update({ ativo: false }).eq("id", id);
  });

  test("dashboard confere com o banco, relatórios exportam e a agenda reagenda", async ({
    page,
    browser,
  }) => {
    test.setTimeout(300_000);
    await entrarAdmin(page);

    // 1) KPIs do dashboard x consultas independentes (últimos 30 dias)
    await page.goto("/admin?periodo=30d");
    await expect(page.getByRole("heading", { name: /Olá,/ })).toBeVisible();
    const hoje = hojeSP();
    const c30 = await contagens(`${somar(hoje, -29)}T00:00:00-03:00`, `${somar(hoje, 1)}T00:00:00-03:00`);
    expect(Number(await kpi(page, "Abertos"))).toBe(c30.abertos);
    expect(Number(await kpi(page, "Em atendimento"))).toBe(c30.atendimento);
    expect(Number(await kpi(page, "Aguardando"))).toBe(c30.aguardando);

    // Período "Hoje"
    await page.getByRole("combobox", { name: "Período" }).click();
    await page.getByRole("option", { name: "Hoje" }).click();
    await expect(page).toHaveURL(/periodo=hoje/);
    const cHoje = await contagens(`${hoje}T00:00:00-03:00`, `${somar(hoje, 1)}T00:00:00-03:00`);
    await expect.poll(async () => Number(await kpi(page, "Em atendimento"))).toBe(cHoje.atendimento);
    expect(Number(await kpi(page, "Abertos"))).toBe(cHoje.abertos);
    expect(cHoje.atendimento).toBeGreaterThanOrEqual(1); // o chamado criado agora

    // Período personalizado
    await page.getByRole("combobox", { name: "Período" }).click();
    await page.getByRole("option", { name: "Personalizado" }).click();
    await page.getByLabel("Data inicial").fill(somar(hoje, -10));
    await page.getByLabel("Data final").fill(hoje);
    await page.getByRole("button", { name: "Aplicar" }).click();
    await expect(page).toHaveURL(/periodo=custom/);
    const cCustom = await contagens(`${somar(hoje, -10)}T00:00:00-03:00`, `${somar(hoje, 1)}T00:00:00-03:00`);
    await expect.poll(async () => Number(await kpi(page, "Abertos"))).toBe(cCustom.abertos);

    // SLA em risco lista o chamado atrasado; gráficos presentes
    await page.goto("/admin?periodo=30d");
    const risco = page.getByRole("link", { name: new RegExp(atrasado.protocolo) });
    await expect(risco).toBeVisible();
    await expect(risco).toContainText("Estourado");
    await expect(page.getByRole("img", { name: /^Chamados por dia/ })).toBeVisible();
    await expect(page.getByRole("img", { name: /^Receita/ })).toBeVisible();
    const estourados = Number(await kpi(page, "SLA estourado agora"));
    expect(estourados).toBeGreaterThanOrEqual(1);

    // 2) Relatórios: índice, tela com exportação e os 11 em CSV
    await page.goto("/admin/relatorios");
    for (const r of RELATORIOS)
      await expect(page.getByRole("link", { name: new RegExp(r.titulo) })).toBeVisible();

    await page.goto("/admin/relatorios/clientes?periodo=30d");
    await expect(page.getByRole("columnheader", { name: "Cliente" })).toBeVisible();
    await expect(page.getByRole("cell", { name: /Residencial Alfa/ }).first()).toBeVisible();

    for (const r of RELATORIOS) {
      const resp = await page.request.get(`/api/relatorios/${r.id}?periodo=30d&formato=csv`);
      expect(resp.status(), `CSV de ${r.id}`).toBe(200);
      const csv = (await resp.body()).toString("utf8");
      expect(csv.startsWith("﻿"), `BOM em ${r.id}`).toBe(true);
      for (const s of r.secoes) expect(csv, `${r.id}/${s.id}`).toContain(s.colunas[0].titulo);
    }
    const xlsx = await page.request.get(`/api/relatorios/sla?periodo=30d&formato=xlsx`);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await xlsx.body()) as never);
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      "Por prioridade",
      "Por cliente",
      "Por técnico",
      "Violações",
    ]);
    const violacoes = wb.getWorksheet("Violações")!;
    let achou = false;
    violacoes.eachRow((row) => {
      if (String(row.getCell(1).value) === atrasado.protocolo) achou = true;
    });
    expect(achou, "violação do chamado atrasado no XLSX").toBe(true);
    for (const id of ["faturamento", "calor"]) {
      const pdf = await page.request.get(`/api/relatorios/${id}?periodo=30d&formato=pdf`);
      expect(pdf.status()).toBe(200);
      expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
    }
    expect((await page.request.get(`/api/relatorios/inexistente?formato=csv`)).status()).toBe(404);

    // O técnico não exporta relatórios
    const ctx = await browser.newContext();
    const tec = await ctx.newPage();
    await tec.goto("/login");
    await tec.getByLabel("E-mail").fill(DEMO.users.tecnico.email);
    await tec.getByLabel("Senha", { exact: true }).fill(SENHA);
    await tec.getByRole("button", { name: "Entrar" }).click();
    await tec.waitForURL(/\/tecnico/);
    expect((await tec.request.get(`/api/relatorios/clientes?formato=csv`)).status()).toBe(403);
    await ctx.close();

    // 3) Agenda: arrastar o chamado agendado na quarta para a quinta
    const amanha = quartaDaSemana();
    const depois = somar(amanha, 1);
    await page.goto(`/admin/agenda?data=${amanha}`);
    const grade = page.locator("div.grid").first();
    const cartao = page.locator('[aria-roledescription="Chamado arrastável"]', {
      hasText: agendado.protocolo,
    });
    const destino = page.getByRole("region", { name: rotuloDia(depois), exact: true });
    await expect(cartao).toBeVisible();
    await expect(cartao).toContainText("10:00");
    await expect(grade).toBeVisible();
    await arrastar(page, cartao, destino);
    await expect(page.getByText(/reagendado para/)).toBeVisible();
    const sa = admin();
    const { data: depoisDrag } = await sa
      .from("chamados")
      .select("data_agendada")
      .eq("id", agendado.id)
      .single();
    const local = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "America/Sao_Paulo",
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(depoisDrag!.data_agendada!));
    expect(local.replace(" ", "T")).toBe(`${depois}T10:00`); // mudou o dia e manteve a hora

    // Reagendar escolhendo o horário
    await page.reload();
    await page
      .locator('[aria-roledescription="Chamado arrastável"]', { hasText: agendado.protocolo })
      .getByRole("button")
      .click();
    await page.getByLabel("Visita agendada para").fill(`${depois}T15:30`);
    await page.getByRole("button", { name: "Reagendar" }).click();
    await expect(page.getByText("Visita reagendada.")).toBeVisible();
    const { data: horario } = await sa
      .from("chamados")
      .select("data_agendada")
      .eq("id", agendado.id)
      .single();
    expect(new Date(horario!.data_agendada!).toISOString()).toBe(
      new Date(`${depois}T15:30:00-03:00`).toISOString(),
    );

    // Visão mensal e filtro por técnico
    await page.goto(`/admin/agenda?view=mes&data=${depois}`);
    await expect(
      page.locator('[aria-roledescription="Chamado arrastável"]', { hasText: agendado.protocolo }),
    ).toBeVisible();
    await page.goto(`/admin/agenda?data=${depois}&tecnico=sem`);
    await expect(
      page.locator('[aria-roledescription="Chamado arrastável"]', { hasText: agendado.protocolo }),
    ).toHaveCount(0);
  });
});
