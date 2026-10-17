import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { gerarCsvSecoes, gerarXlsxSecoes, nomeArquivo } from "@/lib/export";
import { resolverPeriodo } from "@/lib/periodo";
import { RELATORIO_POR_ID } from "@/lib/relatorios";
import { carregarRelatorio, gerarPdfRelatorio, secoesParaExportacao } from "@/lib/relatorios-server";

export const maxDuration = 60;

/** Exporta um relatório (CSV, XLSX ou PDF) para o período pedido. Somente admin. */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/relatorios/[id]">) {
  const perfil = await getCurrentProfile();
  if (!perfil || perfil.role !== "admin")
    return NextResponse.json({ erro: "Acesso negado" }, { status: 403 });

  const { id } = await params;
  const def = RELATORIO_POR_ID.get(id);
  if (!def) return NextResponse.json({ erro: "Relatório não encontrado" }, { status: 404 });

  const sp = request.nextUrl.searchParams;
  const periodo = resolverPeriodo({
    periodo: sp.get("periodo") ?? undefined,
    de: sp.get("de") ?? undefined,
    ate: sp.get("ate") ?? undefined,
  });
  const formato = sp.get("formato") ?? "csv";
  const secoes = await carregarRelatorio(def, periodo);
  if (secoes.some((s) => s.erro)) {
    return NextResponse.json({ erro: "Não foi possível gerar o relatório" }, { status: 500 });
  }
  const arquivo = nomeArquivo("relatorio", def.titulo, periodo.deData, periodo.ateData);
  const titulo = `${def.titulo} — ${periodo.rotulo}`;
  const base = { "Cache-Control": "no-store" };

  if (formato === "pdf") {
    const pdf = await gerarPdfRelatorio(def, periodo, secoes);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        ...base,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${arquivo}.pdf"`,
      },
    });
  }
  const exportar = secoesParaExportacao(secoes);
  if (formato === "xlsx") {
    const buf = await gerarXlsxSecoes(def.titulo, exportar);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        ...base,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${arquivo}.xlsx"`,
      },
    });
  }
  if (formato === "csv") {
    return new NextResponse(gerarCsvSecoes(titulo, exportar), {
      headers: {
        ...base,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${arquivo}.csv"`,
      },
    });
  }
  return NextResponse.json({ erro: "Formato inválido" }, { status: 400 });
}
