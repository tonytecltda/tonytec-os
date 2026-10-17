import { expect, test, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { DEMO } from "../scripts/demo-data";

/**
 * Checkpoint da Fase 2: cliente abre chamado (com foto) → admin atribui ao técnico
 * e agenda → técnico vê na lista e atualiza o status → cliente acompanha sem ver
 * notas internas → Kanban move o chamado (e bloqueia "Resolvido" sem OS assinada).
 * Ao final, o chamado de teste é desativado (exclusão física é proibida pelo banco)
 * e os arquivos enviados são apagados do Storage.
 */

const sufixo = Date.now().toString(36).toUpperCase();
const TITULO = `[E2E] Câmera sem imagem ${sufixo}`;
const SENHA_DEMO = process.env.SEED_DEMO_PASSWORD!;
// 1x1 PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

async function entrar(
  browser: Browser,
  email: string,
  senha: string,
  viewport?: { width: number; height: number },
) {
  const ctx = await browser.newContext(viewport ? { viewport } : {});
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/(admin|tecnico|portal)/);
  return { ctx, page };
}

/** Amanhã às 10:00 (horário de Brasília) no formato do input datetime-local. */
function amanha10h() {
  const d = new Date(Date.now() + 86_400_000);
  const dia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
  return `${dia}T10:00`;
}

async function arrastar(
  page: Page,
  origem: ReturnType<Page["locator"]>,
  destino: ReturnType<Page["locator"]>,
) {
  const a = (await origem.boundingBox())!;
  const b = (await destino.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + 16);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 12, a.y + 24, { steps: 4 });
  await page.mouse.move(b.x + b.width / 2, b.y + 70, { steps: 20 });
  await page.mouse.up();
}

test.describe("Fase 2 — chamados", () => {
  test.skip(({ isMobile }) => isMobile, "fluxo completo roda só no desktop");
  test.skip(!process.env.SEED_ADMIN_PASSWORD || !SENHA_DEMO, "senhas de seed não definidas");

  let chamadoId: string | undefined;

  test.afterAll(async () => {
    if (!chamadoId) return;
    const sa = admin();
    const { data: anexos } = await sa
      .from("chamado_anexos")
      .select("id, storage_path")
      .eq("chamado_id", chamadoId);
    if (anexos?.length) {
      await sa.storage.from("chamado-anexos").remove(anexos.map((a) => a.storage_path));
      await sa.from("chamado_anexos").delete().eq("chamado_id", chamadoId);
    }
    await sa.from("chamados").update({ ativo: false }).eq("id", chamadoId);
  });

  test("cliente abre → admin atribui e agenda → técnico atende → Kanban", async ({ browser }) => {
    test.setTimeout(180_000);

    // 1) Cliente abre o chamado com uma foto
    const cliente = await entrar(browser, DEMO.users.clienteA.email, SENHA_DEMO);
    const p = cliente.page;
    await p.goto("/portal/chamados/novo");
    await p.getByLabel("Categoria").click();
    await p.getByRole("option", { name: "Câmeras/CFTV" }).click();
    await p.getByLabel("Tipo de problema").click();
    await p.getByRole("option", { name: "Câmera sem imagem" }).click();
    await p.getByLabel("Título").fill(TITULO);
    await p
      .getByLabel("Descrição")
      .fill("A câmera do estacionamento parou ontem à noite. Teste automatizado.");
    await p.getByLabel("Prioridade").click();
    await p.getByRole("option", { name: /Alta/ }).click();
    await p.locator('input[type="file"][aria-label="Selecionar arquivos"]').setInputFiles({
      name: "foto-teste.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    await expect(p.getByText("foto-teste.png")).toBeVisible();
    await p.getByRole("button", { name: "Abrir chamado" }).click();
    await expect(p).toHaveURL(/\/portal\/chamados\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    chamadoId = p.url().split("/").pop()!;
    await expect(p.getByRole("heading", { name: TITULO })).toBeVisible();
    await expect(p.getByText(/Protocolo CH-\d{4}-\d{6}/)).toBeVisible();
    await expect(p.getByAltText("foto-teste.png")).toBeVisible();
    await p.getByLabel("Mensagem").fill("Mensagem do cliente E2E");
    await p.getByRole("button", { name: "Enviar" }).click();
    await expect(p.getByText("Mensagem do cliente E2E")).toBeVisible();

    // 2) Admin atribui ao técnico e agenda; registra nota interna e resposta pública
    const adm = await entrar(browser, process.env.SEED_ADMIN_EMAIL!, process.env.SEED_ADMIN_PASSWORD!);
    const a = adm.page;
    await a.goto(`/admin/chamados/${chamadoId}`);
    await expect(a.getByRole("heading", { name: TITULO })).toBeVisible();
    await a.getByLabel("Técnico responsável").click();
    await a.getByRole("option", { name: DEMO.users.tecnico.nome }).click();
    await a.getByLabel("Visita agendada para").fill(amanha10h());
    await a.getByRole("button", { name: "Salvar" }).click();
    await expect(a.getByText(/Status alterado para “Agendado”/)).toBeVisible();
    await expect(a.getByText(`Técnico responsável: ${DEMO.users.tecnico.nome}`)).toBeVisible();

    await a.getByRole("switch", { name: "Nota interna" }).click();
    await a.getByLabel("Mensagem").fill("Nota interna E2E: levar câmera reserva");
    await a.getByRole("button", { name: "Registrar nota" }).click();
    await expect(a.getByText("Nota interna registrada.")).toBeVisible();
    await expect(a.getByText("Nota interna E2E: levar câmera reserva")).toBeVisible();
    await a.getByRole("switch", { name: "Nota interna" }).click();
    await a.getByLabel("Mensagem").fill("Resposta pública E2E: visita agendada");
    await a.getByRole("button", { name: "Enviar" }).click();
    await expect(a.getByText("Mensagem enviada.")).toBeVisible();
    await expect(a.getByText("Resposta pública E2E: visita agendada")).toBeVisible();

    // 3) Técnico vê o chamado na lista, abre e muda o status
    const tec = await entrar(browser, DEMO.users.tecnico.email, SENHA_DEMO);
    const t = tec.page;
    await expect(t.getByText(TITULO)).toBeVisible();
    await t.getByText(TITULO).click();
    await expect(t).toHaveURL(new RegExp(`/tecnico/chamados/${chamadoId}$`));
    await expect(t.getByText("Nota interna E2E: levar câmera reserva")).toBeVisible();
    await expect(t.getByText("Mensagem do cliente E2E")).toBeVisible();
    await expect(t.getByAltText("foto-teste.png")).toBeVisible();
    await t.getByRole("button", { name: "Em atendimento" }).click();
    await expect(t.getByText("Status: Em atendimento.")).toBeVisible();

    // 4) Cliente vê a resposta e o técnico, mas nunca a nota interna
    await p.reload();
    await expect(p.getByText("Resposta pública E2E: visita agendada")).toBeVisible();
    await expect(p.getByText("Nota interna E2E")).toHaveCount(0);
    await expect(p.getByText(`Técnico: ${DEMO.users.tecnico.nome}`)).toBeVisible();
    await expect(p.getByText(/Visita em \d{2}\/\d{2}\/\d{4}/)).toBeVisible();

    // 5) Kanban: mover para "Aguardando peça"; "Resolvido" sem OS assinada é recusado
    const kb = await entrar(browser, process.env.SEED_ADMIN_EMAIL!, process.env.SEED_ADMIN_PASSWORD!, {
      width: 2600,
      height: 1100,
    });
    const k = kb.page;
    await k.goto("/admin/chamados");
    const card = () => k.locator('[aria-roledescription="Chamado arrastável"]', { hasText: TITULO });
    const coluna = (nome: string) => k.getByRole("region", { name: nome, exact: true });
    await expect(
      coluna("Em atendimento").locator('[aria-roledescription="Chamado arrastável"]', { hasText: TITULO }),
    ).toBeVisible();

    await arrastar(k, card(), coluna("Aguardando peça"));
    await expect(k.getByText(/: Aguardando peça$/)).toBeVisible();
    await expect(coluna("Aguardando peça").getByText(TITULO)).toBeVisible();

    await arrastar(k, card(), coluna("Resolvido"));
    await expect(k.getByText(/só pode ser resolvido com OS assinada/)).toBeVisible();
    await expect(coluna("Aguardando peça").getByText(TITULO)).toBeVisible();

    // Confirma no banco: SLA de resposta cumprido e histórico registrado
    const sa = admin();
    const { data: final } = await sa
      .from("chamados")
      .select("status, tecnico_id, primeira_resposta_em, sla_resposta_ate, data_agendada")
      .eq("id", chamadoId)
      .single();
    expect(final?.status).toBe("aguardando_peca");
    expect(final?.primeira_resposta_em).toBeTruthy();
    expect(final?.data_agendada).toBeTruthy();
    const { count } = await sa
      .from("chamado_historico")
      .select("id", { count: "exact", head: true })
      .eq("chamado_id", chamadoId);
    expect(count).toBeGreaterThanOrEqual(5);

    await Promise.all([cliente.ctx.close(), adm.ctx.close(), tec.ctx.close(), kb.ctx.close()]);
  });
});
