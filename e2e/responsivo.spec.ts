import { expect, test, type Page } from "@playwright/test";
import { DEMO } from "../scripts/demo-data";

/** Telas principais não podem ter rolagem horizontal da página em 375 px. */
const PAGINAS = {
  admin: [
    "/admin",
    "/admin/chamados",
    "/admin/chamados?view=lista",
    "/admin/chamados/novo",
    "/admin/clientes",
    "/admin/contratos",
    "/admin/tecnicos",
    "/admin/os",
    "/admin/relatorios",
    "/admin/relatorios/clientes",
    "/admin/relatorios/calor",
    "/admin/agenda",
    "/admin/agenda?view=mes",
    "/admin/cobranca",
    "/admin/cobranca/fechamento",
    "/admin/catalogos",
    "/admin/catalogos?aba=itens",
    "/admin/configuracoes",
    "/admin/configuracoes?aba=sla",
  ],
  cliente: ["/portal", "/portal/chamados", "/portal/chamados/novo", "/portal/contrato"],
  tecnico: ["/tecnico"],
};

async function entrar(page: Page, email: string, senha: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/(admin|tecnico|portal)/);
}

async function semRolagemHorizontal(page: Page, urls: string[]) {
  for (const url of urls) {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    const { scroll, largura } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      largura: window.innerWidth,
    }));
    expect(scroll, `rolagem horizontal em ${url}`).toBeLessThanOrEqual(largura);
  }
}

test.describe("375 px sem rolagem horizontal", () => {
  test.skip(({ isMobile }) => !isMobile, "só no projeto mobile");

  test("admin", async ({ page }) => {
    test.skip(!process.env.SEED_ADMIN_PASSWORD, "SEED_ADMIN_PASSWORD não definido");
    await entrar(page, process.env.SEED_ADMIN_EMAIL!, process.env.SEED_ADMIN_PASSWORD!);
    await semRolagemHorizontal(page, PAGINAS.admin);
  });

  test("portal do cliente", async ({ page }) => {
    await entrar(page, DEMO.users.clienteA.email, process.env.SEED_DEMO_PASSWORD!);
    await semRolagemHorizontal(page, PAGINAS.cliente);
  });

  test("técnico", async ({ page }) => {
    await entrar(page, DEMO.users.tecnico.email, process.env.SEED_DEMO_PASSWORD!);
    await semRolagemHorizontal(page, PAGINAS.tecnico);
    // detalhe do primeiro chamado da lista
    const primeiro = page.locator('a[href^="/tecnico/chamados/"]').first();
    if (await primeiro.count()) {
      await primeiro.click();
      await page.waitForLoadState("networkidle");
      const { scroll, largura } = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        largura: window.innerWidth,
      }));
      expect(scroll, "rolagem horizontal no detalhe do chamado").toBeLessThanOrEqual(largura);
    }
  });
});
