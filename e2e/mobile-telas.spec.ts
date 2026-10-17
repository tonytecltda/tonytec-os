import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { DEMO } from "../scripts/demo-data";

/**
 * Telas do celular (375 px): agenda sem sobreposição (mini calendário + lista do dia),
 * tabelas em cartões com rótulos, filtros recolhíveis e botões com área de toque de 44 px.
 */
const hojeSP = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

const servico = () =>
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

const semRolagemLateral = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test.describe("Celular — telas do administrador", () => {
  test.skip(({ isMobile }) => !isMobile, "só no projeto mobile");
  test.skip(!process.env.SEED_ADMIN_PASSWORD, "SEED_ADMIN_PASSWORD não definido");

  const ids: string[] = [];
  const titulo = `[E2E-MOB] Visita ${Date.now().toString(36).toUpperCase()}`;

  test.beforeAll(async () => {
    const sa = servico();
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
    const { data } = await sa
      .from("chamados")
      .insert({
        cliente_id: cliente!.id,
        tecnico_id: tecnico!.id,
        titulo,
        prioridade: "alta",
        origem: "telefone",
        status: "agendado",
        data_agendada: `${hojeSP()}T10:00:00-03:00`,
      })
      .select("id")
      .single();
    ids.push(data!.id);
  });

  test.afterAll(async () => {
    const sa = servico();
    for (const id of ids) await sa.from("chamados").update({ ativo: false }).eq("id", id);
  });

  test("agenda: semana e mês no celular, sem sobreposição nem rolagem lateral", async ({ page }) => {
    await entrarAdmin(page);

    // Semana: lista vertical de dias; o chamado de hoje aparece inteiro e legível
    await page.goto("/admin/agenda");
    const cartao = page.locator('[aria-roledescription="Chamado arrastável"]', { hasText: titulo });
    await expect(cartao).toBeVisible();
    await expect(cartao).toContainText("10:00");
    expect(await semRolagemLateral(page)).toBeLessThanOrEqual(0);
    // cartões do mesmo dia não se sobrepõem
    const caixas = await page
      .locator('[aria-roledescription="Chamado arrastável"]')
      .evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => [r.top, r.bottom]));
    const ordenadas = [...caixas].sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < ordenadas.length; i++)
      expect(ordenadas[i][0]).toBeGreaterThanOrEqual(ordenadas[i - 1][1] - 1);

    // Mês: mini calendário; tocar no dia mostra a lista do dia
    await page.goto("/admin/agenda?view=mes");
    const calendario = page.getByRole("group", { name: "Calendário do mês" });
    await expect(calendario).toBeVisible();
    const hoje = Number(hojeSP().slice(8, 10));
    const celula = calendario.getByRole("button", { name: new RegExp(`${hoje}: \\d+ visita`) });
    await expect(celula).toBeVisible();
    await celula.click();
    await expect(
      page.locator('[aria-roledescription="Chamado arrastável"]', { hasText: titulo }),
    ).toBeVisible();
    expect(await semRolagemLateral(page)).toBeLessThanOrEqual(0);

    // Tocar no chamado abre a escolha de data e hora (no celular não se arrasta)
    await page
      .locator('[aria-roledescription="Chamado arrastável"]', { hasText: titulo })
      .getByRole("button")
      .click();
    await expect(page.getByLabel("Visita agendada para")).toBeVisible();
  });

  test("listas viram cartões com rótulos e os filtros ficam recolhidos", async ({ page }) => {
    await entrarAdmin(page);
    await page.goto("/admin/chamados?view=lista&q=E2E-MOB");
    const linha = page.locator("tbody tr").first();
    await expect(linha).toBeVisible();
    // rótulos vindos do cabeçalho e cabeçalho fora da tela
    await expect(linha.locator("td[data-label='Status']")).toHaveCount(1);
    expect((await page.locator("thead").boundingBox())!.height).toBeLessThanOrEqual(1);
    expect(await semRolagemLateral(page)).toBeLessThanOrEqual(0);

    // filtros recolhidos por padrão; o botão abre
    const botao = page.getByRole("button", { name: /^Filtros/ });
    await expect(botao).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Prioridade" })).toBeHidden();
    await botao.click();
    await expect(page.getByRole("combobox", { name: "Prioridade" })).toBeVisible();
  });

  test("botões e campos têm área de toque de pelo menos 44 px", async ({ page }) => {
    await entrarAdmin(page);
    for (const url of ["/admin/chamados", "/admin/clientes", "/admin/chamados/novo"]) {
      await page.goto(url);
      await page.waitForLoadState("networkidle");
      const pequenos = await page
        .locator("main button:visible, main input:visible, main [role=combobox]:visible")
        .evaluateAll((els) =>
          els
            .map((e) => ({
              r: e.getBoundingClientRect(),
              t: (e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 30),
            }))
            .filter(({ r, t }) => r.height < 43.5 && !/Nota interna/.test(t))
            .map(({ r, t }) => `${t} ${Math.round(r.width)}x${Math.round(r.height)}`),
        );
      expect(pequenos, `alvos pequenos em ${url}`).toEqual([]);
    }
  });
});
