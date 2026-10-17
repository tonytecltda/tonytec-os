import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Checkpoint da Fase 1: cadastro completo de um cliente com unidade, usuário
 * do portal e contrato — e o usuário do portal ativando o acesso pelo link.
 * Cria dados com o prefixo [E2E] e remove tudo no final.
 */

const sufixo = Date.now().toString(36).toUpperCase();
const NOME = `Cliente E2E ${sufixo}`;
const RAZAO = `[E2E] Cliente Teste ${sufixo} Ltda`;
const EMAIL_PORTAL = `portal.e2e.${sufixo.toLowerCase()}@example.com`;
const SENHA_PORTAL = `E2e#${sufixo}x9`;
const NUMERO_CONTRATO = `E2E-${sufixo}`;

/** CNPJ alfanumérico válido aleatório (exercita a regra nova da Receita). */
function gerarCnpjAlfanumerico() {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const base = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  const valores = base.split("").map((c) => c.charCodeAt(0) - 48);
  const dv = (vals: number[], pesos: number[]) => {
    const r = pesos.reduce((acc, p, i) => acc + vals[i] * p, 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(valores, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = dv([...valores, d1], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${base}${d1}${d2}`;
}

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

async function loginAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(process.env.SEED_ADMIN_EMAIL!);
  await page.getByLabel("Senha", { exact: true }).fill(process.env.SEED_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe("Fase 1 — cadastro completo", () => {
  test.skip(({ isMobile }) => isMobile, "fluxo de cadastro roda só no desktop (evita dados duplicados)");
  test.skip(!process.env.SEED_ADMIN_PASSWORD, "SEED_ADMIN_PASSWORD não definido");

  let clienteId: string | undefined;

  test.afterAll(async () => {
    if (!clienteId) return;
    const sa = admin();
    const { data: perfis } = await sa.from("profiles").select("id").eq("cliente_id", clienteId);
    for (const p of perfis ?? []) await sa.auth.admin.deleteUser(p.id);
    await sa.from("contratos").delete().eq("cliente_id", clienteId);
    await sa.from("unidades").delete().eq("cliente_id", clienteId);
    await sa.from("clientes").delete().eq("id", clienteId);
  });

  test("cliente + unidade + usuário do portal + contrato, e o cliente acessa o portal", async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    await loginAdmin(page);

    // 1) Cliente
    await page.goto("/admin/clientes/novo");
    await page.getByLabel("Razão social / nome").fill(RAZAO);
    await page.getByLabel("Nome fantasia").fill(NOME);
    await page.getByLabel("CPF / CNPJ").fill(gerarCnpjAlfanumerico());
    await page.getByLabel("Telefone").fill("11930001234");
    await page.getByRole("button", { name: "Cadastrar cliente" }).click();
    await expect(page).toHaveURL(/\/admin\/clientes\/[0-9a-f-]{36}\?aba=unidades/);
    clienteId = page.url().match(/clientes\/([0-9a-f-]{36})/)![1];
    await expect(page.getByRole("heading", { name: NOME })).toBeVisible();

    // 2) Unidade (CEP preenche o endereço pelo ViaCEP quando há internet)
    await page.getByRole("button", { name: "Nova unidade" }).first().click();
    const dialogo = page.getByRole("dialog");
    await dialogo.getByLabel("Nome da unidade").fill("Matriz E2E");
    await dialogo.getByLabel("CEP").fill("01310100");
    await dialogo.getByLabel("Número").fill("1000");
    const logradouro = dialogo.getByLabel("Logradouro");
    await expect(logradouro)
      .not.toHaveValue("", { timeout: 5000 })
      .catch(async () => {
        await logradouro.fill("Avenida Paulista");
        await dialogo.getByLabel("Cidade").fill("São Paulo");
      });
    await dialogo.getByRole("button", { name: "Salvar unidade" }).click();
    await expect(dialogo).toBeHidden();
    await expect(page.getByText("Matriz E2E")).toBeVisible();

    // 3) Usuário do portal -> link de acesso
    await page.getByRole("link", { name: /Usuários do portal/ }).click();
    await page.getByRole("button", { name: "Novo usuário" }).first().click();
    const dlgUsuario = page.getByRole("dialog");
    await dlgUsuario.getByLabel("Nome").fill("Síndico E2E");
    await dlgUsuario.getByLabel("E-mail (login)").fill(EMAIL_PORTAL);
    await dlgUsuario.getByLabel("Celular / WhatsApp").fill("11988887777");
    await dlgUsuario.getByRole("button", { name: "Criar usuário" }).click();
    const campoLink = page.getByRole("textbox", { name: "Link de acesso" });
    await expect(campoLink).toBeVisible();
    const link = await campoLink.inputValue();
    expect(link).toContain("/acesso?token=");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("cell", { name: EMAIL_PORTAL })).toBeVisible();

    // 4) Contrato
    await page.locator('a[href$="?aba=contratos"]').click();
    await page.getByRole("link", { name: "Novo contrato" }).first().click();
    await expect(page).toHaveURL(/\/admin\/contratos\/novo\?cliente=/);
    await expect(page.getByRole("combobox", { name: "Cliente" })).toContainText(NOME);
    await page.getByLabel("Número").fill(NUMERO_CONTRATO);
    await page.getByLabel("Descrição").fill("Manutenção mensal E2E");
    await page.getByLabel("Valor mensal").fill("500");
    await page.getByLabel("Visitas inclusas por mês").fill("2");
    await page.getByLabel("Horas inclusas por mês").fill("4");
    await page.getByLabel("Política de visita excedente").click();
    await page.getByRole("option", { name: "Valor por hora" }).click();
    await page.getByLabel("Valor da hora excedente").fill("120");
    await page.getByRole("button", { name: "Cadastrar contrato" }).click();
    await expect(page).toHaveURL(/\/admin\/contratos\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: `Contrato ${NUMERO_CONTRATO}` })).toBeVisible();

    // 5) O usuário do portal ativa o acesso pelo link (sem sessão do admin)
    const ctx = await browser.newContext();
    const portal = await ctx.newPage();
    await portal.goto(link);
    await expect(portal.getByRole("button", { name: "Continuar" })).toBeVisible();
    await portal.getByRole("button", { name: "Continuar" }).click();
    await expect(portal).toHaveURL(/\/definir-senha/);
    await portal.getByLabel("Nova senha").fill(SENHA_PORTAL);
    await portal.getByLabel("Confirmar senha").fill(SENHA_PORTAL);
    await portal.getByRole("button", { name: "Salvar senha" }).click();
    await expect(portal).toHaveURL(/\/portal$/);
    await expect(portal.getByRole("heading", { name: NOME })).toBeVisible();

    // 6) Portal mostra o contrato vigente (somente leitura)
    await portal.goto("/portal/contrato");
    await expect(portal.getByRole("heading", { name: `Contrato ${NUMERO_CONTRATO}` })).toBeVisible();
    await expect(portal.getByText(/R\$\s500,00/)).toBeVisible();
    await expect(portal.getByText(/R\$\s120,00 por hora/)).toBeVisible();

    // 7) O link é de uso único
    const ctx2 = await browser.newContext();
    const reuso = await ctx2.newPage();
    await reuso.goto(link);
    await reuso.getByRole("button", { name: "Continuar" }).click();
    await expect(reuso.getByText(/inválido, já foi usado ou expirou/)).toBeVisible();

    await ctx.close();
    await ctx2.close();
  });
});
