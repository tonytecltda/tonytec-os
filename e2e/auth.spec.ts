import { expect, test, type Page } from "@playwright/test";
import { DEMO } from "../scripts/demo-data";

/**
 * Checkpoint da Fase 0: cada perfil faz login e cai no layout certo,
 * e não consegue entrar na área dos outros.
 * Requer: npm run build, seed:admin e seed:demo.
 */
const demoPassword = process.env.SEED_DEMO_PASSWORD!;

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

test("sem login, área protegida redireciona para /login", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin/);
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
});

test("senha errada mostra erro", async ({ page }) => {
  await login(page, DEMO.users.clienteA.email, "senha-errada-123");
  await expect(page.getByRole("alert").filter({ hasText: "E-mail ou senha incorretos" })).toBeVisible();
});

test("admin cai no /admin", async ({ page }) => {
  test.skip(!process.env.SEED_ADMIN_PASSWORD, "SEED_ADMIN_PASSWORD não definido");
  await login(page, process.env.SEED_ADMIN_EMAIL!, process.env.SEED_ADMIN_PASSWORD!);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: /Olá,/ })).toBeVisible();
});

test("técnico cai no /tecnico, vê o chamado atribuído e não acessa /admin", async ({ page }) => {
  await login(page, DEMO.users.tecnico.email, demoPassword);
  await expect(page).toHaveURL(/\/tecnico$/);
  await expect(page.getByRole("heading", { name: "Meu dia" })).toBeVisible();
  await expect(page.getByText("[DEMO] Câmera da garagem sem imagem")).toBeVisible();
  await expect(page.getByText("[DEMO] Portão da recepção travando")).toHaveCount(0);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/tecnico$/);
});

test("cliente cai no /portal com o próprio cliente e não acessa /admin nem /tecnico", async ({ page }) => {
  await login(page, DEMO.users.clienteA.email, demoPassword);
  await expect(page).toHaveURL(/\/portal$/);
  await expect(page.getByRole("heading", { name: "Residencial Alfa" })).toBeVisible();

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/portal$/);
  await page.goto("/tecnico");
  await expect(page).toHaveURL(/\/portal$/);
});

test("logout volta para o login", async ({ page, isMobile }) => {
  await login(page, DEMO.users.clienteB.email, demoPassword);
  await expect(page).toHaveURL(/\/portal$/);
  await expect(page.getByRole("heading", { name: "Clínica Beta" })).toBeVisible();
  await page.getByRole("button", { name: "Menu do usuário" }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login/);
  test.info().annotations.push({ type: "viewport", description: isMobile ? "mobile" : "desktop" });
});
