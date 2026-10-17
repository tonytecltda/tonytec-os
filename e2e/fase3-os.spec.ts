import { writeFileSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { DEMO } from "../scripts/demo-data";

/**
 * Checkpoint da Fase 3: atendimento completo no celular com PDF assinado.
 *  1) [mobile] técnico inicia → preenche OS (item + foto) → conclui → técnico e cliente
 *     assinam na tela → PDF gerado, hash gravado, OS bloqueada, chamado resolvido →
 *     cliente vê a OS no portal e avalia o atendimento.
 *  2) [desktop] assinatura remota por link (sem login), link de uso único, e o admin reabre a OS.
 * Os registros de teste são arquivados (ativo = false) e os arquivos apagados do Storage.
 */

const SENHA = process.env.SEED_DEMO_PASSWORD!;
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

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

/** Desenha um rabisco no quadro de assinatura. */
async function assinar(page: Page, quadro: Locator) {
  await quadro.scrollIntoViewIfNeeded();
  const b = (await quadro.boundingBox())!;
  const y = b.y + b.height / 2;
  await page.mouse.move(b.x + 20, y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++)
    await page.mouse.move(b.x + 20 + i * 18, y + (i % 2 ? -25 : 25), { steps: 3 });
  await page.mouse.up();
}

/**
 * Assinatura do técnico: desenha no quadro, a menos que a tela ofereça a assinatura
 * salva (o outro cenário pode tê-la salvo antes, rodando em paralelo).
 */
async function assinarComoTecnico(page: Page) {
  const quadro = page.getByRole("img", { name: "Assinatura do técnico" });
  const salva = page.getByRole("img", { name: "Sua assinatura salva" });
  await expect(quadro.or(salva)).toBeVisible();
  if (await quadro.isVisible()) await assinar(page, quadro);
}

async function criarChamado(titulo: string) {
  const sa = admin();
  const { data: cliente } = await sa
    .from("clientes")
    .select("id")
    .eq("cnpj_cpf", DEMO.clienteA.cnpj_cpf)
    .single();
  const { data: unidade } = await sa
    .from("unidades")
    .select("id")
    .eq("cliente_id", cliente!.id)
    .eq("ativo", true)
    .limit(1)
    .single();
  const { data: tecnico } = await sa
    .from("profiles")
    .select("id")
    .eq("email", DEMO.users.tecnico.email)
    .single();
  const { data, error } = await sa
    .from("chamados")
    .insert({
      titulo,
      cliente_id: cliente!.id,
      unidade_id: unidade!.id,
      tecnico_id: tecnico!.id,
      descricao: "Chamado de teste automatizado da Fase 3.",
      prioridade: "alta",
      origem: "telefone",
      status: "agendado",
      data_agendada: new Date(Date.now() + 3_600_000).toISOString(),
    })
    .select("id, cliente_id")
    .single();
  if (error) throw error;
  return data;
}

/** Arquiva chamado/OS de teste e apaga os arquivos que eles geraram. */
async function limpar(chamadoId: string) {
  const sa = admin();
  const { data: ordens } = await sa
    .from("ordens_servico")
    .select("id, cliente_id")
    .eq("chamado_id", chamadoId);
  for (const o of ordens ?? []) {
    for (const [bucket, pasta] of [
      ["os-anexos", `${o.cliente_id}/${o.id}`],
      ["os-pdfs", `${o.cliente_id}/${o.id}`],
      ["assinaturas", `os/${o.id}`],
    ] as const) {
      const { data: arquivos } = await sa.storage.from(bucket).list(pasta);
      if (arquivos?.length) await sa.storage.from(bucket).remove(arquivos.map((a) => `${pasta}/${a.name}`));
    }
    await sa.from("ordens_servico").update({ ativo: false }).eq("id", o.id);
  }
  await sa.from("chamados").update({ ativo: false }).eq("id", chamadoId);
}

test.describe("Fase 3 — OS e assinatura", () => {
  test.skip(!SENHA || !process.env.SEED_ADMIN_PASSWORD, "senhas de seed não definidas");
  const criados: string[] = [];

  test.afterAll(async () => {
    for (const id of criados) await limpar(id);
    // Volta o técnico demo ao estado inicial (sem assinatura padrão salva).
    const sa = admin();
    const { data: tecnico } = await sa
      .from("profiles")
      .select("id")
      .eq("email", DEMO.users.tecnico.email)
      .single();
    await sa.storage.from("assinaturas").remove([`perfis/${tecnico!.id}.png`]);
    await sa.from("profiles").update({ assinatura_path: null }).eq("id", tecnico!.id);
  });

  test("no celular: atendimento completo com assinatura na tela e PDF", async ({
    page,
    browser,
    isMobile,
  }) => {
    test.skip(!isMobile, "cenário do celular roda no projeto mobile (375 px)");
    test.setTimeout(180_000);
    const sufixo = Date.now().toString(36).toUpperCase();
    const chamado = await criarChamado(`[E2E] OS no local ${sufixo}`);
    criados.push(chamado.id);

    // 1) Técnico inicia o atendimento a partir do chamado
    await entrar(page, DEMO.users.tecnico.email, SENHA);
    await page.goto(`/tecnico/chamados/${chamado.id}`);
    await page.getByRole("button", { name: "Iniciar atendimento" }).click();
    await expect(page).toHaveURL(/\/tecnico\/os\/[0-9a-f-]{36}$/);
    const osId = page.url().split("/").pop()!;
    await expect(page.getByText(/Em atendimento desde/)).toBeVisible();

    // 2) Preenche a OS (salvamento automático), item e foto
    await page.getByLabel("Diagnóstico").fill("Fonte de alimentação queimada.");
    await page.getByLabel("Serviço executado").fill("Troca da fonte 12V e teste das câmeras.");
    await page.getByRole("button", { name: "Item avulso" }).click();
    await page.getByLabel("Descrição").fill("Fonte 12V 5A");
    await page.getByLabel("Valor unit.").fill("45");
    await expect(page.getByRole("status").filter({ hasText: /Salvo/ })).toBeVisible({ timeout: 15_000 });
    await page.locator('input[type="file"][aria-label="Tirar foto"]').setInputFiles({
      name: "antes.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    await expect(page.getByRole("img", { name: "Antes" })).toBeVisible({ timeout: 20_000 });

    // 3) Conclui e coleta as assinaturas na tela
    await page.getByRole("button", { name: "Concluir e assinar" }).click();
    await expect(page).toHaveURL(new RegExp(`/tecnico/os/${osId}/assinatura$`), { timeout: 20_000 });
    await assinarComoTecnico(page);
    await page.getByLabel("Nome de quem assina").fill("Síndico E2E");
    await assinar(page, page.getByRole("img", { name: "Assinatura do cliente" }));
    await page.getByRole("checkbox", { name: /Li e concordo/ }).click();
    await page.getByRole("button", { name: "Assinar e encerrar a OS" }).click();
    await expect(page.getByText("OS assinada e encerrada")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("link", { name: "Baixar PDF" })).toBeVisible();

    // 4) PDF disponível para download (pela rota autenticada)
    const resp = await page.request.get(`/api/os/${osId}/pdf`);
    expect(resp.ok()).toBeTruthy();
    const pdf = await resp.body();
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(5_000);
    // Para inspeção manual: E2E_SALVAR_PDF=1 grava o PDF em test-results/.
    if (process.env.E2E_SALVAR_PDF) writeFileSync("test-results/os-e2e.pdf", pdf);

    // 5) Banco: hash, assinaturas, bloqueio e chamado resolvido
    const sa = admin();
    const { data: os } = await sa
      .from("ordens_servico")
      .select("status, finalizada_em, assinada_em, hash_conteudo, pdf_path")
      .eq("id", osId)
      .single();
    expect(os?.status).toBe("assinada");
    expect(os?.hash_conteudo).toMatch(/^[0-9a-f]{64}$/);
    expect(os?.pdf_path).toBeTruthy();
    const { data: ass } = await sa
      .from("os_assinaturas")
      .select("tipo, hash_documento")
      .eq("os_id", osId)
      .is("invalidada_em", null);
    expect(ass?.map((a) => a.tipo).sort()).toEqual(["cliente", "tecnico"]);
    expect(ass?.every((a) => a.hash_documento === os?.hash_conteudo)).toBeTruthy();
    const { data: ch } = await sa.from("chamados").select("status").eq("id", chamado.id).single();
    expect(ch?.status).toBe("resolvido");
    // A visita foi fechada ao concluir (saída e horas gravadas)
    const { data: visitas } = await sa
      .from("os_visitas")
      .select("data_hora_saida, horas_trabalhadas")
      .eq("os_id", osId);
    expect(visitas).toHaveLength(1);
    expect(visitas![0].data_hora_saida).not.toBeNull();
    expect(visitas![0].horas_trabalhadas).not.toBeNull();

    const tec = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
    await tec.auth.signInWithPassword({ email: DEMO.users.tecnico.email, password: SENHA });
    const { error: travada } = await tec
      .from("ordens_servico")
      .update({ diagnostico: "alterado" })
      .eq("id", osId)
      .select();
    const { data: depois } = await sa.from("ordens_servico").select("diagnostico").eq("id", osId).single();
    expect(depois?.diagnostico).toBe("Fonte de alimentação queimada."); // OS assinada não muda
    expect(travada === null || !!travada).toBeTruthy();

    // 6) Cliente vê a OS no portal e avalia o atendimento
    const ctx = await browser.newContext({
      viewport: { width: 375, height: 740 },
      isMobile: true,
      hasTouch: true,
    });
    const cli = await ctx.newPage();
    await entrar(cli, DEMO.users.clienteA.email, SENHA);
    await cli.goto("/portal/os");
    await expect(cli.getByRole("link", { name: /OS-\d{4}-\d{6}/ }).first()).toBeVisible();
    await cli.goto(`/portal/chamados/${chamado.id}`);
    await cli.getByRole("radio", { name: /5 estrelas/ }).click();
    await cli.getByRole("button", { name: "Enviar avaliação" }).click();
    await expect(cli.getByText("Obrigado pela avaliação!").first()).toBeVisible();
    const { data: avaliado } = await sa
      .from("chamados")
      .select("avaliacao_nota")
      .eq("id", chamado.id)
      .single();
    expect(avaliado?.avaliacao_nota).toBe(5);
    await ctx.close();
  });

  test("assinatura remota por link, uso único, e reabertura pelo admin", async ({
    page,
    browser,
    isMobile,
  }) => {
    test.skip(isMobile, "cenário do link roda no desktop");
    test.setTimeout(180_000);
    const sufixo = Date.now().toString(36).toUpperCase();
    const chamado = await criarChamado(`[E2E] OS por link ${sufixo}`);
    criados.push(chamado.id);

    await entrar(page, DEMO.users.tecnico.email, SENHA);
    await page.goto(`/tecnico/chamados/${chamado.id}`);
    await page.getByRole("button", { name: "Iniciar atendimento" }).click();
    await expect(page).toHaveURL(/\/tecnico\/os\/[0-9a-f-]{36}$/);
    const osId = page.url().split("/").pop()!;
    await page.getByLabel("Serviço executado").fill("Ajuste no motor do portão e lubrificação.");
    await expect(page.getByRole("status").filter({ hasText: /salvo/i })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Concluir e assinar" }).click();
    await expect(page).toHaveURL(new RegExp(`/tecnico/os/${osId}/assinatura$`), { timeout: 20_000 });

    // Técnico assina (desenhando, se não houver assinatura salva) e gera o link
    await assinarComoTecnico(page);
    await page.getByRole("tab", { name: /Link/ }).click();
    await page.getByRole("button", { name: "Gerar link de assinatura" }).click();
    const campo = page.getByRole("textbox", { name: "Link" });
    await expect(campo).toBeVisible({ timeout: 20_000 });
    const link = await campo.inputValue();
    expect(link).toMatch(/\/assinar\/[A-Za-z0-9_-]{40,}$/);

    // Cliente assina pelo link, sem login
    const ctx = await browser.newContext();
    const pub = await ctx.newPage();
    await pub.goto(link);
    await expect(pub.getByRole("heading", { name: /Ordem de serviço OS-/ })).toBeVisible();
    await pub.getByLabel("Nome de quem assina").fill("Gerente Remoto E2E");
    await assinar(pub, pub.getByRole("img", { name: "Assinatura do cliente" }));
    await pub.getByRole("checkbox", { name: /Li e concordo/ }).click();
    await pub.getByRole("button", { name: "Assinar ordem de serviço" }).click();
    await expect(pub.getByText("Assinatura registrada. Obrigado!").first()).toBeVisible({ timeout: 60_000 });
    await expect(pub.getByRole("link", { name: "Baixar PDF" })).toBeVisible();

    // Link de uso único
    const pub2 = await ctx.newPage();
    await pub2.goto(link);
    await expect(pub2.getByText("Esta ordem de serviço já foi assinada.")).toBeVisible();

    const sa = admin();
    const { data: assinada } = await sa.from("ordens_servico").select("status").eq("id", osId).single();
    expect(assinada?.status).toBe("assinada");
    const { data: remota } = await sa
      .from("os_assinaturas")
      .select("remota, nome_signatario")
      .eq("os_id", osId)
      .eq("tipo", "cliente")
      .single();
    expect(remota?.remota).toBe(true);

    // Admin reabre a OS (com motivo): assinaturas invalidadas, chamado volta para atendimento
    const adm = await browser.newContext();
    const a = await adm.newPage();
    await entrar(a, process.env.SEED_ADMIN_EMAIL!, process.env.SEED_ADMIN_PASSWORD!);
    await a.goto(`/admin/os/${osId}`);
    await a.getByRole("button", { name: "Reabrir OS" }).click();
    await a.getByLabel("Motivo").fill("Cliente pediu correção no texto (teste E2E)");
    await a.getByRole("button", { name: "Reabrir", exact: true }).click();
    await expect(a.getByText(/OS reaberta/)).toBeVisible();
    const { data: reaberta } = await sa
      .from("ordens_servico")
      .select("status, finalizada_em")
      .eq("id", osId)
      .single();
    expect(reaberta?.status).toBe("em_execucao");
    expect(reaberta?.finalizada_em).toBeNull();
    const { count: validas } = await sa
      .from("os_assinaturas")
      .select("id", { count: "exact", head: true })
      .eq("os_id", osId)
      .is("invalidada_em", null);
    expect(validas).toBe(0);
    const { data: ch } = await sa.from("chamados").select("status").eq("id", chamado.id).single();
    expect(ch?.status).toBe("em_atendimento");

    await ctx.close();
    await adm.close();
  });
});
