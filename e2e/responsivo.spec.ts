import { expect, test } from "@playwright/test";

/** Telas principais não podem ter rolagem horizontal da página em 375 px. */
const PAGINAS_ADMIN = [
  "/admin",
  "/admin/clientes",
  "/admin/contratos",
  "/admin/tecnicos",
  "/admin/catalogos",
  "/admin/catalogos?aba=itens",
  "/admin/configuracoes",
  "/admin/configuracoes?aba=sla",
];

test("admin: sem rolagem horizontal em 375 px", async ({ page, isMobile }) => {
  test.skip(!isMobile, "só no projeto mobile");
  test.skip(!process.env.SEED_ADMIN_PASSWORD, "SEED_ADMIN_PASSWORD não definido");
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(process.env.SEED_ADMIN_EMAIL!);
  await page.getByLabel("Senha", { exact: true }).fill(process.env.SEED_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  for (const url of PAGINAS_ADMIN) {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    const { scroll, largura } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      largura: window.innerWidth,
    }));
    expect(scroll, `rolagem horizontal em ${url}`).toBeLessThanOrEqual(largura);
  }
});
