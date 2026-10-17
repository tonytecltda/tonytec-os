import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { DEMO } from "../scripts/demo-data";

/**
 * Checkpoint da Fase 6: sino de notificações, tela de auditoria, cabeçalhos de segurança
 * e bloqueio de tentativas de login.
 */
const SENHA = process.env.SEED_DEMO_PASSWORD!;
const sufixo = Date.now().toString(36).toUpperCase();

const servico = () =>
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

test.describe("Fase 6 — notificações, auditoria e segurança", () => {
  test.skip(!process.env.SEED_ADMIN_PASSWORD || !SENHA, "senhas de seed não definidas");

  const chamados: string[] = [];
  test.afterAll(async () => {
    const sa = servico();
    for (const id of chamados) await sa.from("chamados").update({ ativo: false }).eq("id", id);
    await sa.from("notificacoes").delete().ilike("mensagem", `%[E2E-F6 ${sufixo}]%`);
  });

  test("o sino avisa do chamado novo, abre o chamado e marca como lido", async ({ page }) => {
    const sa = servico();
    const { data: cliente } = await sa
      .from("clientes")
      .select("id")
      .eq("cnpj_cpf", DEMO.clienteA.cnpj_cpf)
      .single();
    const { data: chamado, error } = await sa
      .from("chamados")
      .insert({
        cliente_id: cliente!.id,
        titulo: `[E2E-F6 ${sufixo}] Portão não fecha`,
        origem: "telefone",
        prioridade: "alta",
      })
      .select("id, protocolo")
      .single();
    expect(error).toBeNull();
    chamados.push(chamado!.id);

    await entrar(page, process.env.SEED_ADMIN_EMAIL!, process.env.SEED_ADMIN_PASSWORD!);
    const contador = page.getByTestId("sino-contador");
    await expect(contador).toBeVisible();
    const antes = Number(await contador.innerText());
    expect(antes).toBeGreaterThanOrEqual(1);

    await page.getByRole("button", { name: /^Notificações/ }).click();
    const painel = page.getByRole("dialog");
    const item = painel.getByRole("button", { name: new RegExp(chamado!.protocolo) });
    await expect(item).toBeVisible();
    await expect(item).toContainText("Portão não fecha");
    const caixa = (await painel.boundingBox())!;
    const largura = page.viewportSize()!.width;
    expect(caixa.x).toBeGreaterThanOrEqual(0);
    expect(caixa.x + caixa.width).toBeLessThanOrEqual(largura);

    await item.click();
    await expect(page).toHaveURL(new RegExp(`/admin/chamados/${chamado!.id}`));
    await expect(page.getByText(`[E2E-F6 ${sufixo}] Portão não fecha`).first()).toBeVisible();
    // contador diminui em 1 (ou some, se era a única)
    if (antes > 1) await expect(page.getByTestId("sino-contador")).toHaveText(String(antes - 1));
    else await expect(page.getByTestId("sino-contador")).toHaveCount(0);

    const { data: eu } = await sa
      .from("profiles")
      .select("id")
      .eq("email", process.env.SEED_ADMIN_EMAIL!)
      .single();
    await expect
      .poll(async () => {
        const { data } = await sa
          .from("notificacoes")
          .select("lida")
          .eq("profile_id", eu!.id)
          .ilike("titulo", `%${chamado!.protocolo}%`)
          .single();
        return data?.lida;
      })
      .toBe(true);

    // "Marcar todas como lidas" zera o contador
    await page.getByRole("button", { name: /^Notificações/ }).click();
    const todas = page.getByRole("button", { name: /Marcar todas como lidas/ });
    if (await todas.isEnabled()) {
      await todas.click();
      await expect(page.getByTestId("sino-contador")).toHaveCount(0);
    }
  });

  test("o cliente é avisado da resposta da equipe e abre o chamado no portal", async ({ page, isMobile }) => {
    test.skip(isMobile, "fluxo completo roda só no desktop");
    const sa = servico();
    const { data: cliente } = await sa
      .from("clientes")
      .select("id")
      .eq("cnpj_cpf", DEMO.clienteA.cnpj_cpf)
      .single();
    const { data: admin } = await sa
      .from("profiles")
      .select("id")
      .eq("email", process.env.SEED_ADMIN_EMAIL!)
      .single();
    const { data: chamado } = await sa
      .from("chamados")
      .insert({
        cliente_id: cliente!.id,
        titulo: `[E2E-F6 ${sufixo}] Interfone mudo`,
        origem: "telefone",
      })
      .select("id, protocolo")
      .single();
    chamados.push(chamado!.id);
    await sa.from("chamado_comentarios").insert({
      chamado_id: chamado!.id,
      autor_id: admin!.id,
      mensagem: `Visita marcada [E2E-F6 ${sufixo}]`,
    });

    await entrar(page, DEMO.users.clienteA.email, SENHA);
    await page.getByRole("button", { name: /^Notificações/ }).click();
    const item = page.getByRole("dialog").getByRole("button", { name: new RegExp(chamado!.protocolo) });
    await expect(item).toContainText("Visita marcada");
    await item.click();
    await expect(page).toHaveURL(new RegExp(`/portal/chamados/${chamado!.id}`));
  });

  test("a auditoria mostra alterações com autor e permite filtrar", async ({ page, isMobile }) => {
    test.skip(isMobile, "fluxo completo roda só no desktop");
    const sa = servico();
    const marca = `E2E-F6 ${sufixo}`;
    const { data: cliente } = await sa
      .from("clientes")
      .select("id")
      .eq("cnpj_cpf", DEMO.clienteA.cnpj_cpf)
      .single();

    // alteração feita pelo admin logado (autor preenchido pelo banco)
    const adm = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
    await adm.auth.signInWithPassword({
      email: process.env.SEED_ADMIN_EMAIL!,
      password: process.env.SEED_ADMIN_PASSWORD!,
    });
    await adm
      .from("clientes")
      .update({ observacoes: `${marca} auditada` })
      .eq("id", cliente!.id);
    await sa.from("clientes").update({ observacoes: null }).eq("id", cliente!.id);

    await entrar(page, process.env.SEED_ADMIN_EMAIL!, process.env.SEED_ADMIN_PASSWORD!);
    await page.getByRole("link", { name: "Auditoria" }).first().click();
    await expect(page.getByRole("heading", { name: "Auditoria" })).toBeVisible();

    await page.goto("/admin/auditoria?tabela=clientes&acao=update");
    const linha = page
      .getByRole("row")
      .filter({ hasText: "Alteração" })
      .filter({ hasText: "Residencial Alfa" });
    await expect(linha.first()).toBeVisible();
    const { data: eu } = await sa
      .from("profiles")
      .select("nome")
      .eq("email", process.env.SEED_ADMIN_EMAIL!)
      .single();
    await expect(linha.filter({ hasText: eu!.nome }).first()).toBeVisible();
    // detalhe: campo alterado, valor novo e valor antigo
    const registro = page
      .getByRole("row")
      .filter({ has: page.locator("details") })
      .first();
    await registro.locator("summary").click();
    await expect(registro).toContainText("observacoes");

    // filtros: outra área não traz esse registro; "Sistema" traz o desfazer feito pelo servidor
    await page.goto("/admin/auditoria?tabela=chamados&acao=delete");
    await expect(page.getByText("Nenhum registro encontrado")).toBeVisible();
    await page.goto("/admin/auditoria?tabela=clientes&autor=sistema");
    await expect(page.getByRole("row").filter({ hasText: "Sistema / link público" }).first()).toBeVisible();
  });

  test("técnico e cliente não acessam a auditoria", async ({ page, isMobile }) => {
    test.skip(isMobile, "fluxo completo roda só no desktop");
    await entrar(page, DEMO.users.tecnico.email, SENHA);
    await page.goto("/admin/auditoria");
    await expect(page).not.toHaveURL(/\/admin/);
  });

  test("cabeçalhos de segurança estão presentes", async ({ request }) => {
    const login = await request.get("/login");
    const h = login.headers();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["content-security-policy"]).toContain("object-src 'none'");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["strict-transport-security"]).toContain("max-age=");
    expect(h["x-robots-tag"]).toContain("noindex");

    const assinar = await request.get("/assinar/token-que-nao-existe-token-que-nao-existe-00");
    expect(assinar.headers()["referrer-policy"]).toBe("no-referrer");
    expect(assinar.headers()["cache-control"]).toContain("no-store");
  });

  test("muitas senhas erradas bloqueiam novas tentativas do mesmo e-mail", async ({ page, isMobile }) => {
    test.skip(isMobile, "fluxo completo roda só no desktop");
    test.setTimeout(120_000);
    const email = `forca-bruta-${sufixo.toLowerCase()}@example.com`;
    await page.goto("/login");
    let bloqueadoNaTentativa = 0;
    for (let i = 1; i <= 17 && !bloqueadoNaTentativa; i++) {
      await page.getByLabel("E-mail").fill(email);
      await page.getByLabel("Senha", { exact: true }).fill(`errada-${i}`);
      const resposta = page.waitForResponse(
        (r) => r.request().method() === "POST" && r.url().includes("/login"),
      );
      await page.getByRole("button", { name: "Entrar" }).click();
      await resposta;
      if (await page.getByText(/Muitas tentativas/).isVisible()) bloqueadoNaTentativa = i;
      else await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
    }
    // O limite é de 8 falhas por 10 min (a janela é fixa: na virada de janela pode levar mais algumas).
    expect(bloqueadoNaTentativa).toBeGreaterThanOrEqual(9);
    expect(bloqueadoNaTentativa).toBeLessThanOrEqual(17);
  });
});
